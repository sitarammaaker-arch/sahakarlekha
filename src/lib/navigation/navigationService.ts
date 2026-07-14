/**
 * NavigationService (C1/C3) — the PORT (DIP). Today it is backed by the code catalog +
 * code capability templates + the `society_capabilities` rows. It can later be swapped
 * to DB-driven / plugin / per-tenant sources WITHOUT changing consumers
 * (useNavigation / Sidebar).
 */
import type { SocietyType } from '@/types';
import type { SocietyCapabilityRow } from './capabilities';
import type { Activity } from './activities';
import { MODULE_CATALOG, type ModuleDefinition } from './moduleCatalog';
import { resolveCapabilities } from './capabilityResolver';

export interface NavigationService {
  getCatalog: () => ModuleDefinition[];
  resolveCapabilities: (
    societyType: SocietyType,
    rows?: SocietyCapabilityRow[],
    state?: string,
    activities?: readonly Activity[],
  ) => ReturnType<typeof resolveCapabilities>;
}

/**
 * ACTIVITIES cutover flag (T-11 → T-12). While FALSE the port IGNORES declared activities and
 * resolves exactly as before (all entitled caps) — so the read-path wiring is dormant and provably
 * non-breaking. T-12 flips this (ultimately per-tenant) ONLY AFTER `society_activities` is backfilled
 * with empty-diff parity. Living at the single port means the High cutover is one switch and every
 * consumer can pass its declared activities unconditionally today. See MASTER-IMPLEMENTATION-BLUEPRINT T-11/T-12.
 */
export const ACTIVITIES_CUTOVER_ENABLED = false;

export const navigationService: NavigationService = {
  getCatalog: () => MODULE_CATALOG,
  // `state` enables jurisdiction packs (e.g. Haryana → haryana_compliance) without a server row.
  // `activities` (T-11) gate entitled capabilities WITHIN entitlement, but ONLY once the cutover flag
  // is on (T-12); until then they are ignored → today's behaviour (all entitled caps), whatever the
  // caller passes. The live source (society_activities) is now wired through here (T-11).
  resolveCapabilities: (societyType, rows, state, activities) =>
    resolveCapabilities(societyType, rows, undefined, state, ACTIVITIES_CUTOVER_ENABLED ? activities : []),
};
