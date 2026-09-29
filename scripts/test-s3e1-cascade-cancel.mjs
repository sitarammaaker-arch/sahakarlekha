#!/usr/bin/env node
// S3-e-1 · every parent-record cascade cancels its vouchers through cancelLinkedVouchers — WITH the
// journal (voucher.cancelled) and a rollback on failure. Static checks of DataContext. CI-safe.
// (cancel_voucher itself is exercised on a restored backup by scripts/db-harness/tests/s3d-edit-cancel-voucher.mjs.)
//
// Run: node scripts/test-s3e1-cascade-cancel.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const dc = readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const fnBody = (name) => {
  const a = dc.indexOf(`const ${name} = `);
  if (a < 0) return '';
  const next = dc.slice(a + 10).search(/\n  const [a-zA-Z0-9_]+ = (useCallback\(|async |\()/);
  return dc.slice(a, next < 0 ? undefined : a + 10 + next);
};

console.log('The helper');
const h = fnBody('cancelLinkedVouchers');
ok('cancelLinkedVouchers exists', h.length > 200);
ok('skips already-cancelled and engine vouchers (idempotent)', /filter\(v => ids\.includes\(v\.id\) && !v\.isDeleted && !isEngineVoucher\(v\)\)/.test(h));
ok('posting service on → cancel_voucher RPC, server events swapped into the journal', /if \(postingServiceRef\.current\) \{\s*supabase\.rpc\('cancel_voucher', \{ p_id: v\.id, p_reason: reason, p_deleted_by: by \}\)/.test(h) && /mapLedgerEventRows\(/.test(h));
ok('off → soft-delete with all four delete columns, then entries removed AND voucher.cancelled from the DB journal', /update\(\{ isDeleted: true, deletedAt: now, deletedBy: by, deletedReason: reason \}\)/.test(h)
  && /deleteEntries\(v\.id\);\s*void ensureVoucherCancelEvent\(v, by, reason\);/.test(h));
ok('any failure (error or rejection, both paths) → that voucher restored + destructive toast + reportError', (h.match(/undo\(v, /g) || []).length >= 2 && (h.match(/, fail\);/g) || []).length === 2
  && /reportError\('voucher-cascade-cancel'/.test(h) && /variant: 'destructive', duration: 15000/.test(h));

console.log('ensureVoucherCancelEvent');
const e = fnBody('ensureVoucherCancelEvent');
ok('reverses the journal\'s own posting legs (falls back to the voucher\'s)', /flipLegs\(evs\.find\(e => e\.eventId === posting\)\?\.payload\) \?\? voucherReversalLines\(voucher\)/.test(e));
ok('append failure is reported, success mirrored into the loaded journal', /reportError\('voucher-cancel-journal'/.test(e) && /journalLoadedRef\.current && !ledgerEventsRef\.current\.some/.test(e));

console.log('Every cascade goes through the helper');
const sites = [
  ['deleteMember', "'Member deleted'"], ['deleteLoan', "'Loan deleted'"], ['deleteAsset', "'Asset deleted'"],
  ['deleteSale', '`Sale ${sale.saleNo} deleted`'], ['updateSale', '`Sale ${original.saleNo} edited`'],
  ['deletePurchase', '`Purchase ${purchase.purchaseNo} deleted`'], ['updatePurchase', '`Purchase ${original.purchaseNo} edited`'],
  ['updateSalaryRecord', '`Salary slip ${oldRecord.slipNo} marked unpaid`'], ['deleteSalaryRecord', '`Salary slip ${record?.slipNo} deleted`'],
];
for (const [fn, reason] of sites) {
  const b = fnBody(fn);
  ok(`${fn}: cancelLinkedVouchers(…, ${reason}, …) and no direct isDeleted write`, b.includes('cancelLinkedVouchers(') && b.includes(reason)
    && !/from\('vouchers'\)\.update\(\{ isDeleted: true/.test(b), b ? '' : 'function not found');
}

console.log('No other code soft-deletes a voucher behind the journal\'s back');
const writers = [...dc.matchAll(/from\('vouchers'\)\.update\(\{ isDeleted: true/g)].map((m) => {
  const before = dc.slice(0, m.index);
  const all = [...before.matchAll(/\n  const ([a-zA-Z0-9_]+) = (?:useCallback\(|async |\()/g)];
  return all.length ? all[all.length - 1][1] : '?';
});
ok('isDeleted is written only by cancelVoucher and cancelLinkedVouchers', writers.every((w) => w === 'cancelVoucher' || w === 'cancelLinkedVouchers'), writers.join(', '));

console.log(`\nS3-e-1 cascade cancel: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
