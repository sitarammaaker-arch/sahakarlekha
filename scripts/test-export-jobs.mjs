// Export History (T-15 / gap EXP-05) — imports the real module and asserts:
//
//   1. every audit row shapes into a history entry, however old or malformed
//   2. the society_id filter is actually applied (audit_log's SELECT policy is
//      `using (true)`, so that filter is the ONLY tenant isolation on the query)
//
// (2) is proved behaviourally: Supabase is stubbed via a loader hook and records the
// chained calls. Remove `.eq('society_id', ...)` and this file goes red.
//
// Run: node scripts/test-export-jobs.mjs   (npm run test:export-jobs)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

// src/lib/supabase.ts reads import.meta.env, which does not exist outside Vite. Stub it,
// and use the stub to observe exactly which query was built.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;

      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }

      export async function load(url, ctx, next) {
        if (url === SUPABASE) {
          return {
            format: 'module',
            shortCircuit: true,
            source: \`
              export const supabase = {
                from(table) {
                  const calls = { table, select: null, eq: [], order: null, limit: null };
                  globalThis.__q = calls;
                  const b = {
                    select(cols) { calls.select = cols; return b; },
                    eq(k, v) { calls.eq.push([k, v]); return b; },
                    order(k, o) { calls.order = [k, o]; return b; },
                    limit(n) { calls.limit = n; return Promise.resolve(globalThis.__result ?? { data: [], error: null }); },
                  };
                  return b;
                },
              };
            \`,
          };
        }
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let jobs;
try {
  jobs = await import(abs('../src/lib/export/jobs.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/export/jobs.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}
const { toExportHistoryEntry, describeExport, mayContainPii, listExportHistory } = jobs;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const AUDIT_ROW = {
  id: 'uuid-1',
  entity_id: 'exp-member-csv-20260710T083012-abc123',
  created_at: '2026-07-10T08:30:12.000Z',
  actor_name: 'राजेश',
  actor_email: 'a@b.com',
  actor_role: 'admin',
  after: {
    entities: ['member'],
    format: 'csv',
    mode: 'full',
    rowCount: 1345,
    filters: { includeDeleted: true },
    artifactSha256: null,
    byteSize: null,
  },
};

// ── 1. Shaping ───────────────────────────────────────────────────────────────
const e = toExportHistoryEntry(AUDIT_ROW);
ok(e.exportId === AUDIT_ROW.entity_id, 'the export id comes from entity_id');
ok(e.at === '2026-07-10T08:30:12.000Z', 'timestamp preserved');
ok(e.actorName === 'राजेश' && e.actorEmail === 'a@b.com' && e.actorRole === 'admin', 'WHO is preserved');
ok(e.entities.join(',') === 'member' && e.format === 'csv' && e.mode === 'full', 'WHAT is preserved');
ok(e.rowCount === 1345, 'HOW MUCH is preserved — the number an auditor scans for');
ok(e.filters.includeDeleted === true, 'filters are preserved');

// ── 2. Defensive against old / malformed WORM rows ───────────────────────────
// These rows are immutable and were written by whatever version shipped that day.
// A history page that throws on a two-year-old row is a history page nobody can audit with.
const empty = toExportHistoryEntry({});
ok(empty.entities.length === 0 && empty.rowCount === 0, 'an empty row yields empty entities and zero rows');
ok(empty.format === 'unknown' && empty.mode === 'unknown', 'missing format/mode read as "unknown", not undefined');
ok(empty.filters === null && empty.artifactSha256 === null, 'absent optional fields are null');

ok(toExportHistoryEntry({ after: null }).rowCount === 0, 'a null `after` does not throw');
ok(toExportHistoryEntry({ after: 'nonsense' }).entities.length === 0, 'a non-object `after` does not throw');
ok(toExportHistoryEntry({ after: { entities: 'member' } }).entities.length === 0, 'a non-array `entities` does not throw');
ok(toExportHistoryEntry({ after: { rowCount: '1345' } }).rowCount === 0, 'a string rowCount is not silently trusted');
ok(toExportHistoryEntry({ after: { entities: [1, 2] } }).entities.join(',') === '1,2', 'non-string entities are coerced');

// ── 3. Description ───────────────────────────────────────────────────────────
ok(describeExport(e).includes('member') && describeExport(e).includes('CSV'), 'description names the entity and format');
ok(describeExport(e).includes('1345 पंक्तियाँ'), 'description is Hindi-first (RULE 7)');
ok(describeExport(e, false).includes('1345 rows'), 'English fallback available');
const many = toExportHistoryEntry({ after: { entities: ['a', 'b', 'c', 'd'], format: 'xlsx', mode: 'full', rowCount: 1 } });
ok(describeExport(many).includes('+2'), 'more than two entities collapse to "a, b +2"');
ok(describeExport(toExportHistoryEntry({})).includes('अज्ञात'), 'an unknown export is labelled, not blank');

// ── 4. The PII flag — computed from the recorded mode, not guessed ───────────
ok(mayContainPii(e) === true, 'a `full` export may contain PII');
ok(mayContainPii(toExportHistoryEntry({ after: { mode: 'standard' } })) === true, 'a `standard` export may contain PII');
ok(mayContainPii(toExportHistoryEntry({ after: { mode: 'statutory' } })) === true, 'a `statutory` export may contain PII');
ok(mayContainPii(toExportHistoryEntry({ after: { mode: 'redacted' } })) === false, 'only a `redacted` export is PII-free');
ok(mayContainPii(toExportHistoryEntry({})) === true, 'an unknown mode is assumed to contain PII (fail closed)');

// ── 5. THE ISOLATION FILTER. audit_log's SELECT policy is `using (true)`. ────
globalThis.__result = { data: [AUDIT_ROW], error: null };
const res = await listExportHistory('SOC-A', 50);
const q = globalThis.__q;

ok(q.table === 'audit_log', 'history reads audit_log (no duplicate export_jobs table)');
const eqMap = Object.fromEntries(q.eq);
ok(eqMap.society_id === 'SOC-A', 'THE QUERY IS SCOPED TO ONE SOCIETY — the only tenant isolation on this table');
ok(eqMap.action === 'export', 'only export events are listed');
ok(q.order[0] === 'created_at' && q.order[1].ascending === false, 'newest first');
ok(q.limit === 50, 'the limit is applied');
ok(res.entries.length === 1 && res.entries[0].rowCount === 1345, 'rows come back shaped');
ok(res.error === null, 'no error on success');

// A read failure surfaces, rather than rendering as "no exports ever happened".
globalThis.__result = { data: null, error: { message: 'permission denied' } };
const bad = await listExportHistory('SOC-A');
ok(bad.entries.length === 0 && bad.error === 'permission denied', 'a read failure returns the error, not a silent empty list');

console.log(`\nExport history (pure + wired): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
