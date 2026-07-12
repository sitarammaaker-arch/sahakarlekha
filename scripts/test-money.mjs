// Exact money — integer minor-unit arithmetic (T-02 / ADR-0006, Canonical CL-3).
//
// The whole point is that a rupee is never a float that drifts in the last paisa. These
// tests prove: the classic float bug is gone, sums of many legs are exact, rounding is the
// one documented function, and every rounded op records the policy it used.
//
// Run: node scripts/test-money.mjs   (npm run test:money)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let m;
try {
  m = await import(abs('../src/lib/money.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the money module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { toMinor, toRupees, roundMinor, addMinor, sumMinor, subMinor, negateMinor,
        mulMinor, applyPercent, formatMinor, isValidMinor, DEFAULT_ROUNDING } = m;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. THE FLOAT BUG IS GONE ─────────────────────────────────────────────────
ok(0.1 + 0.2 !== 0.3, 'sanity: in float, 0.1 + 0.2 !== 0.3 (the bug this module exists to kill)');
ok(addMinor(toMinor(0.1), toMinor(0.2)) === toMinor(0.3), 'in minor units, 0.10 + 0.20 === 0.30 exactly');
ok(toMinor(0.1) === 10 && toMinor(0.2) === 20 && toMinor(0.3) === 30, 'conversion absorbs the float imprecision of rupees*100');

// A ₹100 invoice split three ways sums back to exactly ₹100 (floats would give 99.99…).
ok(sumMinor([toMinor(33.33), toMinor(33.33), toMinor(33.34)]) === toMinor(100), 'three legs of a split sum to exactly the whole');

// ── 2. CONVERSION ROUND-TRIP ─────────────────────────────────────────────────
for (const r of [0, 1, 12.34, 1234.56, 99999.99, 0.05, 0.29]) {
  ok(toRupees(toMinor(r)) === r, `round-trip preserves ₹${r}`);
}
ok(toMinor(1234.56) === 123456, '₹1234.56 → 123456 paise');
ok(toRupees(123456) === 1234.56, '123456 paise → ₹1234.56');
ok(toMinor(-5.5) === -550, 'negative rupees convert correctly');

// ── 3. ROUNDING — one function, every mode, negatives too ────────────────────
ok(DEFAULT_ROUNDING === 'half-up', 'the default policy is half-up (commercial/statutory)');
ok(roundMinor(2.5) === 3 && roundMinor(-2.5) === -3, 'half-up rounds .5 AWAY from zero, symmetrically');
ok(roundMinor(2.4) === 2 && roundMinor(2.6) === 3, 'half-up rounds normally otherwise');
ok(roundMinor(2.9, 'down') === 2 && roundMinor(-2.9, 'down') === -2, 'down truncates toward zero');
ok(roundMinor(2.1, 'up') === 3 && roundMinor(-2.1, 'up') === -3, 'up rounds away from zero');
ok(roundMinor(2.5, 'half-even') === 2 && roundMinor(3.5, 'half-even') === 4, 'half-even rounds .5 to the nearest EVEN');
ok(roundMinor(-2.5, 'half-even') === -2, 'half-even is symmetric for negatives');
ok(Number.isInteger(roundMinor(1.23456)), 'the result is always an integer');

// ── 4. RECORDED-POLICY OPS (ADR-0006) ────────────────────────────────────────
const gst = applyPercent(toMinor(1000), 18); // ₹1000 @ 18%
ok(gst.minor === toMinor(180) && gst.mode === 'half-up', '18% of ₹1000 is exactly ₹180, and the rounding mode is RECORDED');
const frac = applyPercent(12345, 18); // 12345 paise @ 18% = 2222.1 → 2222
ok(frac.minor === 2222 && frac.mode === 'half-up', 'a fractional-paisa percentage rounds by policy and records it');
const scaled = mulMinor(toMinor(12.50), 3);
ok(scaled.minor === toMinor(37.50) && scaled.mode === 'half-up', 'quantity × unit-price is exact, with the policy recorded');

// ── 5. EXACT ARITHMETIC + GUARDS ─────────────────────────────────────────────
ok(subMinor(toMinor(100), toMinor(0.01)) === toMinor(99.99), '₹100 − ₹0.01 === ₹99.99');
ok(negateMinor(toMinor(5)) === toMinor(-5), 'negation is exact');
ok(isValidMinor(100) && !isValidMinor(1.5) && !isValidMinor(NaN) && !isValidMinor('100'), 'isValidMinor accepts only finite integers');
let threw = false; try { addMinor(1.5, 2); } catch { threw = true; }
ok(threw, 'a non-integer minor value throws — floats never sneak into minor-unit math');
let threw2 = false; try { toMinor(Infinity); } catch { threw2 = true; }
ok(threw2, 'a non-finite rupee value throws');

// ── 6. FORMAT (Indian grouping, deterministic) ───────────────────────────────
ok(formatMinor(toMinor(1234567.5)) === '12,34,567.50', 'Indian grouping: 12,34,567.50');
ok(formatMinor(toMinor(100)) === '100.00', 'small amounts are not grouped');
ok(formatMinor(toMinor(-1234.5)) === '-1,234.50', 'negatives format with a leading minus');
ok(formatMinor(toMinor(1234.5), { symbol: true }) === '₹1,234.50', 'the ₹ symbol is optional');

// ── 7. PURITY ────────────────────────────────────────────────────────────────
const raw = readFileSync(pathResolve(SRC, 'lib', 'money.ts'), 'utf8');
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(code.includes('roundMinor') && code.length > 800, 'the purity scan sees real code');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `money.ts is pure & deterministic (no "${forbidden}")`);
}

console.log(`\nExact money (minor units): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
