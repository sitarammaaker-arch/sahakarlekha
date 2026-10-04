// R16 — ratchet guard for report uniformity (docs/research/REPORT-UNIFORMITY-STANDARD-DRAFT.md).
//
// Every file the portal hands out should go through the shared helpers (pdfFileName / downloadCSV /
// downloadExcel) so it gets the standard name, and Excel gets the README provenance sheet. Some older code
// still bypasses them (listed below, to be migrated in the PDF rework). This test does NOT demand that the
// old code is fixed today — it fails when a NEW bypass appears, so the count can only go down.
//
// To migrate a file: move it to the shared helper and DELETE its line from the allowlist here.
// Run: node scripts/test-report-uniformity-guard.mjs   (npm run test:report-uniformity-guard)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
})(path.join(ROOT, 'src'));
const src = new Map(files.map(p => [rel(p), fs.readFileSync(p, 'utf8')]));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

/** Files matching `re`, minus the allowlist; reports each unexpected one and any stale allowlist entry. */
function guard(label, re, allow, { exclude = [] } = {}) {
  const hits = [...src].filter(([f, s]) => re.test(s) && !exclude.includes(f)).map(([f]) => f).sort();
  const unexpected = hits.filter(f => !allow.includes(f));
  const stale = allow.filter(f => !hits.includes(f));
  ok(unexpected.length === 0, `${label}: NEW bypass of the shared helper in ${unexpected.join(', ')} — use the shared helper (see header comment)`);
  ok(stale.length === 0, `${label}: allowlist entry no longer needed — delete it: ${stale.join(', ')}`);
}

// 1. PDFs are created in src/lib/pdf.ts; these files still create their own document (PDF rework, step 3).
guard('new jsPDF outside pdf.ts', /new jsPDF\s*\(/, [
  'src/lib/cas/casPdf.ts', 'src/lib/leadMagnets.ts', 'src/lib/registers/ledgerExport.ts', 'src/lib/sampleReport.ts',
  'src/pages/AgingAnalysis.tsx', 'src/pages/AuditCertificate.tsx', 'src/pages/AuditTrail.tsx',
  'src/pages/BankReconciliation.tsx', 'src/pages/ElectionModule.tsx', 'src/pages/FederationReport.tsx',
  'src/pages/Form1MemberList.tsx', 'src/pages/GstSummary.tsx', 'src/pages/GuideCertificate.tsx',
  'src/pages/KccLoan.tsx', 'src/pages/LoanInterest.tsx', 'src/pages/MeetingRegister.tsx',
  'src/pages/MultiSocietyConsolidation.tsx', 'src/pages/NabardReport.tsx', 'src/pages/NominationRegister.tsx',
  'src/pages/ProfitDistribution.tsx', 'src/pages/StockValuation.tsx', 'src/pages/TdsForm16A.tsx',
], { exclude: ['src/lib/pdf.ts'] });

// 2. PDF file names come from pdfFileName(). Per-document PDFs named by their document number, marketing
//    downloads and the multi-society consolidation are the only deliberate exceptions.
const saveRe = /doc\.save\((?!\s*pdfFileName\()/;
guard('doc.save without pdfFileName', saveRe, [
  'src/lib/leadMagnets.ts',            // public lead-magnet downloads
  'src/lib/pdf.ts',                    // invoice / voucher / salary slip / purchase record: named by document number
  'src/lib/sampleReport.ts',           // public sample report
  'src/pages/MultiSocietyConsolidation.tsx',   // spans societies — no single society tag
]);

// 3. Excel goes through downloadExcel* (README provenance + standard name).
guard('XLSX.writeFile outside exportUtils', /XLSX\.writeFile\s*\(/, ['src/pages/UniversalImporter.tsx'], { exclude: ['src/lib/exportUtils.ts'] });

// 4. Raw browser downloads (Blob + anchor) outside the shared helper — statutory/portal files with their own formats.
guard('raw download outside exportUtils', /\.download\s*=\s|createObjectURL/, [
  'src/lib/tds26q.ts', 'src/pages/BackupRestore.tsx', 'src/pages/EWayBill.tsx', 'src/pages/GSTR9.tsx',
  'src/pages/GstSummary.tsx', 'src/pages/Payroll.tsx', 'src/pages/PfEsi.tsx', 'src/pages/SocietySetup.tsx',
  'src/pages/UniversalImporter.tsx',
], { exclude: ['src/lib/exportUtils.ts'] });

// 5. The shared helpers still do their job.
const eu = src.get('src/lib/exportUtils.ts');
ok(/exportFileName\(filename, 'csv', exportContext/.test(eu) && /exportFileName\(filename, 'xlsx', exportContext/.test(eu), 'downloadCSV and downloadExcel both use the standard file name');
ok(/contextMeta\(exportContext, now\)/.test(eu), 'downloadExcel attaches the README provenance meta');
const pdf = src.get('src/lib/pdf.ts');
ok(/standardFileStem\(/.test(pdf.slice(pdf.indexOf('export function pdfFileName'), pdf.indexOf('export function pdfFileName') + 600)), 'pdfFileName builds on the shared stem');
const app = src.get('src/App.tsx');
ok(/<ExportContextBinder \/>/.test(app), 'the export context binder is mounted in App');

console.log(`\nReport uniformity guard: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
