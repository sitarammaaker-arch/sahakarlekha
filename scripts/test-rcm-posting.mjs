// Reverse charge (RCM) — how a flagged purchase is totalled and posted (src/lib/rcm.ts, lib/invoiceTotals.ts,
// lib/accounting/gstLedgers.ts). The rule is read from the text (cited in lib/rcm.ts):
//   supplier is owed the value only (CGST Act s.9(3)/(4), s.2(98)); the tax is a separate payable, not output
//   tax (s.2(82); Rule 56(4)), paid in cash (Rule 85(4)); and it is input tax of the recipient (s.2(62)(b)).
// Pins: the voucher balances, the supplier never carries the GST, the tax sits on 2297 — never 2201 / Output
// heads — and a purchase without the flag is exactly as before.
import { readFileSync } from 'node:fs';
await import('./gen-migration-156.mjs');   // registers the "@/…" + extension-less resolver
const imp = (rel) => import(new URL(rel, import.meta.url).href);
const R = await imp('../src/lib/rcm.ts');
const T = await imp('../src/lib/invoiceTotals.ts');
const G = await imp('../src/lib/accounting/gstLedgers.ts');
const V = await imp('../src/lib/voucherUtils.ts');
const A = await imp('../src/lib/invoiceAdjustments.ts');
const S = await imp('../src/lib/storage.ts');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const p = (n) => Math.round(n * 100);
const chart = S.fullChartForType('marketing_processing');

// The purchase voucher exactly as DataContext.addPurchase builds it (same helpers, same order).
function purchaseVoucher(data, accounts = chart) {
  const t = R.rcmPurchaseTerms(data);
  const rcmAcc = t.rcm ? G.rcmPayableAccountId(accounts) : null;
  if (t.rcm && !rcmAcc) return null;
  const grandTotal = t.grandTotal;
  const lines = [];
  V.splitNetByAccount([{ accountId: '5101', weight: 1 }], A.goodsBase('purchase', grandTotal, data.roundOff, data.cashDiscount), t.taxInPayable, data.tdsAmount || 0, data.tcsAmount || 0)
    .forEach((l) => lines.push({ ...l, type: 'Dr' }));
  G.gstLedgerLegs('input', { cgst: data.cgstAmount, sgst: data.sgstAmount, igst: data.igstAmount, total: data.taxAmount || 0 }, accounts)
    .forEach((g) => lines.push({ accountId: g.accountId, type: 'Dr', amount: g.amount }));
  if (t.rcm) lines.push({ accountId: rcmAcc, type: 'Cr', amount: t.rcmTax });
  if ((data.tcsAmount || 0) > 0) lines.push({ accountId: '3307', type: 'Dr', amount: data.tcsAmount });
  if (grandTotal > 0) lines.push({ accountId: 'SUPPLIER', type: 'Cr', amount: grandTotal });
  if ((data.tdsAmount || 0) > 0) lines.push({ accountId: '2202', type: 'Cr', amount: data.tdsAmount });
  A.adjustmentLines('purchase', accounts, data.roundOff, data.cashDiscount).forEach((l) => lines.push(l));
  return { lines, grandTotal };
}
const bal = (v) => v.lines.reduce((s, l) => s + (l.type === 'Dr' ? 1 : -1) * p(l.amount), 0);
const amt = (v, id) => v.lines.filter((l) => l.accountId === id).reduce((s, l) => s + (l.type === 'Dr' ? 1 : -1) * p(l.amount), 0) / 100;
const form = (o) => ({ ...T.computeInvoiceTotals(o), rcmApplicable: !!o.rcm });

