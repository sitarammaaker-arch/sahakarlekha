/**
 * Role dashboard widget registry (ECR-18).
 *
 * Maps a user's role (legacy → modelled via rbac.mapLegacyRole) to the ordered set of KPI
 * widgets that role should see. Pure & deterministic → unit-tested by
 * scripts/test-role-dashboard.mjs. The page renders each widget id from existing getters.
 */
import { mapLegacyRole, type LegacyRole, type Role } from '@/lib/rbac';

export type WidgetId =
  | 'netProfit'
  | 'bsStatus'
  | 'members'
  | 'loanPortfolio'
  | 'pendingApprovals'
  | 'complianceDue'
  | 'auditObjections'
  | 'shareReconciliation'
  | 'cashBank'
  | 'trialBalance'
  | 'periodLock'
  | 'unapprovedVouchers';

const ADMIN: WidgetId[] = ['netProfit', 'bsStatus', 'members', 'loanPortfolio', 'pendingApprovals', 'complianceDue'];
const ACCOUNTANT: WidgetId[] = ['netProfit', 'trialBalance', 'cashBank', 'pendingApprovals', 'complianceDue', 'shareReconciliation'];
const AUDITOR: WidgetId[] = ['auditObjections', 'shareReconciliation', 'unapprovedVouchers', 'periodLock', 'complianceDue', 'bsStatus'];
const READ_ONLY: WidgetId[] = ['netProfit', 'members', 'loanPortfolio'];
const CHAIRMAN: WidgetId[] = ['netProfit', 'bsStatus', 'members', 'loanPortfolio', 'pendingApprovals', 'auditObjections', 'complianceDue'];

const ROLE_WIDGETS: Partial<Record<Role, WidgetId[]>> = {
  superAdmin: ADMIN,
  societyAdmin: ADMIN,
  secretary: ADMIN,
  manager: ADMIN,
  accountant: ACCOUNTANT,
  cashier: ['cashBank', 'netProfit', 'complianceDue'],
  auditor: AUDITOR,
  internalAuditor: AUDITOR,
  externalCA: AUDITOR,
  chairman: CHAIRMAN,
  boardMember: CHAIRMAN,
  readOnly: READ_ONLY,
};

const DEFAULT_WIDGETS: WidgetId[] = ['netProfit', 'members', 'loanPortfolio', 'complianceDue'];

/** The ordered widget ids for a role (legacy or modelled). Unknown roles get a sane default. */
export function roleWidgets(role: LegacyRole | Role | undefined): WidgetId[] {
  if (!role) return DEFAULT_WIDGETS;
  const resolved = mapLegacyRole(role);
  return ROLE_WIDGETS[resolved] ?? DEFAULT_WIDGETS;
}
