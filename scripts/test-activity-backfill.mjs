// Activity backfill planner (T-12) — imports the REAL planActivityBackfill via the '@/' loader and
// proves it only seeds society_activities where the inferred set is empty-diff (parity), skips the
// rest for manual review, is idempotent against already-declared activities, and stamps jurisdiction.
// Run: node scripts/test-activity-backfill.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { planActivityBackfill, backfillRowId, inferActivities } = await import(abs('../src/lib/navigation/activityInference.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const grant = (capability) => [{ capability, mode: 'grant', source: 'plan' }];
const byId = (plans, id) => plans.find((p) => p.societyId === id);

// 1. Deterministic, idempotent row id.
ok(backfillRowId('SOC001', 'milk_procurement') === 'SOC001:milk_procurement', 'row id is `${society}:${activity}`');

// 2. A clean type (parity) with no existing activities → a row per inferred activity, correctly shaped.
const plan = planActivityBackfill([{ societyId: 'SOC001', societyType: 'pacs', state: 'Haryana' }]);
const pacs = byId(plan, 'SOC001');
ok(pacs.parity === true, 'PACS inference has empty-diff parity');
ok(pacs.skipped === null, 'PACS with no existing activities → not skipped');
ok(pacs.rowsToInsert.length === inferActivities('pacs').length, 'one row per inferred activity');
const row = pacs.rowsToInsert[0];
ok(row.id === backfillRowId('SOC001', row.activity) && row.society_id === 'SOC001' && row.status === 'active', 'row shape: id/society_id/status');
ok(pacs.rowsToInsert.every((r) => r.jurisdiction === 'hr'), 'jurisdiction stamped from state (Haryana → hr)');

// 3. Idempotent — a re-run where every inferred activity already exists inserts nothing.
const rerun = planActivityBackfill([{ societyId: 'SOC001', societyType: 'pacs', existing: inferActivities('pacs') }]);
ok(byId(rerun, 'SOC001').rowsToInsert.length === 0 && byId(rerun, 'SOC001').skipped === 'already-declared', 'all-existing → nothing to insert (already-declared)');

// 4. Partial existing → only the missing activities are inserted.
const someHave = inferActivities('pacs').slice(0, 1);
const partial = byId(planActivityBackfill([{ societyId: 'SOC001', societyType: 'pacs', existing: someHave }]), 'SOC001');
ok(partial.rowsToInsert.length === inferActivities('pacs').length - 1, 'partial existing → insert only the missing ones');
ok(!partial.rowsToInsert.some((r) => r.activity === someHave[0]), 'the already-declared activity is not re-inserted');

// 5. SAFETY — a society with a license grant its inferred activities do NOT cover fails parity and is
//    SKIPPED for manual review (never silently backfilled into a module loss). dairy + a lending grant.
const risky = byId(planActivityBackfill([{ societyId: 'SOC009', societyType: 'dairy', rows: grant('lending') }]), 'SOC009');
ok(risky.parity === false, 'dairy + lending grant → inferred activities miss lending → no parity');
ok(risky.skipped === 'no-parity' && risky.rowsToInsert.length === 0, 'no-parity society is skipped (flagged for manual review), writes nothing');

// 6. Mixed batch — each society decided independently.
const batch = planActivityBackfill([
  { societyId: 'A', societyType: 'dairy' },
  { societyId: 'B', societyType: 'dairy', rows: grant('lending') },
]);
ok(byId(batch, 'A').skipped === null && byId(batch, 'B').skipped === 'no-parity', 'batch decides per society independently');

console.log(`\nActivity backfill planner (T-12): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
