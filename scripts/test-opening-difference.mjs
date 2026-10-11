// Balance Sheet imbalance follow-up (2026-10-11, recheck of the founder's docx; prod: 3 societies with opening Dr ≠ Cr).
//   P1 a Tally-style "ओपनिंग बैलेंस का अंतर" line on the short side (screen + PDF); the raw imbalance stays visible
//      (status, diagnostic, dashboards) — never hidden
//   P2 wrong-side openings (a liability in Dr …) and openings on income/expense heads are flagged BEFORE save
//   P3 an accounts import says which openings it drops (the account already existed)
//   P4 a sub-rupee gap is snapped the SAME way on create and on edit; anything bigger is refused on both
//   P5 an account's type always matches its parent group's (UI + importer + template test)
// Run: node scripts/test-opening-difference.mjs   (npm run test:opening-difference)
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
const imp = (p) => import(pathToFileURL(resolve(SRC, p)).href);
const L = await imp('lib/balanceSheetLeaves.ts');
const Y = await imp('lib/reports/balanceSheetLayout.ts');
const O = await imp('lib/openingBalances.ts');
const V = await imp('lib/validation.ts');
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const near = (a, b) => Math.abs(a - b) < 0.01;

// ── P1: the opening-difference line ──
const A = (id, name, type, parentId, extra = {}) => ({ id, name, nameHi: name, type, parentId, isGroup: false, ...extra });
const G = (id, name, type, parentId) => ({ id, name, nameHi: name, type, parentId, isGroup: true });
const accounts = [G('1000', 'Capital', 'equity'), G('1100', 'Share Capital', 'equity', '1000'), G('3000', 'Assets', 'asset'), G('3300', 'Current Assets', 'asset', '3000'),
  A('1102', 'Share Capital', 'equity', '1100'), A('3301', 'Cash', 'asset', '3300')];
const tb = (cash, share) => [
  { account: accounts[4], netBalance: share, openingDebit: 0, openingCredit: -share, transactionDebit: 0, transactionCredit: 0 },
  { account: accounts[5], netBalance: cash, openingDebit: cash, openingCredit: 0, transactionDebit: 0, transactionCredit: 0 },
];
for (const [cash, share, sideName] of [[12000, -10000, 'liabilities'], [10000, -12500, 'assets']]) {
  const t = tb(cash, share);
  const lv = L.balanceSheetLeaves(t, { closingStockPosted: false, physicalClosingStock: 0, netProfit: 0 });
  const gap = t.reduce((s, b) => s + b.openingDebit - b.openingCredit, 0);
  const lay = Y.buildBalanceSheetLayout({ accounts, assetLeaves: lv.assetLeaves, capLiabLeaves: lv.capLiabLeaves, unpostedStock: 0, netProfit: 0, openingDifference: gap });
  const od = lay[sideName].sections.find((s) => s.id === 'opening-diff');
  ok(od && od.warn && near(od.total, Math.abs(gap)) && od.titleHi === 'ओपनिंग बैलेंस का अंतर', `P1: gap ${gap} → "ओपनिंग बैलेंस का अंतर" on the ${sideName} side`);
  ok(near(lay.liabilities.total, lay.assets.total) && near(lay.openingDifference, gap), 'P1: the sheet then agrees, and the layout reports the gap');
  ok(!L.balanceSheetTallied(t, { closingStockPosted: false, physicalClosingStock: 0, netProfit: 0 }), 'P1: the dashboards still read "not balanced" (raw tally)');
}
ok(!Y.buildBalanceSheetLayout({ accounts, assetLeaves: [], capLiabLeaves: [], unpostedStock: 0, netProfit: 0, openingDifference: 0.004 }).liabilities.sections.some((s) => s.id === 'opening-diff'), 'P1: no line for a zero gap');
const page = read('pages/BalanceSheet.tsx');
ok(/openingDifference: openingGap,/.test(page) && /const isBalanced = Math\.abs\(rawDiff\) < 1;/.test(page) && /const rawDiff = leafLiabilities - leafAssets;/.test(page), 'P1: the page bridges the opening gap; "balanced" stays the RAW test');
ok(/const diff = residualDiff;/.test(page) && /openingGap,\n    \);/.test(page), 'P1: PDF allowed when only the opening gap remains, and prints the same line');
ok(/ओपनिंग बैलेंस के अंतर के साथ बराबर/.test(page) && /navigate\('\/opening-balances'\)/.test(page), 'P1: status says "equal only with the opening difference" and links to Opening Balances');
const pdf = read('lib/pdf.ts');
ok(/openingDifference: number = 0,/.test(pdf) && /    openingDifference,\n  \}\);/.test(pdf), 'P1: the PDF builds the same layout with the gap');
ok(/'difference in opening balances': 'ओपनिंग बैलेंस का अंतर'/.test(read('lib/pdfHindiLabels.ts')), 'P1: Hindi PDF label');

