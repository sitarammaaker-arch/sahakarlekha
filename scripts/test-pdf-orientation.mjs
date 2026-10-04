// R5 — page orientation is decided by what the report IS, not by whoever wrote the generator.
// (docs/research/REPORT-UNIFORMITY-STANDARD.md). Two-sided statements and wide registers are LANDSCAPE;
// single-column books, notices, forms and per-document PDFs are PORTRAIT.
//
// This pins the current, approved state. A generator that flips orientation, or a NEW generate*PDF that is
// not classified here, fails the build — add it to the right list deliberately.
//
// Run: node scripts/test-pdf-orientation.mjs   (npm run test:pdf-orientation)
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/lib/pdf.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const LANDSCAPE = [
  'TrialBalance', 'IncomeExpenditure', 'ReceiptsPayments', 'BalanceSheet', 'TradingAccount',   // two-sided statements
  'ShareRegister', 'HousingShareNomination', 'LoanRegister', 'AssetRegister', 'AuditRegister',
  'SaleRegister', 'PurchaseRegister', 'ClosingStock', 'DepreciationSchedule', 'DayBook', 'Budget',   // wide registers / schedules
];
const PORTRAIT = [
  'CashBook', 'BankBook', 'Ledger', 'MemberPassbook',                    // books: Date | particulars | amount | balance
  'DemandNotice', 'MaintenanceBill', 'MaintenanceReceipt',               // notices / bills
  'SalarySlip', 'Voucher',                                               // small per-document formats (A5)
  'SaleInvoice', 'PurchaseRecord', 'MemberApplication',                  // per-document / forms
  'GstSummary', 'AuditSchedules',                                        // see note: GST Summary stays portrait for now
];
// generateBlankFormatPDF takes its orientation from a spec on purpose.
const DATA_DRIVEN = ['BlankFormat'];

const found = [...src.matchAll(/export function generate([A-Za-z]+)PDF\(/g)].map(m => ({ name: m[1], at: m.index }));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const orientationOf = (f, i) => {
  const end = i + 1 < found.length ? found[i + 1].at : src.length;
  const body = src.slice(f.at, end);
  const ctor = body.match(/new jsPDF\(([^)]*)\)/);
  if (!ctor) return null;
  const arg = ctor[1];
  if (/orientation:\s*spec\./.test(arg)) return 'data-driven';
  return /landscape|'l'/.test(arg) ? 'landscape' : 'portrait';
};

found.forEach((f, i) => {
  const o = orientationOf(f, i);
  const expected = LANDSCAPE.includes(f.name) ? 'landscape' : PORTRAIT.includes(f.name) ? 'portrait' : DATA_DRIVEN.includes(f.name) ? 'data-driven' : null;
  ok(expected !== null, `generate${f.name}PDF is not classified — add it to LANDSCAPE or PORTRAIT in scripts/test-pdf-orientation.mjs`);
  if (expected) ok(o === expected, `generate${f.name}PDF is ${o}, expected ${expected}`);
});
const names = found.map(f => f.name);
for (const n of [...LANDSCAPE, ...PORTRAIT, ...DATA_DRIVEN]) ok(names.includes(n), `${n} is listed here but generate${n}PDF no longer exists — delete the entry`);
ok(found.length >= 30, `found the generators (${found.length})`);

console.log(`\nPDF orientation lock: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
