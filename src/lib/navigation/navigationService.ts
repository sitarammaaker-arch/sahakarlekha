/**
 * NavigationService (C1) — the PORT (DIP). Today it is backed by the code catalog +
 * the code capability templates. It can later be swapped to DB-driven / plugin /
 * per-tenant sources WITHOUT changing consumers (useNavigation / Sidebar).
 */
import type { SocietyType } from '@/types';
import type { CapabilityOverrides } from './capabilities';
import { MODULE_CATALOG, type ModuleDefinition } from './moduleCatalog';
import { resolveCapabilities } from './capabilityResolver';

export interface NavigationService {
  getCatalog: () => ModuleDefinition[];
  resolveCapabilities: (societyType: SocietyType, overrides?: CapabilityOverrides | null) => ReturnType<typeof resolveCapabilities>;
}

export const navigationService: NavigationService = {
  getCatalog: () => MODULE_CATALOG,
  resolveCapabilities: (societyType, overrides) => resolveCapabilities(societyType, overrides),
};
