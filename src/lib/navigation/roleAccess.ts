/**
 * Role → module access for the 13 NEW roles (ECR-06 17-role rollout, S2 — runbook §2,
 * transcribed from Blueprint TASK3.3 Table 1).
 *
 * PURE and DORMANT: `roleModuleAccess` returns undefined for the 4 legacy role names
 * (admin/accountant/viewer/auditor) and for any unknown string, so `isModuleVisible`
 * keeps its exact pre-S2 behaviour for every user that exists today — the map only takes
 * effect for a role that S3 (the assignment dropdown) will make assignable.
 *
 * Semantics: a mapped role sees a module iff (module.domain ∈ domains OR module.id ∈ add)
 * AND module.id ∉ remove. Capability gating (requiredCapabilities) still applies ON TOP —
 * e.g. a storeKeeper in a non-trading society without `warehousing` still won't see godowns.
 * `requiredRoles` is NOT consulted for mapped roles: this map is their role gate.
 *
 * NOTE `readOnly` is deliberately unmapped: an unmapped/unknown role already behaves exactly
 * like the legacy viewer (fails every requiredRoles gate, sees un-gated modules), which is
 * what Table 1 prescribes — S3 should simply keep assigning the legacy 'viewer' string.
 */
import type { Role as RbacRole } from '@/lib/rbac';
import type { NavDomain } from './capabilities';
import type { ModuleDefinition } from './moduleCatalog';

export interface RoleAccess {
  /** whole catalog domains this role can see */
  domains?: NavDomain[];
  /** individual module ids granted on top of `domains` */
  add?: string[];
  /** individual module ids denied even when their domain is granted */
  remove?: string[];
}

const ALL_BUSINESS_DOMAINS: NavDomain[] = [
  'core', 'operations', 'reports', 'registers', 'consumer', 'dairy', 'housing', 'labour', 'marketing',
];

export const ROLE_MODULE_ACCESS: Partial<Record<RbacRole, RoleAccess>> = {
  // Operational head — everything except administration (Table 1: "No user/backup/config").
  manager: { domains: ALL_BUSINESS_DOMAINS },

  // Statutory executive — all business domains, and from `administration` ONLY what a secretary
  // can actually operate: user management (S7) + godowns (S5). The rest of administration stays
  // admin/founder/platform level (society setup, branches, opening balances, feature flags,
  // federation, bulk importer, backup center) — showing them would promise access those pages'
  // own admin gates then deny, so they are removed from the secretary's nav.
  secretary: {
    domains: [...ALL_BUSINESS_DOMAINS, 'administration'],
    remove: [
      'backupRestore', 'exportCenter', 'restoreCenter',   // backup center (BK)
      'societySetup', 'branches', 'openingBalances',       // society founder-level config
      'features', 'multiSocietyConsolidation', 'universalImporter', // admin/platform tools
    ],
  },

  // Cash & Bank only.
  cashier: { add: ['dashboard', 'myDashboard', 'cashBook', 'bankBook', 'receivePayment', 'makePayment', 'vouchers', 'dayBook'] },

  // Stock receipts/issues + godown + stock reports.
  storeKeeper: { add: ['dashboard', 'myDashboard', 'inventory', 'godowns', 'stockValuation', 'closingStockReport'] },

  // Indent/PO/GRN/supplier — NO payment release (makePayment absent).
  procurementOfficer: {
    domains: ['marketing'],
    add: ['dashboard', 'myDashboard', 'purchaseOrders', 'purchaseReturn', 'suppliers', 'purchases', 'procurementMatch'],
  },

  // Billing/POS/collection — no export surfaces beyond the pages themselves.
  salesOperator: { add: ['dashboard', 'myDashboard', 'sales', 'customers', 'retailCounter', 'salesReturn', 'priceLists', 'memberCredit'] },

  // Assurance roles: read surfaces + audit registers; NARROWER than the legacy viewer
  // (no entry forms at all).
  internalAuditor: { domains: ['reports', 'registers'], add: ['dashboard'] },
  externalCA: { domains: ['reports', 'registers'], add: ['dashboard'] },

  // Governance: reports + dashboard + the approval queue + minutes (Table 1: "minutes").
  boardMember: { domains: ['reports'], add: ['dashboard', 'myDashboard', 'voucherApproval', 'meetingRegister'] },
  chairman: { domains: ['reports'], add: ['dashboard', 'myDashboard', 'voucherApproval', 'meetingRegister'] },

  // "Assigned module(s)" is a future per-user feature (runbook: do NOT fake it with a broad
  // grant) — until then these roles see only the dashboards.
  employee: { add: ['dashboard', 'myDashboard'] },
  dataEntry: { add: ['dashboard', 'myDashboard'] },
};

const LEGACY_NAMES = new Set(['admin', 'accountant', 'viewer', 'auditor']);

/** The access map entry for a role string — undefined for legacy/unknown roles (old path). */
export function roleModuleAccess(role: string | null | undefined): RoleAccess | undefined {
  if (!role || LEGACY_NAMES.has(role)) return undefined;
  return ROLE_MODULE_ACCESS[role as RbacRole];
}

/** Does this access entry grant the module? (capabilities are checked by the caller) */
export function roleGrantsModule(access: RoleAccess, m: Pick<ModuleDefinition, 'id' | 'domain'>): boolean {
  if (access.remove?.includes(m.id)) return false;
  return (access.domains?.includes(m.domain) ?? false) || (access.add?.includes(m.id) ?? false);
}
