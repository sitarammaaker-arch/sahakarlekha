/** Capability-Based Navigation — public API (C1). Consumers import only from here. */
export * from './capabilities';
export { MODULE_CATALOG, type ModuleDefinition } from './moduleCatalog';
export { SOCIETY_TYPE_CAPABILITIES } from './societyTypeCapabilities';
export { resolveCapabilities, resolveEntitlements } from './capabilityResolver';
export { ACTIVITY_CATALOG, ACTIVITY_CODES, declaredActivities, type Activity, type ActivityDef, type ActivityGroup, type SocietyActivityRow } from './activities';
export { CAPABILITY_META, CAPABILITY_CATEGORIES, modulesForCapability, type CapabilityMeta, type CapabilityCategory } from './capabilityCatalog';
export { isModuleVisible, getVisibleGroups, trimSidebar, hiddenInSidebar, type NavContext, type NavGroup, type SidebarTrimContext } from './navVisibility';
export { MAX_FAVOURITES, MAX_RECENTS, prefsKey, parseList, toggleId, pushRecent, keepVisible, recordableModule, type PrefKind } from './navPrefs';
export { HUBS, DIRECT_ENTRIES, hubRoute, hubById, hubForModule, hubSections, compactSidebar, entryIsActive, type HubDef, type HubSection, type SidebarEntry } from './hubs';
export { navigationService, type NavigationService } from './navigationService';
