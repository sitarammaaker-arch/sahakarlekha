// Restore row writer (T-33 wiring / gap EXP-01).
//
// This is the code that actually rewrites a society's books — the single most destructive
// operation in the product. The dangerous decisions (what to insert, what to DELETE) live
// in a pure planner, so they are unit-tested here exhaustively; the executor is driven by a
// mock client that records every call, so society_id scoping and chunking are proven without
// touching a database.
//
// The one property that matters most: a delete NEVER runs without the society filter. On the
// 35 tables whose RLS is `using (true)`, that filter is the only thing between a restore and
// another society's data.
//
// Run: node scripts/test-restore-writer.mjs   (npm run test:restore-writer)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
      export async function load(url, ctx, next) {
        if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let mod, reg;
try {
  mod = await import(abs('../src/lib/restore/rowWriter.ts'));
  reg = await import(abs('../src/lib/export/registry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the restore writer.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { planEntityWrites, applyEntityWrites, makeRestoreWriter, RestoreWriteError } = mod;
const { getEntity } = reg;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const throws = (fn, msg, match) => {
  let e = null;
  try { fn(); } catch (err) { e = err; }
  ok(e && (!match || String(e.message).includes(match)), `${msg} (got: ${e ? e.message.slice(0, 70) : 'no throw'})`);
};

// Real entities: 'member' (naturalKey ['memberId']), 'tds_challan_link' (composite).
const member = getEntity('member');
const composite = getEntity('tds_challan_link');
ok(!!member && member.naturalKey.length === 1, 'member has a single-column natural key');
ok(!!composite && composite.naturalKey.length === 2, 'tds_challan_link has a composite natural key');

/** A mock client that records every operation and can be told to fail a table. */
function mockClient({ failOn = null } = {}) {
  const calls = [];
  const client = {
    from(table) {
      return {
        async insert(rows) { calls.push({ op: 'insert', table, count: rows.length, rows }); return err(table); },
        async upsert(rows) { calls.push({ op: 'upsert', table, count: rows.length, rows }); return err(table); },
        delete() {
          const filters = {};
          const b = {
            eq(col, val) { filters[col] = val; return b; },
            async in(col, vals) { calls.push({ op: 'delete', table, filters: { ...filters }, in: { col, vals } }); return err(table); },
            async match(criteria) { calls.push({ op: 'delete', table, filters: { ...filters }, match: criteria }); return err(table); },
          };
          return b;
        },
      };
    },
  };
  const err = (table) => ({ error: table === failOn ? { message: 'boom' } : null });
  client.calls = calls;
  return client;
}

// ── 1. THE PLANNER, PER MODE ─────────────────────────────────────────────────

const archive = [{ memberId: 'M1', name: 'क' }, { memberId: 'M2', name: 'ख' }, { memberId: 'M3', name: 'ग' }];
const live = [{ memberId: 'M1', name: 'क' }, { memberId: 'M2', name: 'CHANGED' }, { memberId: 'M9', name: 'only live' }];

const fresh = planEntityWrites(member, archive, [], 'fresh');
ok(fresh.insert.length === 3 && fresh.upsert.length === 0 && fresh.deleteKeys.length === 0,
  'Fresh inserts every archived row, deletes nothing');

const merge = planEntityWrites(member, archive, live, 'merge');
ok(merge.insert.length === 1 && merge.insert[0].memberId === 'M3',
  'Merge inserts only the row the society does not have (M3)');
ok(merge.deleteKeys.length === 0 && merge.upsert.length === 0,
  'Merge keeps existing rows untouched — including the one that differs (M2), and never deletes');

const replace = planEntityWrites(member, archive, live, 'replace');
ok(replace.upsert.length === 3, 'Replace upserts every archived row, overwriting');
ok(replace.deleteKeys.length === 1 && replace.deleteKeys[0].memberId === 'M9',
  'Replace DELETES the orphan the archive does not carry (M9)');
ok(replace.insert.length === 0, 'Replace uses upsert, not insert');

// The orphan delete-key is the natural key, so the executor can scope it.
ok(Object.keys(replace.deleteKeys[0]).join() === 'memberId', 'the delete key is exactly the natural key');

// Keyless live rows are never deleted — the diff already flags them, and a restore must not
// silently destroy a row it cannot identify.
const withKeyless = planEntityWrites(member, archive, [...live, { name: 'no id' }], 'replace');
ok(withKeyless.deleteKeys.length === 1, 'a keyless live row is NOT scheduled for deletion');

// voucher_entries can never be written here.
throws(() => planEntityWrites(getEntity('voucher_entry'), archive, [], 'replace'),
  'voucher_entries are refused by the planner', 'replayed, never written');

// ── 2. THE EXECUTOR — society scoping is the whole point ──────────────────────

{
  const client = mockClient();
  const out = await applyEntityWrites(member, replace, client, 'SOC1');
  ok(out.written === 3, 'the executor reports how many rows were written');

  const del = client.calls.find(c => c.op === 'delete');
  ok(del && del.filters.society_id === 'SOC1',
    'EVERY orphan delete is scoped to the society — the only tenant boundary on using(true) tables');
  ok(del.in && del.in.col === 'memberId' && del.in.vals.join() === 'M9',
    'and deletes exactly the orphan, by its natural key');

  const up = client.calls.find(c => c.op === 'upsert');
  ok(up && up.rows.every(r => r.society_id === 'SOC1'), 'every upserted row is stamped with the society');

  // Order: the delete runs before the upsert.
  ok(client.calls.findIndex(c => c.op === 'delete') < client.calls.findIndex(c => c.op === 'upsert'),
    'orphans are deleted before new rows are written');
}

// A composite natural key deletes by matching every key field AND the society.
{
  const cArchive = [{ society_id: 'SOC1', entryId: 'E1' }];
  const cLive = [{ society_id: 'SOC1', entryId: 'E1' }, { society_id: 'SOC1', entryId: 'E2' }];
  const plan = planEntityWrites(composite, cArchive, cLive, 'replace');
  ok(plan.deleteKeys.length === 1 && plan.deleteKeys[0].entryId === 'E2', 'the composite orphan is planned');
  const client = mockClient();
  await applyEntityWrites(composite, plan, client, 'SOC1');
  const del = client.calls.find(c => c.op === 'delete');
  ok(del && del.match && del.match.entryId === 'E2' && del.match.society_id === 'SOC1',
    'a composite delete matches the full key AND the society');
}

// REFUSAL: the executor will not write without a society id.
{
  let threw = null;
  try { await applyEntityWrites(member, fresh, mockClient(), ''); } catch (e) { threw = e; }
  ok(threw instanceof RestoreWriteError && threw.message.includes('tenant boundary'),
    'the executor refuses to write without a society id');
}

// ── 3. CHUNKING — a large table does not become one giant payload ────────────

{
  const big = Array.from({ length: 1250 }, (_, i) => ({ memberId: `M${i}`, name: 'x' }));
  const client = mockClient();
  const out = await applyEntityWrites(member, { insert: big, upsert: [], deleteKeys: [] }, client, 'SOC1');
  ok(out.written === 1250, 'all rows are written');
  const inserts = client.calls.filter(c => c.op === 'insert');
  ok(inserts.length === 3 && inserts[0].count === 500 && inserts[2].count === 250,
    'inserts are chunked at 500 (500 + 500 + 250)');
}

// Orphan deletes chunk too.
{
  const bigLive = Array.from({ length: 700 }, (_, i) => ({ memberId: `X${i}` }));
  const plan = planEntityWrites(member, [], bigLive, 'replace');
  ok(plan.deleteKeys.length === 700, 'all orphans are planned for deletion');
  const client = mockClient();
  await applyEntityWrites(member, plan, client, 'SOC1');
  const dels = client.calls.filter(c => c.op === 'delete');
  ok(dels.length === 2 && dels.every(d => d.filters.society_id === 'SOC1'), 'orphan deletes chunk, each still society-scoped');
}

// ── 4. FAILURE STOPS, LOUDLY ─────────────────────────────────────────────────

{
  let threw = null;
  try { await applyEntityWrites(member, { insert: archive, upsert: [], deleteKeys: [] }, mockClient({ failOn: member.table }), 'SOC1'); }
  catch (e) { threw = e; }
  ok(threw instanceof RestoreWriteError && threw.table === member.table,
    'a failed write throws RestoreWriteError naming the table — the saga turns this into a partial restore');
}

// ── 5. THE SAGA ADAPTER ──────────────────────────────────────────────────────

{
  const client = mockClient();
  const writer = makeRestoreWriter(client, 'SOC1', { member: live });
  const out = await writer(member, archive, 'replace');
  ok(out.written === 3, 'makeRestoreWriter plans from the captured live rows and executes');
  ok(client.calls.some(c => c.op === 'delete' && c.in?.vals.join() === 'M9'),
    'and deletes the orphan the live rows revealed');
}

// ── 6. PURITY OF THE PLANNER ─────────────────────────────────────────────────

const raw = readFileSync(pathResolve(SRC, 'lib', 'restore', 'rowWriter.ts'), 'utf8');
const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(src.includes('planEntityWrites') && src.length > 1500, 'the scan sees real code');
// The planner must not import Supabase; only the executor touches a (injected) client.
ok(!/from ['"]@\/lib\/supabase['"]/.test(src), 'the writer never imports the Supabase client — the client is injected');
// Every delete in the source is society-scoped: no `.delete()` chain lacks `.eq('society_id'`.
const deleteChains = src.match(/\.delete\(\)[^;]*/g) || [];
ok(deleteChains.length > 0 && deleteChains.every(c => c.includes("eq('society_id'")),
  'EVERY delete in the source is scoped by society_id — none can reach another tenant');

console.log(`\nRestore writer: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
