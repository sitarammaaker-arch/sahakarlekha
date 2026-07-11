// Activity inference + cutover parity (T-12 / ADR-0003; MR-1 — the empty-diff guarantee).
//
// The whole safety of the Activities cutover is one property: switching a society from its
// type template to its inferred activities must reproduce EXACTLY the same capabilities — no
// module lost. These tests prove hasCutoverParity holds for EVERY society type, and that the
// verifier correctly REFUSES parity when the inferred activities don't cover an entitlement
// (a license grant), so the cutover is blocked rather than silently dropping a module.
//
// Run: node scripts/test-activity-inference.mjs   (npm run test:activity-inference)

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

let inf, stc;
try {
  inf = await import(abs('../src/lib/navigation/activityInference.ts'));
  stc = await import(abs('../src/lib/navigation/societyTypeCapabilities.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the inference modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { inferActivities, hasCutoverParity, TYPE_INFERRED_ACTIVITIES } = inf;
const ALL_TYPES = Object.keys(stc.SOCIETY_TYPE_CAPABILITIES);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const NOW = Date.parse('2026-07-12T00:00:00Z');

// ── 1. PARITY holds for EVERY type (the MR-1 guarantee) ──────────────────────
ok(ALL_TYPES.length === 11, 'all 11 society types are covered');
for (const t of ALL_TYPES) {
  ok(hasCutoverParity(t, [], undefined, NOW),
    `parity(${t}): the inferred activities reproduce the type template exactly — no module lost at cutover`);
}

// ── 2. Every type has a non-empty inferred activity set ──────────────────────
for (const t of ALL_TYPES) {
  ok(Array.isArray(inferActivities(t)) && inferActivities(t).length > 0, `inferActivities(${t}) is a non-empty seed`);
}
ok(inferActivities('pacs').includes('credit_short_term') && inferActivities('pacs').includes('deposits_savings'),
  'a PACS infers credit + deposits (so lending + deposit_ledger survive the cutover)');
ok(inferActivities('multipurpose').length >= 6, 'a multipurpose society infers many activities (it does many things)');

// ── 3. The verifier REFUSES parity when an entitlement is not covered ────────
// A housing society granted 'lending' (a plan grant) — the inferred housing activities do not
// cover lending, so parity must be FALSE and the cutover blocked (never drop the module silently).
const grantedLending = [{ capability: 'lending', mode: 'grant', source: 'plan' }];
ok(!hasCutoverParity('housing', grantedLending, undefined, NOW),
  'a license grant the inferred activities do NOT cover → parity FALSE (block the flip, do not drop the module)');
// Without the grant, housing has parity.
ok(hasCutoverParity('housing', [], undefined, NOW), 'the same housing society, un-granted, has parity');

// ── 4. A wrong inference is caught ───────────────────────────────────────────
ok(!hasCutoverParity('pacs', [], ['common_service_centre'], NOW),
  'an inference that covers nothing operational → parity FALSE for a type with operational caps');
ok(hasCutoverParity('pacs', [], TYPE_INFERRED_ACTIVITIES.pacs, NOW), 'the real pacs inference has parity');

console.log(`\nActivity inference + cutover parity: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
