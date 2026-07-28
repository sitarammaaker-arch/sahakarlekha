// rpParticulars — the Receipts & Payments line label that makes a "…Payable" line read as
// PAID (Payments side) or RECEIVED (Receipts side), instead of looking still-owed.
//
// THE CONFUSION IT FIXES: "By Salary Payable ₹2,44,303" sat under Payments and a founder read
// it as "still owed" ("salary is paid, why does it show in Payable?"). The side already means
// paid; this makes it explicit. View-only — never touches amount or the underlying accountName.
//
// Imports the REAL src/lib/ledger/rpLabel.ts via the '@/' loader.
// Run: node scripts/test-rp-label.mjs   (npm run test:rp-label)

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
      import { pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        return next(spec, ctx);
      }
    `),
);

const { rpParticulars, isPayableHead } = await import(abs('../src/lib/ledger/rpLabel.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const salaryPayable = { accountName: 'Salary Payable', accountNameHi: 'वेतन देय', glType: 'liability' };
const epfPayable    = { accountName: 'EPF Payable', accountNameHi: 'देय EPF', glType: 'liability' };
const hafed         = { accountName: 'DM HAFED KARNAL', accountNameHi: 'डीएम हैफेड करनाल', glType: 'asset' };
const forestSale    = { accountName: 'Timber Sales', accountNameHi: 'लकड़ी बिक्री', glType: 'income' };

// 1. THE FIX: a payable on the Payments (By) side reads as PAID, not owed.
ok(rpParticulars(salaryPayable, 'By', false) === 'Salary Payable (paid)', 'By + payable → "(paid)" [en]');
ok(rpParticulars(salaryPayable, 'By', true) === 'वेतन देय (चुकाया गया)', 'By + payable → "(चुकाया गया)" [hi]');
ok(rpParticulars(epfPayable, 'By', true) === 'देय EPF (चुकाया गया)', 'EPF Payable on payments reads as paid');

// 2. A payable on the Receipts (To) side reads as RECEIVED.
ok(rpParticulars(salaryPayable, 'To', false) === 'Salary Payable (received)', 'To + payable → "(received)" [en]');
ok(rpParticulars(epfPayable, 'To', true) === 'देय EPF (प्राप्त)', 'To + payable → "(प्राप्त)" [hi]');

// 3. Non-liability heads are untouched (no confusion to fix, so no clutter).
ok(rpParticulars(hafed, 'By', false) === 'DM HAFED KARNAL', 'an asset head is shown as-is');
ok(rpParticulars(forestSale, 'To', true) === 'लकड़ी बिक्री', 'an income head is shown as-is (hi)');

// 4. It NEVER changes the amount or the underlying accountName (only the display string).
ok(!rpParticulars(salaryPayable, 'By', false).includes('undefined'), 'label never leaks undefined');
ok('accountName' in salaryPayable && salaryPayable.accountName === 'Salary Payable', 'the source item is not mutated');

// 5. SAFETY: glType missing → still catches "…Payable" by name (older data path).
ok(isPayableHead({ accountName: 'Bonus Payable', accountNameHi: 'बोनस देय' }), 'name-based fallback: "…Payable" is a payable head even without glType');
ok(rpParticulars({ accountName: 'Bonus Payable', accountNameHi: 'बोनस देय' }, 'By', false) === 'Bonus Payable (paid)', 'fallback still clarifies on the payments side');
ok(!isPayableHead({ accountName: 'Cash at Bank', glType: 'asset' }), 'a non-payable asset is not treated as a payable');

// 6. hi fallback: no Hindi name → uses English name, still clarified.
ok(rpParticulars({ accountName: 'TDS Payable', glType: 'liability' }, 'By', true) === 'TDS Payable (चुकाया गया)', 'hi with no accountNameHi falls back to the English name + hi tag');

console.log(`\nR&P label (paid/received clarity): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
