// xlsx supply-chain + API compatibility guard (T-03 / gap EXP-06).
//
// WHY THIS EXISTS
// npm's registry copy of `xlsx` is frozen at 0.18.5 — SheetJS stopped publishing there.
// 0.18.5 predates the fixes for the known prototype-pollution (0.19.3) and ReDoS (0.20.2)
// advisories, and this library parses UNTRUSTED user uploads in two places:
//   - src/pages/UniversalImporter.tsx      (member / account / voucher import)
//   - src/pages/BankReconciliation.tsx     (bank statement import)
// So package.json pins the patched tarball from the SheetJS CDN instead of the registry.
//
// This test fails loudly if anyone `npm install xlsx` (which silently re-resolves to the
// vulnerable 0.18.5), or if a version bump breaks an API that exportUtils / the two
// importers depend on.
//
// Run: node scripts/test-xlsx-compat.mjs (exit 1 on any failure).

import * as XLSX from 'xlsx';

/** Minimum safe version: 0.19.3 fixed prototype pollution, 0.20.2 fixed ReDoS. */
const MIN_SAFE = [0, 20, 2];

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const cmp = (a, b) => a.reduce((acc, n, i) => acc !== 0 ? acc : n - b[i], 0);
const parsed = XLSX.version.split('.').map(Number);

// 1. Supply chain: never silently fall back to the vulnerable registry build.
ok(cmp(parsed, MIN_SAFE) >= 0,
  `xlsx ${XLSX.version} is older than ${MIN_SAFE.join('.')} — the npm registry copy (0.18.5) is vulnerable. Reinstall from the SheetJS CDN tarball pinned in package.json.`);

// 2. API surface used by exportUtils.ts, UniversalImporter.tsx, BankReconciliation.tsx.
for (const fn of ['read', 'write', 'writeFile']) ok(typeof XLSX[fn] === 'function', `XLSX.${fn} exists`);
for (const fn of ['book_new', 'aoa_to_sheet', 'book_append_sheet', 'sheet_to_json'])
  ok(typeof XLSX.utils[fn] === 'function', `XLSX.utils.${fn} exists`);

// 3. Devanagari round-trip (RULE 7 / RULE 8): headers and cells must survive write → read.
const headers = ['सदस्य ID', 'नाम', 'अंशपूँजी'];
const rows = [['M001', 'राजेश कुमार', 5000], ['M002', 'सीता देवी', 7500]];
const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
ws['!cols'] = headers.map(h => ({ wch: h.length + 2 }));   // exportUtils sets column widths
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Report');

const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
ok(buf && buf.byteLength > 0, 'write() produces bytes');

const wb2 = XLSX.read(buf, { type: 'array' });
const back = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1, defval: '' });
ok(wb2.SheetNames[0] === 'Report', 'sheet name preserved');
ok(JSON.stringify(back[0]) === JSON.stringify(headers), 'Devanagari headers survive round-trip');
ok(back[1][1] === 'राजेश कुमार', 'Hindi cell value survives round-trip');
ok(back[2][2] === 7500 && typeof back[2][2] === 'number', 'numeric cell stays numeric');
ok(back.length === 3, 'row count preserved');

// 4. `cellDates` is used by BankReconciliation.tsx — must stay accepted.
let dateOpt = true;
try { XLSX.read(buf, { type: 'array', cellDates: true }); } catch { dateOpt = false; }
ok(dateOpt, 'cellDates option still accepted');

// 5. Malformed input. DOCUMENTED BEHAVIOUR, not a bug: XLSX.read does NOT throw on
//    arbitrary bytes — it falls back to plaintext/CSV parsing and yields a junk "Sheet1".
//    (Verified identical in 0.18.5 and 0.20.3.) The importers are therefore responsible
//    for rejecting garbage via per-row validation, NOT by relying on read() to throw.
//    Pinned here so nobody "fixes" the importers by removing their validation.
const junk = XLSX.read(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), { type: 'array' });
ok(junk.SheetNames.length > 0, 'malformed bytes parse into a junk sheet (importers must validate rows)');

let zipThrew = false;
try { XLSX.read(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]), { type: 'array' }); }
catch { zipThrew = true; }
ok(zipThrew, 'a truncated ZIP header is rejected');

console.log(`\nxlsx compat (v${XLSX.version}): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
