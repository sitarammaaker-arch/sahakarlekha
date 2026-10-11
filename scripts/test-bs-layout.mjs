// Balance Sheet layout — phase A of the 2026-10-11 review (the society's CA balance sheet + NABARD CAS Annexure IV).
//   B-1 fixed assets net of depreciation (accumulated depreciation stays on the asset side as "Less:")
//   B-2 ONE profit & loss line (brought-forward 1208 + this year), never split, never a stray side
//   B-4 a sub-group is one line; its ledgers are details in a separate column (no column holds a subtotal + parts)
//   B-5 the PDF prints the screen's prior-year column     B-6 Excel/CSV = the same rows, closing stock included
// Every leaf lands exactly once; the sides tie. Runs the real builders.
// Run: node scripts/test-bs-layout.mjs   (npm run test:bs-layout)
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
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
const L = await import(pathToFileURL(resolve(SRC, 'lib', 'balanceSheetLeaves.ts')).href);
const Y = await import(pathToFileURL(resolve(SRC, 'lib', 'reports', 'balanceSheetLayout.ts')).href);
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const near = (a, b) => Math.abs(a - b) < 0.01;

const G = (id, name, type, parentId) => ({ id, name, nameHi: name, type, isGroup: true, parentId });
const A = (id, name, type, parentId, extra = {}) => ({ id, name, nameHi: name, type, isGroup: false, parentId, ...extra });
const accounts = [
  G('1000', 'Capital & Funds', 'equity'), G('1100', 'Share Capital', 'equity', '1000'), G('1200', 'Reserves & Surplus', 'equity', '1000'),
  G('2000', 'Liabilities', 'liability'), G('2100', 'Current Liabilities', 'liability', '2000'), G('2101', 'Sundry Creditors', 'liability', '2100'), G('2300', 'Loans', 'liability', '2000'),
  G('3000', 'Assets', 'asset'), G('3100', 'Fixed Assets', 'asset', '3000'), G('3200', 'Investments', 'asset', '3000'), G('3300', 'Current Assets', 'asset', '3000'),
  G('3302', 'Bank Accounts', 'asset', '3300'), G('3303', 'Sundry Debtors', 'asset', '3300'), G('3303-V', 'Market Supplier Village', 'asset', '3303'), G('3400', 'Inventory', 'asset', '3000'),
  A('1102', 'Individual Share Capital', 'equity', '1100'), A('1201', 'Statutory Reserve Fund', 'equity', '1200'),
  A('1208', 'Net Surplus / (Deficit)', 'equity', '1200', { subtype: 'surplus' }),
  A('2107', 'Member Deposits', 'liability', '2100'), A('2101-01', 'Sundry Creditors — General', 'liability', '2101'), A('2304', 'Loan from DCCB', 'liability', '2300'),
  A('3102', 'Building', 'asset', '3100'), A('3108', 'Accum. Dep. - Building', 'asset', '3100', { subtype: 'accumulated_dep', openingBalanceType: 'credit' }),
  A('3109', 'Accum. Dep. - Furniture', 'asset', '3100', { openingBalanceType: 'credit' }),   // older chart: no subtype, standard id
  A('3205', 'FDR', 'asset', '3200'), A('3301', 'Cash in Hand', 'asset', '3300'), A('3302-01', 'Bank (Main)', 'asset', '3302'),
  A('3303-01', 'Sundry Debtors — General', 'asset', '3303'), A('3303-V1', 'Debtor in village', 'asset', '3303-V'), A('3304', 'Loans & Advances', 'asset', '3300'),
];
const byId = new Map(accounts.map((a) => [a.id, a]));
const tb = (bal) => accounts.filter((a) => !a.isGroup).map((a) => ({ account: a, netBalance: bal[a.id] ?? 0, openingDebit: 0, openingCredit: 0, transactionDebit: 0, transactionCredit: 0 }));
const BASE = { '1102': -350000, '1201': -80000, '1208': -30000, '2107': -150000, '2101-01': -60000, '2304': -300000,
  '3102': 410000, '3108': -80000, '3109': -10000, '3205': 100000, '3301': 20000, '3302-01': 130000, '3303-01': 40000, '3303-V1': 20000, '3304': 250000 };
