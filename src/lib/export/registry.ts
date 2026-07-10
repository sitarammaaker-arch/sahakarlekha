/**
 * Export Registry — the assembled SSOT (T-06).
 *
 * Every persisted collection in the app appears here exactly once. Nothing else in the
 * codebase decides what is exportable. Domains are added one file at a time (T-07…T-11)
 * until all ~93 collections are declared; the drift detector (T-12) then fails the build
 * whenever a table exists in supabase-tables.sql but not here, or vice versa.
 *
 * INVARIANT: `validateRegistry(REGISTRY)` must return zero problems. That is asserted by
 * scripts/test-export-registry.mjs against this real array, not against a fixture.
 */
import type { EntityDescriptor } from './registry.types';
import { CORE_ENTITIES } from './entities/core';
import { MEMBER_ENTITIES } from './entities/member';
import { INVENTORY_ENTITIES } from './entities/inventory';
import { TRADE_ENTITIES } from './entities/trade';
import { LENDING_ENTITIES } from './entities/lending';
import { PAYROLL_ENTITIES } from './entities/payroll';
import { PROCUREMENT_ENTITIES } from './entities/procurement';
import { DAIRY_ENTITIES } from './entities/dairy';
import { HOUSING_ENTITIES } from './entities/housing';
import { MARKETING_ENTITIES } from './entities/marketing';
import { CONSUMER_ENTITIES } from './entities/consumer';
import { PLATFORM_ENTITIES } from './entities/platform';

export const REGISTRY: readonly EntityDescriptor[] = [
  ...CORE_ENTITIES,
  ...MEMBER_ENTITIES,
  ...INVENTORY_ENTITIES,
  ...TRADE_ENTITIES,
  ...LENDING_ENTITIES,
  ...PAYROLL_ENTITIES,
  ...PROCUREMENT_ENTITIES,
  ...DAIRY_ENTITIES,
  ...HOUSING_ENTITIES,
  ...MARKETING_ENTITIES,
  ...CONSUMER_ENTITIES,
  ...PLATFORM_ENTITIES,
];

/** PURE — look up one entity by its stable key. Returns undefined for unknown keys. */
export function getEntity(key: string): EntityDescriptor | undefined {
  return REGISTRY.find(e => e.key === key);
}

/** PURE — every entity in a domain, in declaration order. */
export function entitiesInDomain(domain: EntityDescriptor['domain']): EntityDescriptor[] {
  return REGISTRY.filter(e => e.domain === domain);
}

/**
 * PURE — entities that a full society backup must serialize.
 * Excludes 'exclude' (secrets, cross-tenant) and 'global' scope (shared reference data).
 * Includes 'sidecar' and 'replay' — the writer places them in evidence/ and derived/.
 */
export function backupEntities(): EntityDescriptor[] {
  return REGISTRY.filter(e => e.backupPolicy !== 'exclude' && e.scope === 'society');
}

/** PURE — entities a restore may INSERT. Never 'replay' (regenerated) or 'sidecar' (evidence). */
export function restorableEntities(): EntityDescriptor[] {
  return REGISTRY.filter(e => e.backupPolicy === 'full' && e.scope === 'society');
}