// ── Totals: under reverse charge the GST is computed but is not in the bill total ───────────────
{
  const plain = T.computeInvoiceTotals({ items: [{ amount: 10000 }], cgstPct: 2.5, sgstPct: 2.5 });
  const rcm = T.computeInvoiceTotals({ items: [{ amount: 10000 }], cgstPct: 2.5, sgstPct: 2.5, rcm: true });
  ok(plain.taxAmount === 500 && plain.grandTotal === 10500, 'ordinary purchase: total = value + GST (unchanged)');
  ok(rcm.taxAmount === 500 && rcm.cgstAmount === 250 && rcm.sgstAmount === 250, 'reverse charge: the GST is still worked out (self-assessed)');
  ok(rcm.grandTotal === 10000 && rcm.totalBeforeRoundOff === 10000, 'reverse charge: the supplier is owed the value only — 10,000, not 10,500');
  const withAll = T.computeInvoiceTotals({ items: [{ amount: 10000 }], igstPct: 5, tdsPct: 2, tcsPct: 1, cashDiscount: 100, roundOff: 0.5, rcm: true });
  ok(p(withAll.grandTotal) === p(10000 + 100 - 200 - 100 + 0.5), 'reverse charge with TDS, TCS, cash discount and round off: value + TCS − TDS − discount + round off');
  ok(T.computeInvoiceTotals({ items: [{ amount: 10000 }], cgstPct: 9, sgstPct: 9, rcm: false }).grandTotal === 11800, 'rcm: false is the ordinary total');
}

// ── Posting: a reverse-charge purchase ──────────────────────────────────────────────────────────
{
  const d = form({ items: [{ amount: 10000 }], cgstPct: 2.5, sgstPct: 2.5, rcm: true });
  const v = purchaseVoucher(d);
  ok(v && bal(v) === 0, 'voucher balances');
  ok(amt(v, '5101') === 10000, 'Dr Purchases 10,000 (the value — no tax in the cost)');
  ok(amt(v, 'SUPPLIER') === -10000, 'Cr Supplier 10,000 — the GST is NOT owed to the supplier');
  ok(amt(v, '3391') === 250 && amt(v, '3392') === 250, 'Dr Input CGST 250 + Input SGST 250 (input tax of the recipient)');
  ok(amt(v, '2297') === -500, 'Cr Reverse Charge GST Payable (2297) 500');
  ok(!v.lines.some((l) => ['2201', '2291', '2292', '2293'].includes(l.accountId)), 'never on GST Payable / Output heads — reverse-charge tax is not output tax');

  const inter = purchaseVoucher(form({ items: [{ amount: 20000 }], igstPct: 5, rcm: true }));
  ok(bal(inter) === 0 && amt(inter, '3393') === 1000 && amt(inter, '2297') === -1000 && amt(inter, 'SUPPLIER') === -20000, 'inter-State: Dr Input IGST 1,000 / Cr 2297 1,000 / Cr Supplier 20,000');

  const full = purchaseVoucher(form({ items: [{ amount: 10000 }], cgstPct: 9, sgstPct: 9, tdsPct: 2, tcsPct: 1, cashDiscount: 100, roundOff: 0.5, rcm: true }));
  ok(bal(full) === 0, 'balances with TDS + TCS + cash discount + round off');
  ok(amt(full, '5101') === 10000 && amt(full, '2297') === -1800 && amt(full, '2202') === -200 && amt(full, '3307') === 100, 'value 10,000 · RCM 1,800 · TDS 200 · TCS 100 each on its own head');
  ok(p(amt(full, 'SUPPLIER')) === -p(10000 + 100 - 200 - 100 + 0.5), 'supplier owed value + TCS − TDS − discount + round off, no GST');
}

// ── Posting: without the flag nothing changes ───────────────────────────────────────────────────
{
  const v = purchaseVoucher(form({ items: [{ amount: 10000 }], cgstPct: 2.5, sgstPct: 2.5 }));
  ok(bal(v) === 0 && amt(v, 'SUPPLIER') === -10500 && amt(v, '5101') === 10000 && amt(v, '3391') === 250, 'ordinary purchase: Cr Supplier 10,500, Dr Purchases 10,000, Dr Input 500');
  ok(!v.lines.some((l) => l.accountId === '2297'), 'ordinary purchase: no reverse-charge line');
  const flaggedNoTax = purchaseVoucher(form({ items: [{ amount: 10000 }], rcm: true }));
  ok(bal(flaggedNoTax) === 0 && !flaggedNoTax.lines.some((l) => l.accountId === '2297') && amt(flaggedNoTax, 'SUPPLIER') === -10000, 'flag ticked but no GST rate entered → no tax to post, plain purchase');
}