const make = (bal, netProfit, stock) => {
  const lv = L.balanceSheetLeaves(tb(bal), { closingStockPosted: false, physicalClosingStock: stock, netProfit });
  return { lv, lay: Y.buildBalanceSheetLayout({ accounts, assetLeaves: lv.assetLeaves, capLiabLeaves: lv.capLiabLeaves, unpostedStock: lv.unpostedStock, netProfit }) };
};
const sec = (side, id) => side.sections.find((s) => s.id === id);
const allRows = (lay) => [...lay.liabilities.sections, ...lay.assets.sections].flatMap((s) => s.rows);

// ── profit year ── liab 970k + 45k = 1015k; assets 880k + stock 135k = 1015k
{
  const { lv, lay } = make(BASE, 45000, 135000);
  ok(L.isAccumulatedDepreciation(byId.get('3108')) && L.isAccumulatedDepreciation(byId.get('3109')) && !L.isAccumulatedDepreciation(byId.get('3102')), 'depreciation contra recognised by subtype or the standard id (3108–3112)');
  ok(lv.assetLeaves.some((b) => b.account.id === '3108') && !lv.capLiabLeaves.some((b) => b.account.id === '3108'), 'B-1: accumulated depreciation stays on the asset side');
  ok(near(lv.totalAssets, 1015000) && near(lv.totalLiabilities, 1015000), 'B-1: both totals NET of depreciation (no ₹90,000 inflation) and still tie');
  const fa = sec(lay.assets, '3100');
  ok(fa && fa.rows.map((r) => r.key).join() === 'l-3102,l-3108,l-3109' && fa.rows.slice(1).every((r) => r.tone === 'less' && r.amount < 0) && near(fa.total, 320000), 'B-1: Fixed Assets = cost, then "Less:" depreciation lines; head total = net block');
  ok(fa.rows[1].labelHi.startsWith('घटाएँ: ') && fa.rows[1].label.startsWith('Less: '), 'deduction lines read "घटाएँ: …"');
  ok(!lay.liabilities.sections.some((s) => s.id === 'other'), 'no "Other" head on the liability side any more');
  const res = sec(lay.liabilities, '1200');
  const pl = res.rows.find((r) => r.key === 'pl');
  ok(pl && near(pl.amount, 75000) && !pl.tone, 'B-2: ONE P&L line in Reserves & Surplus = brought forward 30,000 + this year 45,000');
  ok(res.rows.find((r) => r.key === 'pl-bf').amount === 30000 && res.rows.find((r) => r.key === 'pl-cy').amount === 45000 && res.rows.filter((r) => r.key.startsWith('pl-')).every((r) => r.kind === 'detail'), 'B-2: its make-up shows as details (पिछला शेष / इस वर्ष का लाभ)');
  ok(!allRows(lay).some((r) => r.accountId === '1208' && r.key !== 'pl'), 'B-2: the 1208 ledger is not a second line anywhere');
  ok(near(lay.profitAndLoss, 75000), 'layout reports the P&L figure');
  const ca = sec(lay.assets, '3300');
  const bank = ca.rows.find((r) => r.key === 'g-3302'), debt = ca.rows.find((r) => r.key === 'g-3303');
  ok(bank && bank.kind === 'line' && bank.amount === 130000 && ca.rows.some((r) => r.key === 'd-3302-01' && r.kind === 'detail'), 'B-4: a sub-group is one line; its ledgers are details');
  ok(debt.amount === 60000 && ca.rows.some((r) => r.key === 's-3303-V' && r.tone === 'subhead' && r.amount === 20000), 'B-4: a nested group is a subhead among the details (its subtotal is not a summed amount)');
  ok(Y.visibleRows(ca, false).every((r) => r.kind === 'line'), 'summary prints lines only');
  for (const s of [...lay.liabilities.sections, ...lay.assets.sections]) {
    const lines = s.rows.filter((r) => r.kind === 'line');
    if (!near(lines.reduce((t, r) => t + r.amount, 0), s.total)) ok(false, `B-4: head ${s.id} total = its lines`);
  }
  ok(true, 'B-4: every head total = the sum of its lines');
  const inv = sec(lay.assets, '3400');
  ok(inv && inv.rows[0].key === 'cs' && near(inv.total, 135000), 'closing stock is a line of the Inventory head (no loose row)');
  ok(near(lay.liabilities.total, 1015000) && near(lay.assets.total, 1015000), 'layout totals = the leaves totals; sides tie');
  // every leaf exactly once
  const seen = allRows(lay).filter((r) => r.accountId && r.tone !== 'subhead' && r.key !== 'pl').map((r) => r.accountId);
  const expected = Object.keys(BASE).filter((id) => id !== '1208');
  ok(seen.length === expected.length && expected.every((id) => seen.includes(id)), 'every non-zero ledger appears exactly once');
  // export
  const rows = Y.balanceSheetExportRows(lay, true, false);
  ok(rows.every((r) => !(r[3] !== '' && r[4] !== '')), 'B-6: no export row carries both a detail and an amount');
  ok(rows.some((r) => String(r[2]).startsWith('Closing stock')), 'B-6: closing stock is in the export');
  const grand = rows.filter((r) => r[2] === 'GRAND TOTAL').map((r) => r[5]);
  ok(grand.length === 2 && near(grand[0], 1015000) && near(grand[1], 1015000), 'B-6: export grand totals = the sheet');
  const headTotals = rows.filter((r) => r[5] !== '' && r[2] !== 'GRAND TOTAL').reduce((t, r) => t + r[5], 0);
  ok(near(headTotals, 2030000), 'B-6: export head totals add up to both grand totals');
  ok(Y.balanceSheetExportRows(lay, false, true).every((r) => r[3] === ''), 'B-6: summary export has no detail column values');
}

