#!/usr/bin/env node
// B2 · posting-readiness classification (pure). Run: node scripts/test-posting-readiness.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
const { classifyReadiness, blockReasons, READINESS_SQL } = await import(pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), 'posting-readiness.mjs')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
const T = '2026-10-01';
const base = { flag: false, has_settings: true, fy_locked: false, open_fy_end: '2027-03-31', live_vouchers: 10, last_date: '2026-09-01', journal_accounts: 0, entries_accounts: 0 };
const c = (o) => classifyReadiness({ ...base, ...o }, T);
ok('consistent, current FY → READY', c({}) === 'READY');
ok('flag on → ON whatever else', c({ flag: true, has_settings: false }) === 'ON');
ok('no vouchers → EMPTY', c({ live_vouchers: 0 }) === 'EMPTY');
ok('journal drift → HEAL', c({ journal_accounts: 2 }) === 'HEAL');
ok('entries drift → HEAL', c({ entries_accounts: 1 }) === 'HEAL');
ok('open FY ended before today → WAIT-FY (rollover would stop posting)', c({ open_fy_end: '2026-03-31', last_date: '2026-03-31' }) === 'WAIT-FY');
ok('no open FY → BLOCKED', c({ open_fy_end: null }) === 'BLOCKED');
ok('vouchers after the open FY (stale label) → BLOCKED with the reason', c({ open_fy_end: '2022-03-31', last_date: '2026-07-09' }) === 'BLOCKED'
  && blockReasons({ ...base, open_fy_end: '2022-03-31', last_date: '2026-07-09' })[0].startsWith('vouchers dated after'));
ok('FY locked → BLOCKED', c({ fy_locked: true }) === 'BLOCKED');
ok('no settings row → BLOCKED', c({ has_settings: false }) === 'BLOCKED');
ok('the readiness SQL is read-only', !/\b(insert|update|delete|alter|drop|truncate|grant)\b/i.test(READINESS_SQL));
console.log(`\nposting-readiness: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
