// Report status (interim vs final), certificate gating, negative-line presentation, Bank Book default account,
// cross-report tie-out. Pure helpers are imported directly; the PDF generators are rendered for real
// (esbuild bundle + jsPDF node build), like test-bs-tb-pdf-layout.mjs.
// Run: node scripts/test-report-status-tieout.mjs   (npm run test:report-status-tieout)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { reportStatus, fyEndIso } from '../src/lib/reports/reportStatus.ts';
import { splitNegativeLines, reclassifyIncomeExpenditure } from '../src/lib/reports/negativeLines.ts';
import { selectableBankIds, bankBookZeroWarning } from '../src/lib/reports/bankBookPick.ts';
import { buildTieOut } from '../src/lib/reports/tieOut.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  x', m); } };

// ── reportStatus ─────────────────────────────────────────────────────────────
ok(fyEndIso('2026-27') === '2027-03-31' && fyEndIso('2026-2027') === '2027-03-31', 'fyEndIso parses both label forms');
ok(fyEndIso('garbage') === '' && fyEndIso('2026-29') === '', 'fyEndIso rejects bad labels');
let st = reportStatus({ financialYear: '2026-27' }, new Date(2026, 9, 4));
ok(!st.final && !st.yearEnded && /Interim/.test(st.en) && /अंतरिम/.test(st.hi), 'open FY printed 4 Oct 2026 = interim, unaudited');
st = reportStatus({ financialYear: '2026-27' }, new Date(2027, 5, 1));
ok(!st.final && st.yearEnded && /audit pending/.test(st.en), 'FY ended but not audit-locked = still interim');
st = reportStatus({ financialYear: '2026-27', fyLocked: true }, new Date(2027, 5, 1));
ok(st.final && /Final/.test(st.en), 'audit-locked FY = final');

// ── negative lines (Assandh figures) ─────────────────────────────────────────
const sp = splitNegativeLines([{ name: 'A', amount: 100 }, { name: 'Fertilizer Trading Exp A/c', amount: -521756.8 }], '(cr)');
ok(sp.kept.length === 1 && sp.moved.length === 1 && sp.moved[0].amount === 521756.8 && sp.movedTotal === 521756.8, 'negative direct expense moves, re-signed positive');
const ie = reclassifyIncomeExpenditure(
  [{ name: 'GP', amount: 21755113.27 }, { name: 'MDM', amount: -111360 }, { name: 'Misc', amount: -58622.83 }],
  [{ name: 'Salary', amount: 906807 }]);
const sum = (a) => Math.round(a.reduce((s, x) => s + x.amount, 0) * 100) / 100;
ok(ie.income.every(i => i.amount >= 0) && ie.expense.every(i => i.amount >= 0), 'no negative amounts survive on either side');
ok(Math.round((sum(ie.income) - sum(ie.expense)) * 100) / 100 === Math.round((21755113.27 - 111360 - 58622.83 - 906807) * 100) / 100, 'net result (surplus/deficit) unchanged by the reclassification');

// ── Bank Book default account ────────────────────────────────────────────────
ok(JSON.stringify(selectableBankIds(['3302', 'a', 'b'], '3302', false)) === '["a","b"]', 'idle head 3302 hidden when real bank accounts exist');
ok(selectableBankIds(['3302', 'a'], '3302', true).includes('3302'), 'head kept when it holds money itself');
ok(JSON.stringify(selectableBankIds(['3302'], '3302', false)) === '["3302"]', 'head is the only choice when there are no sub-accounts');
ok(bankBookZeroWarning({ selectedOpening: 0, selectedEntryCount: 0, otherBalances: [7053432.17] }).warn, 'empty book next to funded banks warns');
ok(!bankBookZeroWarning({ selectedOpening: 0, selectedEntryCount: 0, otherBalances: [0, 0] }).warn, 'all banks empty: no warning');
ok(!bankBookZeroWarning({ selectedOpening: 500, selectedEntryCount: 0, otherBalances: [100] }).warn, 'opening balance present: no warning');

