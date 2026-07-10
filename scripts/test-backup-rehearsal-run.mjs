// Client-side rehearsal runner (T-35, client-side realization / gap EXP-04).
//
// The runner proves a backup restores to the same books — in the browser, no shadow society,
// no server. loadArchive and fetchRows are injected, so the SEQUENCE is testable without
// Supabase: verify the archive, replay its ledger, read the live rows (abort on any partial
// read), replay theirs, compare. It writes nothing.
//
// Run: node scripts/test-backup-rehearsal-run.mjs   (npm run test:backup-rehearsal-run)

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
  mod = await import(abs('../src/lib/backup/rehearsalRun.ts'));
  reg = await import(abs('../src/lib/export/registry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the rehearsal runner.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { runRehearsal, summarizeRun } = mod;
const { REGISTRY } = reg;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const NOW = '2026-07-10T00:00:00Z';

// A tiny balanced society: one voucher (1500 Dr 1101 / 1500 Cr 4101), one stock item.
const vouchers = [{
  id: 'V1', isDeleted: false, amount: 0,
  lines: [
    { id: 'L1', accountId: '1101', type: 'Dr', amount: 1500 },
    { id: 'L2', accountId: '4101', type: 'Cr', amount: 1500 },
  ],
}];
const stockItems = [{ id: 'I1', openingStock: 10 }];
const stockMovements = [{ itemId: 'I1', type: 'purchase', qty: 5 }];

/** A loadArchive spy returning a verified archive with the given rows. */
const loadOk = (rows) => async () => ({ report: { ok: true, problems: [] }, rows, unplaceable: [], problems: [] });
/** A fetchRows spy returning live rows per entity key. */
const fetchLive = (rows) => async (entity) => ({ rows: rows[entity.key] ?? [], truncated: false, error: null });

function baseInput(over = {}) {
  return {
    bytes: new Uint8Array([1]),
    societyId: 'SOC1',
    entities: REGISTRY,
    now: NOW,
    loadArchive: loadOk({ voucher: vouchers, stock_item: stockItems, stock_movement: stockMovements }),
    fetchRows: fetchLive({ voucher: vouchers, stock_item: stockItems, stock_movement: stockMovements }),
    ...over,
  };
}

// ── 1. A CURRENT BACKUP PASSES ───────────────────────────────────────────────

{
  const out = await runRehearsal(baseInput());
  ok(out.status === 'passed', 'a backup that reproduces the live books passes');
  ok(out.verdict.ok === true && out.verdict.differences.length === 0, 'with no differences');
  ok(out.live.balanced && out.restored.balanced, 'both sides balance');
  ok(out.health.status === 'green', 'and a passing rehearsal makes the health card green');
  ok(out.health.proven === true, 'the backup is now proven');
  ok(summarizeRun(out, false).includes('reproduce the current books exactly'), 'the summary says it passed');
}

// ── 2. A STALE BACKUP FAILS — the core value ─────────────────────────────────
//
// The live society gained a voucher after the backup was taken. Restoring the backup would
// NOT reproduce today's books, and the rehearsal must catch it.

{
  const liveVouchers = [...vouchers, {
    id: 'V2', isDeleted: false, amount: 0,
    lines: [{ id: 'L1', accountId: '1101', type: 'Dr', amount: 700 }, { id: 'L2', accountId: '5101', type: 'Cr', amount: 700 }],
  }];
  const out = await runRehearsal(baseInput({
    fetchRows: fetchLive({ voucher: liveVouchers, stock_item: stockItems, stock_movement: stockMovements }),
  }));
  ok(out.status === 'failed', 'a backup missing a voucher the live books have FAILS the rehearsal');
  ok(out.verdict.accounts.includes('5101'), 'and names the account only the live books have');
  ok(out.health.status !== 'green', 'a failed rehearsal is never green');
  ok(summarizeRun(out, false).includes('stale or incomplete'), 'the summary explains the likely cause');
}

// A stock difference is caught too.
{
  const out = await runRehearsal(baseInput({
    fetchRows: fetchLive({ voucher: vouchers, stock_item: stockItems, stock_movement: [{ itemId: 'I1', type: 'purchase', qty: 9 }] }),
  }));
  ok(out.status === 'failed' && out.verdict.items.includes('I1'), 'a stock position that differs fails the rehearsal');
}

// A soft-deleted voucher in the backup must not resurrect into the rehearsed books (RULE 5).
{
  const withCancelled = [...vouchers, { id: 'V9', isDeleted: true, lines: [{ id: 'L1', accountId: '1101', type: 'Dr', amount: 999 }, { id: 'L2', accountId: '4101', type: 'Cr', amount: 999 }] }];
  const out = await runRehearsal(baseInput({
    loadArchive: loadOk({ voucher: withCancelled, stock_item: stockItems, stock_movement: stockMovements }),
  }));
  ok(out.status === 'passed', 'a cancelled voucher in the backup produces no entries — it does not break the match (RULE 5)');
}

// ── 3. A CORRUPT ARCHIVE HAS NOTHING TO REHEARSE ─────────────────────────────

{
  const out = await runRehearsal(baseInput({
    loadArchive: async () => ({ report: { ok: false, problems: ['member.ndjson: hash-mismatch'] }, rows: {}, unplaceable: [], problems: [] }),
  }));
  ok(out.status === 'archive-invalid', 'a backup that did not verify is not rehearsed');
  ok(out.problems[0].includes('hash-mismatch'), 'and the verification problem is surfaced');
}

// A verified archive whose rows would not parse (loadArchive problems) also aborts.
{
  const out = await runRehearsal(baseInput({
    loadArchive: async () => ({ report: { ok: true, problems: [] }, rows: {}, unplaceable: [], problems: ['voucher: promised 5 rows but the file holds 2'] }),
  }));
  ok(out.status === 'archive-invalid' && out.problems[0].includes('promised 5'), 'a load problem aborts the rehearsal');
}

// ── 4. A PARTIAL LIVE READ ABORTS — never compare against half the books ─────

{
  const out = await runRehearsal(baseInput({
    fetchRows: async (entity) => (entity.key === 'stock_movement'
      ? { rows: [], truncated: true, error: null }
      : { rows: [], truncated: false, error: null }),
  }));
  ok(out.status === 'read-failed' && out.entityKey === 'stock_movement',
    'a truncated live read aborts the rehearsal, naming the table — a partial comparison would be a lie');
}
{
  const out = await runRehearsal(baseInput({
    fetchRows: async (entity) => (entity.key === 'voucher'
      ? { rows: [], truncated: false, error: 'permission denied' }
      : { rows: [], truncated: false, error: null }),
  }));
  ok(out.status === 'read-failed' && out.entityKey === 'voucher', 'a failed live read aborts too');
}

// ── 5. IT READS, IT NEVER WRITES ─────────────────────────────────────────────

const raw = readFileSync(pathResolve(SRC, 'lib', 'backup', 'rehearsalRun.ts'), 'utf8');
const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(src.includes('runRehearsal') && src.length > 1500, 'the scan sees real code, not a blanked file');
for (const forbidden of ['.insert(', '.update(', '.delete(', '.upsert(', '.rpc(', 'Date.now', 'Math.random']) {
  ok(!src.includes(forbidden), `the runner reads and never writes / is deterministic (found "${forbidden}")`);
}
// It must replay through the shared posting rule, not inline one.
ok(src.includes('replayEntries') && !/dr:\s*l\.type === 'Dr'/.test(src),
  'it replays through the shared posting rule (RULE 2), never a second copy');
ok(!/from ['"]@\/lib\/supabase['"]/.test(src), 'and never imports the Supabase client directly — I/O is injected');

console.log(`\nRehearsal runner: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
