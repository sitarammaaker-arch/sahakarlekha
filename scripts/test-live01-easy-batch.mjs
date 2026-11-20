// LIVE-01 (product audit 2026-11-17) — after an Easy-mode voucher is saved, the open tile keeps its Dr / Cr accounts,
// so the next voucher of a batch can be saved without "Select debit account" (Easy mode has no account field).
// SEO-01 is checked by test:spa-rewrite (vercel.json /en rules).
// Run: node scripts/test-live01-easy-batch.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const s = readFileSync(resolve(ROOT, 'src/pages/Vouchers.tsx'), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

ok(s.includes("const handleClear = (opts?: { keepTemplateAccounts?: boolean }) => {\n    if (!opts?.keepTemplateAccounts) {\n      setDebitAccount('');\n      setCreditAccount('');\n    }"), 'handleClear keeps the accounts only when asked');
ok(s.includes("handleClear({ keepTemplateAccounts: mode === 'simple' });"), 'after a save, the Easy-mode (simple) form keeps the tile accounts');
ok((s.match(/saveOpts\('simple'/g) || []).length === 1, 'only the Easy-mode save is "simple"');
ok(!/onClick=\{handleClear\}/.test(s), 'no button passes its click event into handleClear');
ok((s.match(/setSelectedTemplate\(null\); handleClear\(\);/g) || []).length >= 2, 'Cancel / Go back still clear the tile and its accounts');

console.log(`LIVE-01 easy batch: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
