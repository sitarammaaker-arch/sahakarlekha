// R12 on the REAL generators: with the PDF language set to Hindi, every LABEL the core reports draw is
// translated (only data — account names, narrations, the society's address — stays as typed), and with English
// (the default) nothing changes. Renders the actual generators (esbuild bundle + jsPDF node build; there is no
// canvas in node, so this checks the TRANSLATION step; the browser drawing of Devanagari is verified by eye).
// Run: node scripts/test-pdf-hindi-render.mjs   (npm run test:pdf-hindi-render)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dir = mkdtempSync(join(tmpdir(), 'hi-'));
const shim = join(dir, 'jspdf-shim.cjs');
writeFileSync(shim, `const m=require(${JSON.stringify(join(ROOT, 'node_modules/jspdf/dist/jspdf.node.js'))});const J=m.jsPDF||m.default;module.exports=J;module.exports.default=J;module.exports.jsPDF=J;`);
const entry = join(dir, 'entry.ts');
writeFileSync(entry, `
import jsPDF from 'jspdf';
import * as pdf from '@/lib/pdf';
import { setPdfLang, setTranslationMissSink } from '@/lib/pdfLang';
import { setAppVocabulary } from '@/lib/pdfDevanagari';
import { translations } from '@/contexts/LanguageContext';
setAppVocabulary(translations);
(globalThis as any).window = (globalThis as any).window || {};
let last: any = null;
(jsPDF as any).API.save = function () { last = this; };

const society: any = { name: 'DATA_Society', nameHi: 'DATA_समिति', registrationNo: 'R-1', financialYear: '2026-27', address: 'DATA_addr', district: 'DATA_dist', state: 'hr', pinCode: '1', signatories: {} };
const acc = (id: string, name: string, type: string, parentId?: string, isGroup = false): any => ({ id, name, type, parentId, isGroup, openingBalance: 0, openingBalanceType: 'debit' });
const tbRows: any[] = ['asset', 'liability', 'income', 'expense'].map((t, i) => ({ account: { id: 'a' + i, name: 'DATA_Head' + i, type: t }, openingDebit: 10, openingCredit: 0, transactionDebit: 100, transactionCredit: 50, totalDebit: 0, totalCredit: 0, netBalance: t === 'asset' || t === 'expense' ? 100 : -100 }));
const accounts: any[] = [acc('1000', 'CAPITAL', 'liability', undefined, true), acc('2000', 'LIABILITIES', 'liability', undefined, true), acc('2300', 'Current Liabilities', 'liability', '2000', true), acc('3000', 'ASSETS', 'asset', undefined, true), acc('3300', 'Current Assets', 'asset', '3000', true), acc('L0', 'DATA_Creditor', 'liability', '2300'), acc('A0', 'DATA_Asset', 'asset', '3300')];
const liab = [{ account: accounts[5], openingDebit: 0, openingCredit: 0, transactionDebit: 0, transactionCredit: 0, totalDebit: 0, totalCredit: 0, netBalance: -1000 }];
const asset = [{ account: accounts[6], openingDebit: 0, openingCredit: 0, transactionDebit: 0, transactionCredit: 0, totalDebit: 0, totalCredit: 0, netBalance: 1500 }];
const rp: any = { openingCash: 100, openingBank: 200, receipts: [{ accountId: 'x', accountName: 'DATA_R1', accountNameHi: 'x', amount: 1000, nature: 'capital', glType: 'income' }, { accountId: 'y', accountName: 'DATA_R2', accountNameHi: 'y', amount: 500, nature: 'revenue', glType: 'income' }], payments: [{ accountId: 'z', accountName: 'DATA_P1', accountNameHi: 'z', amount: 400, nature: 'revenue', glType: 'expense' }], closingCash: 50, closingBank: 1350 };
const vouchers: any[] = [{ id: 'v1', voucherNo: 'V1', date: '2026-04-05', type: 'receipt', debitAccountId: '3301', creditAccountId: '4101', amount: 100, narration: 'DATA_n', createdAt: '2026-04-05T00:00:00Z' }];
const members: any[] = [{ id: 'm1', memberId: 'M1', name: 'DATA_A', fatherName: 'DATA_B', joinDate: '2020-04-01', shareCertNo: '1', shareCount: 2, shareFaceValue: 100, shareCapital: 200, status: 'active', memberType: 'regular' }];

const generators: Record<string, () => void> = {
  TB: () => pdf.generateTrialBalancePDF(tbRows, society, '2027-03-31', 'hi'),
  BS: () => pdf.generateBalanceSheetPDF(asset as any, liab as any, 500, society, 'hi', 0, accounts, [], true, 0),
  RP: () => pdf.generateReceiptsPaymentsPDF(rp, society),
  IE: () => pdf.generateIncomeExpenditurePDF([{ name: 'DATA_Interest', nameHi: 'x', amount: 1000 }], [{ name: 'DATA_Salary', nameHi: 'y', amount: 600 }], society, 'hi', 0),
  TRADING: () => pdf.generateTradingAccountPDF({ salesItems: [{ name: 'DATA_S', amount: 1000 }], closingStockItems: [{ name: 'DATA_C', amount: 200 }], openingStockItems: [{ name: 'DATA_O', amount: 100 }], purchaseItems: [{ name: 'DATA_P', amount: 500 }], directExpItems: [{ name: 'DATA_D', amount: 50 }], totalSales: 1000, totalClosingStock: 200, totalOpeningStock: 100, totalPurchases: 500, totalDirectExp: 50, grossProfit: 550 } as any, society),
  CASHBOOK: () => pdf.generateCashBookPDF([{ id: '1', date: '2026-04-05', voucherNo: 'V1', particulars: 'DATA_in', type: 'receipt', amount: 100, runningBalance: 100 }, { id: '2', date: '2026-04-06', voucherNo: 'V2', particulars: 'DATA_out', type: 'payment', amount: 40, runningBalance: 60 }] as any, society, 0, 'hi'),
  BANKBOOK: () => pdf.generateBankBookPDF([{ id: '1', date: '2026-04-05', voucherNo: 'V1', particulars: 'DATA_dep', type: 'deposit', amount: 100, runningBalance: 100 }] as any, society, 0, 'hi'),
  LEDGER: () => pdf.generateLedgerPDF([{ date: '2026-04-05', voucherNo: 'V1', particulars: 'DATA_x', debit: 100, credit: 0, balance: 100, balanceType: 'Dr' }], acc('3301', 'DATA_Cash', 'asset') as any, society, 'hi', '2026-04-01', '2026-04-30'),
  DAYBOOK: () => pdf.generateDayBookPDF(vouchers, [acc('3301', 'DATA_Cash', 'asset'), acc('4101', 'DATA_Sales', 'income')] as any, society, '2026-04-01', '2026-04-30', 'hi', 0),
  SHAREREG: () => pdf.generateShareRegisterPDF(members, society),
  LOANREG: () => pdf.generateLoanRegisterPDF([{ id: 'l1', loanNo: 'L1', memberId: 'm1', loanType: 'short-term', purpose: 'DATA_p', amount: 1000, interestRate: 9, disbursementDate: '2026-04-01', dueDate: '2027-03-31', status: 'active', repayments: [] }] as any, members, society),
};

const run = (lang: string) => {
  setPdfLang(lang as any);
  const misses: Record<string, string[]> = {}, texts: Record<string, string> = {}, errors: string[] = [];
  let current = '';
  setTranslationMissSink(t => { (misses[current] ||= []).push(t); });
  for (const [name, f] of Object.entries(generators)) {
    current = name;
    try { f(); texts[name] = last.output(); } catch (e: any) { errors.push(name + ': ' + (e && e.message)); }
  }
  setTranslationMissSink(null);
  return { misses, texts, errors };
};
module.exports = { run, setPdfLang };
`);
const out = join(dir, 'bundle.cjs');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  alias: { '@': join(ROOT, 'src'), jspdf: shim }, absWorkingDir: ROOT });
const { run, setPdfLang } = createRequire(import.meta.url)(out);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const DEVA = /[ऀ-ॿ]/;
// a miss is acceptable only if it is DATA typed by the user, the society's own address line, or the English
// fragments of the auditor's certificate that bilingual mode prints on purpose
const isData = (s) => /^DATA_/.test(s) || /DATA_addr/.test(s) || /DATA_/.test(s);

