// isCountedVoucher (audit A-03): pages that read raw vouchers must exclude exactly what
// DataContext.activeVouchers excludes (deleted, rejected, pending-under-maker-checker).
// Run: node scripts/test-counted-voucher.mjs   (npm run test:counted-voucher)
import { isCountedVoucher } from '../src/lib/countedVoucher.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

ok(isCountedVoucher({}), 'plain voucher counts');
ok(!isCountedVoucher({ isDeleted: true }), 'deleted excluded');
ok(!isCountedVoucher({ approvalStatus: 'rejected' }), 'rejected excluded');
ok(!isCountedVoucher({ approvalStatus: 'rejected' }, true), 'rejected excluded under maker-checker');
ok(isCountedVoucher({ approvalStatus: 'pending' }, false), 'pending counts when maker-checker is OFF');
ok(isCountedVoucher({ approvalStatus: 'pending' }), 'pending counts when flag undefined');
ok(!isCountedVoucher({ approvalStatus: 'pending' }, true), 'pending excluded when maker-checker is ON');
ok(isCountedVoucher({ approvalStatus: 'approved' }, true), 'approved counts');
ok(!isCountedVoucher({ isDeleted: true, approvalStatus: 'approved' }, true), 'deleted+approved still excluded');
console.log(`\nisCountedVoucher: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
