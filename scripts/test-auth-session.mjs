// Auth session serialization (ECR-30) — mirrors src/lib/authSession.ts.
// Run: node scripts/test-auth-session.mjs
const PLATFORM_SOCIETY_ID = 'PLATFORM';
const isPlatformSession = (s) => !!s && s.societyId === PLATFORM_SOCIETY_ID;
function toSession(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, societyId: u.societyId, branchId: u.branchId || undefined, mfaEnabled: !!u.mfaEnabled };
}
function sessionToUser(s) {
  if (!s || !s.email || !s.name || !s.role || !s.societyId) return null;
  return { id: s.id || s.email, name: s.name, email: s.email, role: s.role, societyId: s.societyId, branchId: s.branchId || undefined, mfaEnabled: !!s.mfaEnabled };
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Round-trip preserves EVERY field (the bug: mfaEnabled + id were dropped on refresh).
{
  const user = { id: 'uuid-123', name: 'Ram', email: 'ram@x.com', role: 'accountant', societyId: 'SOC001', mfaEnabled: true, branchId: 'br-2' };
  const back = sessionToUser(toSession(user));
  const same = Object.keys(user).every(k => back[k] === user[k]) && Object.keys(back).every(k => back[k] === user[k]);
  ok(same, 'full round-trip is lossless (id + mfaEnabled + branchId survive)');
  ok(back.id === 'uuid-123', 'real id preserved (not replaced by email)');
  ok(back.mfaEnabled === true, 'mfaEnabled preserved');
}

// 2. Legacy session (pre-ECR-30: no id, no mfaEnabled) → id falls back to email, mfa false.
{
  const legacy = { email: 'old@x.com', name: 'Old', role: 'admin', societyId: 'SOC001', branchId: undefined };
  const u = sessionToUser(legacy);
  ok(u.id === 'old@x.com', 'legacy session (no id) → id falls back to email');
  ok(u.mfaEnabled === false, 'legacy session (no mfaEnabled) → false');
}

// 3. Optional fields normalise: empty branchId → undefined.
{
  const u = { id: 'i', name: 'N', email: 'e@x.com', role: 'viewer', societyId: 'S', branchId: '' };
  ok(toSession(u).branchId === undefined, 'empty branchId serializes to undefined');
  ok(sessionToUser({ ...u, branchId: '' }).branchId === undefined, 'empty branchId restores to undefined');
}

// 4. Incomplete session → null (no partial user).
ok(sessionToUser(null) === null, 'null session → null');
ok(sessionToUser({ email: 'e@x.com' }) === null, 'missing name/role/society → null');
ok(sessionToUser({ email: 'e', name: 'n', role: 'admin', societyId: '' }) === null, 'empty societyId → null');

// 5. Platform-session detection (drives the super-admin re-validation on mount).
ok(isPlatformSession({ societyId: 'PLATFORM' }), 'PLATFORM societyId → platform session');
ok(!isPlatformSession({ societyId: 'SOC001' }), 'normal society → not platform');
ok(!isPlatformSession(null), 'null → not platform');

// 6. mfaEnabled truthiness normalises to a real boolean.
ok(toSession({ id: 'i', name: 'n', email: 'e', role: 'admin', societyId: 's' }).mfaEnabled === false, 'undefined mfaEnabled → false in session');

console.log(`\nAuth session (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
