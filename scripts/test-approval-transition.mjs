// Approval state machine (ECR-11) — mirrors src/lib/approvalTransition.ts.
// Run: node scripts/test-approval-transition.mjs
function canApprovalTransition(from, to) {
  return from === 'pending';
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Only pending → terminal is allowed.
ok(canApprovalTransition('pending', 'approved'), 'pending → approved allowed');
ok(canApprovalTransition('pending', 'rejected'), 'pending → rejected allowed');

// 2. Terminal states cannot transition again (no re-approve / re-reject / flip).
ok(!canApprovalTransition('approved', 'approved'), 'approved → approved blocked (no double-approve)');
ok(!canApprovalTransition('approved', 'rejected'), 'approved → rejected blocked');
ok(!canApprovalTransition('rejected', 'approved'), 'rejected → approved blocked (no silent re-post)');
ok(!canApprovalTransition('rejected', 'rejected'), 'rejected → rejected blocked');

// 3. A voucher not in the workflow (undefined status) is not transitionable here.
ok(!canApprovalTransition(undefined, 'approved'), 'undefined (non-workflow) → approved blocked');
ok(!canApprovalTransition(undefined, 'rejected'), 'undefined (non-workflow) → rejected blocked');

console.log(`\nApproval state machine (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
