#!/usr/bin/env node
// Sales return credit account (src/lib/consumer/salesReturnAccount.ts). 2026-10-01: an "adjust against
// credit" return credited the 3303 control instead of the customer's own ledger the sale debited, so the
// customer's outstanding did not drop (Kapil Nutri Store SRET/2026-27/001).
// Run: node scripts/test-sales-return-account.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)}; const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));
const { salesReturnCreditAccountId: f } = await import(pathToFileURL(pathResolve(SRC, 'lib/consumer/salesReturnAccount.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
const sale = (dr) => ({ id: 's', voucherNo: 'JV/1', type: 'journal', date: '2026-09-01', debitAccountId: dr, creditAccountId: '4105', amount: 100,
  lines: [{ id: 'a', accountId: dr, type: 'Dr', amount: 100 }, { id: 'b', accountId: '4105', type: 'Cr', amount: 100 }] });
const base = { bankAccountIds: ['bank-1'], memberReceivableAccountId: 'mem-rcv' };
ok('credit sale to a customer → the customer\'s own ledger the sale debited', f({ ...base, refundMode: 'credit', saleVoucher: sale('cust-uggarsain') }) === 'cust-uggarsain');
ok('cash refund → 3301', f({ ...base, refundMode: 'cash', saleVoucher: sale('cust') }) === '3301');
ok('bank refund → chosen bank, else first bank', f({ ...base, refundMode: 'bank', bankAccountId: 'bank-9' }) === 'bank-9' && f({ ...base, refundMode: 'bank' }) === 'bank-1');
ok('member sale → the member receivable the sale debited', f({ ...base, refundMode: 'credit', saleVoucher: sale('mem-rcv'), memberId: 'm1' }) === 'mem-rcv');
ok('cash sale (no receivable leg) → member receivable / 3303 fallback', f({ ...base, refundMode: 'credit', saleVoucher: sale('3301') }) === '3303' && f({ ...base, refundMode: 'credit', saleVoucher: sale('bank-1'), memberId: 'm' }) === 'mem-rcv');
ok('no sale voucher → 3303 fallback', f({ ...base, refundMode: 'credit', saleVoucher: null }) === '3303');
ok('a cancelled sale voucher is not trusted', f({ ...base, refundMode: 'credit', saleVoucher: { ...sale('cust'), isDeleted: true } }) === '3303');
const ctx = readFileSync(pathResolve(SRC, 'contexts/ConsumerDataContext.tsx'), 'utf8');
ok('both add and update sales return use the helper (no bare 3303 for a customer)', (ctx.match(/salesReturnCreditAccountId\(\{/g) || []).length === 2 && !/sale\.customerId \? '3303'/.test(ctx));
console.log(`\nsales return account: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
