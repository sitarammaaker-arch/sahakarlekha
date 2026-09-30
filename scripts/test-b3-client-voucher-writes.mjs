#!/usr/bin/env node
// Phase-2 B3 · client-side voucher writes that bypassed the journal / the posting service.
// Static guarantees on DataContext (the runtime paths are exercised by the S3 harness suites):
//   · updateSalaryRecord never rewrites a voucher row itself — it goes through updateVoucher
//     (journal repost pair, or edit_voucher under the posting service) and pre-checks edit locks;
//   · postJoiningReceipts posts through addVoucher (post_voucher) when the posting service is on;
//   · clear / unclear / reject change ONLY their own columns (no whole-row upsert of a client copy);
//   · reversal-link failures reach error_log; editHistory records the editor, not the creator.
//
// Run: node scripts/test-b3-client-voucher-writes.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/contexts/DataContext.tsx'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

/** The body of `const <name> = useCallback(` up to the next top-level `  const ` declaration. */
function body(name) {
  const start = src.indexOf(`  const ${name} = useCallback(`);
  if (start < 0) return '';
  const next = src.indexOf('\n  const ', start + 10);
  return src.slice(start, next < 0 ? undefined : next);
}

const salary = body('updateSalaryRecord');
ok('updateSalaryRecord found', salary.length > 0);
ok('updateSalaryRecord never persists / upserts a voucher row itself', !/persistVoucher\(/.test(salary) && !/from\('vouchers'\)/.test(salary));
ok('updateSalaryRecord re-syncs the payment and the accrual voucher through updateVoucher', (salary.match(/updateVoucher\(/g) || []).length >= 2);
ok('updateSalaryRecord pre-checks edit locks before changing anything', salary.indexOf('isEditLocked(') > 0 && salary.indexOf('isEditLocked(') < salary.indexOf('cancelLinkedVouchers('));
ok('a refused voucher edit stops the salary save', /\)\) return;/.test(salary));

const joining = body('postJoiningReceipts');
ok('postJoiningReceipts found', joining.length > 0);
const flagAt = joining.indexOf('if (postingServiceRef.current)');
ok('postJoiningReceipts: posting service → addVoucher, before the client-side save', flagAt > 0 && joining.indexOf('addVoucher(', flagAt) > flagAt && joining.indexOf('addVoucher(', flagAt) < joining.indexOf('persistVoucher('));

for (const [fn, cols] of [['clearVoucher', 'isCleared: true'], ['unclearVoucher', 'isCleared: false'], ['rejectVoucher', "approvalStatus: 'rejected'"]]) {
  const b = body(fn);
  ok(`${fn}: no whole-row upsert`, b.length > 0 && !/from\('vouchers'\)\.upsert/.test(b));
  ok(`${fn}: targeted update of its own columns`, b.includes(`from('vouchers').update({ ${cols}`));
}

const reverse = body('reverseVoucher');
ok('reversal link failures reach error_log', (reverse.match(/reportError\('voucher-reversal-link'/g) || []).length === 2 && !/console\.warn/.test(reverse));
ok('editHistory records the editor', body('updateVoucher').includes('editedBy: userRef.current?.name ?? current.createdBy'));

console.log(`\nB3 client voucher writes: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
