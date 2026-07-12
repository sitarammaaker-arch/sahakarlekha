// Document-number parse/format (T-03 / ADR-0005).
//
// The server sequence issues the SEQ; the client splits its provisional BOOK/FY/SEQ number
// and reassembles it with the issued SEQ, preserving zero-pad width. These are the pure
// helpers persistVoucher uses to shape the official number — imported REAL, not mirrored.
//
// Run: node scripts/test-numbering.mjs   (npm run test:numbering)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

const { parseDocNumber, formatDocNumber } = await import(abs('../src/lib/numbering.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── parse ────────────────────────────────────────────────────────────────────
const p = parseDocNumber('RCP/2025-26/0007');
ok(p && p.book === 'RCP' && p.fy === '2025-26' && p.seq === 7 && p.width === 4, 'parses BOOK/FY/SEQ incl. zero-pad width');
ok(parseDocNumber('SL/2025-26/012')?.width === 3, 'width follows the actual pad (3)');
for (const bad of [undefined, null, '', 'RCP/2025-26', 'RCP/2025-26/', 'RCP//007', 'RCP/2025-26/07a', 'a/b/c/d']) {
  ok(parseDocNumber(bad) === null, `rejects malformed "${bad}"`);
}

// ── format (reassemble with the server SEQ, keep width) ──────────────────────
ok(formatDocNumber('RCP', '2025-26', 8, 4) === 'RCP/2025-26/0008', 'reformats the issued SEQ with the original width');
ok(formatDocNumber('SL', '2025-26', 1, 3) === 'SL/2025-26/001', 'pads to width 3');
ok(formatDocNumber('PMT', '2025-26', 12345, 3) === 'PMT/2025-26/12345', 'a SEQ wider than the pad is not truncated');

// ── round trip: parse a provisional, reissue with a server number ────────────
const parsed = parseDocNumber('JRN/2026-27/0042');
ok(parsed && formatDocNumber(parsed.book, parsed.fy, 43, parsed.width) === 'JRN/2026-27/0043',
   'provisional 0042 reissued as official 0043, same shape');

console.log(`\nDocument numbering: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
