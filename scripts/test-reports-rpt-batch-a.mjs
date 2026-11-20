// RPT-07/08/10/13/17/18/19/20/21-22 (product audit 2026-11-17) — reports batch A.
// Each pure rule is RUN here; each page is checked to use it.
// Run: node scripts/test-reports-rpt-batch-a.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = pathResolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as pathResolve } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
  export async function resolve(spec, ctx, next) {
    if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
    if (spec.startsWith('@/')) { const base = pathResolve(SRC, spec.slice(2)); for (const c of [base + '.ts', base + '.tsx', base + '/index.ts', base]) if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const c of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) { const u = new URL(c, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
    return next(url, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── RPT-08: one return period ──
{
  const G = await imp('src/lib/gstStates.ts');
  ok(JSON.stringify(G.gstReturnPeriod('2026-07-01', '2026-07-31')) === '{"fp":"072026"}', 'one whole month → MMYYYY');
  ok(JSON.stringify(G.gstReturnPeriod('2026-04-01', '2026-06-30')) === '{"fp":"062026"}', 'one QRMP quarter → its last month');
  ok('error' in G.gstReturnPeriod('2026-04-01', '2027-03-31'), 'a whole financial year is refused (was filed as April)');
  ok('error' in G.gstReturnPeriod('2026-07-15', '2026-08-14') && 'error' in G.gstReturnPeriod('2026-07-01', '2026-07-30'), 'a part-month range is refused');
  ok(JSON.stringify(G.gstReturnPeriod('2028-02-01', '2028-02-29')) === '{"fp":"022028"}', 'leap-year February ends on the 29th');
  ok(G.monthLastDay(2026, 7) === '2026-07-31' && G.monthLastDay(2026, 2) === '2026-02-28', '"This Month" ends on the real last day (no IST day-shift)');
  const gs = read('src/pages/GstSummary.tsx');
  ok(gs.includes('ret_period: retPeriod,') && gs.includes('const fp = returnPeriod();') && !gs.includes('fromDate.slice(5, 7) + fromDate.slice(0, 4)'), 'GSTR-1 and GSTR-3B JSON use the checked period');
  ok(gs.includes('const lastDay = monthLastDay(y, m);'), 'the "This Month" button uses it');
  // RPT-09 helpers (used in batch B): inter-state is derived
  ok(G.isInterState('06', '27AAAAA0000A1Z5') === true && G.isInterState('06', '06AAAAA0000A1Z5') === false && G.isInterState('', '27AAAAA0000A1Z5') === false, 'inter-state is derived from the two states');
  ok(G.taxHeadMismatch(true, { cgst: 9, sgst: 9 }) && G.taxHeadMismatch(false, { igst: 18 }) && !G.taxHeadMismatch(true, { igst: 18 }), 'a tax head that disagrees with the place of supply is detected');
}

// ── RPT-07: GSTR-9 counts the RCM liability ──
{
  const R = await imp('src/lib/gstr9.ts');
  const sale = { date: '2026-06-01', netAmount: 10000, cgstAmount: 900, sgstAmount: 900, igstAmount: 0, cgstPct: 9, sgstPct: 9 };
  const rcmPurchase = { date: '2026-06-02', netAmount: 5000, cgstAmount: 125, sgstAmount: 125, igstAmount: 0, cgstPct: 2.5, sgstPct: 2.5 };
  const base = { sales: [sale], purchases: [rcmPurchase], from: '2026-04-01', to: '2027-03-31' };
  ok(R.computeGSTR9(base).netLiability.total === 1550, 'without RCM the payable was 1,550 (the RCM tax silently netted off)');
  const g = R.computeGSTR9({ ...base, rcm: { cgst: 125, sgst: 125, igst: 0 } });
  ok(g.netLiability.total === 1800 && g.rcm.total === 250, 'with RCM it is 1,800 — the same as GST Summary (1,800 + 250 − 250)');
  ok(read('src/pages/GSTR9.tsx').includes('    rcm,\n    from, to,'), 'the GSTR-9 page passes the RCM it computes');
}

// ── RPT-10: e-Way Bill values ──
{
  const E = await imp('src/lib/ewayValues.ts');
  const doc = { totalAmount: 60000, netAmount: 55000, igstAmount: 9900, igstPct: 18, items: [{ amount: 40000 }, { amount: 20000 }] };
  const v = E.ewayValues(doc);
  ok(v.taxable === 55000 && v.invoiceValue === 64900 && v.rate === 18, 'taxable after the trade discount; invoice value = taxable + GST; rate = sum of heads');
  ok(v.itemTaxable[0] + v.itemTaxable[1] === 55000 && Math.abs(v.itemTaxable[0] - 36666.67) < 0.01, 'the discount is spread over the items, which add up exactly');
  ok(E.needsEwayBill({ netAmount: 50000 }) === false && E.needsEwayBill({ netAmount: 45000, cgstAmount: 2700, sgstAmount: 2700 }) === true, 'needed when the invoice value EXCEEDS ₹50,000 (not the payable, not ≥)');
  const page = read('src/pages/EWayBill.tsx');
  ok(page.includes('totalValue: ev.taxable,') && page.includes('totInvValue: ev.invoiceValue,') && page.includes('taxable: ev.itemTaxable[idx] ?? 0,') && page.includes('gstRate: ev.rate,'), 'the JSON uses those values');
  ok(page.includes('needsEwayBill(s)') && page.includes('needsEwayBill(p)') && !page.includes('grandTotal >= 50000'), 'the eligible list uses the same rule');
  ok(page.includes('const fromStateCode = societyStateCode(society);') && !page.includes("|| '09'"), 'no hard-coded Uttar Pradesh state code');
}

// ── RPT-13: purchase TDS party from the supplier ──
{
  const P = await imp('src/lib/tax/purchaseTdsParty.ts');
  const c = P.purchaseTdsParty({ supplierType: 'individual', tdsSection: '194C', pan: 'ABCDE1234F' });
  ok(c.section === '194C' && c.deducteeType === 'individual' && c.natureOfPayment === 'Payment to Contractor' && c.deducteePan === 'ABCDE1234F' && !c.sectionAssumed, 'a 194C contractor stays 194C / individual');
  ok(P.purchaseTdsParty({ supplierType: 'pvtLtd', gstin: '06ABCDE1234F1Z5' }).deducteePan === 'ABCDE1234F' && P.purchaseTdsParty({ supplierType: 'pvtLtd' }).deducteeType === 'company', 'PAN from the current gstin field; a company is a company');
  ok(P.purchaseTdsParty({}).section === '194Q' && P.purchaseTdsParty({}).sectionAssumed && P.deducteeTypeOf(undefined) === 'other' && P.deducteeTypeOf('society') === 'cooperative', 'no section on the supplier → 194Q, marked assumed; unknown type is "other", not "firm"');
  const tr = read('src/pages/TdsRegister.tsx');
  ok(tr.includes('const party = purchaseTdsParty(supplier);') && !tr.includes("deducteeType: 'firm' as TdsDeducteeType") && !tr.includes('tdsRate: p.tdsPct || 0.1'), 'the TDS Register uses it (no hard-coded firm / 194Q / 0.1%)');
}

// ── RPT-17: owned funds = the Balance Sheet ──
{
  const B = await imp('src/lib/balanceSheetLeaves.ts');
  const leaf = (id, type, net, subtype) => ({ account: { id, type, subtype, isGroup: false }, netBalance: net });
  const leaves = { capLiabLeaves: [leaf('1101', 'equity', -300000, 'share_capital'), leaf('1201', 'equity', -300000, 'reserve'), leaf('1208', 'equity', 150000, 'surplus'), leaf('2101', 'liability', -50000)] };
  ok(B.ownedFunds(leaves, 0) === 450000, 'share 3,00,000 + reserves 3,00,000 − deficit 1,50,000 = 4,50,000 (the reports printed 6,00,000)');
  ok(B.ownedFunds(leaves, 25000) === 475000, 'the year\'s unclosed result is included, as on the Balance Sheet');
  for (const p of ['src/pages/NabardReport.tsx', 'src/pages/FederationReport.tsx']) {
    const s = read(p);
    ok(s.includes('return ownedFunds(leaves, balanceSheetResult);') && s.includes('const ownFunds = bsOwnedFunds;'), `${p}: own funds from the Balance Sheet rule`);
  }
}

// ── RPT-18: NPA as on the report date ──
{
  const N = await imp('src/lib/loans/npaClass.ts');
  const asOf = N.reportAsOf('2025-26', new Date(2026, 11, 5));
  ok(asOf.getFullYear() === 2026 && asOf.getMonth() === 2 && asOf.getDate() === 31, 'a past FY is reported as on its last day, whenever opened');
  ok(N.npaClassForDays(N.overdueDaysAt('2025-12-01', asOf)) === 'Sub-Standard', 'a loan due 01-12-2025 is Sub-Standard in the 2025-26 return (was Doubtful if opened in December 2026)');
  const running = N.reportAsOf('2026-27', new Date(2026, 10, 20));
  ok(running.getMonth() === 10 && running.getDate() === 20, 'a running FY is as on today');
  ok(N.overdueDaysAt('', asOf) === 0 && N.overdueDaysAt('not-a-date', asOf) === 0, 'a missing due date is not overdue (was NaN → Loss)');
  for (const p of ['src/pages/NabardReport.tsx', 'src/pages/FederationReport.tsx']) ok(read(p).includes('const today = reportAsOf(society.financialYear);'), `${p}: dated as on the return`);
  ok(read('src/pages/NabardReport.tsx').includes('const cls: NpaClass = npaClassForDays(overdueDays);'), 'NABARD bands with the shared rule');
}

// ── RPT-19 / RPT-20 / RPT-21-22 ──
{
  const ac = read('src/pages/AuditCertificate.tsx');
  ok(ac.includes("const asOn = auditTo || `20${String(fy || '').split('-')[1]}-03-31`;") && ac.includes('getProfitLoss(asOn)') && ac.includes('getTrialBalance(asOn)'), 'Audit Certificate: every figure as on one date');
  ok(!ac.includes('getAccountBalance') && !/b > 0 \? b : 0/.test(ac), '…no all-time balances, share capital signed');
  const fs_ = read('src/pages/FundStatement.tsx');
  ok(fs_.includes('const counted = useMemo(() => vouchers.filter(isCountedVoucher), [vouchers]);') && !fs_.includes('buildFundStatement(f, vouchers)') && !fs_.includes('buildFundStatement(fund, vouchers)'), 'Fund Statement: counted vouchers only (no pending / rejected)');
  const bm = read('src/pages/BudgetModule.tsx');
  ok(bm.includes("const signed = (t === 'income') === (l.type === 'Cr') ? l.amount : -l.amount;") && bm.includes('isCountedVoucher(v) && v.refType !== \'fy.close\''), 'Budget: actual signed by Dr/Cr over counted vouchers, year-close transfer excluded');
  ok(bm.includes("fav: type === 'income' ? diff >= 0 : diff <= 0"), 'Budget: income above budget is favourable');
  // the budget sign rule, run
  const signed = (t, side, amt) => ((t === 'income') === (side === 'Cr') ? amt : -amt);
  ok(signed('income', 'Cr', 100000) + signed('income', 'Dr', 10000) === 90000 && signed('expense', 'Cr', 500) === -500, 'a sales return lowers sales; an expense refund lowers the expense');
}

console.log(`Reports RPT batch A: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
