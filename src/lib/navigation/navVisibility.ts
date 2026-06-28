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

export interface NavContext {
  societyType: SocietyType;
  capabilities: Set<Capability>;
  hasRole: (roles?: Role[]) => boolean;
  superAdminShowAll?: boolean;
}

export function isModuleVisible(m: ModuleDefinition, ctx: NavContext): boolean {
  if (ctx.superAdminShowAll) return true;
  if (m.requiredRoles && !ctx.hasRole(m.requiredRoles)) return false;
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
