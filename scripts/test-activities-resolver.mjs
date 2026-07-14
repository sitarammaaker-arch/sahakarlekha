// Activities layer (T-11 / ADR-0003) — imports the REAL navigation libs via the '@/' loader and
// proves: (a) declaredActivities filters society_activities rows correctly, (b) the navigationService
// port IGNORES declared activities while the cutover flag is OFF (dormant read-path — today's
// behaviour, empty-diff), and (c) the pure resolver, once gated on, keeps an activity strictly
// within entitlement (MR-4). Run: node scripts/test-activities-resolver.mjs
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

const { declaredActivities } = await import(abs('../src/lib/navigation/activities.ts'));
const { resolveCapabilities } = await import(abs('../src/lib/navigation/capabilityResolver.ts'));
const { navigationService, ACTIVITIES_CUTOVER_ENABLED } = await import(abs('../src/lib/navigation/navigationService.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const setEq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// ── 1. declaredActivities — only active, non-deleted, known catalog codes; de-duplicated ──────────
ok(declaredActivities([]).length === 0, 'no rows → no activities');
ok(declaredActivities().length === 0, 'undefined rows → no activities');
ok(JSON.stringify(declaredActivities([{ activity: 'milk_procurement' }])) === '["milk_procurement"]', 'a bare row defaults to active');
ok(declaredActivities([{ activity: 'milk_procurement', status: 'paused' }]).length === 0, 'paused row excluded');
ok(declaredActivities([{ activity: 'milk_procurement', status: 'retired' }]).length === 0, 'retired row excluded');
ok(declaredActivities([{ activity: 'milk_procurement', status: 'active', isDeleted: true }]).length === 0, 'soft-deleted row excluded');
ok(declaredActivities([{ activity: 'not_a_real_activity', status: 'active' }]).length === 0, 'unknown code excluded');
ok(declaredActivities([{ activity: 'lending' /* capability, not activity */, status: 'active' }]).length === 0, 'a capability code is not an activity');
ok(declaredActivities([
  { activity: 'credit_short_term', status: 'active' },
  { activity: 'credit_short_term', status: 'active' },
]).length === 1, 'duplicate activities de-duplicated');
ok(setEq(new Set(declaredActivities([
  { activity: 'credit_short_term', status: 'active' },
  { activity: 'milk_procurement', status: 'active' },
  { activity: 'consumer_retail', status: 'paused' },
])), new Set(['credit_short_term', 'milk_procurement'])), 'mixed rows → only the active, known ones');

// ── 2. The cutover flag ships OFF (T-11 dormant; T-12 flips it after backfill) ────────────────────
ok(ACTIVITIES_CUTOVER_ENABLED === false, 'ACTIVITIES_CUTOVER_ENABLED is false at rest (guard against an accidental cutover)');

// ── 3. Port GATING — while the flag is off, declared activities are IGNORED: the port output equals
//       today's full entitled set, whatever activities a society declares (empty-diff safety). ──────
const acts = ['credit_short_term']; // → 'lending' only; would narrow a PACS if the flag were on
const today = resolveCapabilities('pacs', [], undefined, undefined);            // baseline (no activities)
const viaPort = navigationService.resolveCapabilities('pacs', [], undefined, acts); // through the gated port
ok(setEq(viaPort, today), 'port ignores declared activities while the flag is off (identical to today)');
ok(viaPort.has('inventory_sales') && viaPort.has('deposit_ledger'), 'a PACS keeps its non-credit modules at rest (nothing hidden by an activity)');

// ── 4. The pure resolver, WHEN activities are applied (flag-on path), narrows within entitlement, and
//       an activity NEVER surfaces an unentitled capability (MR-4). ───────────────────────────────
const gated = resolveCapabilities('pacs', [], undefined, undefined, acts); // pure resolver, activities applied
ok(gated.has('lending'), 'declared credit activity keeps its entitled capability (lending)');
ok(!gated.has('inventory_sales'), 'a declared credit-only activity hides the unrelated retail module (would-be cutover effect)');
// MR-4: a HOUSING society (not entitled to lending) declaring a credit activity still cannot lend.
const housingGated = resolveCapabilities('housing', [], undefined, undefined, ['credit_short_term']);
ok(!housingGated.has('lending'), 'MR-4 — an activity cannot grant a capability the society is not entitled to');

console.log(`\nActivities resolver (pure, T-11): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
