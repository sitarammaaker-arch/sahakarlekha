// Born-exact sale account split (T-02 slice 3 / RULE 4, ADR-0006).
//
// A sale's net (grandTotal − tax) is apportioned across each item's salesAccountId. It USED
// to round each account bucket independently (Math.round(amt*100)/100), so the buckets could
// sum to net ± a few paise — the imbalance the voucher balance check papers over with a
// 1-paisa tolerance. splitNetByAccount now allocates in integer paise (largest-remainder) so
// the lines sum to EXACTLY net and the voucher balances by construction.
//
// This imports the REAL money.ts (allocateMinor) and the REAL voucherUtils.ts
// (splitNetByAccount) via a loader that resolves the '@/' alias — not a reimplementation.
//
// Run: node scripts/test-sale-split.mjs   (npm run test:sale-split)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

// Loader: resolve '@/x' → src/x and bare extensionless relatives to their .ts file.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { allocateMinor, toMinor, addMinor } = await import(abs('../src/lib/money.ts'));
const { splitNetByAccount } = await import(abs('../src/lib/voucherUtils.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const sumAmt = (arr) => arr.reduce((s, x) => addMinor(s, toMinor(x.amount)), 0);

// ── 1. allocateMinor sums to EXACTLY the total, always ───────────────────────
ok(allocateMinor(10000, [1, 1, 1]).reduce((a, b) => a + b, 0) === 10000, '3-way split of ₹100 sums to exactly 10000 paise');
ok(JSON.stringify(allocateMinor(10000, [1, 1, 1])) === JSON.stringify([3334, 3333, 3333]), 'the leftover paisa goes to the first (largest-remainder, tie by index)');
ok(allocateMinor(101, [1, 1, 1]).reduce((a, b) => a + b, 0) === 101, '2 leftover paise both handed out (sum 101)');
for (const [total, w] of [[12345, [3, 5, 2]], [99999, [1, 1, 1, 1, 1, 1, 1]], [1, [1, 1]], [50050, [7, 0, 3]]]) {
  ok(allocateMinor(total, w).reduce((a, b) => a + b, 0) === total, `allocateMinor(${total}, [${w}]) sums to exactly ${total}`);
}
ok(allocateMinor(-10000, [1, 1, 1]).reduce((a, b) => a + b, 0) === -10000, 'works for a negative total (net return)');
ok(JSON.stringify(allocateMinor(500, [0, 0])) === JSON.stringify([500, 0]), 'all-zero weights → whole total on the first slot');
ok(allocateMinor(500, []).length === 0, 'no slots → empty');

// ── 2. splitNetByAccount: the drift the old rounding produced is gone ─────────
// Three equal items, net ₹100. Old: 3 × round(33.333) = 3 × 33.33 = 99.99 (₹0.01 short).
const equal3 = splitNetByAccount([{ accountId: 'A', weight: 1 }, { accountId: 'B', weight: 1 }, { accountId: 'C', weight: 1 }], 100, 0);
ok(sumAmt(equal3) === toMinor(100), 'three equal items: Cr split sums to EXACTLY ₹100 (old rounding gave 99.99)');
ok(equal3.length === 3, 'one line per account');

// ── 3. VOUCHER BALANCES BY CONSTRUCTION: Dr(grandTotal) = ΣCr(split) + tax ────
// grandTotal 118, tax 18 → net 100 across 3 uneven accounts.
const gt = 118, tax = 18;
const split = splitNetByAccount([{ accountId: 'A', weight: 33.33 }, { accountId: 'B', weight: 33.33 }, { accountId: 'C', weight: 33.34 }], gt, tax);
ok(sumAmt(split) === toMinor(gt - tax), 'split sums to exactly net (grandTotal − tax) = ₹100');
ok(addMinor(sumAmt(split), toMinor(tax)) === toMinor(gt), 'ΣCr(split) + tax === grandTotal exactly — voucher balances with ZERO tolerance');

// ── 4. Same account on two items is merged into one line ─────────────────────
const merged = splitNetByAccount([{ accountId: 'X', weight: 10 }, { accountId: 'Y', weight: 5 }, { accountId: 'X', weight: 5 }], 200, 0);
ok(merged.length === 2, 'two distinct accounts → two lines (duplicates merged)');
ok(sumAmt(merged) === toMinor(200), 'merged split still sums to exactly ₹200');
ok(merged.find(l => l.accountId === 'X').amount === 150, 'X (weight 10+5=15 of 20) gets ₹150; Y gets ₹50');

// ── 5. Degenerate inputs never throw / never unbalance ───────────────────────
ok(splitNetByAccount([], 100, 0).length === 0, 'no items → no split lines');
ok(splitNetByAccount([{ accountId: 'A', weight: 1 }], 50, 50).length === 0, 'net 0 (grandTotal == tax) → no split lines');

console.log(`\nSale account split (born-exact): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
