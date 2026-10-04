// Approval-gating verification (P0 #1 / ECR-01) — asserts the reporting predicate that decides
// whether a voucher counts toward financial reports. Imports the REAL rule (lib/countedVoucher —
// the one predicate DataContext.activeVouchers and the raw-voucher pages share) instead of a
// mirror, plus source guards so the chokepoints can't drift back to a private copy.
// Run: node scripts/test-approval-gating.mjs   (exit 1 on any failure).
import { readFileSync } from 'node:fs';
import { isCountedVoucher as isActive } from '../src/lib/countedVoucher.ts';
import { requiresApproval } from '../src/lib/approvalMatrix.ts';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const V = (o) => ({ isDeleted: false, approvalStatus: undefined, ...o });

// 1. Deleted / rejected never count.
ok(!isActive(V({ isDeleted: true })), 'deleted excluded');
ok(!isActive(V({ isDeleted: true, approvalStatus: 'approved' })), 'deleted+approved excluded');
ok(!isActive(V({ approvalStatus: 'rejected' })), 'rejected excluded');

// 2. PENDING never counts — whatever approvalRequired says. The matrix holds by threshold / type
//    with the flag OFF; such a voucher has no journal event until approve_voucher posts it.
ok(!isActive(V({ approvalStatus: 'pending' })), 'pending excluded');
const matrixOff = { approvalRequired: false, threshold: 50000, types: ['journal'] };
const heldByThreshold = requiresApproval(75000, 'payment', matrixOff);
const heldByType = requiresApproval(100, 'journal', matrixOff);
ok(heldByThreshold && heldByType, 'matrix holds by threshold / type even with approvalRequired OFF');
ok(!isActive(V({ approvalStatus: heldByThreshold ? 'pending' : undefined })), 'threshold-held voucher (flag OFF) does NOT count — the fix');
ok(!isActive(V({ approvalStatus: heldByType ? 'pending' : undefined })), 'type-held voucher (flag OFF) does NOT count — the fix');

// 3. Approved / unmarked always count (engine & system vouchers carry no status; the vouchers
//    column defaults to 'approved' in prod).
ok(isActive(V({ approvalStatus: 'approved' })), 'approved counts');
ok(isActive(V({ approvalStatus: undefined })), 'unmarked counts');
ok(isActive({}), 'bare voucher counts');

// 4. Source guards — every chokepoint uses the shared predicate, none keeps a flag-gated copy.
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const dc = src('src/contexts/DataContext.tsx');
ok(/const activeVouchers = useMemo\(\(\) => vouchers\.filter\(v =>\s*isCountedVoucher\(v\)/.test(dc), 'activeVouchers uses isCountedVoucher');
ok(!/approvalRequired && v\.approvalStatus === 'pending'/.test(dc), 'DataContext has no flag-gated pending rule left');
ok(/const syncEntries = \(v: Voucher\) => \{[\s\S]{0,400}if \(!isCountedVoucher\(v\)\) return;/.test(dc), 'syncEntries writes no voucher_entries for a pending voucher');
for (const page of ['Dashboard', 'DepreciationSchedule', 'FederationReport', 'FundRegister', 'NabardReport', 'ProfitDistribution', 'ReserveFund', 'AuditCertificate', 'BankReconciliation', 'DayBook', 'Ledger']) {
  const s = src(`src/pages/${page}.tsx`);
  ok(s.includes('isCountedVoucher'), `${page} uses isCountedVoucher`);
  ok(!/isCountedVoucher\(v, /.test(s), `${page} passes no approvalRequired flag`);
}
const dash = src('src/pages/Dashboard.tsx');
ok(!/const activeVouchers = vouchers\.filter\(v => !v\.isDeleted\)/.test(dash), 'Dashboard compliance checks (reserve-posted) use the counted rule');
ok(!/const activeV = vouchers\.filter\(v => !v\.isDeleted\)/.test(dash), 'Dashboard monthly chart uses the counted rule');

console.log(`\nApproval-gating predicate: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
