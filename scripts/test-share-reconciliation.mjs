// Share-capital reconciliation (P0 #4 / ECR-05 / MS-03) — asserts the PURE helpers of
// src/lib/shareReconciliation.ts, mirrored here as scripts/test-nav.mjs mirrors navVisibility.
// Run: node scripts/test-share-reconciliation.mjs (exit 1 on any failure).

// ── Mirror of the pure logic in src/lib/shareReconciliation.ts ────────────────
function sumActiveMemberShareCapital(members) {
  return (members || [])
    .filter((m) => !m.isDeleted && (!m.approvalStatus || m.approvalStatus === 'approved'))
    .reduce((sum, m) => sum + (m.shareCapital || 0), 0);
}
function reconcileShareCapital(subsidiaryTotal, controlBalance) {
  const difference = +(subsidiaryTotal - controlBalance).toFixed(2);
  return {
    subsidiaryTotal: +subsidiaryTotal.toFixed(2),
    controlBalance: +controlBalance.toFixed(2),
    difference,
    reconciled: Math.abs(difference) < 1,
  };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Subsidiary total — only approved, non-archived members are counted.
const members = [
  { shareCapital: 1000, approvalStatus: 'approved' },
  { shareCapital: 500 },                                   // legacy (undefined status) → counted
  { shareCapital: 2000, approvalStatus: 'pending' },       // no posted voucher → excluded
  { shareCapital: 3000, approvalStatus: 'rejected' },      // no posted voucher → excluded
  { shareCapital: 800, approvalStatus: 'approved', isDeleted: true }, // archived → excluded
];
ok(sumActiveMemberShareCapital(members) === 1500, 'sum counts only approved/legacy, excludes pending/rejected/archived');
ok(sumActiveMemberShareCapital([]) === 0, 'empty list → 0');
ok(sumActiveMemberShareCapital(undefined) === 0, 'undefined list → 0');
ok(sumActiveMemberShareCapital([{ approvalStatus: 'approved' }]) === 0, 'missing shareCapital treated as 0');

// 2. Reconciled — control equals subsidiary exactly.
const r1 = reconcileShareCapital(1500, 1500);
ok(r1.reconciled === true && r1.difference === 0, 'equal totals reconcile');

// 3. Drift detected — control (ledger) diverges from subsidiary (members).
const r2 = reconcileShareCapital(1500, 1000);
ok(r2.reconciled === false && r2.difference === 500, 'positive drift (members > ledger) flagged');
const r3 = reconcileShareCapital(1000, 1500);
ok(r3.reconciled === false && r3.difference === -500, 'negative drift (ledger > members) flagged with sign');

// 4. Rounding tolerance — sub-₹1 float noise must NOT be a false positive.
const r4 = reconcileShareCapital(1000.005, 1000);
ok(r4.reconciled === true, 'sub-₹1 difference within tolerance → reconciled');
const r5 = reconcileShareCapital(1001, 1000);
ok(r5.reconciled === false && r5.difference === 1, '₹1 difference is NOT within tolerance (>= 1)');

// 5. Values are rounded to 2dp in the result.
const r6 = reconcileShareCapital(1000.126, 999.874);
ok(r6.subsidiaryTotal === 1000.13 && r6.controlBalance === 999.87, 'totals rounded to 2dp');

// 6. End-to-end — sum members then reconcile against a matching ledger balance.
const e2e = reconcileShareCapital(sumActiveMemberShareCapital(members), 1500);
ok(e2e.reconciled === true, 'end-to-end: approved-member sum reconciles with ledger');

console.log(`\nShare reconciliation (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
