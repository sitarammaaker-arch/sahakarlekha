// Member lifecycle (ECR-16 slice 1) — asserts the pure transition rule mirrored from
// src/contexts/DataContext.tsx (canTransitionMember), the same way scripts/test-nav.mjs
// mirrors navVisibility. Run: node scripts/test-member-lifecycle.mjs

// ── Mirror of the pure logic in DataContext ───────────────────────────────────
const MEMBER_STATUSES = ['active', 'inactive', 'resigned', 'expelled', 'deceased'];
const canTransitionMember = (from, to) => from !== to && from !== 'deceased' && MEMBER_STATUSES.includes(to);
// Eligibility invariant used across reports (dividend / active count): only 'active' counts.
const isMemberActive = (status) => status === 'active';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. The five lifecycle states exist.
ok(MEMBER_STATUSES.length === 5, 'five lifecycle states');

// 2. Normal exits from active are allowed.
ok(canTransitionMember('active', 'resigned'), 'active → resigned allowed');
ok(canTransitionMember('active', 'expelled'), 'active → expelled allowed');
ok(canTransitionMember('active', 'deceased'), 'active → deceased allowed');
ok(canTransitionMember('active', 'inactive'), 'active → inactive (suspend) allowed');

// 3. Reactivation / reinstatement back to active is allowed from non-terminal states.
ok(canTransitionMember('resigned', 'active'), 'resigned → active (rejoin) allowed');
ok(canTransitionMember('expelled', 'active'), 'expelled → active (reinstate) allowed');
ok(canTransitionMember('inactive', 'active'), 'inactive → active (resume) allowed');

// 4. Deceased is terminal — no transition out.
ok(!canTransitionMember('deceased', 'active'), 'deceased → active BLOCKED (terminal)');
ok(!canTransitionMember('deceased', 'resigned'), 'deceased → resigned BLOCKED');
for (const s of MEMBER_STATUSES) ok(!canTransitionMember('deceased', s), `deceased → ${s} blocked`);

// 5. No self-transition (nothing to record).
for (const s of MEMBER_STATUSES) ok(!canTransitionMember(s, s), `${s} → ${s} blocked (no-op)`);

// 6. Unknown target rejected.
ok(!canTransitionMember('active', 'zombie'), 'unknown target status rejected');

// 7. Eligibility invariant — exit states are excluded from dividend/active counts.
ok(isMemberActive('active'), 'active is eligible');
ok(!isMemberActive('inactive') && !isMemberActive('resigned') && !isMemberActive('expelled') && !isMemberActive('deceased'),
  'all non-active states are excluded (dividend/active count unchanged)');

console.log(`\nMember lifecycle (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
