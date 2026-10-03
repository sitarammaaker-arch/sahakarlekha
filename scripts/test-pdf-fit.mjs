// fitLine (audit D-02): header lines must never exceed the printable width.
// Run: node scripts/test-pdf-fit.mjs   (npm run test:pdf-fit)
import { jsPDF } from 'jspdf';
import { fitLine } from '../src/lib/pdfFit.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const doc = new jsPDF();            // A4 portrait, 210mm
const maxW = 210 - 30;
doc.setFont('helvetica', 'bold');

const short = fitLine(doc, 'Rania PACS Ltd', maxW, 14, 9);
ok(short === 'Rania PACS Ltd' && doc.getFontSize() === 14, 'short name unchanged at full size');

const mid = 'Shri Baba Mastnath Primary Agricultural Cooperative Credit Society Limited Assandh';
const m = fitLine(doc, mid, maxW, 14, 9);
ok(m === mid && doc.getFontSize() < 14 && doc.getTextWidth(m) <= maxW, 'medium name shrinks, not truncated');

const long = 'Shri Baba Mastnath Primary Agricultural Cooperative Credit and Multipurpose Service Society Limited Village Assandh Tehsil Assandh District Karnal Haryana Registered 1987';
const l = fitLine(doc, long, maxW, 14, 9);
ok(l.endsWith('...') && doc.getTextWidth(l) <= maxW && doc.getFontSize() === 9, 'very long name truncated with ellipsis at min size');

const landscape = new jsPDF({ orientation: 'landscape' });
ok(fitLine(landscape, long, 297 - 30, 14, 9).length >= l.length, 'landscape page keeps more of the name');
ok(fitLine(doc, '', maxW, 14, 9) === '', 'empty string safe');

console.log(`\nfitLine: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
