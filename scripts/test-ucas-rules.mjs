// UCAS statutory rules as data (T-16 / ADR-0008; UCAS CM-1).
//
// Proves the appropriation numbers are DATA resolved through the engine: the common-Act
// defaults are correct, they are effective-dated and jurisdiction-scoped (fallback to national),
// every accessor has a safe per-rule fallback, the CM-1 order is encoded, and a rate drives an
// EXACT appropriation via the money primitive (T-02) — 25% of a surplus in minor units, no float.
//
// Run: node scripts/test-ucas-rules.mjs   (npm run test:ucas-rules)

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

let ucas, money;
try {
  ucas = await import(abs('../src/lib/rules/ucas.ts'));
  money = await import(abs('../src/lib/money.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the UCAS/money modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { ucasReserveMinPct, ucasEducationFundPct, ucasDividendCapPct, ucasCharitableMaxPct, UCAS_RULES, UCAS_APPROPRIATION_ORDER } = ucas;
const { toMinor, applyPercent, toRupees } = money;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const AT = { asOf: '2026-06-01' };

// ── 1. The common-Act defaults (UCAS CM-1) ───────────────────────────────────
ok(ucasReserveMinPct(AT) === 25, 'Reserve Fund minimum is 25% of net profit (UCAS-P4)');
ok(ucasEducationFundPct(AT) === 5, 'Education Fund contribution is 5%');
ok(ucasDividendCapPct(AT) === 15, 'Dividend cap is 15% without Registrar sanction (UCAS-P2)');
ok(ucasCharitableMaxPct(AT) === 10, 'Charitable/public-purpose ceiling is 10%');

// ── 2. Effective-dated + jurisdiction-scoped (via the engine) ────────────────
ok(ucasReserveMinPct({ jurisdiction: 'pb', asOf: '2026-06-01' }) === 25, 'a state with no override uses the national rule');
ok(ucasReserveMinPct({ jurisdiction: 'hr', asOf: '2026-06-01' }) === 25, 'no fabricated state override — Haryana resolves to the national default too');
// Before the baseline effectiveFrom the rule does not resolve → the accessor FALLS BACK safely.
ok(ucasReserveMinPct({ asOf: '1990-01-01' }) === 25, 'before the baseline date, the accessor falls back to the safe default (per-rule rollback)');
ok(ucasDividendCapPct({ asOf: 'not-a-date' }) === 15, 'an unparseable asOf falls back — never a wrong figure');

// The rule carries its effectiveFrom + [NV per state] note (recordable / honest about scope).
ok(UCAS_RULES.reserve_fund_min_pct.byJurisdiction[''][0].note.includes('[NV per state]'),
  'the seeded value is flagged [NV per state] — a common-Act default, to be confirmed per State Act');

// ── 3. The mandatory appropriation ORDER is data (CM-1) ──────────────────────
ok(UCAS_APPROPRIATION_ORDER[0] === 'reserve_fund', 'appropriation starts with the Reserve Fund (indivisible, first)');
ok(UCAS_APPROPRIATION_ORDER[UCAS_APPROPRIATION_ORDER.length - 1] === 'carry_forward', 'and ends with carry-forward');
ok(UCAS_APPROPRIATION_ORDER.indexOf('dividend') < UCAS_APPROPRIATION_ORDER.indexOf('patronage_bonus'),
  'dividend is appropriated before patronage bonus');
ok(UCAS_APPROPRIATION_ORDER.indexOf('reserve_fund') < UCAS_APPROPRIATION_ORDER.indexOf('education_fund'),
  'reserve before education fund (the statutory order)');

// ── 4. A rate drives an EXACT appropriation (composes T-02) ──────────────────
// Net surplus ₹10,000 → Reserve Fund at 25% = exactly ₹2,500 (no float).
const netSurplus = toMinor(10000);
const reserve = applyPercent(netSurplus, ucasReserveMinPct(AT));
ok(reserve.minor === toMinor(2500) && toRupees(reserve.minor) === 2500, '25% of ₹10,000 is exactly ₹2,500 (rate × exact money, T-02)');
ok(reserve.mode === 'half-up', 'and the rounding policy is recorded with the figure (ADR-0006)');
// A fractional case rounds by policy: 5% of ₹1,234.57 = ₹61.7285 → ₹61.73.
const edu = applyPercent(toMinor(1234.57), ucasEducationFundPct(AT));
ok(edu.minor === toMinor(61.73), '5% of ₹1,234.57 rounds to ₹61.73 by the recorded policy');

console.log(`\nUCAS rules as data: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
