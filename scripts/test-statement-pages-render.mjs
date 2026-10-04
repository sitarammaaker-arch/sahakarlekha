// On-screen statements (I&E, Trading, Receipts & Payments, Trial Balance) render Head / Sub-head subtotals and
// show no negative-looking line — server-rendered with stub contexts (no browser, no Supabase).
// Run: node scripts/test-statement-pages-render.mjs   (npm run test:statement-pages-render)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dir = mkdtempSync(join(tmpdir(), 'pages-'));
const shim = join(dir, 'jspdf-shim.cjs');
writeFileSync(shim, `const m=require(${JSON.stringify(join(ROOT, 'node_modules/jspdf/dist/jspdf.node.js'))});const J=m.jsPDF||m.default;module.exports=J;module.exports.default=J;module.exports.jsPDF=J;`);
const stub = join(dir, 'stub.tsx');
writeFileSync(stub, `
export const store: any = {};
export const useLanguage = () => ({ language: 'en', t: (k: string) => k });
export const useAuth = () => ({ can: () => false, user: { name: 'x', role: 'admin' } });
export const useData = () => store;
`);
const entry = join(dir, 'entry.tsx');
writeFileSync(entry, `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { store } from ${JSON.stringify(stub.replace(/\\/g, '/'))};
import ProfitLoss from '@/pages/ProfitLoss';
import TradingAccount from '@/pages/TradingAccount';
import ReceiptsPayments from '@/pages/ReceiptsPayments';
import TrialBalance from '@/pages/TrialBalance';

const acct = (id: string, name: string, type: string, parentId?: string, isGroup = false): any => ({ id, name, nameHi: name, type, parentId, isGroup, openingBalance: 0, openingBalanceType: 'debit' });
const accounts = [
  acct('4000','Income','income',undefined,true), acct('4200','Commission Income','income','4000',true),
  acct('5000','Expenses','expense',undefined,true), acct('5200','Establishment Expenses','expense','5000',true),
  acct('3000','Assets','asset',undefined,true), acct('3300','Cash & Bank','asset','3000',true),
  acct('c1','Service Charges','income','4200'), acct('c2','Market Fee Income','income','4200'),
  acct('e1','Salary','expense','5200'), acct('b1','SBI Current','asset','3300'),
];
const society: any = { name: 'Page Test Society', nameHi: 'Page Test Society', financialYear: '2026-27', registrationNo: '1', state: 'hr' };
const bal = (id: string, net: number, dr = 0, cr = 0): any => ({ account: accounts.find(a => a.id === id), openingDebit: 0, openingCredit: 0, transactionDebit: dr, transactionCredit: cr, totalDebit: dr, totalCredit: cr, netBalance: net });
Object.assign(store, {
  society, accounts, vouchers: [],
  getProfitLoss: () => ({
    incomeItems: [{ name: 'Service Charges', nameHi: 'Service Charges', amount: 1000, parentId: '4200' }, { name: 'MDM', nameHi: 'MDM', amount: -111, parentId: '4200' }],
    expenseItems: [{ name: 'Salary', nameHi: 'Salary', amount: 400, parentId: '5200' }],
    totalIncome: 889, totalExpenses: 400, netProfit: 489,
  }),
  getTradingAccount: () => ({
    salesItems: [{ name: 'Fertilizer Sales', nameHi: 'Fertilizer Sales', amount: 1000 }], closingStockItems: [{ name: 'Closing Stock (Physical)', nameHi: 'x', amount: 200 }],
    openingStockItems: [], purchaseItems: [{ name: 'Fertilizer Purchase', nameHi: 'x', amount: 800 }],
    directExpItems: [{ name: 'Fertilizer Trading Exp A/c', nameHi: 'x', amount: -521 }],
    totalSales: 1000, totalClosingStock: 200, totalOpeningStock: 0, totalPurchases: 800, totalDirectExp: -521, grossProfit: 921,
    activities: [], unallocated: { purchases: 0, directExp: 0, otherSales: 0 },
  }),
  getReceiptsPayments: () => ({
    openingCash: 10, openingBank: 20,
    receipts: [{ accountId: 'c1', accountName: 'Service Charges', amount: 1000, nature: 'revenue' }, { accountId: 'c2', accountName: 'Market Fee Income', amount: 500, nature: 'revenue' }],
    payments: [{ accountId: 'e1', accountName: 'Salary', amount: 400, nature: 'revenue' }],
    closingCash: 10, closingBank: 1120,
  }),
  getTrialBalance: () => [bal('c1', -1000, 0, 1000), bal('c2', -500, 0, 500), bal('e1', 400, 400, 0), bal('b1', 1100, 1100, 0)],
  getBankBookEntries: () => [], getAccountBalance: () => 0,
});
const html = (C: any) => renderToStaticMarkup(<MemoryRouter><C /></MemoryRouter>);
module.exports = { pl: html(ProfitLoss), ta: html(TradingAccount), rp: html(ReceiptsPayments), tb: html(TrialBalance) };
`);
const out = join(dir, 'bundle.cjs');
const stubPlugin = {
  name: 'stub-contexts',
  setup(b) {
    b.onResolve({ filter: /^@\/contexts\/(Language|Auth|Data)Context$/ }, () => ({ path: stub }));
  },
};
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  alias: { '@': join(ROOT, 'src'), jspdf: shim }, absWorkingDir: ROOT, nodePaths: [join(ROOT, 'node_modules')], plugins: [stubPlugin], jsx: 'automatic',
  define: { 'import.meta.env': '{}' }, loader: { '.svg': 'dataurl', '.png': 'dataurl' } });
const pages = createRequire(import.meta.url)(out);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  x', m); } };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const pl = text(pages.pl);
ok(pl.includes('Commission Income') && pl.includes('Establishment Expenses'), 'I&E shows the Head rows');
ok(pl.includes('Grand'), 'I&E has the Grand column');
ok(!/-₹|₹\s?-|\(-/.test(pl) && !/-\s?[\d,]+\.\d\d/.test(pl), 'I&E shows no negative amount');
ok(pl.includes('debit balance in income A/c'), 'I&E moved the debit-balance income line to the expenditure side');

const ta = text(pages.ta);
ok(ta.includes('Total Purchases'), 'Trading shows Total Purchases');
ok(ta.includes('Recoveries') && ta.includes('Total Recoveries'), 'Trading shows the credit-balance expense as a recovery');
ok(!/-\s?[\d,]+\.\d\d/.test(ta), 'Trading shows no negative amount');

const rp = text(pages.rp);
ok(rp.includes('Commission Income') && rp.includes('Establishment Expenses'), 'R&P shows the Head rows');
ok(rp.includes('Grand'), 'R&P has the Grand column');

const tb = text(pages.tb);
ok(tb.includes('Commission Income') && tb.includes('Establishment Expenses') && tb.includes('Cash & Bank'), 'Trial Balance shows the Head rows');
ok(tb.includes('Service Charges') && tb.includes('SBI Current'), 'Trial Balance still shows every ledger');

console.log(`statement-pages-render: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
