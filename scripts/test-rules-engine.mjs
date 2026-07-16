// Rules engine — effective-dated, jurisdiction-scoped, point-in-time (T-15 / ADR-0008, INV-3).
//
// Proves the three properties compliance-as-data rests on:
//   • a historical date reproduces its era's rule (effective-dating);
//   • a state override applies only when/where it is effective, else the national default
//     (jurisdiction scoping — 28 Acts coexist);
//   • the resolved value carries its effectiveFrom + version, so a figure records which rule
//     produced it (auditability).
//
// Run: node scripts/test-rules-engine.mjs   (npm run test:rules-engine)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let mod;
try {
  mod = await import(abs('../src/lib/rules/engine.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the rules engine.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { resolveRule, resolveValue } = mod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// Statutory reserve %: national 25% forever; raised to 28% in 2020; Haryana overrides to 30%
// from FY2025-26.
const RESERVE = {
  key: 'reserve_pct',
  byJurisdiction: {
    '':   [{ value: 25, effectiveFrom: '2000-04-01', version: 1 }, { value: 28, effectiveFrom: '2020-04-01', version: 2 }],
    'hr': [{ value: 30, effectiveFrom: '2025-04-01', version: 1 }],
  },
};
const CATALOG = { reserve_pct: RESERVE };

// ── 1. EFFECTIVE-DATING — a historical date sees its era's rule ──────────────
ok(resolveRule(RESERVE, { asOf: '2010-06-01' }).value === 25, 'national reserve in 2010 is 25% (the pre-2020 rule)');
ok(resolveRule(RESERVE, { asOf: '2021-06-01' }).value === 28, 'national reserve in 2021 is 28% (the 2020 revision)');
ok(resolveRule(RESERVE, { asOf: '1999-01-01' }) === null, 'before the earliest effectiveFrom, no value applies');
ok(resolveRule(RESERVE, { asOf: '2020-04-01' }).value === 28, 'the effectiveFrom date itself is inclusive');

// ── 2. JURISDICTION SCOPING — override only where/when effective ─────────────
ok(resolveRule(RESERVE, { jurisdiction: 'hr', asOf: '2026-06-01' }).value === 30, 'Haryana in 2026 uses its 30% override');
ok(resolveRule(RESERVE, { jurisdiction: 'hr', asOf: '2010-06-01' }).value === 25,
  'Haryana in 2010 falls back to the NATIONAL rule — its override is not yet effective');
ok(resolveRule(RESERVE, { jurisdiction: 'pb', asOf: '2026-06-01' }).value === 28,
  'Punjab (no override) uses the national rule');
ok(resolveRule(RESERVE, { jurisdiction: '', asOf: '2026-06-01' }).value === 28, 'the national default resolves for empty jurisdiction');

// ── 3. RECORDS THE POLICY — value + effectiveFrom + version ──────────────────
const hr = resolveRule(RESERVE, { jurisdiction: 'hr', asOf: '2026-06-01' });
ok(hr.effectiveFrom === '2025-04-01' && hr.version === 1, 'the resolved rule carries its effectiveFrom + version (recordable for audit)');
const nat = resolveRule(RESERVE, { asOf: '2021-06-01' });
ok(nat.version === 2, 'the national 2021 value records version 2');

// ── 4. CONVENIENCE + EDGE ────────────────────────────────────────────────────
ok(resolveValue(CATALOG, 'reserve_pct', { jurisdiction: 'hr', asOf: '2026-06-01' }) === 30, 'resolveValue returns just the value');
ok(resolveValue(CATALOG, 'unknown_key', { asOf: '2026-06-01' }) === null, 'an unknown rule key resolves to null');
ok(resolveRule(RESERVE, { asOf: 'not-a-date' }) === null, 'an unparseable asOf resolves to null, never a wrong rule');
ok(resolveRule({ key: 'x', byJurisdiction: {} }, { asOf: '2026-01-01' }) === null, 'a rule with no values resolves to null');

// Determinism.
ok(JSON.stringify(resolveRule(RESERVE, { jurisdiction: 'hr', asOf: '2026-06-01' })) ===
   JSON.stringify(resolveRule(RESERVE, { jurisdiction: 'hr', asOf: '2026-06-01' })), 'resolution is deterministic');

// ── 5. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'rules', 'engine.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `rules/engine.ts is pure & deterministic (no "${forbidden}")`);
}

/* ── Attribute conditions (`when` / `attrs`) ───────────────────────────────────
   Statute varies a figure by more than place and date: TDS is 1% for an
   Individual/HUF payee and 2% for others; 10% for professional services but 2% for
   technical. Without this the catalog held one number per section, so those sections
   had to be omitted rather than encoded as half the law (rules/tax.ts).
   Most-specific-wins, mirroring the jurisdiction chain (`hr` beats `''` regardless
   of date). Every assertion above still passes untouched — the extension is additive,
   and that is the proof. */
const CONDITIONED = {
  key: 'tds.194c.rate_pct',
  byJurisdiction: {
    '': [
      { value: 2, effectiveFrom: '2020-04-01', version: 1 },                                  // default: everyone else
      { value: 1, effectiveFrom: '2020-04-01', version: 1, when: { payeeType: 'individual' } },
    ],
  },
};

ok(resolveRule(CONDITIONED, { asOf: '2026-07-16', attrs: { payeeType: 'individual' } }).value === 1,
  'when: an Individual/HUF payee gets the specific rate');
ok(resolveRule(CONDITIONED, { asOf: '2026-07-16', attrs: { payeeType: 'company' } }).value === 2,
  'when: any other payee falls back to the default');
ok(resolveRule(CONDITIONED, { asOf: '2026-07-16' }).value === 2,
  'when: no attrs at all ⇒ the unconditioned default, never the specific one');
ok(resolveRule(CONDITIONED, { asOf: '2026-07-16', attrs: { unrelated: 'x' } }).value === 2,
  'when: an irrelevant attr does not accidentally match a condition');

/* THE GUARD THAT MATTERS: a rule with ONLY conditioned values and no default must
   return null when nothing matches — the caller then refuses. Silently picking the
   first row would put an unasked-for rate on a voucher (AI-N8). */
const NO_DEFAULT = {
  key: 'tds.194j.rate_pct',
  byJurisdiction: {
    '': [
      { value: 10, effectiveFrom: '2020-04-01', when: { serviceType: 'professional' } },
      { value: 2, effectiveFrom: '2020-04-01', when: { serviceType: 'technical' } },
    ],
  },
};
ok(resolveRule(NO_DEFAULT, { asOf: '2026-07-16', attrs: { serviceType: 'technical' } }).value === 2,
  'no-default: a matching attr resolves');
ok(resolveRule(NO_DEFAULT, { asOf: '2026-07-16' }) === null,
  'no-default: a MISSING attr resolves to null — refuse, never guess');
ok(resolveRule(NO_DEFAULT, { asOf: '2026-07-16', attrs: { serviceType: 'other' } }) === null,
  'no-default: an unknown attr value resolves to null, not the first row');

/* Effective-dating still governs WITHIN a condition group. */
const AMENDED = {
  key: 'x',
  byJurisdiction: {
    '': [
      { value: 1, effectiveFrom: '2020-04-01', when: { payeeType: 'individual' } },
      { value: 3, effectiveFrom: '2026-04-01', when: { payeeType: 'individual' } },
    ],
  },
};
ok(resolveRule(AMENDED, { asOf: '2024-06-01', attrs: { payeeType: 'individual' } }).value === 1,
  'when + date: a 2024 case gets the rate in force then');
ok(resolveRule(AMENDED, { asOf: '2026-07-16', attrs: { payeeType: 'individual' } }).value === 3,
  'when + date: a 2026 case gets the amended rate');

/* Specificity beats recency — a specific provision governs even if the general one was
   amended later, which is how statute reads and how `hr` already beats `''` here. */
const SPECIFIC_VS_NEW = {
  key: 'y',
  byJurisdiction: {
    '': [
      { value: 5, effectiveFrom: '2020-04-01', when: { payeeType: 'individual' } },
      { value: 9, effectiveFrom: '2026-04-01' }, // newer, but general
    ],
  },
};
ok(resolveRule(SPECIFIC_VS_NEW, { asOf: '2026-07-16', attrs: { payeeType: 'individual' } }).value === 5,
  'specificity beats recency — the specific provision governs');
ok(resolveRule(SPECIFIC_VS_NEW, { asOf: '2026-07-16', attrs: { payeeType: 'company' } }).value === 9,
  '...but everyone else still gets the newer general one');

console.log(`\nRules engine (effective-dated, jurisdiction-scoped): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
