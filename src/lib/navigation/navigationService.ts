/**
 * NavigationService (C1/C3) — the PORT (DIP). Today it is backed by the code catalog +
 * code capability templates + the `society_capabilities` rows. It can later be swapped
 * to DB-driven / plugin / per-tenant sources WITHOUT changing consumers
 * (useNavigation / Sidebar).
 */
import type { SocietyType } from '@/types';
import type { SocietyCapabilityRow } from './capabilities';
import { MODULE_CATALOG, type ModuleDefinition } from './moduleCatalog';
import { resolveCapabilities } from './capabilityResolver';

export interface NavigationService {
  getCatalog: () => ModuleDefinition[];
  resolveCapabilities: (societyType: SocietyType, rows?: SocietyCapabilityRow[]) => ReturnType<typeof resolveCapabilities>;
}

export const navigationService: NavigationService = {
  getCatalog: () => MODULE_CATALOG,
  resolveCapabilities: (societyType, rows) => resolveCapabilities(societyType, rows),
};
