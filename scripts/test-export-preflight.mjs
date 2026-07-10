// Export preflight (T-17 / gap EXP-11) — imports the real module and asserts:
//
//   1. the count is taken with `head: true` — NO ROWS are read to count rows. A preflight
//      that fetches the table to measure it has become the problem it prevents.
//   2. the count is scoped to one society (35 of the schema's policies are `using (true)`)
//   3. `exclude` entities cannot even be counted
//   4. the boundary: a table holding EXACTLY maxRows rows is allowed, not refused
//
// Run: node scripts/test-export-preflight.mjs   (npm run test:export-preflight)

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

let pf, srcMod, reg;
try {
  pf = await import(abs('../src/lib/export/preflight.ts'));
  srcMod = await import(abs('../src/lib/export/source.ts'));
  reg = await import(abs('../src/lib/export/registry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/export/preflight.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}
const { estimateBytes, formatBytes, assessExport, countEntityRows, preflightExport } = pf;
const { DEFAULT_MAX_ROWS, EntityNotReadableError } = srcMod;
const { getEntity } = reg;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

/** Fake PostgREST that records exactly how the count was asked for. */
function fakeClient(count, { error = null } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, select: null, options: null, eq: [] };
      calls.push(call);
      const b = {
        select(cols, options) { call.select = cols; call.options = options; return b; },
        eq(k, v) {
          call.eq.push([k, v]);
          return error
            ? Promise.resolve({ count: null, data: null, error: { message: error } })
            : Promise.resolve({ count, data: null, error: null });
        },
      };
      return b;
    },
  };
}

const member = getEntity('member');
const userMfa = getEntity('user_mfa');

// ── 1. THE COUNT READS NO ROWS ───────────────────────────────────────────────
let c = fakeClient(1345);
let res = await countEntityRows(member, 'SOC-A', { client: c });
ok(res.count === 1345 && res.error === null, 'the count comes back');

const call = c.calls[0];
ok(call.table === 'members', 'counts the table the registry declares');
ok(call.options?.head === true, 'HEAD REQUEST: no rows are read in order to count rows');
ok(call.options?.count === 'exact', 'an exact count is requested, not an estimate');
ok(Object.fromEntries(call.eq).society_id === 'SOC-A', 'the count is scoped to one society');
ok(res.count > 0 && c.calls.length === 1, 'exactly one round-trip');

// ── 2. Custody: an excluded entity cannot even be counted ────────────────────
let threw = null;
try { await countEntityRows(userMfa, 'SOC-A', { client: fakeClient(3) }); } catch (e) { threw = e; }
ok(threw instanceof EntityNotReadableError, 'user_mfa cannot be counted — the row count is itself information');

// ── 3. Size estimate ─────────────────────────────────────────────────────────
ok(estimateBytes(0, 10, 'csv') === 0, 'an empty table estimates zero bytes');
ok(estimateBytes(100, 10, 'csv') > 0, 'a non-empty table estimates something');
ok(estimateBytes(100, 10, 'xlsx') < estimateBytes(100, 10, 'csv'), 'xlsx (zipped) estimates smaller than csv');
ok(estimateBytes(100, 10, 'json') > estimateBytes(100, 10, 'csv'), 'json (keys repeated per row) estimates larger than csv');
ok(estimateBytes(200, 10, 'csv') === 2 * estimateBytes(100, 10, 'csv'), 'the estimate is linear in rows');
ok(estimateBytes(100, 20, 'csv') === 2 * estimateBytes(100, 10, 'csv'), 'the estimate is linear in columns');
ok(estimateBytes(100, 10, 'pdf') === estimateBytes(100, 10, 'csv'), 'an unknown format falls back to the csv weight rather than NaN');

ok(formatBytes(512) === '512 B', 'bytes below 1 KiB are shown as bytes');
ok(formatBytes(1024) === '1.0 KB', 'exactly 1 KiB');
ok(formatBytes(1536) === '1.5 KB', 'one decimal, no false precision');
ok(formatBytes(5 * 1024 * 1024) === '5.0 MB', 'megabytes');
ok(formatBytes(3 * 1024 ** 3) === '3.0 GB', 'gigabytes, and it does not run past the unit list');

// ── 4. The decision, and the boundary a naive check gets wrong ───────────────
const small = assessExport({ rowCount: 100, columnCount: 10, format: 'csv' });
ok(small.canExportInline === true && !small.reason, 'a small table exports inline, with no reason to show');
ok(small.estimatedBytes === estimateBytes(100, 10, 'csv'), 'the assessment carries the estimate');

const exact = assessExport({ rowCount: 10, columnCount: 5, format: 'csv', maxRows: 10 });
ok(exact.canExportInline === true, 'a table holding EXACTLY maxRows rows is allowed — refusing it would be a false alarm');

const over = assessExport({ rowCount: 11, columnCount: 5, format: 'csv', maxRows: 10 });
ok(over.canExportInline === false, 'one row past the cap refuses the inline export');
ok(typeof over.reason === 'string' && over.reason.includes('11'), 'the refusal says how many rows there are');
ok(over.rowCount === 11, 'the refusal still reports the count, so the user knows the scale');

ok(assessExport({ rowCount: DEFAULT_MAX_ROWS, columnCount: 5, format: 'csv' }).canExportInline === true,
  'the default cap itself is allowed');
ok(assessExport({ rowCount: DEFAULT_MAX_ROWS + 1, columnCount: 5, format: 'csv' }).canExportInline === false,
  'one past the default cap is refused');

// ── 5. The one call the Export Center makes ──────────────────────────────────
c = fakeClient(42);
let pfRes = await preflightExport(member, 'SOC-A', 8, 'csv', { client: c });
ok(pfRes.error === null && pfRes.result.rowCount === 42, 'preflightExport counts then judges');
ok(pfRes.result.canExportInline === true, 'a 42-row table is fine');
ok(c.calls[0].options?.head === true, 'preflightExport still reads no rows');

c = fakeClient(DEFAULT_MAX_ROWS + 1);
pfRes = await preflightExport(member, 'SOC-A', 8, 'csv', { client: c });
ok(pfRes.result.canExportInline === false, 'a huge table is refused before a single row is fetched');

// ── 6. Errors surface, and never as "zero rows" ──────────────────────────────
c = fakeClient(0, { error: 'permission denied' });
res = await countEntityRows(member, 'SOC-A', { client: c });
ok(res.error === 'permission denied', 'a count failure returns the error');

pfRes = await preflightExport(member, 'SOC-A', 8, 'csv', { client: fakeClient(0, { error: 'boom' }) });
ok(pfRes.error === 'boom' && pfRes.result === null, 'a failed preflight returns no result — never a confident "0 rows"');

console.log(`\nExport preflight (pure + wired): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