// ── P2: wrong-side / P&L-head openings ──
const acc2 = [
  A('2101-07', 'Creditor X', 'liability', '2101'), A('3301', 'Cash', 'asset', '3300'), A('3302-09', 'Bank OD wrongly as asset', 'asset', '3302'),
  A('3108', 'Accum. Dep. - Building', 'asset', '3100', { subtype: 'accumulated_dep' }), A('1208', 'Net Surplus', 'equity', '1200', { subtype: 'surplus' }),
  A('1211', 'Dividend Distribution', 'equity', '1200'), A('5301', 'Office Rent', 'expense', '5300'), G('2101', 'Sundry Creditors', 'liability', '2100'),
];
const w = O.openingWarnings([
  { accountId: '2101-07', amount: 165947, type: 'debit' }, { accountId: '3301', amount: 500, type: 'debit' }, { accountId: '3302-09', amount: 3587104, type: 'credit' },
  { accountId: '3108', amount: 80000, type: 'credit' }, { accountId: '1208', amount: 20000, type: 'debit' }, { accountId: '1211', amount: 5000, type: 'debit' },
  { accountId: '5301', amount: 371351, type: 'debit' }, { accountId: '2101', amount: 9, type: 'debit' },
], acc2);
ok(w.wrongSide.map((r) => r.accountId).join() === '3302-09,2101-07', 'P2: a liability in Dr and an asset in Cr are flagged (largest first)');
ok(!w.wrongSide.some((r) => ['3108', '1208', '1211', '3301'].includes(r.accountId)), 'P2: legit contras (depreciation, 1208 deficit, 1211) and normal sides are not');
ok(w.plHeads.length === 1 && w.plHeads[0].accountId === '5301', 'P2: an income/expense opening is listed separately; groups ignored');
const AB = await imp('lib/abnormalBalance.ts');
ok(AB.isAbnormalBalance({ id: '2102', type: 'liability', openingBalance: 5000, openingBalanceType: 'debit' }, 5000), 'P2: a liability OPENED in Dr (non-zero) now reads as a reversed balance (Trial Balance / Balance Sheet / Ledger Hygiene)');
ok(!AB.isAbnormalBalance({ id: 'X9', type: 'liability', openingBalance: 0, openingBalanceType: 'debit' }, 5000), 'P2: a user-made contra (abnormal side set, ₹0 opening) is still respected');
ok(!AB.isAbnormalBalance({ id: '3108', type: 'asset', openingBalance: 80000, openingBalanceType: 'credit' }, -80000) && !AB.isAbnormalBalance({ id: '1211', type: 'equity', openingBalance: 500, openingBalanceType: 'debit' }, 500), 'P2: known contras (depreciation, 1211) never flagged');
const lay2 = Y.buildBalanceSheetLayout({ accounts: [...accounts, A('2102', 'Expenses Payable', 'liability', '2100', { openingBalance: 5000, openingBalanceType: 'debit' })],
  assetLeaves: [{ account: A('2102', 'Expenses Payable', 'liability', '2100', { openingBalance: 5000, openingBalanceType: 'debit' }), netBalance: 5000 }], capLiabLeaves: [], unpostedStock: 0, netProfit: 0, py: {} });
