// Approval-gating verification (P0 #1 / ECR-01) — asserts the pure reporting predicate
// that decides whether a voucher counts toward financial reports. Mirrors the
// `activeVouchers` filter in DataContext (the single reporting chokepoint), exactly as
// scripts/test-nav.mjs mirrors navVisibility. Run: node scripts/test-approval-gating.mjs
// (exit 1 on any failure).

// ── Mirror of the DataContext `activeVouchers` predicate ──────────────────────
// A voucher is active (counts in reports) iff: not deleted, not rejected, and — only
// when the society opted into approvalRequired — not a held pending voucher.
const isActive = (v, approvalRequired) =>
  !v.isDeleted &&
  v.approvalStatus !== 'rejected' &&
  !(approvalRequired && v.approvalStatus === 'pending');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const V = (o) => ({ isDeleted: false, approvalStatus: undefined, ...o });

// 1. Deleted vouchers never count (unchanged invariant).
ok(!isActive(V({ isDeleted: true }), false), 'deleted excluded (gating off)');
ok(!isActive(V({ isDeleted: true }), true), 'deleted excluded (gating on)');

// 2. Rejected vouchers are ALWAYS excluded — the client-vs-SQL divergence fix.
ok(!isActive(V({ approvalStatus: 'rejected' }), false), 'rejected excluded even when gating OFF (the fix)');
ok(!isActive(V({ approvalStatus: 'rejected' }), true), 'rejected excluded when gating on');

// 3. Backward-compat: with gating OFF, everything except deleted/rejected counts —
//    this proves existing societies see NO behaviour change beyond the rejected fix.
ok(isActive(V({ approvalStatus: undefined }), false), 'undefined counts (gating off) — legacy default');
ok(isActive(V({ approvalStatus: 'pending' }), false), 'pending STILL counts when gating off — no behaviour change');
ok(isActive(V({ approvalStatus: 'approved' }), false), 'approved counts (gating off)');

// 4. Gating ON: pending is held out; approved / unmarked still count (engine & other
//    system vouchers carry no approvalStatus, so they are never held).
ok(!isActive(V({ approvalStatus: 'pending' }), true), 'pending HELD when gating on (maker-checker)');
ok(isActive(V({ approvalStatus: 'approved' }), true), 'approved counts when gating on');
ok(isActive(V({ approvalStatus: undefined }), true), 'unmarked (undefined) counts when gating on — system/auto vouchers unaffected');

// 5. Truth-table completeness across the 3 statuses × 2 flags × deleted.
for (const approvalRequired of [false, true]) {
  ok(isActive(V({ approvalStatus: 'approved' }), approvalRequired), `approved active (gating=${approvalRequired})`);
  ok(!isActive(V({ approvalStatus: 'rejected' }), approvalRequired), `rejected inactive (gating=${approvalRequired})`);
  ok(isActive(V({ approvalStatus: 'approved', isDeleted: false }), approvalRequired), `approved+live active (gating=${approvalRequired})`);
}
ok(isActive(V({ approvalStatus: 'pending' }), false) && !isActive(V({ approvalStatus: 'pending' }), true),
   'pending toggles exactly on the approvalRequired flag');

console.log(`\nApproval-gating predicate: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