// ── A bill that still carries the GST in its total is brought to the reverse-charge shape ───────
{
  const old = { rcmApplicable: true, netAmount: 10000, cgstAmount: 250, sgstAmount: 250, igstAmount: 0, taxAmount: 500, grandTotal: 10500 };
  const t = R.rcmPurchaseTerms(old);
  ok(t.rcm && t.grandTotal === 10000 && t.taxInPayable === 0 && t.rcmTax === 500, 'old-shape flagged bill (total 10,500) → supplier 10,000 + RCM payable 500');
  const v = purchaseVoucher(old);
  ok(bal(v) === 0 && amt(v, 'SUPPLIER') === -10000 && amt(v, '5101') === 10000 && amt(v, '2297') === -500, 'so an EDIT of an old flagged purchase posts by the new rule');
  ok(R.rcmPurchaseTerms({ ...old, grandTotal: 10000 }).grandTotal === 10000, 'a bill already in the new shape is left alone');
  ok(JSON.stringify(R.rcmPurchaseTerms({ ...old, rcmApplicable: false })) === JSON.stringify({ rcm: false, grandTotal: 10500, taxInPayable: 500, rcmTax: 0 }), 'not flagged → untouched');
  ok(R.rcmPurchaseTerms({ rcmApplicable: true, netAmount: 100 }).rcm === false && R.rcmPurchaseTerms({ rcmApplicable: true, netAmount: 100 }).grandTotal === 100, 'no grandTotal given → falls back to the net');
  ok(R.rcmTaxOutsideTotal({ ...old, grandTotal: 10000 }) && !R.rcmTaxOutsideTotal(old) && !R.rcmTaxOutsideTotal({ ...old, rcmApplicable: false }), 'rcmTaxOutsideTotal: true only for a flagged bill whose total carries no GST');
}

// ── The reverse-charge payable head ─────────────────────────────────────────────────────────────
{
  ok(G.rcmPayableAccountId(chart) === '2297', 'standard chart → 2297');
  for (const t of ['marketing_processing', 'pacs', 'consumer', 'dairy', 'housing', 'sugar', 'transport'])
    ok(G.rcmPayableAccountId(S.fullChartForType(t)) === '2297', `${t}: the head is in the chart`);
  const none = chart.filter((a) => a.id !== '2297');
  ok(G.rcmPayableAccountId(none) === null && purchaseVoucher(form({ items: [{ amount: 100 }], cgstPct: 9, sgstPct: 9, rcm: true }), none) === null, 'no reverse-charge head → the purchase is refused (nothing is posted elsewhere)');
  ok(G.rcmPayableAccountId(chart, new Set(['2297'])) === null, 'a head on screen but not in the database is not used');
  const taken = chart.map((a) => (a.id === '2297' ? { ...a, name: 'Staff Advance Payable' } : a));
  ok(G.rcmPayableAccountId(taken) === null, "a society's own account at code 2297 is never used for RCM");
  ok(G.rcmPayableAccountId([...taken, { id: 'X', name: 'GST RCM Payable', type: 'liability' }]) === 'X', "a society's own single RCM payable ledger is used");
  ok(G.rcmPayableAccountId([{ id: '2297', name: 'Reverse Charge GST Payable (RCM)', type: 'liability', isGroup: true }]) === null, 'a group is never posted to');
  ok(G.rcmPayableAccountId([{ id: '2201', name: 'GST Payable', type: 'liability' }, { id: '2291', name: 'Output CGST', type: 'liability' }]) === null, 'GST Payable / Output CGST are never read as the RCM head');
  ok(G.gstHeadAccountId('output', 'cgst', chart) === '2291' && !/\brcm\b|reverse charge/i.test('Output CGST'), 'and the RCM head is never read as an output head');
}

