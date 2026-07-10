// Shared export helpers (T-13 / gaps EXP-21, EXP-26) — asserts the PURE builders of
// src/lib/exportUtils.ts by importing the real module. The DOM wrappers (triggerDownload,
// downloadCSV/Excel/JSON) are not unit-tested; they only wrap a Blob.
//
// The point of this file is REGRESSION, not coverage: 59 pages call downloadCSV and 45
// call downloadExcel. Their output must not shift under a refactor. Every assertion here
// pins behaviour that already shipped.
//
// Run: node scripts/test-export-utils.mjs   (npm run test:export-utils)

import {
  buildCsv, buildWorkbook, buildReadmeSheet, buildJsonEnvelope,
  EXPORT_SCHEMA_VERSION,
} from '../src/lib/exportUtils.ts';
import * as XLSX from 'xlsx';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const BOM = String.fromCharCode(0xFEFF);

// ── 1. CSV: the shape 59 callers depend on ───────────────────────────────────
const csv = buildCsv(['A', 'B'], [['x', 1], ['y', 2]]);
ok(csv === '"A","B"\r\n"x","1"\r\n"y","2"', 'every field is quoted, rows joined with CRLF');
ok(!csv.startsWith(BOM), 'buildCsv does NOT prepend the BOM (downloadCSV does — only the file needs it)');

// Escaping. Because every field is quoted, commas and newlines need no special casing.
ok(buildCsv(['A'], [['he said "hi"']]) === '"A"\r\n"he said ""hi"""', 'embedded quotes are doubled');
ok(buildCsv(['A'], [['a,b']]) === '"A"\r\n"a,b"', 'commas survive inside a field');
ok(buildCsv(['A'], [['line1\nline2']]) === '"A"\r\n"line1\nline2"', 'newlines survive inside a field');

// Nullish cells become empty strings, not "null"/"undefined". Numbers stringify.
ok(buildCsv(['A', 'B', 'C'], [[null, undefined, 0]]) === '"A","B","C"\r\n"","","0"', 'null/undefined → empty; 0 is not dropped');

// RULE 7 / RULE 8: Devanagari passes through untouched.
const hi = buildCsv(['सदस्य', 'नाम'], [['M001', 'राजेश कुमार']]);
ok(hi.includes('राजेश कुमार') && hi.includes('सदस्य'), 'Devanagari headers and cells pass through');

ok(buildCsv([], []) === '', 'empty headers + empty rows → empty string');
ok(buildCsv(['A'], []) === '"A"', 'headers with no rows → header line only');

// ── 2. Workbook: unchanged for the 45 existing callers ───────────────────────
const sheets = [{ name: 'Report', headers: ['A', 'B'], rows: [['x', 1]] }];
const wb = buildWorkbook(sheets);
ok(wb.SheetNames.length === 1 && wb.SheetNames[0] === 'Report', 'no meta ⇒ no README sheet (existing callers unchanged)');
ok(Array.isArray(wb.Sheets.Report['!cols']) && wb.Sheets.Report['!cols'].length === 2, 'column widths are still set');

// Multi-sheet — the capability only 4 of 45 callers use today (EXP-26).
const multi = buildWorkbook([
  { name: 'One', headers: ['A'], rows: [['1']] },
  { name: 'Two', headers: ['B'], rows: [['2'], ['3']] },
]);
ok(multi.SheetNames.join(',') === 'One,Two', 'multi-sheet workbooks keep sheet order');

// Excel's hard limit.
const long = buildWorkbook([{ name: 'x'.repeat(40), headers: ['A'], rows: [] }]);
ok(long.SheetNames[0].length === 31, 'sheet names are truncated to 31 chars');

// Round-trip through the real library: the bytes actually parse back.
const buf = XLSX.write(buildWorkbook([{ name: 'R', headers: ['नाम'], rows: [['राजेश', 5000]] }]), { type: 'array', bookType: 'xlsx' });
const back = XLSX.utils.sheet_to_json(XLSX.read(buf, { type: 'array' }).Sheets.R, { header: 1, defval: '' });
ok(back[0][0] === 'नाम' && back[1][0] === 'राजेश', 'Devanagari survives a real xlsx round-trip');
ok(back[1][1] === 5000 && typeof back[1][1] === 'number', 'numeric cells stay numeric in xlsx');

// ── 3. README sheet: opt-in, and last ────────────────────────────────────────
const META = { societyName: 'श्री कृष्ण सहकारी समिति', financialYear: '2025-26', generatedAt: '2026-07-10T00:00:00.000Z' };

ok(buildReadmeSheet({}, sheets) === null, 'empty meta ⇒ no README sheet at all');

const readme = buildReadmeSheet(META, sheets);
ok(readme.name === 'README' && readme.headers.join(',') === 'Field,Value', 'README shape');
const kv = Object.fromEntries(readme.rows.filter(r => r[0]));
ok(kv['Society'] === META.societyName, 'README records the society');
ok(kv['Financial Year'] === '2025-26' && kv['Generated At'] === META.generatedAt, 'README records FY + generated-at');
ok(kv['Rows in "Report"'] === '1', 'README records a row count per data sheet');

const withMeta = buildWorkbook(sheets, META);
ok(withMeta.SheetNames.join(',') === 'Report,README', 'README goes LAST — Excel still opens on the data sheet');

// Filters are flattened one row each, so a reader sees the export was scoped.
const filtered = buildReadmeSheet({ ...META, filters: { fromDate: '2025-04-01', includeDeleted: true } }, sheets);
const fkv = Object.fromEntries(filtered.rows.filter(r => r[0]));
ok(fkv['Filter: fromDate'] === '2025-04-01' && fkv['Filter: includeDeleted'] === 'true', 'filters are recorded individually');
ok(buildReadmeSheet({ ...META, filters: {} }, sheets).rows.every(r => !String(r[0]).startsWith('Filter')), 'an empty filter object adds no rows');

// ── 4. JSON envelope ─────────────────────────────────────────────────────────
const env = buildJsonEnvelope({ members: [1, 2] }, META);
ok(env.schemaVersion === EXPORT_SCHEMA_VERSION, 'envelope carries the schema version');
ok(env.generatedAt === META.generatedAt, 'generatedAt is injectable (deterministic tests)');
ok(env.society === META.societyName && env.financialYear === '2025-26', 'envelope carries provenance');
ok(JSON.stringify(env.data) === '{"members":[1,2]}', 'the payload sits under `data`, untouched');
ok(env.filters === null && env.mode === null, 'absent meta fields are null, not undefined (JSON-safe)');

// THE STATUTORY GUARD. downloadJSON must be able to emit a foreign schema verbatim.
// GstSummary's GSTR-1/3B and GSTR9's draft imitate the NIC/GSTN offline-utility shape;
// wrapping them in an envelope would corrupt the file they exist to produce. The pure
// proof is that the envelope is only ever applied when meta is supplied — asserted here
// by showing the payload is reachable unmodified.
const statutory = { gstin: '06AAAAA0000A1Z5', fp: '072026', b2b: [] };
ok(JSON.stringify(buildJsonEnvelope(statutory, {}).data) === JSON.stringify(statutory), 'a foreign payload is never mutated by the envelope');

console.log(`\nExport utils (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