ok(lay2.assets.sections.some((s) => s.id === 'reversed' && s.rows.some((r) => r.accountId === '2102')), 'P2: on the Balance Sheet it lands under "⚠ उलटे शेष वाले खाते", not plain "अन्य"');
ok(lay2.assets.sections.every((s) => s.id !== 'opening-diff'), 'no opening line without a gap');
const ob = read('pages/OpeningBalances.tsx');
ok(/openingWarnings\(Object\.values\(balances\), accounts\)/.test(ob) && /खातों की opening उलटी तरफ़ है/.test(ob) && /आय\/व्यय खातों पर opening है/.test(ob), 'P2: Opening Balances page shows both warnings before save');

// ── P3: accounts import drops openings of existing accounts — and says so ──
const chk = O.accountImportOpeningCheck([
  { account_name: 'Cash in Hand', account_type: 'Asset', opening_balance: '500', balance_type: 'Debit' },
  { account_name: 'New Creditor', account_type: 'Liability', opening_balance: '900', balance_type: 'Debit' },
  { account_name: 'Zero Row', account_type: 'Asset', opening_balance: '0', balance_type: 'Debit' },
], [{ name: 'cash in hand' }]);
ok(chk.dropped.join() === 'Cash in Hand' && chk.warnings.wrongSide.map((r) => r.name).join() === 'New Creditor', 'P3: existing account with an opening → dropped; a new liability in Dr → wrong side');
const ui = read('pages/UniversalImporter.tsx');
ok(/const droppedOpenings = validRows/.test(ui) && /\$\{droppedNote\}/.test(ui), 'P3: the import result names the openings it did not apply');
ok(/<OpeningWarnCard w=\{accountOpeningCheck\.warnings\} dropped=\{accountOpeningCheck\.dropped\} \/>/.test(ui) && /<OpeningWarnCard w=\{obOpeningCheck\} \/>/.test(ui), 'P2/P3: both import previews warn BEFORE import');

// ── P4: one sub-rupee rule ──
const L3 = (dr, cr1, cr2) => [{ id: 'a', accountId: 'x', type: 'Dr', amount: dr }, { id: 'b', accountId: 'y', type: 'Cr', amount: cr1 }, { id: 'c', accountId: 'z', type: 'Cr', amount: cr2 }];
const snapped = V.snapSubRupeeResidual(L3(1000, 600, 399.6));
ok(V.voucherLinesBalance(snapped).balanced && snapped[1].amount === 600.4, 'P4: a 40-paise gap goes to the largest line on the short side');
const big = L3(1000, 600, 398);
ok(V.snapSubRupeeResidual(big) === big && !V.voucherLinesBalance(big).balanced, 'P4: ₹1 or more is left for the caller to refuse');
const dc = read('contexts/DataContext.tsx');
ok((dc.match(/snapSubRupeeResidual\(/g) || []).length === 2 && /updatedVoucher\.lines = snapSubRupeeResidual\(updatedVoucher\.lines\);\s*const bal = voucherLinesBalance\(updatedVoucher\.lines\);\s*if \(!bal\.balanced\) \{/.test(dc), 'P4: create AND edit use it; an edit refuses any remaining gap');

// ── P5: type = parent type ──
const lh = read('pages/LedgerHeads.tsx');
ok(/accounts\.filter\(a => a\.isGroup && a\.type === form\.type\)/.test(lh) && /a\.isGroup && a\.type === \(editAccount\?\.type \|\| form\.type\)/.test(lh), 'P5: Ledger Heads offers only same-type parent groups (add + edit)');
ok(/समूह और खाते का प्रकार एक ही होना चाहिए/.test(read('lib/importTemplates.ts')), 'P5: the importer refuses a parent group of another type');
ok(/class-parent\s+a child has the same type/.test(readFileSync(resolve(SRC, '..', 'scripts', 'test-template-integrity.mjs'), 'utf8')), 'P5: every shipped chart is checked (test-template-integrity class-parent)');

console.log(`Opening difference & imbalance guards: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
