/**
 * Navigation visibility (C1) — THE single visibility rule, in one place.
 * A module is visible iff: super-admin show-all, OR (role allowed AND every required
 * capability is held). Empty requiredCapabilities ⇒ universal (always visible).
 * Adding a future gate (state/plan) = add one predicate here; nothing else changes.
 */
import type { SocietyType } from '@/types';
import type { Capability, NavDomain, Role } from './capabilities';
import { DOMAIN_ORDER, DOMAIN_HEADING_KEY } from './capabilities';
import type { ModuleDefinition } from './moduleCatalog';
import { MODULE_CATALOG } from './moduleCatalog';
import { roleModuleAccess, roleGrantsModule } from './roleAccess';

export interface NavContext {
  societyType: SocietyType;
  capabilities: Set<Capability>;
  hasRole: (roles?: Role[]) => boolean;
  /** Raw role string of the current user (ECR-06 S2). For the 4 legacy names (and when
   *  absent) the classic requiredRoles path runs unchanged; for a mapped 17-role name the
   *  ROLE_MODULE_ACCESS map becomes the role gate instead. */
  userRole?: string;
  superAdminShowAll?: boolean;
}

export function isModuleVisible(m: ModuleDefinition, ctx: NavContext): boolean {
  if (ctx.superAdminShowAll) return true;
  const access = roleModuleAccess(ctx.userRole);
  if (access) {
    if (!roleGrantsModule(access, m)) return false; // mapped new role: the map IS the role gate
  } else if (m.requiredRoles && !ctx.hasRole(m.requiredRoles)) return false; // legacy path, byte-identical
  return m.requiredCapabilities.every((c) => ctx.capabilities.has(c));
}

/**
 * Pages kept but taken OUT of every menu (sidebar, group pages, Ctrl+K search, next-step links). The route,
 * its gates and the data stay — a society that has data there opens it by URL.
 *   • payroll — founder 2026-11-11: ONE salary path in the menu. The new Payroll engine is not complete yet
 *     (its TDS is not in the TDS Register / 24Q, its data is not in backup, the compliance calendar does not
 *     see it, no designation / phone / bank in its employee master), so the older Salary page is the one
 *     shown. Bring Payroll back here when those gaps are closed (docs/payroll/PAYROLL-CONSOLIDATION-PLAN.md).
 * Super-admin show-all still sees them (support).
 */
export const RETIRED_FROM_MENU: ReadonlySet<string> = new Set(['payroll']);

export interface NavGroup {
  domain: NavDomain;
  headingKey: string | null;
  items: ModuleDefinition[];
}

/** Visible modules grouped by domain in render order, each sorted by `order`. Empty groups dropped. */
export function getVisibleGroups(ctx: NavContext, catalog: ModuleDefinition[] = MODULE_CATALOG): NavGroup[] {
  const visible = catalog.filter((m) => isModuleVisible(m, ctx) && (ctx.superAdminShowAll || !RETIRED_FROM_MENU.has(m.id)));
  return DOMAIN_ORDER
    .map((domain) => ({
      domain,
      headingKey: DOMAIN_HEADING_KEY[domain],
      items: visible.filter((m) => m.domain === domain).sort((a, b) => a.order - b.order),
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * Sidebar-only trimming (founder 2026-10-10: "what in this list is not needed / repeated?"). These pages stay in the
 * catalog — the route, its role/capability gate and every link keep working — they are just not listed twice:
 *   • memberApplication — opened from the Members page's "आवेदन पत्र" button
 *   • myDashboard — the same cards as Dashboard for admin / accountant; it stays the home for the narrower roles
 *   • deletedVouchers — the cancelled-voucher audit register, opened from the Vouchers page's "रद्द" view
 *   • stockValuation — today's stock value, opened from Inventory / Closing Stock report
 *   • voucherApproval — only when maker-checker is on or something is waiting for approval
 * PURE.
 */
export interface SidebarTrimContext { fullDashboardRole: boolean; approvalRequired: boolean; pendingApprovals: number }
export function hiddenInSidebar(id: string, c: SidebarTrimContext): boolean {
  switch (id) {
    case 'memberApplication': case 'deletedVouchers': case 'stockValuation': return true;
    case 'myDashboard': return c.fullDashboardRole;
    case 'voucherApproval': return !c.approvalRequired && c.pendingApprovals === 0;
    default: return false;
  }
}
export function trimSidebar(groups: NavGroup[], c: SidebarTrimContext): NavGroup[] {
  return groups.map((g) => ({ ...g, items: g.items.filter((m) => !hiddenInSidebar(m.id, c)) })).filter((g) => g.items.length > 0);
}
