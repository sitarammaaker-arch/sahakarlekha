// Posting default bank account: when a caller names no bank, the entry must land on a real bank sub-account,
// never on the head 3302 "Bank Accounts" (stored as a plain non-group account on some societies, e.g. Assandh).
// Also a source guard: no `getBankAccountIds(...)[0]` fallback may come back.
// Run: node scripts/test-default-bank-account.mjs   (npm run test:default-bank-account)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dir = mkdtempSync(join(tmpdir(), 'defbank-'));
const entry = join(dir, 'entry.ts');
writeFileSync(entry, `export { defaultBankAccountId, getBankAccountIds } from '@/lib/storage';`);
const out = join(dir, 'bundle.cjs');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  alias: { '@': join(ROOT, 'src') }, absWorkingDir: ROOT, define: { 'import.meta.env': '{}' } });
const { defaultBankAccountId, getBankAccountIds } = createRequire(import.meta.url)(out);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  x', m); } };
const a = (id, parentId, isGroup = false) => ({ id, parentId, isGroup });

// Assandh shape: head 3302 is NOT a group, 2 sub-accounts
const plainHead = [a('3302', '3300', false), a('sbi', '3302'), a('hdfc', '3302')];
ok(getBankAccountIds(plainHead)[0] === '3302', 'precondition: the old default really was the head');
ok(defaultBankAccountId(plainHead) === 'sbi', 'plain head + sub-accounts: default is the first real bank');
// Group head
const groupHead = [a('3302', '3300', true), a('sbi', '3302'), a('hdfc', '3302')];
ok(defaultBankAccountId(groupHead) === 'sbi', 'group head: unchanged, first sub-account');
// No sub-accounts: head stays the only choice
ok(defaultBankAccountId([a('3302', '3300', false)]) === '3302', 'no sub-accounts: head is the default');
ok(defaultBankAccountId([]) === '3302', 'empty chart: falls back to 3302');

// Source guard
const bad = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p);
  if (s.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(n) && n !== 'storage.ts' && /getBankAccountIds\([^\n]*\)\[0\]/.test(readFileSync(p, 'utf8'))) bad.push(p); } };
walk(join(ROOT, 'src'));
ok(bad.length === 0, `no getBankAccountIds(...)[0] fallback left in src (found in: ${bad.join(', ')})`);

console.log(`default-bank-account: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