// ── loss year ── liab 970k − 90k = 880k = assets 880k (no stock)
{
  const { lv, lay } = make(BASE, -90000, 0);
  const pl = sec(lay.liabilities, '1200').rows.find((r) => r.key === 'pl');
  ok(pl && near(pl.amount, -60000) && pl.tone === 'less' && pl.labelHi.startsWith('घटाएँ'), 'B-2: a deficit is ONE "घटाएँ: लाभ-हानि खाता (घाटा)" line (30,000 b/f − 90,000 loss)');
  ok(near(lay.liabilities.total, lv.totalLiabilities) && near(lay.assets.total, lv.totalAssets) && near(lay.assets.total, 880000) && near(lay.liabilities.total, 880000), 'loss year ties, totals = the app');
}

// ── 1208 in Dr (accumulated deficit) ── it no longer sits among the assets; it reduces the P&L line
{
  const bal = { ...BASE, '1208': 20000 };       // Dr 20,000 instead of Cr 30,000 → liab 920k + np
  const { lay } = make(bal, 45000, 85000);   // leaves: liab 940k + 45k = assets 880k + Dr 1208 20k + stock 85k
  ok(!lay.assets.sections.some((s) => s.rows.some((r) => r.accountId === '1208')), 'a Dr 1208 is not shown as an asset');
  const pl = sec(lay.liabilities, '1200').rows.find((r) => r.key === 'pl');
  ok(near(pl.amount, 25000), 'Dr 1208 nets into the one P&L line (−20,000 + 45,000)');
  ok(near(lay.liabilities.total, lay.assets.total), 'and the sides still tie');
}

// ── prior year column ties ──
{
  const py = { ...BASE, '4101': -200000, '5101': 155000 };   // last year's books incl. unclosed income/expense
  const pyAccounts = [...accounts, A('4101', 'Sales', 'income', '4100'), A('5101', 'Purchases', 'expense', '5100')];
  const pyNet = Y.pyResult(py, pyAccounts);
  ok(pyNet === 45000, 'prior-year result = −Σ income/expense balances');
  const lv = L.balanceSheetLeaves(tb(BASE), { closingStockPosted: false, physicalClosingStock: 135000, netProfit: 45000 });
  const lay = Y.buildBalanceSheetLayout({ accounts, assetLeaves: lv.assetLeaves, capLiabLeaves: lv.capLiabLeaves, unpostedStock: lv.unpostedStock, netProfit: 45000, py, pyNetProfit: pyNet });
  ok(near(lay.liabilities.pyTotal, 1015000) && near(lay.assets.pyTotal, 880000), 'prior-year head totals come from the prior balances (stock has no prior figure)');
  ok(sec(lay.liabilities, '1200').rows.find((r) => r.key === 'pl').py === 75000, 'prior-year P&L line = prior 1208 + prior result');
}

