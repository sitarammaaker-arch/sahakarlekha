// Dual-control FY unlock (ECR-07) — mirrors src/lib/dualControlUnlock.ts.
// Run: node scripts/test-dual-control-unlock.mjs

function unlockAction(state, currentUserId) {
  if (!state.locked) return 'none';
  if (!state.requestedBy) return 'request';
  if (state.requestedBy === currentUserId) return 'awaiting';
  return 'approve';
}
function canApproveUnlock(state, currentUserId) {
  return unlockAction(state, currentUserId) === 'approve' && !!currentUserId && state.requestedBy !== currentUserId;
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Unlocked → nothing to do for anyone.
ok(unlockAction({ locked: false }, 'a@x.com') === 'none', 'unlocked → none');

// 2. Locked, no request → any admin can request.
ok(unlockAction({ locked: true }, 'a@x.com') === 'request', 'locked, no request → request');

// 3. Locked, requested by A → A only sees "awaiting" (cannot self-approve).
ok(unlockAction({ locked: true, requestedBy: 'a@x.com' }, 'a@x.com') === 'awaiting', 'requester sees awaiting');
ok(!canApproveUnlock({ locked: true, requestedBy: 'a@x.com' }, 'a@x.com'), 'requester CANNOT approve own request');

// 4. Locked, requested by A → a DIFFERENT admin B can approve.
ok(unlockAction({ locked: true, requestedBy: 'a@x.com' }, 'b@x.com') === 'approve', 'other admin → approve');
ok(canApproveUnlock({ locked: true, requestedBy: 'a@x.com' }, 'b@x.com'), 'a second, distinct admin CAN approve');

// 5. Empty/unknown user never approves.
ok(!canApproveUnlock({ locked: true, requestedBy: 'a@x.com' }, ''), 'empty user cannot approve');

console.log(`\nDual-control unlock (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
