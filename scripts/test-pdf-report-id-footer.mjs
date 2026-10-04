// R2 + R8 + R9 on REAL rendered PDFs: the Report ID is a content fingerprint printed in the footer of EVERY
// page; the brand line follows the plan. Renders the actual generators (esbuild bundle + jsPDF node build).
// Run: node scripts/test-pdf-report-id-footer.mjs   (npm run test:pdf-report-id-footer)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dir = mkdtempSync(join(tmpdir(), 'rid-'));
const shim = join(dir, 'jspdf-shim.cjs');
writeFileSync(shim, `const m=require(${JSON.stringify(join(ROOT, 'node_modules/jspdf/dist/jspdf.node.js'))});const J=m.jsPDF||m.default;module.exports=J;module.exports.default=J;module.exports.jsPDF=J;`);
const entry = join(dir, 'entry.ts');
writeFileSync(entry, `
import jsPDF from 'jspdf';
import * as pdf from '@/lib/pdf';
import { setReportBranding } from '@/lib/reportBranding';
(globalThis as any).window = (globalThis as any).window || {};
let last: any = null;
(jsPDF as any).API.save = function () { last = this; };
const society: any = { name: 'Kapil Nutri Store', registrationNo: 'UDYAM-HR-17-0062406', financialYear: '2026-27', address: 'x', district: 'y', state: 'hr', pinCode: '1', signatories: {} };
const tb = (n: number, amt = 100): any[] => Array.from({ length: n }, (_, i) => { const t = ['asset','liability','income','expense'][i%4]; return { account:{ id:'a'+i, name:'Head '+i, type:t }, openingDebit:0, openingCredit:0, transactionDebit:amt, transactionCredit:amt, totalDebit:0, totalCredit:0, netBalance:(t==='asset'||t==='expense')?amt:-amt }; });
const render = (balances: any[]) => { pdf.generateTrialBalancePDF(balances, society, '2027-03-31', 'en'); return { text: last.output(), pages: last.getNumberOfPages() }; };
module.exports = { render, tb, setReportBranding, pdf, society, jsPDF };
`);
const out = join(dir, 'bundle.cjs');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  alias: { '@': join(ROOT, 'src'), jspdf: shim }, absWorkingDir: ROOT });
const { render, tb, setReportBranding, pdf, society, jsPDF } = createRequire(import.meta.url)(out);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const ids = (text) => [...text.matchAll(/Report ID: (SL-[A-Z0-9]+-[A-Z0-9]+-[0-9]{8}-[0-9A-F]{10})/g)].map(m => m[1]);

// same data -> same ID; changed figure -> different ID
const a = render(tb(8)), b = render(tb(8)), c = render(tb(8, 101));
ok(ids(a.text).length === 1, `one page -> exactly one Report ID in the footer (got ${ids(a.text).length})`);
ok(ids(a.text)[0] === ids(b.text)[0], `the same report generated twice has the SAME ID (${ids(a.text)[0]})`);
ok(ids(a.text)[0] !== ids(c.text)[0], 'a single changed figure gives a DIFFERENT ID');
ok(/^SL-TB-0062406-[0-9]{8}-/.test(ids(a.text)[0]), 'ID carries report type, society tag and date');

// every page of a long report carries the ID, and it is the SAME ID on all pages
const long = render(tb(200));
const longIds = ids(long.text);
ok(long.pages >= 3, `long report spans several pages (${long.pages})`);
ok(longIds.length === long.pages, `Report ID printed on EVERY page (${longIds.length} of ${long.pages})`);
ok(new Set(longIds).size === 1, 'the same ID on every page');
ok((long.text.match(/Page [0-9]+ of [0-9]+/g) || []).length >= long.pages, 'Page x of y still printed on every page');
ok(long.text.indexOf('Prepared on') !== -1 && long.text.indexOf('Report ID:') > long.text.indexOf('Prepared on'), 'the first Report ID comes AFTER the header (it is stamped in the footer, not drawn in the header)');

// R9: brand footer follows the plan
setReportBranding({ showBrandFooter: true });
ok(/Generated free with SahakarLekha/.test(render(tb(8)).text), 'trial/legacy plan: brand line present');
setReportBranding({ showBrandFooter: false });
const clean = render(tb(8));
ok(!/Generated free with SahakarLekha/.test(clean.text), 'paying plan: NO marketing line on the statement');
ok(/Confidential/.test(clean.text) && /Page 1 of 1/.test(clean.text) && ids(clean.text).length === 1, 'paying plan: confidentiality line, page number and Report ID all remain');
setReportBranding({ showBrandFooter: true });

// a PDF that never called addHeader (no identity) must not crash and gets no ID
const doc = new jsPDF();
pdf.addPageNumbers(doc, 'helvetica', 'Some Society');
ok(ids(doc.output()).length === 0, 'a document without a report identity gets no Report ID (and no crash)');

console.log(`\nPDF Report ID + footer: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
