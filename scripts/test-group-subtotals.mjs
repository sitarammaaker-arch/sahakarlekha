// Head / Sub-head subtotals on the flat statements (I&E, Receipts & Payments, Trial Balance): the pure roll-up,
// and the rendered PDFs. Presentation only — totals must not move.
// Run: node scripts/test-group-subtotals.mjs   (npm run test:group-subtotals)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { groupWithSubtotals } from '../src/lib/reports/groupSubtotals.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  x', m); } };

const chart = [
  { id: '5000', name: 'Expenses', isGroup: true },
  { id: '5200', name: 'Establishment', parentId: '5000', isGroup: true },
  { id: '5210', name: 'Staff', parentId: '5200', isGroup: true },
  { id: '5300', name: 'Administrative', parentId: '5000', isGroup: true },
  { id: 'sal', name: 'Salary', parentId: '5210' },
  { id: 'epf', name: 'EPF', parentId: '5210' },
  { id: 'rent', name: 'Rent', parentId: '5200' },
  { id: 'off', name: 'Office', parentId: '5300' },
];
const lines = [
  { name: 'Gross Loss from Trading', amount: 50 },                 // loose, leads
  { name: 'Salary', amount: 900, parentId: '5210' },
  { name: 'Office', amount: 120.5, parentId: '5300' },
  { name: 'EPF', amount: 80, parentId: '5210' },
  { name: 'Rent', amount: 300, parentId: '5200' },
  { name: 'Moved line', amount: 7 },                               // loose, trails
];
const rows = groupWithSubtotals(lines, chart, ['5000']);
const items = rows.filter(r => r.kind === 'item');
ok(items.length === lines.length, 'every input line is emitted exactly once');
ok(Math.round(items.reduce((s, r) => s + r.amount, 0) * 100) === Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100), 'item amounts sum to the input total (nothing added or lost)');
ok(rows[0].name === 'Gross Loss from Trading' && rows[0].depth === 0, 'loose line before the first grouped line stays first');
ok(rows[rows.length - 1].name === 'Moved line', 'loose line after the grouped lines stays last');
const g = (id) => rows.find(r => r.groupId === id);
ok(g('5210').amount === 980, 'sub-group subtotal = its lines');
ok(g('5200').amount === 1280, 'group subtotal includes nested sub-group + own lines (900+80+300)');
ok(g('5300').amount === 120.5, 'sibling group subtotal');
ok(!rows.some(r => r.groupId === '5000'), 'the root head itself is not repeated as a group row');
const names = rows.filter(r => r.kind === 'group').map(r => r.name);
ok(names.join('|') === 'Establishment|Staff|Administrative', 'groups in chart order, nested group right after its parent\'s own lines');
ok(g('5210').depth === 1 && rows.find(r => r.name === 'Salary').depth === 2, 'depth follows nesting');
ok(groupWithSubtotals(lines, undefined, []).every(r => r.kind === 'item') && groupWithSubtotals(lines, undefined, []).length === lines.length, 'no chart: flat list, unchanged');
const vr = groupWithSubtotals([{ name: 'A', amount: 1, parentId: '5300', vals: [1, 2] }, { name: 'B', amount: 2, parentId: '5300', vals: [3, 4] }], chart, ['5000']);
ok(JSON.stringify(vr[0].vals) === '[4,6]', 'extra figures roll up element-wise');

