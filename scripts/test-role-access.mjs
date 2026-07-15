// ECR-06 S2 — role→module access map (src/lib/navigation/roleAccess.ts) wired into
// isModuleVisible. Imports the REAL catalog + visibility rule. Two guarantees locked here:
//   1. EMPTY-DIFF for the 4 legacy roles: with userRole set, isModuleVisible returns exactly
//      what the pre-S2 rule (requiredRoles + capabilities) returned — byte-identical.
//   2. Exact visible-module sets per mapped new role (runbook §2), derived from the catalog.
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

const { MODULE_CATALOG } = await import(abs('../src/lib/navigation/moduleCatalog.ts'));
const { isModuleVisible } = await import(abs('../src/lib/navigation/navVisibility.ts'));
const { ROLE_MODULE_ACCESS, roleModuleAccess } = await import(abs('../src/lib/navigation/roleAccess.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// Faithful copy of AuthContext.hasPermission semantics for a given role string.
const hasRoleFor = (role) => (roles) => {
  if (role === 'admin') return true;
  const eff = role === 'auditor' ? 'viewer' : role;
  return (roles ?? []).includes(eff) || (roles ?? []).includes(role);
};

// Every capability any module requires — so with ALL_CAPS the capability gate never hides anything.
const ALL_CAPS = new Set(MODULE_CATALOG.flatMap((m) => m.requiredCapabilities));
const visibleIds = (role, caps = ALL_CAPS) =>
  MODULE_CATALOG
    .filter((m) => isModuleVisible(m, { societyType: 'multi_purpose', capabilities: caps, hasRole: hasRoleFor(role), userRole: role }))
    .map((m) => m.id)
    .sort();

// ── 1. Legacy empty-diff: userRole set vs the pre-S2 rule ─────────────────────
const preS2 = (role, caps = ALL_CAPS) =>
  MODULE_CATALOG
    .filter((m) => (!m.requiredRoles || hasRoleFor(role)(m.requiredRoles)) && m.requiredCapabilities.every((c) => caps.has(c)))
    .map((m) => m.id)
    .sort();

for (const legacy of ['admin', 'accountant', 'viewer', 'auditor']) {
  ok(roleModuleAccess(legacy) === undefined, `${legacy} never consults the map`);
  ok(JSON.stringify(visibleIds(legacy)) === JSON.stringify(preS2(legacy)), `${legacy}: visible set byte-identical to the pre-S2 rule (${preS2(legacy).length} modules)`);
}
ok(roleModuleAccess('readOnly') === undefined, 'readOnly stays unmapped (viewer-equivalent old path)');
ok(roleModuleAccess(undefined) === undefined && roleModuleAccess('') === undefined, 'missing role → old path');

// ── 2. Exact sets per mapped role (catalog-derived expectations) ──────────────
const idsWhere = (pred) => MODULE_CATALOG.filter(pred).map((m) => m.id).sort();
const eq = (role, expected, label) => {
  const got = visibleIds(role);
  ok(JSON.stringify(got) === JSON.stringify([...expected].sort()),
    `${role}: ${label}\n    got:      ${got.join(',')}\n    expected: ${[...expected].sort().join(',')}`);
};

eq('manager', idsWhere((m) => m.domain !== 'administration'), 'everything except administration');
const SECRETARY_ADMIN_REMOVED = ['backupRestore', 'exportCenter', 'restoreCenter', 'societySetup', 'branches', 'openingBalances', 'features', 'multiSocietyConsolidation', 'universalImporter'];
eq('secretary', idsWhere((m) => !SECRETARY_ADMIN_REMOVED.includes(m.id)), 'all business + admin minus founder/platform admin tools');
// The concrete guard the user hit: secretary must NOT see these admin-only modules.
for (const id of ['societySetup', 'branches', 'openingBalances', 'features', 'multiSocietyConsolidation', 'universalImporter']) {
  ok(!new Set(visibleIds('secretary', ALL_CAPS)).has(id), `secretary does NOT see admin-only ${id}`);
}
// …but keeps the two it can operate.
ok(new Set(visibleIds('secretary', ALL_CAPS)).has('userManagement') && new Set(visibleIds('secretary', ALL_CAPS)).has('godowns'), 'secretary keeps userManagement + godowns');
eq('cashier', ['dashboard', 'myDashboard', 'cashBook', 'bankBook', 'receivePayment', 'makePayment', 'vouchers', 'dayBook'], 'cash & bank only');
eq('storeKeeper', ['dashboard', 'myDashboard', 'inventory', 'godowns', 'stockValuation', 'closingStockReport'], 'stock + godown + stock reports');
eq('procurementOfficer', [...idsWhere((m) => m.domain === 'marketing'), 'dashboard', 'myDashboard', 'purchaseOrders', 'purchaseReturn', 'suppliers', 'purchases', 'procurementMatch'], 'procurement surfaces, no payment release');
eq('salesOperator', ['dashboard', 'myDashboard', 'sales', 'customers', 'retailCounter', 'salesReturn', 'priceLists', 'memberCredit'], 'billing/POS surfaces');
eq('internalAuditor', [...idsWhere((m) => m.domain === 'reports' || m.domain === 'registers'), 'dashboard'], 'reports + registers + dashboard');
eq('externalCA', [...idsWhere((m) => m.domain === 'reports' || m.domain === 'registers'), 'dashboard'], 'reports + registers + dashboard');
eq('boardMember', [...idsWhere((m) => m.domain === 'reports'), 'dashboard', 'myDashboard', 'voucherApproval', 'meetingRegister'], 'reports + approvals + minutes');
eq('chairman', [...idsWhere((m) => m.domain === 'reports'), 'dashboard', 'myDashboard', 'voucherApproval', 'meetingRegister'], 'reports + approvals + minutes');
eq('employee', ['dashboard', 'myDashboard'], 'dashboards only until per-user assignment exists');
eq('dataEntry', ['dashboard', 'myDashboard'], 'dashboards only until per-user assignment exists');

// ── 3. Guard rails ────────────────────────────────────────────────────────────
// Capability gating still applies ON TOP for mapped roles.
{
  const noCaps = visibleIds('cashier', new Set());
  const capFree = MODULE_CATALOG.filter((m) => ['dashboard', 'myDashboard', 'cashBook', 'bankBook', 'receivePayment', 'makePayment', 'vouchers', 'dayBook'].includes(m.id) && m.requiredCapabilities.length === 0).map((m) => m.id).sort();
  ok(JSON.stringify(noCaps) === JSON.stringify(capFree), 'cashier with zero capabilities sees only capability-free modules');
}
// No payment release for procurement (explicit runbook restriction).
ok(!visibleIds('procurementOfficer').includes('makePayment'), 'procurementOfficer never sees makePayment');
// Assurance roles see no entry forms.
ok(!visibleIds('internalAuditor').includes('vouchers') && !visibleIds('externalCA').includes('retailCounter'), 'auditor-family sees no entry forms');
// superAdminShowAll still bypasses everything.
ok(MODULE_CATALOG.every((m) => isModuleVisible(m, { societyType: 'multi_purpose', capabilities: new Set(), hasRole: () => false, userRole: 'cashier', superAdminShowAll: true })), 'superAdminShowAll bypass intact');
// superAdmin is not society-mappable.
ok(ROLE_MODULE_ACCESS.superAdmin === undefined, 'superAdmin has no society map entry');

// ── operations domain = "doing" surface, hidden from read-only LEGACY roles ──
// (ECR-06: transaction-entry + trade masters carry requiredRoles ['admin','accountant'];
//  read-only auditor/viewer audit via the reports/registers instead.)
const OPS_ENTRY = ['ledgerHeads', 'inventory', 'suppliers', 'customers', 'sales', 'purchases', 'salary', 'receivePayment', 'makePayment'];
const ALL = new Set(MODULE_CATALOG.flatMap((m) => m.requiredCapabilities));
for (const legacy of ['auditor', 'viewer']) {
  const seen = new Set(visibleIds(legacy, ALL));
  ok(OPS_ENTRY.every((id) => !seen.has(id)), `${legacy} sees NO operations entry page (sales/purchases/inventory/…)`);
  // …but still audits via the read-only registers.
  ok(seen.has('saleRegister') && seen.has('purchaseRegister') && seen.has('trialBalance'), `${legacy} still sees the reports/registers (audits there)`);
}
for (const worker of ['admin', 'accountant']) {
  const seen = new Set(visibleIds(worker, ALL));
  ok(OPS_ENTRY.every((id) => seen.has(id)), `${worker} keeps every operations entry page (byte-identical)`);
}
// New operational roles reach their pages via ROLE_MODULE_ACCESS, unaffected by requiredRoles.
ok(new Set(visibleIds('salesOperator', ALL)).has('sales'), 'salesOperator still sees Sales (map governs, requiredRoles ignored)');
ok(new Set(visibleIds('storeKeeper', ALL)).has('inventory'), 'storeKeeper still sees Inventory (map governs)');

console.log(`Role→module access (S2): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
