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
import { hasCutoverParity } from './activityInference';

export interface NavigationService {
  getCatalog: () => ModuleDefinition[];
  resolveCapabilities: (
    societyType: SocietyType,
    rows?: SocietyCapabilityRow[],
    state?: string,
    activities?: readonly Activity[],
    cutoverEnabled?: boolean,
  ) => ReturnType<typeof resolveCapabilities>;
}

export const navigationService: NavigationService = {
  getCatalog: () => MODULE_CATALOG,
  /**
   * `state` enables jurisdiction packs (e.g. Haryana → haryana_compliance) without a server row.
   *
   * ACTIVITIES cutover (T-12, per-tenant via `cutoverEnabled` = society.activitiesCutoverEnabled):
   * declared `activities` gate capabilities WITHIN entitlement ONLY when this society has been cut
   * over AND the switch is empty-diff (hasCutoverParity — MR-1). Three cases:
   *   • cutover OFF (default), or no declared activities → resolve from the type template (today).
   *   • cutover ON + parity holds → gate on activities (identical result, source-of-truth switched).
   *   • cutover ON + parity FAILS (mis-backfilled society_activities) → fall back to the template,
   *     so an over-eager flip can NEVER hide a module. The safety net is at the read path, not just
   *     the flip tool. (Intentional divergence — a society hiding an entitled module — is T-14.)
   */
  resolveCapabilities: (societyType, rows, state, activities, cutoverEnabled) => {
    const apply =
      !!cutoverEnabled &&
      (activities?.length ?? 0) > 0 &&
      hasCutoverParity(societyType, rows ?? [], activities, undefined, state);
    return resolveCapabilities(societyType, rows, undefined, state, apply ? activities : []);
  },
};