// ── Return of a reverse-charge purchase (ConsumerDataContext.addPurchaseReturn) ─────────────────
{
  const rcmVoucher = { lines: [{ accountId: '5101' }, { accountId: '3391' }, { accountId: '3392' }, { accountId: '2297' }, { accountId: 'SUPPLIER' }] };
  const oldVoucher = { lines: [{ accountId: '5101' }, { accountId: '3310' }, { accountId: 'SUPPLIER' }] };
  ok(G.voucherRcmAccountId(rcmVoucher, chart) === '2297', 'a purchase voucher with a 2297 line was posted under reverse charge');
  ok(G.voucherRcmAccountId(oldVoucher, chart) === null && G.voucherRcmAccountId(null, chart) === null, 'an older flagged purchase (tax went to the supplier) / missing voucher → not reverse-charge posted');
  // Half of a 10,000 + 500 RCM purchase returned: Cr Purchases 5,000, Cr Input 250, Dr Supplier 5,000, Dr 2297 250.
  const net = 5000, tax = 250, rcmAcc = G.voucherRcmAccountId(rcmVoucher, chart);
  const grand = net + (rcmAcc ? 0 : tax);
  const legs = [{ t: 'Cr', a: net }, ...G.gstLedgerLegs('input', { cgst: 125, sgst: 125, total: tax }, chart).map((g) => ({ t: 'Cr', a: g.amount })), { t: 'Dr', a: grand }, ...(rcmAcc ? [{ t: 'Dr', a: tax }] : [])];
  ok(grand === 5000 && legs.reduce((s, l) => s + (l.t === 'Dr' ? 1 : -1) * p(l.a), 0) === 0, 'return: supplier gives back the value only; the tax comes off Input and off 2297; balanced');
  const src = readFileSync(new URL('../src/contexts/ConsumerDataContext.tsx', import.meta.url), 'utf8');
  ok((src.match(/const rcmAccId = taxAmount > 0 \? voucherRcmAccountId\(/g) || []).length === 2
    && (src.match(/round2\(netAmount \+ \(rcmAccId \? 0 : taxAmount\) - cashDiscShare\)/g) || []).length === 2
    && (src.match(/if \(rcmAccId\) lines\.push\(\{ id: lid\(\), accountId: rcmAccId, type: 'Dr', amount: taxAmount \}\)/g) || []).length === 2, 'both purchase-return paths (add + edit) use it');
}

// ── Wiring (source guards — there is no runnable harness for the contexts) ──────────────────────
{
  const dc = readFileSync(new URL('../src/contexts/DataContext.tsx', import.meta.url), 'utf8');
  ok((dc.match(/const rcmT = rcmPurchaseTerms\(data\);/g) || []).length === 2, 'addPurchase and updatePurchase both apply rcmPurchaseTerms');
  ok((dc.match(/goodsBase\('purchase', grandTotal, data\.roundOff, data\.cashDiscount\), rcmT\.taxInPayable,/g) || []).length === 2, 'both take only the tax that is in the payable back out of the goods value');
  ok((dc.match(/if \(rcmT\.rcm\) lines\.push\(\{ id: lid\(\), accountId: rcmAccId!, type: 'Cr', amount: rcmT\.rcmTax/g) || []).length === 2, 'both credit the reverse-charge payable');
  ok((dc.match(/if \(rcmT\.rcm && !rcmAccId\) \{/g) || []).length === 2, 'both refuse when the head is missing');
  // In updatePurchase the refusal must come before stock or the old voucher is touched.
  const up = dc.slice(dc.indexOf('const updatePurchase = useCallback('));
  ok(up.indexOf('if (rcmT.rcm && !rcmAccId)') > 0 && up.indexOf('if (rcmT.rcm && !rcmAccId)') < up.indexOf('setStockItemsState('), 'updatePurchase refuses BEFORE any stock / voucher change');
  const pm = readFileSync(new URL('../src/pages/PurchaseManagement.tsx', import.meta.url), 'utf8');
  ok((pm.match(/rcm: rcmApplicable \}\)/g) || []).length === 2, 'the purchase form totals follow the RCM tick box');
  const gs = readFileSync(new URL('../src/pages/GstSummary.tsx', import.meta.url), 'utf8');
  ok(/const rcmIn = useMemo\(\(\) => computeRCM\(activePurchases/.test(gs) && /isup_rev: \{ txval: rcmIn\.taxableValue/.test(gs) && /outputTotals\.tax\s+\+ rcmIn\.total - itcTotals\.tax/.test(gs), 'GST Summary: 3.1(d), the 3B JSON and net payable carry the reverse-charge tax (same computeRCM as GSTR-9)');
}

console.log(`RCM posting: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
