// Round off (sale + purchase) and cash discount (purchase, after GST) — the voucher a bill posts must balance and
// route each adjustment to the right side of the right account. Builds the voucher exactly as DataContext does:
// computeInvoiceTotals → splitNetByAccount(goodsBase(...)) + GST/TDS/TCS lines + adjustmentLines(...).
// Imports the REAL src/lib files via an '@/'-resolving loader.
//
// Run: node scripts/test-round-off-cash-discount.mjs   (npm run test:round-off-cash-discount)
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts']) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const abs = (p) => pathToFileURL(pathResolve(HERE, p)).href;
const { computeInvoiceTotals, autoRoundOff } = await import(abs('../src/lib/invoiceTotals.ts'));
const { splitNetByAccount } = await import(abs('../src/lib/voucherUtils.ts'));
const { isAbnormalBalance } = await import(abs('../src/lib/abnormalBalance.ts'));
const { goodsBase, adjustmentLines, resolveRoundOffAccountId, resolveDiscountReceivedAccountId } = await import(abs('../src/lib/invoiceAdjustments.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const paise = (n) => Math.round(n * 100);
const sum = (ls, t) => ls.filter((l) => l.type === t).reduce((s, l) => s + paise(l.amount), 0);
const ACC = [{ id: '5499', subtype: 'round_off' }, { id: '4499', subtype: 'discount_received' }];

function saleVoucher(t, roundOff) {
  const lines = [{ accountId: 'DEBTOR', type: 'Dr', amount: t.grandTotal }];
  splitNetByAccount([{ accountId: '4101', weight: 1 }], goodsBase('sale', t.grandTotal, roundOff), t.taxAmount).forEach((l) => lines.push({ ...l, type: 'Cr' }));
  if (t.taxAmount > 0) lines.push({ accountId: '2201', type: 'Cr', amount: t.taxAmount });
  adjustmentLines('sale', ACC, roundOff).forEach((l) => lines.push(l));
  return lines;
}
function purchaseVoucher(t, roundOff, cashDiscount) {
  const lines = [];
  splitNetByAccount([{ accountId: '5101', weight: 1 }], goodsBase('purchase', t.grandTotal, roundOff, cashDiscount), t.taxAmount, t.tdsAmount, t.tcsAmount).forEach((l) => lines.push({ ...l, type: 'Dr' }));
  if (t.taxAmount > 0) lines.push({ accountId: '3310', type: 'Dr', amount: t.taxAmount });
  if (t.tcsAmount > 0) lines.push({ accountId: '3307', type: 'Dr', amount: t.tcsAmount });
  lines.push({ accountId: 'SUPPLIER', type: 'Cr', amount: t.grandTotal });
  if (t.tdsAmount > 0) lines.push({ accountId: '2202', type: 'Cr', amount: t.tdsAmount });
  adjustmentLines('purchase', ACC, roundOff, cashDiscount).forEach((l) => lines.push(l));
  return lines;
}
const find = (ls, acc) => ls.find((l) => l.accountId === acc);

// 1. Sale ₹1,234 + 5% GST = 1,295.70 → +0.30 → ₹1,296 (the plan's example)
{
  const pre = computeInvoiceTotals({ items: [{ amount: 1234 }], cgstPct: 2.5, sgstPct: 2.5 });
  const ro = autoRoundOff(pre.totalBeforeRoundOff);
  const t = computeInvoiceTotals({ items: [{ amount: 1234 }], cgstPct: 2.5, sgstPct: 2.5, roundOff: ro });
  const v = saleVoucher(t, t.roundOff);
  ok(sum(v, 'Dr') === sum(v, 'Cr'), 'sale with round off balances');
  ok(find(v, 'DEBTOR').amount === 1296 && find(v, '4101').amount === 1234 && find(v, '2201').amount === 61.7, 'Dr party 1,296 · Cr sales 1,234 · Cr GST 61.70');
  ok(find(v, '5499')?.type === 'Cr' && find(v, '5499')?.amount === 0.3, 'round off UP on a sale → Cr 5499 0.30');
}
// 2. Sale rounded DOWN
{
  const t = computeInvoiceTotals({ items: [{ amount: 1000.4 }], roundOff: autoRoundOff(1000.4) });
  const v = saleVoucher(t, t.roundOff);
  ok(sum(v, 'Dr') === sum(v, 'Cr') && find(v, 'DEBTOR').amount === 1000 && find(v, '5499')?.type === 'Dr' && find(v, '5499')?.amount === 0.4, 'round off DOWN on a sale → Dr 5499 0.40, balanced');
  ok(find(v, '4101').amount === 1000.4, 'sales income stays at the real value (1,000.40)');
}
// 3. Purchase: trade discount 500, GST 18%, cash discount 105.40, +0.40 → ₹11,105 (the plan's example)
{
  const base = { items: [{ amount: 10000 }], discount: 500, cgstPct: 9, sgstPct: 9, cashDiscount: 105.4 };
  const ro = autoRoundOff(computeInvoiceTotals(base).totalBeforeRoundOff);
  const t = computeInvoiceTotals({ ...base, roundOff: ro });
  const v = purchaseVoucher(t, t.roundOff, t.cashDiscount);
  ok(sum(v, 'Dr') === sum(v, 'Cr'), 'purchase with trade + cash discount + round off balances');
  ok(find(v, '5101').amount === 9500 && find(v, '3310').amount === 1710, 'Dr purchases 9,500 (after trade discount) · Dr ITC 1,710 — unchanged by the cash discount');
  ok(find(v, 'SUPPLIER').amount === 11105 && find(v, '4499')?.type === 'Cr' && find(v, '4499')?.amount === 105.4, 'Cr supplier 11,105 · Cr Discount Received 105.40');
  ok(find(v, '5499')?.type === 'Dr' && find(v, '5499')?.amount === 0.4, 'round off UP on a purchase (we owe more) → Dr 5499 0.40');
}
// 4. Purchase with TDS + TCS + cash discount + round off down — still balances; TDS on the taxable value
{
  const base = { items: [{ amount: 200000 }], igstPct: 5, tdsPct: 0.1, tcsPct: 0.1, cashDiscount: 2000.35 };
  const ro = autoRoundOff(computeInvoiceTotals(base).totalBeforeRoundOff);
  const t = computeInvoiceTotals({ ...base, roundOff: ro });
  const v = purchaseVoucher(t, t.roundOff, t.cashDiscount);
  ok(sum(v, 'Dr') === sum(v, 'Cr'), `purchase with TDS + TCS + cash discount + round off (${ro}) balances`);
  ok(t.tdsAmount === 200 && find(v, '5101').amount === 200000, 'TDS 0.1% of the taxable value (200), goods at 2,00,000');
}
// 5. No adjustments → no extra lines (old bills post exactly as before)
{
  const t = computeInvoiceTotals({ items: [{ amount: 500 }], cgstPct: 9, sgstPct: 9 });
  ok(adjustmentLines('sale', ACC, 0).length === 0 && adjustmentLines('purchase', ACC, 0, 0).length === 0, 'zero round off / cash discount adds no line');
  ok(goodsBase('sale', t.grandTotal) === t.grandTotal && goodsBase('purchase', t.grandTotal) === t.grandTotal, 'goods base = grand total when nothing is adjusted');
  ok(adjustmentLines('sale', ACC, 0, 50).length === 0, 'a sale never posts a cash discount line');
}
// 6. Account resolution: subtype first (a society may hold it under another id), else 5499 / 4499
ok(resolveRoundOffAccountId([{ id: 'uuid-1', subtype: 'round_off' }]) === 'uuid-1' && resolveRoundOffAccountId([]) === '5499', 'round off account: by subtype, else 5499');
ok(resolveDiscountReceivedAccountId([{ id: 'g', subtype: 'discount_received', isGroup: true }]) === '4499', 'a GROUP is never used as the posting account');

ok(!isAbnormalBalance({ type: 'expense', subtype: 'round_off' }, -0.7) && isAbnormalBalance({ type: 'expense' }, -0.7), 'a Cr balance on Round Off is not flagged as abnormal (other expenses still are)');

// 7. Wiring — DataContext uses the helpers on all four paths; the purchase return gives the cash discount back
const dc = readFileSync(pathResolve(SRC, 'contexts/DataContext.tsx'), 'utf8');
ok((dc.match(/goodsBase\('sale', grandTotal, data\.roundOff\)/g) || []).length === 2, 'addSale + updateSale split goods from goodsBase');
ok((dc.match(/goodsBase\('purchase', grandTotal, data\.roundOff, data\.cashDiscount\)/g) || []).length === 2, 'addPurchase + updatePurchase split goods from goodsBase');
ok((dc.match(/adjustmentLines\('sale'/g) || []).length === 2 && (dc.match(/adjustmentLines\('purchase'/g) || []).length === 2, 'adjustment lines on all four paths');
ok(/roundOff: sRound \?\? 0/.test(dc) && /cashDiscount: pCashDisc \?\? 0, roundOff: pRound \?\? 0/.test(dc), 'new columns are saved in step-2 extras (RULE 1), not the base upsert');
const cdc = readFileSync(pathResolve(SRC, 'contexts/ConsumerDataContext.tsx'), 'utf8');
ok((cdc.match(/const cashDiscShare = /g) || []).length === 2 && (cdc.match(/resolveDiscountReceivedAccountId\(accounts\), type: 'Dr', amount: cashDiscShare/g) || []).length === 2, 'purchase return (add + edit) reverses the cash discount in proportion');

console.log(`Round off + cash discount: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
