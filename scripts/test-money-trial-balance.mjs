// Trial-balance money precision (T-02 slice 1 / ADR-0006).
//
// getTrialBalance (src/contexts/DataContext.tsx) used to accumulate every voucher leg with
// float `+=`, which drifts in the last paisa over thousands of legs (RULE 2 / CA-02, the
// phantom-balance class). It now sums in exact integer paise via src/lib/money.ts. This test
// exercises that SAME accumulation shape against the real money module and proves: the float
// version drifts, the minor-unit version is exact, a balanced book stays exactly balanced,
// and net = Dr − Cr to the paisa. (The React getTrialBalance itself is verified in-app; this
// guards the money-summation invariant it now depends on.)
//
// Run: node scripts/test-money-trial-balance.mjs   (npm run test:money-tb)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let m;
try {
  m = await import(abs('../src/lib/money.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the money module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}
const { toMinor, toRupees, addMinor, subMinor } = m;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// The exact accumulation getTrialBalance now does per account: sum Dr legs and Cr legs in
// paise, net = Dr − Cr. `legs` = [{ type:'Dr'|'Cr', amount:<rupees> }].
function sumLegsMinor(legs) {
  let dr = 0, cr = 0;
  for (const l of legs) {
    if (l.type === 'Dr') dr = addMinor(dr, toMinor(Number(l.amount) || 0));
    else cr = addMinor(cr, toMinor(Number(l.amount) || 0));
  }
  return { drMinor: dr, crMinor: cr, netMinor: subMinor(dr, cr) };
}
// The OLD float way, kept only to demonstrate the drift being removed.
function sumLegsFloat(legs) {
  let dr = 0, cr = 0;
  for (const l of legs) { if (l.type === 'Dr') dr += l.amount; else cr += l.amount; }
  return { dr, cr, net: dr - cr };
}

// ── 1. THE DRIFT THIS SLICE REMOVES ──────────────────────────────────────────
// 10,000 debit legs of ₹0.01 = ₹100.00 exactly. Float repeated-addition drifts.
const pennies = Array.from({ length: 10000 }, () => ({ type: 'Dr', amount: 0.01 }));
const floatPennies = sumLegsFloat(pennies);
const minorPennies = sumLegsMinor(pennies);
ok(floatPennies.dr !== 100, `float drifts: 10000×₹0.01 summed as float = ${floatPennies.dr} (≠ 100 — the bug)`);
ok(minorPennies.drMinor === toMinor(100), 'minor units: 10000×₹0.01 = exactly ₹100.00');
ok(toRupees(minorPennies.drMinor) === 100, 'and converts back to exactly ₹100');

// A ₹100 invoice split three ways, posted as three legs, sums to exactly ₹100.
const split = [{ type: 'Dr', amount: 33.33 }, { type: 'Dr', amount: 33.33 }, { type: 'Dr', amount: 33.34 }];
ok(toRupees(sumLegsMinor(split).drMinor) === 100, 'three split legs sum to exactly ₹100 (float would give 99.99…)');

// ── 2. CLEAN DATA IS UNCHANGED (parity) ──────────────────────────────────────
// Where float does not drift, the minor-unit total equals the float total to the paisa.
const clean = [
  { type: 'Dr', amount: 1500 }, { type: 'Dr', amount: 2500.5 },
  { type: 'Cr', amount: 4000.5 },
];
const cf = sumLegsFloat(clean), cm = sumLegsMinor(clean);
ok(toRupees(cm.drMinor) === cf.dr, `parity: Dr total matches float on clean data (${toRupees(cm.drMinor)})`);
ok(toRupees(cm.crMinor) === cf.cr, 'parity: Cr total matches float on clean data');
ok(toRupees(cm.netMinor) === cf.net, 'parity: net matches float on clean data');

// ── 3. A BALANCED BOOK STAYS EXACTLY BALANCED ────────────────────────────────
// Many drift-prone legs on both sides; total Dr must equal total Cr to the paisa.
const book = [];
for (let i = 0; i < 777; i++) { book.push({ type: 'Dr', amount: 10.10 }); book.push({ type: 'Cr', amount: 10.10 }); }
book.push({ type: 'Dr', amount: 0.05 }); book.push({ type: 'Cr', amount: 0.05 });
const bm = sumLegsMinor(book);
ok(bm.drMinor === bm.crMinor, 'balanced book: total Dr === total Cr exactly (integer paise)');
ok(bm.netMinor === 0, 'balanced book: net is exactly zero (no phantom paisa)');

// ── 4. NET = Dr − Cr TO THE PAISA ────────────────────────────────────────────
const acc = [{ type: 'Dr', amount: 12345.67 }, { type: 'Cr', amount: 2345.67 }, { type: 'Cr', amount: 1000 }];
ok(toRupees(sumLegsMinor(acc).netMinor) === 9000, 'net balance = ₹9000.00 exactly');

// ── 5. BAD / MISSING AMOUNTS DEGRADE TO ZERO, NEVER THROW (render safety) ─────
ok(toRupees(sumLegsMinor([{ type: 'Dr', amount: undefined }, { type: 'Dr', amount: NaN }, { type: 'Dr', amount: 500 }]).drMinor) === 500,
   'undefined/NaN legs count as 0 — getTrialBalance never throws in render');

console.log(`\nTrial-balance money precision: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
