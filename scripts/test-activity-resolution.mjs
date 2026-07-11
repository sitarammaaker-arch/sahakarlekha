// Activity → capability resolution WITHIN entitlement (T-11 / ADR-0002/0003; MR-4, MR-2).
//
// The whole safety property is MR-4: a declared activity may only surface a capability the
// society is ENTITLED to — it can never grant an unpaid feature. And it must be non-breaking:
// a society with NO declared activities resolves exactly as today. These tests exercise the
// REAL resolver (not a mirror), so they also prove the wiring compiles and runs.
//
// Run: node scripts/test-activity-resolution.mjs   (npm run test:activity-resolution)

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
        if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let R;
try {
  R = await import(abs('../src/lib/navigation/capabilityResolver.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the resolver.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { resolveCapabilities, resolveEntitlements, activityCapabilities } = R;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const NOW = Date.parse('2026-07-12T00:00:00Z');
const setEq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// pacs template entitles: inventory_sales, lending, procurement_msp, gst, tds.

// ── 1. NON-BREAKING — no declared activities → exactly today's caps ───────────
const noAct = resolveCapabilities('pacs', [], NOW, undefined, []);
const legacy = resolveCapabilities('pacs', [], NOW, undefined);           // legacy 4-arg call
ok(setEq(noAct, legacy), 'no declared activities → identical to the legacy (activity-unaware) result');
ok(noAct.has('lending') && noAct.has('inventory_sales'), 'and it still contains the full entitled set');

// ── 2. ACTIVITY-GATED within entitlement ─────────────────────────────────────
// A pacs entitled to {inventory_sales, lending, procurement_msp, gst, tds} that declares only
// credit_short_term (→ lending) should now show only lending — not the other entitled caps.
const credit = resolveCapabilities('pacs', [], NOW, undefined, ['credit_short_term']);
ok(credit.has('lending'), 'a declared activity surfaces its entitled capability');
ok(!credit.has('inventory_sales'), 'entitled caps NOT lit by a declared activity are gated out (activity-primary within entitlement)');

// Two activities union their caps.
const multi = resolveCapabilities('pacs', [], NOW, undefined, ['credit_short_term', 'agri_input_retail']);
ok(multi.has('lending') && multi.has('inventory_sales') && multi.has('gst'), 'multiple activities union their entitled caps');

// ── 3. MR-4 — an activity can NEVER grant an unentitled capability ────────────
// housing is NOT in the pacs template, so declaring housing_management (→ housing) grants nothing.
const housingOnPacs = resolveCapabilities('pacs', [], NOW, undefined, ['housing_management']);
ok(!housingOnPacs.has('housing'), 'MR-4: a declared activity does NOT grant a capability the society is not entitled to');
ok(activityCapabilities(['housing_management']).has('housing'), '(the activity DOES map to housing — it is entitlement, not the map, that blocks it)');

// But grant the entitlement (a plan grant) and the SAME activity now surfaces it — within entitlement.
const withGrant = resolveCapabilities('pacs',
  [{ capability: 'housing', mode: 'grant', source: 'plan' }], NOW, undefined, ['housing_management']);
ok(withGrant.has('housing'), 'once entitled (plan grant), the declared activity surfaces the capability');

// ── 4. ADMIN-HIDE still wins, and empty vs unknown activity ──────────────────
const hidden = resolveCapabilities('pacs',
  [{ capability: 'lending', mode: 'revoke', source: 'admin' }], NOW, undefined, ['credit_short_term']);
ok(!hidden.has('lending'), 'an admin-hidden capability stays hidden even when a declared activity lights it');

// common_service_centre maps to [] (no capability yet) → declaring it surfaces nothing.
const noCap = resolveCapabilities('pacs', [], NOW, undefined, ['common_service_centre']);
ok(noCap.size === 0, 'an activity whose capability does not exist yet ([]) surfaces nothing');

// ── 4b. T-13 — the new deposit_ledger capability flows through the resolver ───
// pacs is now entitled to deposit_ledger; declaring the deposits activity surfaces it.
const dep = resolveCapabilities('pacs', [], NOW, undefined, ['deposits_savings']);
ok(dep.has('deposit_ledger'), 'a pacs declaring deposits_savings surfaces deposit_ledger (T-13, within entitlement)');
// dairy is NOT entitled to deposit_ledger, so the same declared activity grants nothing (MR-4).
const depDairy = resolveCapabilities('dairy', [], NOW, undefined, ['deposits_savings']);
ok(!depDairy.has('deposit_ledger'), 'a dairy (not entitled) declaring deposits gets nothing — MR-4 holds for the new capability too');

// ── 5. DETERMINISM ───────────────────────────────────────────────────────────
ok(setEq(resolveCapabilities('pacs', [], NOW, undefined, ['credit_short_term']),
         resolveCapabilities('pacs', [], NOW, undefined, ['credit_short_term'])),
  'resolution is deterministic for a fixed now (MR-2: pure)');

console.log(`\nActivity resolution within entitlement: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
