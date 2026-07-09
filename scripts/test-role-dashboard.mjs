// Role dashboard widget registry (ECR-18) — mirrors src/lib/roleDashboard.ts + the rbac
// legacy-role mapping. Run: node scripts/test-role-dashboard.mjs

const LEGACY_ROLE_MAP = { admin: 'societyAdmin', accountant: 'accountant', viewer: 'readOnly', auditor: 'auditor' };
const mapLegacyRole = (role) => LEGACY_ROLE_MAP[role] ?? role;

const ADMIN = ['netProfit', 'bsStatus', 'members', 'loanPortfolio', 'pendingApprovals', 'complianceDue'];
const ACCOUNTANT = ['netProfit', 'trialBalance', 'cashBank', 'pendingApprovals', 'complianceDue', 'shareReconciliation'];
const AUDITOR = ['auditObjections', 'shareReconciliation', 'unapprovedVouchers', 'periodLock', 'complianceDue', 'bsStatus'];
const READ_ONLY = ['netProfit', 'members', 'loanPortfolio'];
const CHAIRMAN = ['netProfit', 'bsStatus', 'members', 'loanPortfolio', 'pendingApprovals', 'auditObjections', 'complianceDue'];
const MANAGER = ['netProfit', 'bsStatus', 'pendingApprovals', 'loanPortfolio', 'purchasesCount', 'complianceDue'];
const PROCUREMENT = ['purchasesCount', 'stockValue', 'pendingApprovals', 'complianceDue'];
const INVENTORY = ['stockValue', 'outOfStock', 'purchasesCount'];
const COMPLIANCE = ['complianceDue', 'auditObjections', 'unapprovedVouchers', 'periodLock', 'bsStatus'];
const ROLE_WIDGETS = {
  superAdmin: ADMIN, societyAdmin: ADMIN, secretary: COMPLIANCE, manager: MANAGER,
  accountant: ACCOUNTANT, cashier: ['cashBank', 'netProfit', 'complianceDue'],
  storeKeeper: INVENTORY, procurementOfficer: PROCUREMENT,
  auditor: AUDITOR, internalAuditor: AUDITOR, externalCA: AUDITOR,
  chairman: CHAIRMAN, boardMember: CHAIRMAN, readOnly: READ_ONLY,
};
const DEFAULT_WIDGETS = ['netProfit', 'members', 'loanPortfolio', 'complianceDue'];
function roleWidgets(role) {
  if (!role) return DEFAULT_WIDGETS;
  return ROLE_WIDGETS[mapLegacyRole(role)] ?? DEFAULT_WIDGETS;
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const has = (arr, x) => arr.includes(x);

// 1. Legacy roles resolve and get sensible widgets.
ok(JSON.stringify(roleWidgets('admin')) === JSON.stringify(ADMIN), 'legacy admin → societyAdmin widgets');
ok(JSON.stringify(roleWidgets('accountant')) === JSON.stringify(ACCOUNTANT), 'accountant widgets');
ok(JSON.stringify(roleWidgets('auditor')) === JSON.stringify(AUDITOR), 'auditor widgets');
ok(JSON.stringify(roleWidgets('viewer')) === JSON.stringify(READ_ONLY), 'legacy viewer → readOnly widgets');

// 2. Role focus is distinct — the right widget for the right role.
ok(has(roleWidgets('accountant'), 'trialBalance') && !has(roleWidgets('accountant'), 'auditObjections'), 'accountant: trial balance, no objections');
ok(has(roleWidgets('auditor'), 'auditObjections') && has(roleWidgets('auditor'), 'unapprovedVouchers') && has(roleWidgets('auditor'), 'periodLock'), 'auditor: objections + unapproved + period lock');
ok(has(roleWidgets('admin'), 'pendingApprovals'), 'admin: pending approvals');
ok(!has(roleWidgets('viewer'), 'pendingApprovals') && roleWidgets('viewer').length === 3, 'viewer: read-only subset (no approvals)');

// 3. Cashier gets a cash-focused set.
ok(roleWidgets('cashier')[0] === 'cashBank', 'cashier leads with cash/bank');

// 3b. ECR-18 — the added role dashboards are distinct (not the default).
ok(has(roleWidgets('procurementOfficer'), 'purchasesCount') && has(roleWidgets('procurementOfficer'), 'stockValue'), 'procurement: purchases + stock value');
ok(has(roleWidgets('storeKeeper'), 'stockValue') && has(roleWidgets('storeKeeper'), 'outOfStock'), 'inventory: stock value + out-of-stock');
ok(has(roleWidgets('secretary'), 'complianceDue') && has(roleWidgets('secretary'), 'auditObjections') && !has(roleWidgets('secretary'), 'members'), 'secretary: compliance-first, not the admin set');
ok(has(roleWidgets('manager'), 'purchasesCount') && has(roleWidgets('manager'), 'netProfit'), 'manager: ops + finance');
for (const r of ['procurementOfficer', 'storeKeeper', 'secretary', 'manager']) {
  ok(JSON.stringify(roleWidgets(r)) !== JSON.stringify(DEFAULT_WIDGETS), `${r} has a tailored (non-default) dashboard`);
}

// 4. Unknown / missing role → default.
ok(JSON.stringify(roleWidgets('someUnknownRole')) === JSON.stringify(DEFAULT_WIDGETS), 'unknown role → default widgets');
ok(JSON.stringify(roleWidgets(undefined)) === JSON.stringify(DEFAULT_WIDGETS), 'undefined role → default widgets');

// 5. Every role's widget list is non-empty and has no duplicates.
for (const r of ['admin', 'accountant', 'auditor', 'viewer', 'chairman', 'cashier']) {
  const w = roleWidgets(r);
  ok(w.length > 0 && new Set(w).size === w.length, `${r}: non-empty, no duplicate widgets`);
}

console.log(`\nRole dashboard (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
