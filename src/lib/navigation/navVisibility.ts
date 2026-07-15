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

export interface NavGroup {
  domain: NavDomain;
  headingKey: string | null;
  items: ModuleDefinition[];
}

/** Visible modules grouped by domain in render order, each sorted by `order`. Empty groups dropped. */
export function getVisibleGroups(ctx: NavContext, catalog: ModuleDefinition[] = MODULE_CATALOG): NavGroup[] {
  const visible = catalog.filter((m) => isModuleVisible(m, ctx));
  return DOMAIN_ORDER
    .map((domain) => ({
      domain,
      headingKey: DOMAIN_HEADING_KEY[domain],
      items: visible.filter((m) => m.domain === domain).sort((a, b) => a.order - b.order),
    }))
    .filter((g) => g.items.length > 0);
}
