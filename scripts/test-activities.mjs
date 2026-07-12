// Activities layer — catalog + activity→capability map (T-10 / ADR-0003, BA-1).
//
// The compiler already guarantees the map is TOTAL over the Activity union and every value is
// a real Capability (Record<Activity, Capability[]>). These runtime tests guard what types
// cannot: the catalog and the map agree (same set of activities, no orphan either way), codes
// are unique, and every catalog entry is well-formed. A society modelling MANY activities
// starts here.
//
// Run: node scripts/test-activities.mjs   (npm run test:activities)

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
      export async function resolve(spec, ctx, next) {
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
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let cat, map, stc;
try {
  cat = await import(abs('../src/lib/navigation/activities.ts'));
  map = await import(abs('../src/lib/navigation/activityCapabilities.ts'));
  stc = await import(abs('../src/lib/navigation/societyTypeCapabilities.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the activities modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { ACTIVITY_CATALOG, ACTIVITY_CODES } = cat;
const { ACTIVITY_CAPABILITY_MAP } = map;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. CATALOG is well-formed ────────────────────────────────────────────────
ok(Array.isArray(ACTIVITY_CATALOG) && ACTIVITY_CATALOG.length >= 20, 'the catalog is non-trivial (>= 20 activities)');
const codes = ACTIVITY_CATALOG.map((a) => a.code);
ok(new Set(codes).size === codes.length, 'activity codes are unique — no duplicate catalog entries');
ok(ACTIVITY_CATALOG.every((a) => a.code && a.label && a.labelHi && a.group), 'every entry has code, label, Hindi label and group');
ok(ACTIVITY_CODES instanceof Set && ACTIVITY_CODES.size === codes.length, 'ACTIVITY_CODES mirrors the catalog exactly');
const GROUPS = new Set(['credit', 'agri_allied', 'processing', 'marketing', 'services', 'emerging']);
ok(ACTIVITY_CATALOG.every((a) => GROUPS.has(a.group)), 'every activity belongs to a known group');

// ── 2. CATALOG and MAP agree (no orphan either way) ──────────────────────────
const mapKeys = Object.keys(ACTIVITY_CAPABILITY_MAP);
ok(mapKeys.length === codes.length, 'the map has exactly one entry per catalog activity');
ok(codes.every((c) => c in ACTIVITY_CAPABILITY_MAP), 'every catalog activity has a capability mapping (no unmapped activity)');
ok(mapKeys.every((k) => ACTIVITY_CODES.has(k)), 'the map declares no activity absent from the catalog');

// ── 3. The map is well-shaped (values are capability arrays) ─────────────────
ok(Object.values(ACTIVITY_CAPABILITY_MAP).every((v) => Array.isArray(v)), 'every mapping is an array of capabilities');
ok(Object.values(ACTIVITY_CAPABILITY_MAP).every((v) => v.every((c) => typeof c === 'string' && c.length > 0)),
  'mapped capabilities are non-empty strings (validity vs the Capability union is enforced by tsc)');
ok(Object.values(ACTIVITY_CAPABILITY_MAP).every((v) => new Set(v).size === v.length),
  'no activity lists the same capability twice');

// The multipurpose thesis: a real society can declare many activities that light up several
// capabilities — e.g. a Multipurpose PACS doing credit + dairy + consumer retail.
const multi = new Set([
  ...ACTIVITY_CAPABILITY_MAP.credit_short_term,
  ...ACTIVITY_CAPABILITY_MAP.milk_procurement,
  ...ACTIVITY_CAPABILITY_MAP.consumer_retail,
]);
ok(multi.has('lending') && multi.has('dairy_collection') && multi.has('pos_billing'),
  'a Multipurpose PACS (credit + dairy + retail) unions to lending + dairy_collection + pos_billing');

// ── 4. T-13 — new capabilities + legal types are wired ───────────────────────
ok(ACTIVITY_CAPABILITY_MAP.deposits_savings.includes('deposit_ledger'), 'deposits_savings now lights deposit_ledger (CAP-1 / BA-2 — no longer [])');
ok(ACTIVITY_CAPABILITY_MAP.deposits_term.includes('deposit_ledger'), 'deposits_term lights deposit_ledger');
ok(ACTIVITY_CAPABILITY_MAP.fair_price_shop_pds.includes('subsidy_reconciliation'), 'fair_price_shop_pds lights subsidy_reconciliation (CAP-2 / BA-3)');
ok(ACTIVITY_CAPABILITY_MAP.agri_input_retail.includes('subsidy_reconciliation'), 'agri_input_retail lights subsidy_reconciliation (fertilizer/seed subsidy)');

const T = stc.SOCIETY_TYPE_CAPABILITIES;
ok(T.producer && T.multistate && T.multipurpose, 'new legal types producer/multistate/multipurpose have templates (SC-1/2/3)');
ok(T.pacs.includes('deposit_ledger'), 'PACS is entitled to deposit_ledger (they take deposits) — so the deposits activity can surface it');
ok(T.multipurpose.includes('deposit_ledger') && T.multipurpose.includes('subsidy_reconciliation') && T.multipurpose.includes('dairy_collection'),
  'multipurpose is broad — credit + deposits + dairy + subsidy at once (the multipurpose-PACS reality)');
ok(!T.dairy.includes('deposit_ledger'), 'dairy is NOT auto-entitled to deposits (a declared deposits activity there stays gated — MR-4)');

console.log(`\nActivities layer (catalog + map): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
