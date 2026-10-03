// Export hardening (audit 2026-10-03: D-S01 CSV/XLSX formula injection, sheet-name
// crashes, 32,767-char cell cap, ".csv.csv" double extension).
// Run: node scripts/test-export-hardening.mjs   (npm run test:export-hardening)
import {
  neutraliseFormula, safeSheetName, stripExt, buildCsv, buildWorkbook,
} from '../src/lib/exportUtils.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// Formula guard
ok(neutraliseFormula('=1+1') === "'=1+1", '= prefixed');
ok(neutraliseFormula('@SUM(A1)') === "'@SUM(A1)", '@ prefixed');
ok(neutraliseFormula('+cmd|x') === "'+cmd|x", '+ text prefixed');
ok(neutraliseFormula('-cmd|x') === "'-cmd|x", '- text prefixed');
ok(neutraliseFormula('\tx') === "'\tx", 'TAB prefixed');
ok(neutraliseFormula('\rx') === "'\rx", 'CR prefixed');
ok(neutraliseFormula('-1,250.50') === '-1,250.50', 'negative numeric string untouched');
ok(neutraliseFormula('+919876543210') === '+919876543210', 'phone-like numeric untouched');
ok(neutraliseFormula(-5) === '-5', 'typed negative number untouched');
ok(neutraliseFormula('राजेश') === 'राजेश', 'Hindi untouched');
ok(neutraliseFormula(null) === '' && neutraliseFormula(undefined) === '', 'nullish -> empty');
ok(buildCsv(['A'], [['=HYPERLINK("x")']]) === '"A"\r\n"\'=HYPERLINK(""x"")"', 'buildCsv neutralises formulas');
ok(buildCsv(['A'], [[-5]]) === '"A"\r\n"-5"', 'buildCsv keeps typed negatives');

// Sheet names
ok(safeSheetName('A/B:C?') === 'A B C', 'forbidden sheet chars removed');
ok(safeSheetName('x'.repeat(40)).length === 31, 'capped at 31');
ok(safeSheetName('') === 'Sheet', 'blank defaulted');
const used = new Set();
ok(safeSheetName('Data', used) === 'Data' && safeSheetName('data', used) === 'data (2)', 'duplicates (case-insensitive) made unique');
const dup = buildWorkbook([
  { name: 'S', headers: ['A'], rows: [['=1']] },
  { name: 'S', headers: ['A'], rows: [] },
]);
ok(dup.SheetNames.length === 2 && dup.SheetNames[0] !== dup.SheetNames[1], 'duplicate sheet names do not throw');
ok(dup.Sheets[dup.SheetNames[0]].A2.v === "'=1", 'xlsx text cell neutralised');
const big = buildWorkbook([{ name: 'S', headers: ['A'], rows: [['y'.repeat(40000)]] }]);
ok(big.Sheets.S.A2.v.length === 32767, 'xlsx cell capped at 32767 chars');

// Extensions
ok(stripExt('sales.csv', 'csv') === 'sales', 'strips .csv');
ok(stripExt('sales', 'csv') === 'sales', 'no ext untouched');
ok(stripExt('a.CSV', 'csv') === 'a', 'case-insensitive');
ok(stripExt('a.csv', 'xlsx') === 'a.csv', 'other ext untouched');

console.log(`\nExport hardening: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
