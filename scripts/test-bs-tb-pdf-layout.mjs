// Balance Sheet + Trial Balance PDFs are HORIZONTAL (T-format: liabilities left, assets right) on a
// LANDSCAPE page — one zipped table, so a long sheet paginates both sides together (header on every
// page, grand total once). Renders the real generators (esbuild bundle + jsPDF's node build) and
// inspects the produced documents.
// Run: node scripts/test-bs-tb-pdf-layout.mjs   (npm run test:bs-tb-pdf-layout)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dir = mkdtempSync(join(tmpdir(), 'bs-tb-'));
const shim = join(dir, 'jspdf-shim.cjs');
writeFileSync(shim, `const m=require(${JSON.stringify(join(ROOT, 'node_modules/jspdf/dist/jspdf.node.js'))});const J=m.jsPDF||m.default;module.exports=J;module.exports.default=J;module.exports.jsPDF=J;`);
const entry = join(dir, 'entry.ts');
writeFileSync(entry, `
import jsPDF from 'jspdf';
import * as pdf from '@/lib/pdf';
(globalThis as any).window = (globalThis as any).window || {};
const docs: Record<string, any> = {};
(jsPDF as any).API.save = function (fn: string) { docs[(globalThis as any).__tag] = this; };
const society: any = { name: 'Kapil Nutri Store', registrationNo: 'R-1', financialYear: '2026-27', address: 'x', district: 'y', state: 'hr', pinCode: '1', signatories: {} };
const acc = (id: string, name: string, type: string, parentId?: string, isGroup = false): any => ({ id, name, type, parentId, isGroup, openingBalance: 0, openingBalanceType: 'debit' });
function build(nL: number, nA: number) {
  const accounts: any[] = [acc('1000','CAPITAL','liability',undefined,true), acc('2000','LIABILITIES','liability',undefined,true), acc('2300','Current Liabilities','liability','2000',true),
    acc('3000','ASSETS','asset',undefined,true), acc('3300','Current Assets','asset','3000',true)];
  const liab: any[] = [], asset: any[] = [];
  for (let i = 0; i < nL; i++) { const a = acc('L'+i,'Creditor '+i,'liability','2300'); accounts.push(a); liab.push({ account:a, openingDebit:0, openingCredit:0, transactionDebit:0, transactionCredit:0, totalDebit:0, totalCredit:0, netBalance:-(1000+i) }); }
  for (let i = 0; i < nA; i++) { const a = acc('A'+i,'Asset '+i,'asset','3300'); accounts.push(a); asset.push({ account:a, openingDebit:0, openingCredit:0, transactionDebit:0, transactionCredit:0, totalDebit:0, totalCredit:0, netBalance:500+i }); }
  return { accounts, liab, asset };
}
const tb = (n: number): any[] => Array.from({ length: n }, (_, i) => { const t = ['asset','liability','income','expense'][i%4]; return { account:{ id:'a'+i, name:'Head '+i, type:t }, openingDebit:0, openingCredit:0, transactionDebit:100, transactionCredit:100, totalDebit:0, totalCredit:0, netBalance:(t==='asset'||t==='expense')?100:-100 }; });
const run = (tag: string, f: () => void) => { (globalThis as any).__tag = tag; f(); };
let d = build(4, 3);
run('bs_small', () => pdf.generateBalanceSheetPDF(d.asset, d.liab, 0, society, 'en', 0, d.accounts, [], true, 0));
d = build(120, 20);
run('bs_long', () => pdf.generateBalanceSheetPDF(d.asset, d.liab, 0, society, 'en', 0, d.accounts, [], true, 0));
run('tb_small', () => pdf.generateTrialBalancePDF(tb(8), society, '2027-03-31', 'en'));
run('tb_long', () => pdf.generateTrialBalancePDF(tb(200), society, '2027-03-31', 'en'));
const rpItem = (i: number, nature: 'capital'|'revenue', amt: number) => ({ accountId:'x'+i, accountName:'Head '+i, accountNameHi:'Head '+i, amount:amt, nature, glType:'income' });
const rp = (nR: number, nP: number): any => {
  const receipts: any[] = [], payments: any[] = []; let tr = 0, tp = 0;
  for (let i = 0; i < nR; i++) { tr += 1000 + i; receipts.push(rpItem(i, i === 0 ? 'capital' : 'revenue', 1000 + i)); }
  for (let i = 0; i < nP; i++) { tp += 500 + i; payments.push(rpItem(100 + i, i === 0 ? 'capital' : 'revenue', 500 + i)); }
  return { openingCash: 100, openingBank: 200, receipts, payments, closingCash: 50, closingBank: 300 + tr - tp - 50 };
};
run('rp_small', () => pdf.generateReceiptsPaymentsPDF(rp(4, 3), society));
run('rp_long', () => pdf.generateReceiptsPaymentsPDF(rp(120, 70), society));
module.exports = { docs };
`);
const out = join(dir, 'bundle.cjs');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  alias: { '@': join(ROOT, 'src'), jspdf: shim }, absWorkingDir: ROOT });
const { docs } = createRequire(import.meta.url)(out);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const count = (s, needle) => s.split(needle).length - 1;
const raw = (d) => d.output();

