// Signatures on reports are the society admin's choice: all three, any two, one, or none. Renders the actual
// generators (esbuild bundle + jsPDF node build). Documents signed to be valid are not touched by the choice.
// Run: node scripts/test-report-signatures.mjs   (npm run test:report-signatures)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dir = mkdtempSync(join(tmpdir(), 'sig-'));
const shim = join(dir, 'jspdf-shim.cjs');
writeFileSync(shim, `const m=require(${JSON.stringify(join(ROOT, 'node_modules/jspdf/dist/jspdf.node.js'))});const J=m.jsPDF||m.default;module.exports=J;module.exports.default=J;module.exports.jsPDF=J;`);
const entry = join(dir, 'entry.ts');
writeFileSync(entry, `
import jsPDF from 'jspdf';
import * as pdf from '@/lib/pdf';
import * as sig from '@/lib/reportSignatures';
(globalThis as any).window = (globalThis as any).window || {};
let last: any = null;
(jsPDF as any).API.save = function () { last = this; };
const society: any = { name: 'Test Society', registrationNo: 'R-1', financialYear: '2026-27', address: 'x', district: 'y', state: 'hr', signatories: { accountant: { name: 'Asha Accts', source: 'employee' }, secretary: { name: 'Sunil Secy', source: 'board' }, president: { name: 'Prem Pres', source: 'board' } } };
const tb = (n: number, amt = 100): any[] => Array.from({ length: n }, (_, i) => { const t = ['asset','liability','income','expense'][i%4]; return { account:{ id:'a'+i, name:'Head '+i, type:t }, openingDebit:0, openingCredit:0, transactionDebit:amt, transactionCredit:amt, totalDebit:0, totalCredit:0, netBalance:(t==='asset'||t==='expense')?amt:-amt }; });
const renderTB = (n = 8) => { pdf.generateTrialBalancePDF(tb(n), society, '2027-03-31', 'en'); return { text: last.output(), pages: last.getNumberOfPages() }; };
const renderDoc = () => { const doc = new jsPDF(); pdf.addDocumentSignatureBlock(doc, 'helvetica', ['Secretary / Manager', 'Chairman / President'], 30); return doc.output(); };
module.exports = { renderTB, renderDoc, ...sig };
`);
const out = join(dir, 'bundle.cjs');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  alias: { '@': join(ROOT, 'src'), jspdf: shim }, absWorkingDir: ROOT });
const { renderTB, renderDoc, setReportSignatureRoles, selectSignatures, signatoryRoleOf } = createRequire(import.meta.url)(out);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// Every label the app prints maps to the right post; the rest are not pickable.
for (const [label, role] of [
  ['Accountant', 'accountant'], ['Secretary', 'secretary'], ['Secretary / Manager', 'secretary'],
  ['Secretary / Manager\n(with Seal)', 'secretary'], ['Secretary\n(Seal)', 'secretary'],
  ['President', 'president'], ['Chairman', 'president'], ['President / Chairman', 'president'],
  ['Chairman / President', 'president'], ['President\n(Seal)', 'president'],
  ['Statutory Auditor\n(Name & Membership No.)', null], ['Auditor', null], ['Registrar / Auditor', null],
  ['Election Officer', null], ['Treasurer', null], ['Authorized Signatory', null],
]) ok(signatoryRoleOf(label) === role, `${JSON.stringify(label)} -> ${role}`);

// Names stay beside their own lines.
const two = selectSignatures(['Accountant', 'Secretary', 'President'], ['A', 'S', 'P'], ['secretary', 'president']);
ok(two.labels.join() === 'Secretary,President' && two.names.join() === 'S,P', 'names follow their labels');
ok(selectSignatures(['Secretary', 'Auditor'], undefined, ['president']).labels.join() === 'Auditor', 'a non-pickable line stays while the block is on');
ok(selectSignatures(['Secretary', 'Auditor'], undefined, []).labels.length === 0, 'none selected removes every line');

// Never chosen: exactly what every society has today.
setReportSignatureRoles(undefined);
const all = renderTB();
ok(all.text.includes('(Accountant)') && all.text.includes('(Asha Accts)'), 'default prints the Accountant');
ok(all.text.includes('(Secretary / Manager)') && all.text.includes('(President)'), 'default prints all three');
ok(all.text.includes('Certified that'), 'default keeps the certified note');

// Two of three.
setReportSignatureRoles(['secretary', 'president']);
const sp = renderTB();
ok(!sp.text.includes('(Accountant)') && !sp.text.includes('(Asha Accts)'), 'two chosen: Accountant line and name gone');
ok(sp.text.includes('(Sunil Secy)') && sp.text.includes('(Prem Pres)'), 'two chosen: the chosen two print with their names');
ok(sp.text.includes('Certified that'), 'two chosen: certified note stays');

// None.
setReportSignatureRoles([]);
const none = renderTB();
for (const s of ['(Accountant)', '(Secretary / Manager)', '(President)', 'Date: ____', 'Certified that'])
  ok(!none.text.includes(s), `none chosen: ${s} not printed`);

// An empty block must never add an empty page: find a length where the block alone would spill over.
setReportSignatureRoles(undefined);
let spills = 0;
for (let n = 5; n < 80; n++) {
  setReportSignatureRoles(undefined);
  const withBlock = renderTB(n).pages;
  setReportSignatureRoles([]);
  const without = renderTB(n).pages;
  if (withBlock > without) spills++;
  ok(without <= withBlock, `${n} rows: none chosen never has more pages`);
}
ok(spills > 0, 'the page-spill case was actually exercised');

// A document signed to be valid ignores the choice.
setReportSignatureRoles([]);
const docText = renderDoc();
ok(docText.includes('(Secretary / Manager)') && docText.includes('(Chairman / President)'), 'documents always carry their signatures');
setReportSignatureRoles(undefined);

console.log(`report signatures: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