// ── rendered PDFs ──
const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dir = mkdtempSync(join(tmpdir(), 'grp-'));
const shim = join(dir, 'jspdf-shim.cjs');
writeFileSync(shim, `const m=require(${JSON.stringify(join(ROOT, 'node_modules/jspdf/dist/jspdf.node.js'))});const J=m.jsPDF||m.default;module.exports=J;module.exports.default=J;module.exports.jsPDF=J;`);
const entry = join(dir, 'entry.ts');
writeFileSync(entry, `
import jsPDF from 'jspdf';
import * as pdf from '@/lib/pdf';
(globalThis as any).window = (globalThis as any).window || {};
const docs: Record<string, any> = {};
(jsPDF as any).API.save = function () { docs[(globalThis as any).__tag] = this; };
const society: any = { name: 'Group Test Society', registrationNo: '1', financialYear: '2026-27', address: 'x', district: 'y', state: 'hr', pinCode: '1', signatories: {}, fyLocked: true };
const run = (tag: string, f: () => void) => { (globalThis as any).__tag = tag; f(); };
const chart: any[] = [
  { id: '4000', name: 'Income', type: 'income', isGroup: true }, { id: '4200', name: 'Commission Income', type: 'income', isGroup: true, parentId: '4000' },
  { id: '5000', name: 'Expenses', type: 'expense', isGroup: true }, { id: '5200', name: 'Establishment Expenses', type: 'expense', isGroup: true, parentId: '5000' },
  { id: '5300', name: 'Administrative Expenses', type: 'expense', isGroup: true, parentId: '5000' },
  { id: 'c1', name: 'Service Charges', type: 'income', parentId: '4200' }, { id: 'c2', name: 'Market Fee Income', type: 'income', parentId: '4200' },
  { id: 'e1', name: 'Salary', type: 'expense', parentId: '5200' }, { id: 'e2', name: 'Office', type: 'expense', parentId: '5300' },
  { id: '3000', name: 'Assets', type: 'asset', isGroup: true }, { id: '3300', name: 'Cash & Bank', type: 'asset', isGroup: true, parentId: '3000' },
  { id: 'b1', name: 'SBI Current', type: 'asset', parentId: '3300' }, { id: 'b2', name: 'HDFC', type: 'asset', parentId: '3300' },
];
const inc = [{ name: 'Service Charges', nameHi: '', amount: 1000, parentId: '4200' }, { name: 'Market Fee Income', nameHi: '', amount: 500, parentId: '4200' }];
const exp = [{ name: 'Salary', nameHi: '', amount: 900, parentId: '5200' }, { name: 'Office', nameHi: '', amount: 300, parentId: '5300' }];
run('ie_grp', () => pdf.generateIncomeExpenditurePDF(inc, exp, society, 'en', 0, chart));
run('ie_flat', () => pdf.generateIncomeExpenditurePDF(inc, exp, society, 'en', 0));
const rpi = (id: string, name: string, amt: number): any => ({ accountId: id, accountName: name, accountNameHi: name, amount: amt, nature: 'revenue', glType: 'income' });
const rp: any = { openingCash: 100, openingBank: 200, receipts: [rpi('c1', 'Service Charges', 1000), rpi('c2', 'Market Fee Income', 500)], payments: [rpi('e1', 'Salary', 900), rpi('e2', 'Office', 300)], closingCash: 100, closingBank: 500 };
run('rp_grp', () => pdf.generateReceiptsPaymentsPDF(rp, society, chart));
const bal = (id: string, net: number, dr = 0, cr = 0): any => ({ account: chart.find(a => a.id === id), openingDebit: 0, openingCredit: 0, transactionDebit: dr, transactionCredit: cr, totalDebit: dr, totalCredit: cr, netBalance: net });
const tb = [bal('c1', -1000, 0, 1000), bal('c2', -500, 0, 500), bal('e1', 900, 900, 0), bal('e2', 300, 300, 0), bal('b1', 400, 400, 0), bal('b2', 500, 500, 0)];
run('tb_grp', () => pdf.generateTrialBalancePDF(tb, society, '2027-03-31', 'en', chart));
run('tb_flat', () => pdf.generateTrialBalancePDF(tb, society, '2027-03-31', 'en'));
module.exports = { docs };
`);
const out = join(dir, 'bundle.cjs');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  alias: { '@': join(ROOT, 'src'), jspdf: shim }, absWorkingDir: ROOT });
const { docs } = createRequire(import.meta.url)(out);
const raw = (t) => docs[t].output();
if (process.env.GROUP_PDF_OUT) for (const t of Object.keys(docs)) writeFileSync(join(process.env.GROUP_PDF_OUT, `${t}.pdf`), Buffer.from(docs[t].output('arraybuffer')));

ok(raw('ie_grp').includes('(Commission Income)') && raw('ie_grp').includes('(Establishment Expenses)') && raw('ie_grp').includes('(Administrative Expenses)'), 'I&E prints the Head rows');
ok(raw('ie_grp').includes('1,500.00') && raw('ie_grp').includes('900.00'), 'I&E Head subtotals printed (1,500.00 income head; 900.00 establishment head)');
ok(!raw('ie_flat').includes('(Commission Income)'), 'without a chart the I&E stays flat');
ok(raw('rp_grp').includes('(Commission Income)') && raw('rp_grp').includes('(Establishment Expenses)'), 'R&P prints the Head rows');
ok(raw('tb_grp').includes('(Commission Income)') && raw('tb_grp').includes('(Cash & Bank)'), 'Trial Balance prints the Head rows');
ok(raw('tb_grp').includes('(900.00 Dr)') || raw('tb_grp').includes('900.00 Dr'), 'Trial Balance Head closing subtotal printed');
ok(raw('tb_grp').includes('Trial Balance is Balanced') === raw('tb_flat').includes('Trial Balance is Balanced'), 'Trial Balance verdict unchanged by subtotals');

console.log(`group-subtotals: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
