// Registry-driven row source (T-16a) — imports the real module and asserts:
//
//   1. `exclude` entities cannot be read, even by a caller that skipped authorizeExport
//   2. every read is scoped to one society (35 of the schema's policies are `using (true)`,
//      so this filter is the only tenant boundary on those tables)
//   3. paging orders by the naturalKey — five entities have no `id` column, and ordering
//      by a non-unique column silently skips and repeats rows across page boundaries
//   4. NO SILENT CAPS: hitting maxRows reports `truncated: true`, and a table holding
//      exactly maxRows rows is reported complete
//
// Supabase is stubbed through the loader (src/lib/supabase.ts reads import.meta.env),
// and a fake client is injected so we can observe the exact queries built.
//
// Run: node scripts/test-export-source.mjs   (npm run test:export-source)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

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
        if (url === SUPABASE) {
          return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        }
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let src, reg;
try {
  src = await import(abs('../src/lib/export/source.ts'));
  reg = await import(abs('../src/lib/export/registry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/export/source.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}
const { fetchEntityRows, orderColumns, assertReadable, EntityNotReadableError, PAGE_SIZE, DEFAULT_MAX_ROWS } = src;
const { getEntity } = reg;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

/**
 * Fake PostgREST. `total` rows exist; every `.range(from,to)` returns the slice.
 * Records each query so we can assert what was actually built.
 */
function fakeClient(total, { error = null } = {}) {
  const queries = [];
  const client = {
    queries,
    from(table) {
      const q = { table, eq: [], order: [], range: null };
      queries.push(q);
      const b = {
        select() { return b; },
        eq(k, v) { q.eq.push([k, v]); return b; },
        order(c) { q.order.push(c); return b; },
        range(from, to) {
          q.range = [from, to];
          if (error) return Promise.resolve({ data: null, error: { message: error } });
          const slice = [];
          for (let i = from; i <= to && i < total; i++) slice.push({ id: `r${i}` });
          return Promise.resolve({ data: slice, error: null });
        },
      };
      return b;
    },
  };
  return client;
}

const member = getEntity('member');
const userMfa = getEntity('user_mfa');
const societies = getEntity('societies');
const counter = getEntity('procurement_jform_counter');
const link = getEntity('tds_challan_link');

// ── 1. Custody: excluded and global entities are unreadable ──────────────────
let threw = null;
try { assertReadable(userMfa); } catch (e) { threw = e; }
ok(threw instanceof EntityNotReadableError, 'user_mfa (TOTP secrets) cannot be read — defence in depth, independent of authorizeExport');

threw = null;
try { assertReadable(societies); } catch (e) { threw = e; }
ok(threw instanceof EntityNotReadableError, 'the cross-tenant societies registry cannot be read');

ok(assertReadable(member) === undefined, 'a normal entity is readable');

let rejected = false;
await fetchEntityRows(userMfa, 'SOC-A', { client: fakeClient(5) }).catch(e => { rejected = e instanceof EntityNotReadableError; });
ok(rejected, 'fetchEntityRows itself refuses an excluded entity');

// ── 2. Ordering by naturalKey, because five entities have no `id` ────────────
ok(orderColumns(member).join(',') === 'memberId', 'members page by memberId');
ok(orderColumns(counter).join(',') === 'society_id', 'the J-Form counter has no id column — it pages by society_id');
ok(orderColumns(link).join(',') === 'society_id,entryId', 'tds_challan_links pages by its composite key');
ok(!member.columns.some(c => c.key === 'id' && c.defaultVisible), 'sanity: member.id exists but is hidden — ordering does not depend on it being visible');

// ── 3. The tenant boundary ───────────────────────────────────────────────────
let c = fakeClient(3);
let res = await fetchEntityRows(member, 'SOC-A', { client: c });
ok(res.rows.length === 3 && res.error === null, 'a short table comes back whole');
ok(res.truncated === false && res.fetched === 3, 'a short table is not truncated');

const q0 = c.queries[0];
ok(q0.table === 'members', 'reads the table the registry declares');
ok(Object.fromEntries(q0.eq).society_id === 'SOC-A', 'EVERY READ IS SCOPED TO ONE SOCIETY — the only tenant boundary on 35 tables');
ok(q0.order.join(',') === 'memberId', 'paging orders by the natural key, so pages cannot skip or repeat rows');
ok(q0.range[0] === 0 && q0.range[1] === PAGE_SIZE - 1, `the first page asks for rows 0..${PAGE_SIZE - 1}`);

// ── 4. Paging ────────────────────────────────────────────────────────────────
c = fakeClient(PAGE_SIZE + 7);
res = await fetchEntityRows(member, 'SOC-A', { client: c });
ok(res.rows.length === PAGE_SIZE + 7, 'a table spanning two pages comes back whole');
ok(c.queries.length === 2, 'exactly two page reads were issued');
ok(c.queries[1].range[0] === PAGE_SIZE, 'the second page starts where the first ended');
ok(new Set(res.rows.map(r => r.id)).size === res.rows.length, 'no row is fetched twice');

c = fakeClient(PAGE_SIZE);
res = await fetchEntityRows(member, 'SOC-A', { client: c });
ok(res.rows.length === PAGE_SIZE && !res.truncated, 'a table that is exactly one page long stops after one full page + nothing more');

// ── 5. NO SILENT CAPS (blueprint P7) ─────────────────────────────────────────
// DataContext's fetchAllPaged stops after 200 pages and says nothing. That is data loss
// with a success toast. Here, hitting the cap must be REPORTED.
c = fakeClient(25);
res = await fetchEntityRows(member, 'SOC-A', { client: c, maxRows: 10 });
ok(res.rows.length === 10, 'the cap is honoured');
ok(res.truncated === true, 'HITTING THE CAP IS REPORTED — the caller must not pretend the export is complete');
ok(res.fetched === 10, 'fetched counts what was actually read');

// The boundary case that a naive implementation gets wrong.
c = fakeClient(10);
res = await fetchEntityRows(member, 'SOC-A', { client: c, maxRows: 10 });
ok(res.rows.length === 10, 'a table holding exactly maxRows rows returns all of them');
ok(res.truncated === false, 'a table holding EXACTLY maxRows rows is COMPLETE, not truncated — refusing it would be a false alarm');

c = fakeClient(11);
res = await fetchEntityRows(member, 'SOC-A', { client: c, maxRows: 10 });
ok(res.truncated === true, 'one row past the cap is enough to report truncation');

ok(DEFAULT_MAX_ROWS >= 10_000, 'the default cap is generous enough not to fire on ordinary societies');

// ── 6. Errors surface, and never as an empty table ───────────────────────────
c = fakeClient(5, { error: 'permission denied' });
res = await fetchEntityRows(member, 'SOC-A', { client: c });
ok(res.error === 'permission denied', 'a read failure returns the error');
ok(res.rows.length === 0 && res.truncated === false, 'a failed read yields no rows and no false truncation claim');

console.log(`\nExport source (pure + wired): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
