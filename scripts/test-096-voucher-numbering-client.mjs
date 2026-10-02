#!/usr/bin/env node
// 096 client side · voucher numbers (BOOK/YYYY/YY/SEQ) are understood by the numbering helpers, and the
// posting-service path no longer pre-issues a number (the server issues it inside post_voucher and the
// client restamps the returned number). Server side: db-harness h-096-voucher-numbering.
// Run: node scripts/test-096-voucher-numbering-client.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { parseDocNumber, formatDocNumber, issueOfficialNumber } = await import(pathToFileURL(resolve(root, 'src/lib/numbering.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };

const p = parseDocNumber('RV/2026/27/012');
ok('4-part voucher number parses (book RV, fy 2026/27, seq 12, width 3)', p && p.book === 'RV' && p.fy === '2026/27' && p.seq === 12 && p.width === 3);
ok('…and reassembles to the same shape', formatDocNumber(p.book, p.fy, 1940, p.width) === 'RV/2026/27/1940');
ok('malformed 4-part stays rejected', parseDocNumber('a/b/c/d') === null && parseDocNumber('RV/26/27/1') === null && parseDocNumber('RV/2026/2027/1') === null);
ok('3-part (sales) unchanged', parseDocNumber('SL/2026-27/081')?.fy === '2026-27');
const calls = [];
const rpc = async (s, b, f) => { calls.push([s, b, f]); return 1940; };
ok('issueOfficialNumber sequences a voucher number on (book, YYYY/YY) — the server key', (await issueOfficialNumber(rpc, 'S1', 'RV/2026/27/017')) === 'RV/2026/27/1940' && calls[0][1] === 'RV' && calls[0][2] === '2026/27');

const dc = readFileSync(resolve(root, 'src/contexts/DataContext.tsx'), 'utf8');
const ps = dc.slice(dc.indexOf('if (postingServiceRef.current && shadowEvent) {'), dc.indexOf('// ── Default (flag OFF)'));
ok('posting path no longer pre-issues a number', !ps.includes('issueOfficialNumber(') && /attempt\(newVoucher, 0\);/.test(ps));
ok('posting path restamps the official number post_voucher returns', /const officialNo = \(data as \{ voucherNo\?: string \} \| null\)\?\.voucherNo;/.test(ps) && /restamp\(nv, nev\)/.test(ps));
const mig = readFileSync(resolve(root, 'supabase/migrations/096_server_voucher_numbering.sql'), 'utf8');
ok('096: post_voucher numbers inside its own transaction', /v_no := public\._official_doc_no\(v_sid, p_voucher ->> 'voucherNo', 'vouchers', 'voucherNo'\);/.test(mig));
ok('096: post_stock_document marks its voucher pre-numbered', /'voucherNo', v_vno, 'numbered', true/.test(mig));
ok('096: sequences seeded from current maxima, never lowered', /on conflict \(society_id, book, fy\)\s*do update set last_number = greatest/.test(mig));

console.log(`\n096 voucher numbering (client): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