// ── tie-out ──────────────────────────────────────────────────────────────────
let rows = buildTieOut({ tbClosingDr: 2847687630.24, tbClosingCr: 2847687630.24, tbBankClosing: 7053432.17, bankBooksClosing: 7053432.17, rpClosingBank: 7053432.17 });
ok(rows.length === 3 && rows.every(r => r.ok), 'Assandh figures tie');
rows = buildTieOut({ tbClosingDr: 10, tbClosingCr: 10, tbBankClosing: 7053432.17, bankBooksClosing: 0, rpClosingBank: 7053432.17 });
ok(!rows.find(r => r.key === 'bank-bb').ok && rows.find(r => r.key === 'bank-rp').ok, 'zero Bank Book vs TB bank balance is flagged');

// ── rendered PDFs ────────────────────────────────────────────────────────────
const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dir = mkdtempSync(join(tmpdir(), 'status-'));
const shim = join(dir, 'jspdf-shim.cjs');
writeFileSync(shim, `const m=require(${JSON.stringify(join(ROOT, 'node_modules/jspdf/dist/jspdf.node.js'))});const J=m.jsPDF||m.default;module.exports=J;module.exports.default=J;module.exports.jsPDF=J;`);
const entry = join(dir, 'entry.ts');
writeFileSync(entry, `
import jsPDF from 'jspdf';
import * as pdf from '@/lib/pdf';
(globalThis as any).window = (globalThis as any).window || {};
const docs: Record<string, any> = {};
(jsPDF as any).API.save = function () { docs[(globalThis as any).__tag] = this; };
const base: any = { name: 'Assandh Test Society', registrationNo: '503', financialYear: '2026-27', address: 'x', district: 'y', state: 'hr', pinCode: '1', signatories: {} };
const open = base;
const locked = { ...base, fyLocked: true };
const run = (tag: string, f: () => void) => { (globalThis as any).__tag = tag; f(); };
const acc = (id: string, name: string, type: string, parentId?: string, isGroup = false): any => ({ id, name, type, parentId, isGroup, openingBalance: 0, openingBalanceType: 'debit' });
const accounts: any[] = [acc('1000','CAPITAL','liability',undefined,true), acc('3000','ASSETS','asset',undefined,true), acc('3300','Current Assets','asset','3000',true),
  acc('1100','Share Capital','liability','1000',true), acc('L1','Individual Share Capital','liability','1100'), acc('A1','Cash','asset','3300')];
const bal = (a: any, n: number): any => ({ account: a, openingDebit: 0, openingCredit: 0, transactionDebit: 0, transactionCredit: 0, totalDebit: 0, totalCredit: 0, netBalance: n });
const liab = [bal(accounts[4], -327250)], asset = [bal(accounts[5], 327250)];
const py = { ...open, previousFinancialYear: '2025-26', previousYearBalances: { L1: -327250, A1: 500000 } };
run('bs_open', () => pdf.generateBalanceSheetPDF(asset, liab, 0, py, 'en', 0, accounts, [], true, 0));
run('bs_locked', () => pdf.generateBalanceSheetPDF(asset, liab, 0, locked, 'en', 0, accounts, [], true, 0));
const inc = [{ name: 'Service Charges', nameHi: '', amount: 1333971 }, { name: 'MDM', nameHi: '', amount: -111360 }];
const exp = [{ name: 'Salary', nameHi: '', amount: 906807 }];
run('ie_open', () => pdf.generateIncomeExpenditurePDF(inc, exp, open, 'en', 0));
run('ie_locked', () => pdf.generateIncomeExpenditurePDF(inc, exp, locked, 'en', 0));
run('ie_zz', () => pdf.generateIncomeExpenditurePDF(inc, exp, { ...locked, state: 'zz' }, 'en', 0));
const ta: any = { salesItems: [{ name: 'Fertilizer Sales', amount: 1000000 }], closingStockItems: [{ name: 'Closing Stock (Physical)', amount: 200000 }], openingStockItems: [],
  purchaseItems: [{ name: 'Fertilizer Purchase', amount: 800000 }], directExpItems: [{ name: 'Fertilizer Trading Exp A/c', amount: -521756.8 }],
  totalSales: 1000000, totalClosingStock: 200000, totalOpeningStock: 0, totalPurchases: 800000, totalDirectExp: -521756.8, grossProfit: 1000000 + 200000 - 800000 + 521756.8 };
run('ta', () => pdf.generateTradingAccountPDF(ta, open));
const ta2: any = { ...ta, salesItems: [{ name: 'Fertilizer Sales', amount: 1000000 }, { name: 'Sales Return', amount: -50000 }], directExpItems: [], totalSales: 950000, totalDirectExp: 0, grossProfit: 950000 + 200000 - 800000 };
run('ta_ret', () => pdf.generateTradingAccountPDF(ta2, open));
run('bb', () => pdf.generateBankBookPDF([], open, 0, 'en', 'SBI BANK ASSANDH CURRENT A/C', 'Check the bank account.'));
run('tb', () => pdf.generateTrialBalancePDF([bal(accounts[4], -327250), bal(accounts[5], 327250)], open, '2027-03-31', 'en'));
module.exports = { docs };
`);
const out = join(dir, 'bundle.cjs');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  alias: { '@': join(ROOT, 'src'), jspdf: shim }, absWorkingDir: ROOT });
const { docs } = createRequire(import.meta.url)(out);
const raw = (t) => docs[t].output();