// ── flipped-side balances under their IMMEDIATE sub-group (2026-10-11, founder) ──
// A creditor gone Dr shows on the asset side as "<its sub-group> (Dr शेष)" with that sub-group's total there, its
// ledgers as details; an error-looking one stays inside the ⚠ head (still grouped), an intentional one is a line of
// Current Assets. The mirror (an asset gone Cr) works the same way on the liability side.
{
  const extra = [
    G('2101-08', 'Market Supplier Kharia', 'liability', '2101'), G('3303-K', 'Arthiya Kharia', 'asset', '3303'),
    A('2101-08-A', 'A Trading Co', 'liability', '2101-08', { openingBalance: 1000, openingBalanceType: 'debit' }),   // opened Dr by mistake → reversed
    A('2101-08-B', 'B Trading Co', 'liability', '2101-08', { openingBalance: 5000, openingBalanceType: 'credit' }),  // normal Cr
    A('2101-08-C', 'C Trading Co', 'liability', '2101-08', { openingBalance: 0, openingBalanceType: 'debit' }),      // user-made contra → intentional
    A('2101-08-D', 'D Trading Co', 'liability', '2101-08', { openingBalance: 300, openingBalanceType: 'debit' }),    // second reversed in the same group
    A('3303-K1', 'Arthiya One', 'asset', '3303-K', { openingBalance: 700, openingBalanceType: 'debit' }),            // asset gone Cr → reversed
    A('3303-K2', 'Arthiya Two', 'asset', '3303-K', { openingBalance: 0, openingBalanceType: 'credit' }),             // asset contra → intentional
    A('9999', 'Loose ledger', 'asset'),                                                                               // no parent at all
  ];
  const acc = [...accounts, ...extra];
  const bal = { ...BASE, '2101-08-A': 1000, '2101-08-B': -5000, '2101-08-C': 2000, '2101-08-D': 300, '3303-K1': -3000, '3303-K2': -4000, '9999': 600 };
  const tb2 = acc.filter((a) => !a.isGroup).map((a) => ({ account: a, netBalance: bal[a.id] ?? 0, openingDebit: 0, openingCredit: 0, transactionDebit: 0, transactionCredit: 0 }));
  const lv = L.balanceSheetLeaves(tb2, { closingStockPosted: false, physicalClosingStock: 0, netProfit: 0 });
  const lay = Y.buildBalanceSheetLayout({ accounts: acc, assetLeaves: lv.assetLeaves, capLiabLeaves: lv.capLiabLeaves, unpostedStock: lv.unpostedStock, netProfit: 0 });
  const revA = sec(lay.assets, 'reversed');
  const lineA = revA && revA.rows.find((r) => r.key === 'f-rev-2101-08');
  ok(lineA && lineA.kind === 'line' && lineA.labelHi === 'Market Supplier Kharia (Dr शेष)' && near(lineA.amount, 1300), 'reversed creditors: ONE line named after their immediate sub-group, with its Dr total there (1,000 + 300)');
  ok(revA.rows.filter((r) => r.kind === 'detail').map((r) => r.accountId).join() === '2101-08-A,2101-08-D' && revA.rows.filter((r) => r.kind === 'detail').every((r) => r.depth === 1), 'its ledgers are details under it (full detail only)');
  ok(revA.warn === true && near(revA.total, 1300), 'the ⚠ head is kept for error-looking balances; its total = the sub-group lines');
  const ca = sec(lay.assets, '3300');
  const lineC = ca.rows.find((r) => r.key === 'f-cur-2101-08');
  ok(lineC && lineC.kind === 'line' && lineC.label === 'Market Supplier Kharia (Dr balances)' && near(lineC.amount, 2000) && ca.rows.some((r) => r.key === 'd-2101-08-C' && r.kind === 'detail'), 'an intentional Dr creditor is a line of Current Assets under its sub-group name');
  ok(!lay.assets.sections.some((s) => s.rows.some((r) => r.accountId === '2101-08-B')), 'the normal Cr creditor stays on the liability side only');
  const revL = sec(lay.liabilities, 'reversed');
  ok(revL && revL.rows.some((r) => r.key === 'f-rev-3303-K' && r.labelHi === 'Arthiya Kharia (Cr शेष)' && near(r.amount, 3000)), 'mirror: an asset gone Cr (error-looking) → liability-side ⚠ head, under its sub-group (Cr शेष)');
  const cl = sec(lay.liabilities, '2100');
  ok(cl.rows.some((r) => r.key === 'f-cur-3303-K' && near(r.amount, 4000)), 'mirror: an intentional asset contra → a line of Current Liabilities under its sub-group');
  const oth = sec(lay.assets, 'other');
  ok(oth && oth.rows.length === 1 && oth.rows[0].accountId === '9999', 'a ledger with no parent group still falls back to "Other" (never dropped)');
  ok(near(lay.assets.total, lv.totalAssets) && near(lay.liabilities.total, lv.totalLiabilities), 'side totals unchanged = the leaves totals (presentation only)');
  const seen = [...lay.liabilities.sections, ...lay.assets.sections].flatMap((s) => s.rows).filter((r) => r.accountId && r.tone !== 'subhead' && r.key !== 'pl').map((r) => r.accountId);
  const nonZero = Object.keys(bal).filter((id) => id !== '1208');
  ok(seen.length === nonZero.length && nonZero.every((id) => seen.includes(id)), 'every non-zero ledger still appears exactly once');
  for (const s of [...lay.liabilities.sections, ...lay.assets.sections]) {
    if (!near(s.rows.filter((r) => r.kind === 'line').reduce((t, r) => t + r.amount, 0), s.total)) ok(false, `head ${s.id} total = its lines`);
  }
  // no Current Assets head in the chart → its own head, not dropped
  const noCA = acc.filter((a) => a.id !== '3300' && a.parentId !== '3300');
  const lv3 = L.balanceSheetLeaves(tb2.filter((b) => noCA.includes(b.account)), { closingStockPosted: false, physicalClosingStock: 0, netProfit: 0 });
  const lay3 = Y.buildBalanceSheetLayout({ accounts: noCA, assetLeaves: lv3.assetLeaves, capLiabLeaves: lv3.capLiabLeaves, unpostedStock: 0, netProfit: 0 });
  ok(sec(lay3.assets, 'cur-asset')?.rows.some((r) => r.key === 'f-cur-2101-08'), 'chart without Current Assets: the line gets its own "चालू संपत्ति" head');
}

