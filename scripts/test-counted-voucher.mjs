// isCountedVoucher (audit A-03): pages that read raw vouchers must exclude exactly what
// DataContext.activeVouchers excludes (deleted, rejected, pending — pending regardless of
// society.approvalRequired, since the matrix also holds by threshold / type).
// Run: node scripts/test-counted-voucher.mjs   (npm run test:counted-voucher)
import { isCountedVoucher } from '../src/lib/countedVoucher.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

ok(isCountedVoucher({}), 'plain voucher counts');
ok(!isCountedVoucher({ isDeleted: true }), 'deleted excluded');
ok(!isCountedVoucher({ approvalStatus: 'rejected' }), 'rejected excluded');
ok(!isCountedVoucher({ approvalStatus: 'pending' }), 'pending excluded (flag OFF — threshold/type hold)');
ok(isCountedVoucher({ approvalStatus: 'approved' }), 'approved counts');
ok(isCountedVoucher({ approvalStatus: undefined }), 'unmarked counts');
ok(!isCountedVoucher({ isDeleted: true, approvalStatus: 'approved' }), 'deleted+approved still excluded');
ok([{}, { approvalStatus: 'pending' }, { approvalStatus: 'rejected' }, { isDeleted: true }].filter(isCountedVoucher).length === 1, 'usable directly as an Array.filter callback');
ok(isCountedVoucher.length === 1, 'takes the voucher only (no approvalRequired parameter)');
console.log(`\nisCountedVoucher: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
