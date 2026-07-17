// Born-exact invoice totals (T-02 slice 5 / ADR-0006) + the TDS/TCS sign rule.
//
// §5b pins the direction of the two income taxes, because getting it wrong is silent and
// expensive: TDS we deduct (payable DOWN, Cr 2202 — a liability we owe), TCS the seller
// collects (payable UP, Dr 3307 — our own 26AS credit). A real ₹49.23L forest-depot timber
// bill is the fixture; it booked ₹1,64,120 short when its 2% "I.T." was typed into tdsPct.
//
// SaleManagement / PurchaseManagement computed GST/TDS with `+(x).toFixed(2)` /
// `Math.round(x*100)/100`, which misround at a float half-boundary (2.5% of ₹107 = ₹2.675,
// but `(2.675).toFixed(2)` === "2.67"). computeInvoiceTotals now runs every percentage
// through money.applyPercent (disciplined half-up) and every sum in integer paise.
//
// Imports the REAL src/lib/invoiceTotals.ts (which imports @/lib/money) via an '@/'-resolving
// loader — not a reimplementation.
//
// Run: node scripts/test-invoice-totals.mjs   (npm run test:invoice-totals)

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

const { computeInvoiceTotals } = await import(abs('../src/lib/invoiceTotals.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. THE toFixed HALF-BOUNDARY MISROUND IS FIXED ───────────────────────────
ok(+(107 * 2.5 / 100).toFixed(2) === 2.67, 'baseline bug: (2.675).toFixed(2) rounds DOWN to 2.67');
const t1 = computeInvoiceTotals({ items: [{ amount: 107 }], cgstPct: 2.5 });
ok(t1.cgstAmount === 2.68, `applyPercent rounds ₹2.675 half-up to ₹2.68 (got ${t1.cgstAmount})`);
ok(t1.taxAmount === 2.68 && t1.grandTotal === 109.68, 'tax = 2.68, grandTotal = net + tax = 109.68');

// ── 2. NET = Σ items − discount, floored at 0 ────────────────────────────────
ok(computeInvoiceTotals({ items: [{ amount: 100 }, { amount: 50 }], discount: 30 }).netAmount === 120, 'net = 150 − 30 = 120');
ok(computeInvoiceTotals({ items: [{ amount: 100 }], discount: 250 }).netAmount === 0, 'discount ≥ total → net floored at 0 (no negative)');
const t3 = computeInvoiceTotals({ items: [{ amount: 33.33 }, { amount: 33.33 }, { amount: 33.34 }] });
ok(t3.netAmount === 100 && t3.grandTotal === 100, 'item amounts sum exactly to ₹100 (no float drift), no tax → grandTotal 100');

// ── 3. taxAmount === cgst + sgst + igst, to the paisa ────────────────────────
const t4 = computeInvoiceTotals({ items: [{ amount: 1000 }], cgstPct: 9, sgstPct: 9 });
ok(t4.cgstAmount === 90 && t4.sgstAmount === 90 && t4.taxAmount === 180, 'CGST 9% + SGST 9% of ₹1000 = 90 + 90 = 180');
ok(t4.grandTotal === 1180, 'grandTotal = 1000 + 180 = 1180');

// ── 4. PURCHASE: grandTotal = net + tax − tds ────────────────────────────────
const t5 = computeInvoiceTotals({ items: [{ amount: 107 }], cgstPct: 2.5, tdsPct: 10 });
ok(t5.tdsAmount === 10.70, 'TDS 10% of ₹107 = ₹10.70');
ok(t5.grandTotal === 98.98, `grandTotal = 107 + 2.68 − 10.70 = 98.98 (got ${t5.grandTotal})`);

// ── 5. tdsPct omitted (sale) ⇒ tds 0, unaffected ─────────────────────────────
ok(computeInvoiceTotals({ items: [{ amount: 500 }], igstPct: 18 }).tdsAmount === 0, 'a sale (no tdsPct) has tds 0');

// ── 5b. TCS — the SELLER's income tax, which ADDS ────────────────────────────
// THE BILL THAT FOUND THIS: Kohla depot, 01.04.2026, Safeda timber, to The Assandh Cooperative
// Marketing Cum Processing Society. 4149.20 qtl @ ₹988.87 = ₹41,03,009 + IGST 18% ₹7,38,542
// + "I.T." 2% ₹82,060 = ₹49,23,611. The depot COLLECTS that 2% from the society and adds it.
// Before tcsPct existed, the only field on the screen was tdsPct, which subtracts.
const P = (r) => Math.round(r * 100);   // rupees → paise, for exact comparison
const depot = computeInvoiceTotals({ items: [{ amount: 4103009 }], igstPct: 18, tcsPct: 2 });
ok(depot.netAmount === 4103009, `depot bill: taxable ₹41,03,009 (got ${depot.netAmount})`);
ok(P(depot.igstAmount) === P(738541.62), `depot bill: IGST 18% = ₹7,38,541.62 (got ${depot.igstAmount})`);
ok(P(depot.tcsAmount) === P(82060.18), `depot bill: I.T. 2% = ₹82,060.18 (got ${depot.tcsAmount})`);
// KNOWN, DELIBERATE: the depot rounds EACH tax to whole rupees on its bill (₹7,38,542 +
// ₹82,060 = ₹49,23,611); we hold exact paise from the percentage, landing 20 paise lower.
// This is how GST has always behaved here — the operator types a rate, not an amount — so the
// gap is the existing design, not TCS. Pinned so nobody "fixes" the paise away by accident.
ok(P(depot.grandTotal) === P(4923610.80), `depot bill: grand total ₹49,23,610.80 exact (got ${depot.grandTotal})`);
ok(P(4923611) - P(depot.grandTotal) === 20, 'we sit 20 paise under the depot\'s rupee-rounded ₹49,23,611 — rate-driven, as GST always has been');
// The old advice — "put the 2% in TDS" — and why it was wrong by twice the tax.
const asTds = computeInvoiceTotals({ items: [{ amount: 4103009 }], igstPct: 18, tdsPct: 2 });
ok(P(asTds.grandTotal) === P(4759490.44), `the same 2% in tdsPct gives ₹47,59,490.44 — TDS subtracts (got ${asTds.grandTotal})`);
ok(P(depot.grandTotal) - P(asTds.grandTotal) === 2 * P(depot.tcsAmount), 'TDS vs TCS differ by TWICE the tax — opposite signs, never one field');
ok(P(depot.grandTotal) - P(asTds.grandTotal) === P(164120.36), 'the real cost of the confusion on this one bill: ₹1,64,120.36');

// TCS and TDS can ride the same bill without touching each other.
const both = computeInvoiceTotals({ items: [{ amount: 1000 }], igstPct: 18, tdsPct: 10, tcsPct: 1 });
ok(both.tcsAmount === 10 && both.tdsAmount === 100, 'both: TCS ₹10 (1%), TDS ₹100 (10%)');
ok(both.grandTotal === 1000 + 180 + 10 - 100, 'both: grandTotal = net + tax + tcs − tds = ₹1,090');

// TCS is born exact in paise, like every other percentage here (the §1 half-boundary rule).
ok(computeInvoiceTotals({ items: [{ amount: 107 }], tcsPct: 2.5 }).tcsAmount === 2.68, 'TCS 2.5% of ₹107 rounds half-up to ₹2.68, not toFixed 2.67');

// Omitting tcsPct must leave every existing caller's number untouched.
const noTcs = computeInvoiceTotals({ items: [{ amount: 500 }], igstPct: 18, tdsPct: 5 });
ok(noTcs.tcsAmount === 0 && noTcs.grandTotal === 500 + 90 - 25, 'tcsPct omitted ⇒ tcs 0 and the old formula stands (₹565)');

// ── 5c. The purchase voucher balances — Dr(goods) + Dr(ITC) + Dr(TCS) === Cr(payable) ──
// splitNetByAccount must hand the goods lines the GOODS value only. Leave TCS in and the
// ₹41.03L lot books at ₹41.85L — the society's tax credit silently becomes timber cost.
const { splitNetByAccount } = await import(abs('../src/lib/voucherUtils.ts'));
const drGoods = splitNetByAccount(
  [{ accountId: '5101', weight: 4103009 }],
  depot.grandTotal, depot.taxAmount, depot.tdsAmount, depot.tcsAmount,
);
ok(drGoods.length === 1 && drGoods[0].amount === 4103009, `Dr goods = ₹41,03,009, TCS excluded (got ${drGoods[0]?.amount})`);
const drTotal = drGoods.reduce((s, l) => s + l.amount, 0) + depot.taxAmount + depot.tcsAmount;
ok(drTotal === depot.grandTotal, `voucher balances: Dr ₹${drTotal} === Cr ₹${depot.grandTotal}`);
// And the split across two ledgers still sums to the goods value exactly (RULE 4, exact paise).
const twoAcc = splitNetByAccount(
  [{ accountId: '5101', weight: 2000000 }, { accountId: '5102', weight: 2103009 }],
  depot.grandTotal, depot.taxAmount, depot.tdsAmount, depot.tcsAmount,
);
ok(twoAcc.reduce((s, l) => s + l.amount, 0) === 4103009, 'two purchase ledgers still sum to exactly the goods value');
// A purchase with no TCS splits exactly as before (tcs defaults 0 — no caller shifts).
const legacy = splitNetByAccount([{ accountId: '5101', weight: 1000 }], 1090, 180, 100);
ok(legacy[0].amount === 1010, 'no-TCS caller unchanged: net = grandTotal − tax + tds = ₹1,010');

// ── 6. Consumer GRN invoice delegates to the SAME born-exact rule (buildGrnInvoice) ──
const { buildGrnInvoice, lineAmount } = await import(abs('../src/lib/consumer/purchaseOrder.ts'));
// T-02: per-item qty × rate born exact (shared by lineAmount + the sale/purchase item rows).
ok(lineAmount(3, 100.5) === 301.5, 'lineAmount 3 × ₹100.50 = ₹301.50');
ok(lineAmount(2.5, 10) === 25, 'lineAmount 2.5 × ₹10 = ₹25.00');
ok(lineAmount(7, 14.35) === 100.45, 'lineAmount 7 × ₹14.35 = ₹100.45 (exact)');
ok(lineAmount(0, 100) === 0 && lineAmount(3, 0) === 0, 'zero qty / rate → 0');
const paise = (r) => Math.round(r * 100);
const grn = buildGrnInvoice([{ itemId: 'i1', itemName: 'x', unit: 'pc', qty: 1, rate: 107 }], { gstPct: 5 });
ok(grn.netAmount === 107, 'GRN net = billed ₹107');
ok(paise(grn.cgstAmount) === 268 && paise(grn.sgstAmount) === 268, 'GRN CGST=SGST=2.5% of ₹107 = ₹2.68 (applyPercent half-up, not toFixed 2.67)');
ok(paise(grn.cgstAmount) + paise(grn.sgstAmount) === paise(grn.taxAmount), 'GRN cgst + sgst === taxAmount');
ok(paise(grn.netAmount) + paise(grn.taxAmount) === paise(grn.grandTotal), 'GRN net + tax === grandTotal exactly');
// TdsRegister's tdsAmount now uses the same applyPercent half-up (the 2.675 → 2.68 fix, §1).

console.log(`\nInvoice totals (born-exact): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
