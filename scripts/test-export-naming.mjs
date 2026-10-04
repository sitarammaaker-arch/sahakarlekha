// R13 one file-name scheme. Run: node scripts/test-export-naming.mjs   (npm run test:export-naming)
import { societyShortName, fileTimestamp, parseBaseName, standardFileStem, scopeFor } from '../src/lib/exportNaming.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const NOW = new Date(2026, 9, 4, 8, 41, 5);               // 4 Oct 2026 08:41 local
const SOC = { name: 'Kapil Nutri Store', registrationNo: 'UDYAM-HR-17-0062406' };

ok(fileTimestamp(NOW) === '20261004-0841', 'timestamp is yyyymmdd-hhmm local');
ok(fileTimestamp(new Date(2027, 0, 2, 3, 4)) === '20270102-0304', 'timestamp zero-pads');

ok(societyShortName(SOC) === 'KapilNutriStore', 'three significant words, TitleCase, joined');
ok(societyShortName({ name: 'THE ASSANDH COOPERATIVE MARKETING CUM PROCESSING SOCIETY LTD. ASSANDH' }) === 'AssandhCooperative', 'drops The/Society/Ltd, adds whole words only while within the 24-char cap (no half words)');
ok(societyShortName({ name: 'श्री राम सहकारी समिति', registrationNo: 'HR/KNL/503' }) === 'RegHRKNL503', 'Hindi-only name falls back to the registration number');
ok(societyShortName({ name: 'समिति' }) === 'Society' && societyShortName(null) === 'Society', 'no usable name or reg -> "Society"');
ok(societyShortName({ name: 'A'.repeat(60) }).length <= 24, 'capped at 24 chars');

// every distinct base-name SHAPE the pages use today (scan of the downloadCSV/Excel call sites)
const cases = [
  ['trial-balance-2026-27', 'TrialBalance', 'FY2026-27'],
  ['balance-sheet-2026-27', 'BalanceSheet', 'FY2026-27'],
  ['day-book-2026-04-01-to-2026-04-30', 'DayBook', '2026-04-01-to-2026-04-30'],
  ['GSTR9_2026-04-01_to_2026-04-30.csv', 'GSTR9', '2026-04-01-to-2026-04-30'],
  ['form24Q_2026-27_Q1.csv', 'Form24Q', 'FY2026-27-Q1'],
  ['customers.csv', 'Customers', ''],
  ['voucher_approval.xlsx', 'VoucherApproval', ''],
  ['sale-register-2026-27', 'SaleRegister', 'FY2026-27'],
  ['Audit_Trail_2026-04-01_2026-04-30', 'AuditTrail', '2026-04-01-2026-04-30'],
  ['member-outstanding-2026-10-04.csv', 'MemberOutstanding', '2026-10-04'],
  ['ledger-Sundry Creditors', 'LedgerSundryCreditors', ''],
  ['ledger-समिति', 'Ledger', ''],
  ['TrialBalance', 'TrialBalance', ''],
  ['', 'Report', ''],
  ['aging-analysis-receivable', 'AgingAnalysisReceivable', ''],
];
for (const [base, type, scope] of cases) {
  const r = parseBaseName(base);
  ok(r.type === type && r.scope === scope, `parse "${base}" -> ${type} | ${scope || '(none)'}  (got ${r.type} | ${r.scope || '(none)'})`);
}
ok(parseBaseName('x-2026-04').scope === '2026-04', 'a year-month (2026-04) is NOT mistaken for a financial year');
ok(parseBaseName('x-2026-27').scope === 'FY2026-27', '2026-27 IS a financial year');
ok(parseBaseName('x-2099-00').scope === 'FY2099-00', 'century roll-over financial year');

// the SAME stem for a PDF and the CSV/Excel of one report
const pdfStem = standardFileStem({ base: 'TrialBalance', society: SOC, now: NOW, scope: scopeFor({ financialYear: '2026-27' }) });
const csvStem = standardFileStem({ base: 'trial-balance-2026-27', society: SOC, now: NOW });
ok(pdfStem === 'TrialBalance_KapilNutriStore_FY2026-27_20261004-0841', `PDF stem (${pdfStem})`);
ok(pdfStem === csvStem, 'PDF and CSV/Excel of the same report share one stem');
ok(scopeFor({ fromDate: '2026-04-01', toDate: '2026-04-30' }) === '2026-04-01-to-2026-04-30', 'date-range scope');
ok(scopeFor({}) === '', 'no scope');

// safety: ASCII only, no spaces or path characters, bounded
const nasty = standardFileStem({ base: '../../etc/passwd "x" <y>', society: { name: 'A/B\\C:D' }, now: NOW });
ok(/^[A-Za-z0-9._-]+$/.test(nasty) && !/[\\/ ]/.test(nasty), `no path/space characters (${nasty})`);
ok(standardFileStem({ base: 'x'.repeat(500), society: SOC, now: NOW }).length <= 120, 'stem length bounded');
ok(/^[A-Za-z0-9._-]+$/.test(standardFileStem({ base: 'ledger-समिति', society: { name: 'समिति' }, now: NOW })), 'Hindi input never leaks into a file name');


// ── wiring in exportUtils: the file name + README provenance every download now gets ──
import { exportFileName, contextMeta, setExportContext, getExportContext, localIso } from '../src/lib/exportUtils.ts';
const CTX = { society: { name: 'Kapil Nutri Store', registrationNo: 'UDYAM-1', financialYear: '2026-27' }, userName: 'Raju' };
ok(exportFileName('customers.csv', 'csv', null, NOW) === 'customers.csv', 'no session bound: legacy name, extension de-duplicated');
ok(exportFileName('trial-balance-2026-27', 'xlsx', CTX, NOW) === 'TrialBalance_KapilNutriStore_FY2026-27_20261004-0841.xlsx', 'session bound: standard name');
ok(exportFileName('trial-balance-2026-27', 'csv', CTX, NOW).replace('.csv', '') === pdfStem, 'Excel/CSV stem equals the PDF stem of the same report');
ok(contextMeta(null, NOW) === undefined, 'no session -> no README meta');
const cm = contextMeta(CTX, NOW);
ok(cm.societyName === 'Kapil Nutri Store' && cm.registrationNo === 'UDYAM-1' && cm.financialYear === '2026-27' && cm.generatedBy === 'Raju' && cm.generatedAt === localIso(NOW), 'README meta carries society, reg no, FY, user and time');
ok(/^2026-10-04T08:41:05[+-][0-9]{2}:[0-9]{2}$/.test(localIso(NOW)), `README time is the LOCAL clock with its UTC offset, not UTC (${localIso(NOW)})`);
setExportContext(CTX); ok(getExportContext() === CTX, 'context can be bound'); setExportContext(null); ok(getExportContext() === null, 'and cleared (logout)');
for (const [base] of cases) {
  const fn = exportFileName(base, 'csv', CTX, NOW);
  ok(/^[A-Za-z0-9._-]+\.csv$/.test(fn) && !fn.endsWith('.csv.csv'), `safe single-extension name for "${base}" -> ${fn}`);
}
console.log(`\nExport naming: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
