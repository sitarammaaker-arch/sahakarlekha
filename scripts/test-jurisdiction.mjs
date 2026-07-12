// Jurisdiction — the SSOT for (society_id, jurisdiction) (T-01 / ADR-0009, Canonical CL-5).
//
// Two guarantees:
//   1. resolveJurisdiction collapses every spelling of one state to ONE code, so a society's
//      data can never split across 'HR' / 'Haryana' / 'हरियाणा' jurisdictions.
//   2. stampTenant is the single seam both tenancy keys are applied through — it stamps both,
//      never mutates the row, and the writer's scope always wins (the anti-IRR-4 device).
//
// Run: node scripts/test-jurisdiction.mjs   (npm run test:jurisdiction)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let mod;
try {
  mod = await import(abs('../src/lib/jurisdiction.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the jurisdiction module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { resolveJurisdiction, stampTenant } = mod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. resolveJurisdiction — one place, one code per state ────────────────────
ok(resolveJurisdiction('Haryana') === 'hr', 'the English state name resolves to its code');
ok(resolveJurisdiction('HR') === 'hr', 'the 2-letter code is accepted');
ok(resolveJurisdiction('हरियाणा') === 'hr', 'the Devanagari name resolves to the same code (UTF-8, RULE 8)');
ok(resolveJurisdiction('  haryana  ') === 'hr', 'surrounding whitespace is trimmed');
ok(resolveJurisdiction('HARYANA') === 'hr', 'case does not matter');
ok(resolveJurisdiction('Haryana') === resolveJurisdiction('हरियाणा')
  && resolveJurisdiction('HR') === resolveJurisdiction('Haryana'),
  'ALL spellings of one state agree — the anti-split-jurisdiction guarantee (CL-5)');

ok(resolveJurisdiction('Punjab') === 'punjab', 'an un-aliased state normalizes to a stable lower-case slug');
ok(resolveJurisdiction('Uttar Pradesh') === 'uttar pradesh', 'multi-word states keep their words, just normalized');
ok(resolveJurisdiction('') === '', 'an empty state is the empty code, never null');
ok(resolveJurisdiction(undefined) === '' && resolveJurisdiction(null) === '', 'a missing state is the empty code (always a defined key)');
ok(typeof resolveJurisdiction('Bihar') === 'string', 'the result is always a string');

// ── 2. stampTenant — the single seam, immutable, scope wins ───────────────────
const scope = { societyId: 'SOC001', jurisdiction: 'hr' };
const row = { id: 'v1', amount: 100 };
const stamped = stampTenant(row, scope);

ok(stamped.society_id === 'SOC001' && stamped.jurisdiction === 'hr', 'BOTH tenancy keys are applied');
ok(stamped.id === 'v1' && stamped.amount === 100, 'the row payload is preserved');
ok(!('society_id' in row) && Object.keys(row).length === 2, 'the input row is NOT mutated (a new object is returned)');

const carried = stampTenant({ id: 'x', society_id: 'WRONG', jurisdiction: 'zz' }, scope);
ok(carried.society_id === 'SOC001' && carried.jurisdiction === 'hr',
  "the writer's scope WINS over any tenancy the row already carried");

ok(JSON.stringify(stampTenant(row, scope)) === JSON.stringify(stamped), 'stamping is deterministic');

console.log(`\nJurisdiction (SSOT + stamp): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