// ── Hindi: every label of the 11 core reports is translated ──
const hi = run('hi');
ok(hi.errors.length === 0, `all 11 generators ran in Hindi mode (${hi.errors.join('; ')})`);
let untranslated = [];
for (const [name, list] of Object.entries(hi.misses)) for (const s of new Set(list)) if (!isData(s)) untranslated.push(`${name}: ${JSON.stringify(s)}`);
ok(untranslated.length === 0, `${untranslated.length} label(s) still English in Hindi mode:\n      ${untranslated.join('\n      ')}`);
ok(Object.keys(hi.texts).length === 11, 'all 11 reports produced a document');

// ── bilingual: runs for every report ──
const bi = run('bi');
ok(bi.errors.length === 0, `all 11 generators ran in bilingual mode (${bi.errors.join('; ')})`);

// ── English (default): identical behaviour, no Hindi anywhere ──
const en = run('en');
ok(en.errors.length === 0, 'all 11 generators ran in English mode');
ok(Object.values(en.texts).every(t => !DEVA.test(t)), 'English mode never emits Devanagari, even though the society has a Hindi name');
ok(Object.values(en.texts).every(t => /DATA_Society/.test(t)), 'English header uses the English society name (not nameHi)');
ok(Object.values(en.texts).every(t => /Page 1 of /.test(t) && /Report ID: SL-/.test(t)), 'English footer keeps "Page x of y" and "Report ID:"');
// Hindi mode swaps the header name for nameHi; the English society name must not remain as the heading
ok(Object.values(hi.texts).every(t => !/\\(DATA_Society\\) Tj/.test(t)), 'Hindi mode does not draw the English society name as the heading');
ok(Object.keys(en.misses).length === 0, 'English mode records no missing labels (translation is skipped entirely)');

console.log(`\nPDF Hindi render: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
