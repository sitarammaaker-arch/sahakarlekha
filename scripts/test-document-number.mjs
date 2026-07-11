// Document numbering — format SSOT + the server-authority seam (T-03 / ADR-0005, CA-03).
//
// The server RPC (next_document_number) guarantees GAPLESS, race-free numbers at the DB;
// that atomicity is a database property, tested by inspection. What is unit-tested here is
// the CLIENT contract: the canonical format (which must match the legacy numbers exactly, so
// server-issued numbers are drop-in), round-trip parsing, and that the issuer formats
// whatever the authority returns — and refuses an invalid number rather than composing one.
//
// Run: node scripts/test-document-number.mjs   (npm run test:document-number)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let m;
try {
  m = await import(abs('../src/lib/documentNumber.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the documentNumber module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { composeDocumentNumber, parseDocumentNumber, issueDocumentNumber } = m;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. FORMAT — must match the legacy storage.getNextVoucherNo output EXACTLY ──
ok(composeDocumentNumber('RV', '2025-26', 1) === 'RV/2025/26/001',
  'RV/2025-26/#1 → "RV/2025/26/001" — identical to the legacy format (drop-in replacement)');
ok(composeDocumentNumber('PV', '2025-26', 42) === 'PV/2025/26/042', 'seq is zero-padded to 3');
ok(composeDocumentNumber('JV', '2024-25', 999) === 'JV/2024/25/999', 'three-digit seq is unpadded');
ok(composeDocumentNumber('JV', '2024-25', 1000) === 'JV/2024/25/1000', 'four-digit seq is not truncated');

let threw = false; try { composeDocumentNumber('RV', '2025-26', 0); } catch { threw = true; }
ok(threw, 'seq 0 is rejected — a document number starts at 1');
let threw2 = false; try { composeDocumentNumber('RV', '2025-26', 1.5); } catch { threw2 = true; }
ok(threw2, 'a non-integer seq is rejected');

// ── 2. PARSE — round-trip, and reject malformed ──────────────────────────────
const parsed = parseDocumentNumber('RV/2025/26/001');
ok(parsed && parsed.prefix === 'RV' && parsed.fy === '2025-26' && parsed.seq === 1, 'parse recovers prefix, fy and seq');
for (const [prefix, fy, seq] of [['RV', '2025-26', 1], ['PV', '2024-25', 137], ['JV', '2030-31', 1000]]) {
  const round = parseDocumentNumber(composeDocumentNumber(prefix, fy, seq));
  ok(round && round.prefix === prefix && round.fy === fy && round.seq === seq, `round-trip ${prefix}/${fy}/#${seq}`);
}
for (const bad of ['', 'abc', 'RV/2025/001', 'RV/2025/26/xx', 'RV-2025-26-001', 42, null]) {
  ok(parseDocumentNumber(bad) === null, `malformed input ${JSON.stringify(bad)} parses to null`);
}

// ── 3. ISSUER — formats what the authority returns; refuses an invalid number ─
let seen = null;
const fakeAuthority = async (societyId, book, fy) => { seen = { societyId, book, fy }; return 7; };
const issued = await issueDocumentNumber(fakeAuthority, { prefix: 'RV', book: 'receipt', societyId: 'SOC001', fy: '2025-26' });
ok(issued === 'RV/2025/26/007', 'the issuer formats the authority-issued number');
ok(seen && seen.societyId === 'SOC001' && seen.book === 'receipt' && seen.fy === '2025-26',
  'the issuer passes (society, book, fy) through to the authority');

// Monotonic authority → monotonic numbers.
let n = 0;
const counting = async () => ++n;
const a = await issueDocumentNumber(counting, { prefix: 'PV', book: 'payment', societyId: 'S', fy: '2025-26' });
const b = await issueDocumentNumber(counting, { prefix: 'PV', book: 'payment', societyId: 'S', fy: '2025-26' });
ok(a === 'PV/2025/26/001' && b === 'PV/2025/26/002', 'consecutive issues are consecutive numbers');

// A bad number from the authority is refused, not composed.
let issThrew = false;
try { await issueDocumentNumber(async () => 0, { prefix: 'RV', book: 'receipt', societyId: 'S', fy: '2025-26' }); }
catch { issThrew = true; }
ok(issThrew, 'the issuer THROWS on an invalid (0) number rather than minting a wrong one of record');

// ── 4. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'documentNumber.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `documentNumber.ts is pure (no "${forbidden}")`);
}

console.log(`\nDocument numbering (format + issuer): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
