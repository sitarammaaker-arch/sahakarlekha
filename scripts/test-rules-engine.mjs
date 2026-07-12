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

console.log(`\nRules engine (effective-dated, jurisdiction-scoped): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
