// RBAC model verification (Sprint-1 SL-05) — asserts the pure permission evaluator.
// Mirrors the trivially-small logic of src/lib/rbac.ts (can / mapLegacyRole) in JS, the
// same way scripts/test-nav.mjs mirrors navVisibility. `tsc` guarantees the TS compiles;
// this guards the matrix invariants + the legacy shim. Run: node scripts/test-rbac.mjs
// (exit 1 on any failure).

// ── Mirror of src/lib/rbac.ts (kept byte-identical in shape) ──────────────────
const PERMISSION_MATRIX = {
  superAdmin:        new Set(['create', 'read', 'update', 'delete', 'export', 'print', 'userMgmt', 'backup', 'config']),
  societyAdmin:      new Set(['create', 'read', 'update', 'delete', 'approve', 'reject', 'export', 'print', 'lockPeriod', 'unlockPeriod', 'userMgmt', 'backup', 'config']),
  manager:           new Set(['create', 'read', 'update', 'approve', 'reject', 'export', 'print', 'lockPeriod', 'config']),
  accountant:        new Set(['create', 'read', 'update', 'export', 'print', 'lockPeriod']),
  cashier:           new Set(['create', 'read', 'update', 'print']),
  storeKeeper:       new Set(['create', 'read', 'update', 'export', 'print']),
  procurementOfficer:new Set(['create', 'read', 'update', 'approve', 'export', 'print']),
  salesOperator:     new Set(['create', 'read', 'update', 'print']),
  auditor:           new Set(['create', 'read', 'export', 'print']),
  internalAuditor:   new Set(['create', 'read', 'export', 'print']),
  boardMember:       new Set(['read', 'approve', 'reject', 'export', 'print']),
  chairman:          new Set(['read', 'approve', 'reject', 'export', 'print', 'lockPeriod', 'unlockPeriod', 'closeFY']),
  secretary:         new Set(['create', 'read', 'update', 'delete', 'approve', 'reject', 'export', 'print', 'lockPeriod', 'closeFY', 'userMgmt', 'config']),
  employee:          new Set(['create', 'read', 'update', 'print']),
  dataEntry:         new Set(['create', 'read', 'update', 'print']),
  readOnly:          new Set(['read', 'print']),
  externalCA:        new Set(['create', 'read', 'export', 'print']),
};
const LEGACY_ROLE_MAP = { admin: 'societyAdmin', accountant: 'accountant', viewer: 'readOnly', auditor: 'auditor' };
const mapLegacyRole = (role) => LEGACY_ROLE_MAP[role] ?? role;
const can = (role, permission) => PERMISSION_MATRIX[mapLegacyRole(role)]?.has(permission) ?? false;

const ROLES = Object.keys(PERMISSION_MATRIX);
const PERMISSIONS = ['create','read','update','delete','approve','reject','export','print','lockPeriod','unlockPeriod','closeFY','userMgmt','backup','config'];

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Structural invariants — 17 roles, every role grants only valid permissions.
ok(ROLES.length === 17, `17 roles defined (got ${ROLES.length})`);
for (const r of ROLES) for (const p of PERMISSION_MATRIX[r]) ok(PERMISSIONS.includes(p), `${r} grants a valid permission (${p})`);

// 2. Everyone can read; nobody but the intended roles gets high-risk permissions.
for (const r of ROLES) ok(can(r, 'read'), `${r} can read`);
ok(!can('readOnly', 'create'), 'readOnly cannot create');
ok(!can('readOnly', 'export'), 'readOnly cannot export');
ok(!can('auditor', 'update'), 'auditor cannot update (read-only)');
ok(!can('auditor', 'delete'), 'auditor cannot delete');
ok(can('auditor', 'export') && can('auditor', 'read'), 'auditor can read + export');

// 3. Sensitive permissions restricted to the right roles.
ok(can('chairman', 'closeFY'), 'chairman can closeFY');
ok(can('secretary', 'closeFY'), 'secretary can closeFY');
ok(!can('accountant', 'closeFY'), 'accountant cannot closeFY');
ok(!can('superAdmin', 'closeFY'), 'superAdmin cannot closeFY (governance act, not platform)');
ok(!can('superAdmin', 'approve'), 'superAdmin cannot approve society finance');
ok(can('societyAdmin', 'unlockPeriod') && can('chairman', 'unlockPeriod'), 'admin+chairman can unlock');
ok(!can('accountant', 'unlockPeriod'), 'accountant cannot unlock');
ok(can('superAdmin', 'userMgmt') && can('societyAdmin', 'userMgmt'), 'admins manage users');
ok(!can('manager', 'userMgmt'), 'manager cannot manage users');
ok(can('accountant', 'create') && can('accountant', 'update') && !can('accountant', 'approve'), 'accountant: create/update but not approve (segregation)');

// 4. Legacy shim parity — the four legacy roles behave sensibly under the new model.
ok(mapLegacyRole('admin') === 'societyAdmin', 'legacy admin → societyAdmin');
ok(mapLegacyRole('viewer') === 'readOnly', 'legacy viewer → readOnly');
ok(mapLegacyRole('auditor') === 'auditor', 'legacy auditor → auditor');
ok(mapLegacyRole('accountant') === 'accountant', 'legacy accountant → accountant');
ok(can('admin', 'config') && can('admin', 'create') && can('admin', 'delete'), 'legacy admin retains broad access');
ok(can('viewer', 'read') && !can('viewer', 'create') && !can('viewer', 'update'), 'legacy viewer is read-only');
ok(can('auditor', 'read') && !can('auditor', 'update'), 'legacy auditor is read-only (≡ audit access)');
ok(mapLegacyRole('secretary') === 'secretary', 'a new role maps to itself (identity)');

// 5. SL-06 wiring — approval authority as AuthContext.can() / DataContext guardPermission
//    resolve it for the four LIVE legacy roles. Only admin may approve/reject → real
//    segregation of duties on the voucher approval queue (the P0 #1 maker-checker control).
for (const perm of ['approve', 'reject']) {
  ok(can('admin', perm), `legacy admin can ${perm} (maker-checker approver)`);
  ok(!can('accountant', perm), `legacy accountant cannot ${perm} (maker, not checker)`);
  ok(!can('viewer', perm), `legacy viewer cannot ${perm}`);
  ok(!can('auditor', perm), `legacy auditor cannot ${perm} (independence)`);
}
// New roles that SHOULD be able to approve once adopted (governance/segregation).
ok(can('manager', 'approve') && can('boardMember', 'approve') && can('chairman', 'approve'), 'manager/board/chairman can approve');
ok(!can('cashier', 'approve') && !can('dataEntry', 'approve') && !can('salesOperator', 'approve'), 'operational roles cannot approve');

console.log(`\nRBAC model: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
