// Audit year helpers (src/lib/auditYear.ts): the Audit Register must store the FY string the
// Audit Certificate filters on — a calendar-year default ("2026") made objections vanish from it.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { isFyString, shiftFy, auditYearOptions } = await import(pathToFileURL(resolve(HERE, '../src/lib/auditYear.ts')).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}`);

ok(isFyString('2026-27'), '"2026-27" is an FY');
ok(isFyString('1999-00'), 'century rollover "1999-00" is an FY');
ok(!isFyString('2026'), 'calendar year "2026" is NOT an FY');
ok(!isFyString('2026-28'), 'mismatched suffix is NOT an FY');
ok(!isFyString('') && !isFyString(undefined), 'empty is NOT an FY');

eq(shiftFy('2026-27', -1), '2025-26', 'shift back one year');
eq(shiftFy('2026-27', 2), '2028-29', 'shift forward two years');
eq(shiftFy('2026', -1), '', 'non-FY input → empty');

const opts = auditYearOptions('2026-27');
eq(opts, ['2026-27', '2025-26', '2024-25', '2023-24', '2022-23', '2021-22'], 'current FY + five before, newest first');
const withLegacy = auditYearOptions('2026-27', ['2026', '2019-20', '2025-26', '', null]);
eq(withLegacy[withLegacy.length - 1], '2026', 'legacy calendar-year row kept (last) so editing shows its value');
ok(withLegacy.includes('2019-20') && withLegacy.indexOf('2019-20') === withLegacy.length - 2, 'older FY in use is kept, sorted before legacy');
eq(new Set(withLegacy).size, withLegacy.length, 'no duplicates');
eq(auditYearOptions('', ['2024-25']), ['2024-25'], 'no current FY → only existing values');

console.log(`Audit year helpers: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