for (const tag of ['bs_small', 'bs_long', 'tb_small', 'tb_long']) {
  const d = docs[tag];
  const w = d.internal.pageSize.getWidth(), h = d.internal.pageSize.getHeight();
  ok(w > h, `${tag}: LANDSCAPE page (${w.toFixed(0)} x ${h.toFixed(0)} mm)`);
}
for (const tag of ['bs_small', 'bs_long']) {
  const d = docs[tag], s = raw(d), pages = d.getNumberOfPages();
  ok(s.includes('(Capital & Liabilities)') && s.includes('(Assets)'), `${tag}: both sides are present in the same document`);
  // HORIZONTAL: the two headings sit on the SAME baseline, Assets in the right half (x of the first Td before the text).
  const posOf = (text) => { const m = s.match(new RegExp('([\\d.]+) ([\\d.]+) Td\\s*\\(' + text.replace(/[&]/g, '\\&') + '\\) Tj')); return m ? { x: +m[1], y: +m[2] } : null; };
  const pl = posOf('Capital & Liabilities'), pa = posOf('Assets');
  ok(pl && pa && Math.abs(pl.y - pa.y) < 0.5, `${tag}: Capital & Liabilities and Assets headings are on the same line (y ${pl && pl.y.toFixed(1)} vs ${pa && pa.y.toFixed(1)})`);
  ok(pl && pa && pa.x > pl.x + 250, `${tag}: Assets is in the right half, Liabilities in the left (x ${pl && pl.x.toFixed(0)} vs ${pa && pa.x.toFixed(0)})`);
  ok(count(s, '(GRAND TOTAL)') === 2, `${tag}: GRAND TOTAL printed once per side (left + right = 2), got ${count(s, '(GRAND TOTAL)')}`);
}
{
  const d = docs.bs_long, s = raw(d);
  ok(d.getNumberOfPages() >= 3, `bs_long spans multiple pages (${d.getNumberOfPages()})`);
  // header row repeats on EVERY table page: the certificate page has none, so count >= pages-1
  ok(count(s, '(Capital & Liabilities)') >= d.getNumberOfPages() - 1, 'bs_long: the table header repeats on every table page');
}
for (const tag of ['tb_small', 'tb_long']) {
  const d = docs[tag], s = raw(d);
  ok(s.includes('Liabilities & Income') && s.includes('Assets & Expenditure'), `${tag}: Liabilities & Income (left) and Assets & Expenditure (right) side by side`);
  ok(count(s, '(Total)') === 2, `${tag}: totals row printed once per side (2), got ${count(s, '(Total)')}`);
}
{
  const d = docs.tb_long, s = raw(d);
  ok(d.getNumberOfPages() >= 3, `tb_long spans multiple pages (${d.getNumberOfPages()})`);
  ok(count(s, 'Liabilities & Income') >= d.getNumberOfPages(), 'tb_long: the table header repeats on every page');
  ok(s.includes('Trial Balance is Balanced'), 'tb_long: the balanced / not-balanced statement is still printed');
}

// ── Receipts & Payments: the same single-table T-format (two independent tables used to repeat a partial
//    Total at the foot of every page and start Payments on a later page with an empty left half) ──
for (const tag of ['rp_small', 'rp_long']) {
  const d = docs[tag], s = raw(d);
  const w = d.internal.pageSize.getWidth(), h = d.internal.pageSize.getHeight();
  ok(w > h, `${tag}: LANDSCAPE page`);
  const posOf = (re) => { const m = s.match(new RegExp('([\\d.]+) ([\\d.]+) Td\\s*\\(' + re + '\\) Tj')); return m ? { x: +m[1], y: +m[2] } : null; };
  const pr = posOf('Dr [^)]{1,8}Receipts'), pp = posOf('Cr [^)]{1,8}Payments');
  ok(pr && pp && Math.abs(pr.y - pp.y) < 0.5, `${tag}: Receipts and Payments headings share one baseline (y ${pr && pr.y.toFixed(1)} vs ${pp && pp.y.toFixed(1)})`);
  ok(pr && pp && pp.x > pr.x + 250, `${tag}: Payments sits in the right half, Receipts in the left`);
  ok(count(s, '(Total)') === 2, `${tag}: the two Totals print ONCE (one per side, last page), got ${count(s, '(Total)')}`);
  ok(!/\(Rs\.\)\s*Tj/.test(s), `${tag}: no amount wraps "Rs." onto a line of its own`);
}
{
  const d = docs.rp_long, s = raw(d);
  ok(d.getNumberOfPages() >= 3, `rp_long spans multiple pages (${d.getNumberOfPages()})`);
  ok(count(s, 'Receipts') >= d.getNumberOfPages(), 'rp_long: the Receipts / Payments header repeats on every page');
  ok(s.includes('Certified that the above Receipts'), 'rp_long: the certificate and signatures are still printed');
}

console.log(`\nBS/TB/R&P horizontal landscape PDFs: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
