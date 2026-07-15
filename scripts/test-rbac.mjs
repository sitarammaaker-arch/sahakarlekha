// RBAC model verification (Sprint-1 SL-05) — asserts the pure permission evaluator.
// Mirrors the trivially-small logic of src/lib/rbac.ts (can / mapLegacyRole) in JS, the
// same way scripts/test-nav.mjs mirrors navVisibility. `tsc` guarantees the TS compiles;
// this guards the matrix invariants + the legacy shim. Run: node scripts/test-rbac.mjs
// (exit 1 on any failure).

// ── Import the REAL src/lib/rbac.ts via the '@/' loader ───────────────────────
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { PERMISSION_MATRIX, mapLegacyRole, can, ROLES, PERMISSIONS } = await import(abs('../src/lib/rbac.ts'));

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

// 6. Page-affordance gate (ECR-06 17-role): the 7 financial pages replaced
//    hasPermission(['admin','accountant']) with `can('update')` (edit affordances) and
//    `can('delete')` (delete affordances). `update` — NOT `create` — is the gate because the
//    auditor family's `create` is scoped to audit objections; using it would wrongly show
//    edit buttons to auditors on financial pages. Lock the truth table so a matrix change
//    can't silently reopen or close a page action.
const canEdit = (r) => can(r, 'update');
// Byte-identical to the old hardcoded gate for the 4 legacy roles.
ok(canEdit('admin') && canEdit('accountant'), 'canEdit: admin + accountant retain edit affordances (was hardcoded)');
ok(!canEdit('viewer') && !canEdit('auditor'), 'canEdit: viewer + auditor stay read-only on financial pages');

// 6b. Audit-note carve-out (ECR-06): the auditor family files objections via `auditNote`, a
//     SCOPED write distinct from financial `create` — so they cannot post vouchers/sales.
for (const a of ['auditor', 'internalAuditor', 'externalCA']) {
  ok(can(a, 'auditNote'), `${a} can file audit objections (auditNote)`);
  ok(!can(a, 'create'), `${a} CANNOT financial-create (addVoucher's guardPermission('create') blocks it)`);
  ok(!can(a, 'update') && !can(a, 'delete'), `${a} has no financial write at all`);
}
// The audit register's managers keep auditNote; operational/read-only roles do not.
ok(can('societyAdmin', 'auditNote') && can('secretary', 'auditNote'), 'admin/secretary can manage the audit register');
ok(!can('cashier', 'auditNote') && !can('viewer', 'auditNote') && !can('manager', 'auditNote'), 'operational/read-only roles cannot file audit objections');
// Operational new roles gain edit affordances; pure-governance/assurance roles do not.
ok(canEdit('cashier') && canEdit('manager') && canEdit('secretary') && canEdit('storeKeeper') && canEdit('salesOperator') && canEdit('dataEntry'), 'canEdit: operational roles can now enter/edit');
ok(!canEdit('boardMember') && !canEdit('chairman') && !canEdit('internalAuditor') && !canEdit('externalCA') && !canEdit('readOnly'), 'canEdit: governance/assurance/read-only roles stay read-only');
// Delete affordance is narrower — only admin-tier roles.
ok(can('admin', 'delete') && can('societyAdmin', 'delete') && can('secretary', 'delete'), 'canDelete: admin/societyAdmin/secretary only');
ok(!can('accountant', 'delete') && !can('cashier', 'delete') && !can('manager', 'delete'), 'canDelete: accountant/cashier/manager cannot delete (fail-closes at the data layer too)');

console.log(`\nRBAC model: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