for (const t of ['bs_open', 'ie_open', 'tb', 'ta', 'bb']) ok(raw(t).includes('Interim / Unaudited'), `${t}: status line says Interim / Unaudited`);
for (const t of ['bs_locked', 'ie_locked']) ok(raw(t).includes('Status: Final'), `${t}: audit-locked FY says Final`);
for (const t of ['bs_open', 'ie_open']) ok(!raw(t).includes("AUDITOR'S CERTIFICATE") && raw(t).includes('UNAUDITED'), `${t}: no auditor certificate on an open FY, unaudited notice instead`);
for (const t of ['bs_locked', 'ie_locked']) ok(raw(t).includes("AUDITOR'S CERTIFICATE"), `${t}: certificate present once audit-locked`);
ok(raw('bs_open').includes('Provisional position') && !raw('bs_open').includes('As at 31st March'), 'open-FY Balance Sheet does not claim "As at 31st March"');
ok(raw('bs_locked').includes('As at 31st March 2027'), 'locked Balance Sheet keeps the year-end date');
ok(raw('ie_locked').includes('as at 31/03/2027'), 'certificate names the date the accounts are made up to');
ok(!raw('ie_zz').includes('Multi-State') && raw('ie_zz').includes('applicable to the'), 'unconfigured state: certificate does not name the Multi-State Act');
ok(!raw('bs_open').includes('Rs. -'), 'Balance Sheet comparative column has no negative liability');
ok(!raw('ie_open').includes('Rs. -'), 'I&E prints no negative amount');
ok(!raw('ta').includes('Rs. -') && raw('ta').includes('Recoveries'), 'Trading prints the credit-balance expense as a recovery line, not a negative');
ok(raw('bb').includes('SBI BANK ASSANDH CURRENT A/C'), 'Bank Book PDF names the bank account');
ok(raw('ta_ret').includes('(Net Sales)') && raw('ta_ret').includes('(Gross Sales)') && !raw('ta_ret').includes('Rs. -'), 'Trading shows Gross Sales, Less: Sales Returns, Net Sales - no negative sales line');
ok(raw('ta').includes('(Total Sales)') && !raw('ta').includes('(Net Sales)'), 'Trading without returns keeps the single Total Sales line');

console.log(`report-status-tieout: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