// ── wiring (RULE 2: one layout, three outputs) ──
const page = read('pages/BalanceSheet.tsx');
ok(/buildBalanceSheetLayout\(\{/.test(page) && /renderSide\(layout\.liabilities/.test(page) && /renderSide\(layout\.assets/.test(page), 'screen renders the shared layout');
ok(/balanceSheetExportRows\(layout, showLedgers, hi\)/.test(page), 'Excel/CSV export = the same layout, in the chosen detail level');
ok(/hasPY \? \{ balances: pyBalances, label: pyYear, netProfit: pyNetProfit \} : undefined/.test(page), 'B-5: the screen hands its prior-year column to the PDF');
const pdf = read('lib/pdf.ts');
ok(/const layout = buildBalanceSheetLayout\(\{/.test(pdf) && /priorYear\?\.balances \?\? society\.previousYearBalances/.test(pdf), 'B-5: PDF prints the same layout and the screen\'s prior year');
ok(!/const buildGroupedBody = \(/.test(pdf), 'the PDF\'s private grouping copy is gone');
ok(/const last = i === rows\.length - 1;/.test(page) && /\{last \? <span/.test(page), 'CA style: the head total sits on the head\'s last line');
ok(/!isStock\(b\) && !isAccumulatedDepreciation\(b\.account\)/.test(read('lib/balanceSheetLeaves.ts')), 'the shared leaves rule keeps the depreciation contra on the asset side');

console.log(`Balance Sheet layout: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
