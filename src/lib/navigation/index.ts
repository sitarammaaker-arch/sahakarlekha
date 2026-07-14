/** Capability-Based Navigation — public API (C1). Consumers import only from here. */
export * from './capabilities';
export { MODULE_CATALOG, type ModuleDefinition } from './moduleCatalog';
export { SOCIETY_TYPE_CAPABILITIES } from './societyTypeCapabilities';
export { resolveCapabilities, resolveEntitlements } from './capabilityResolver';
export { ACTIVITY_CATALOG, ACTIVITY_CODES, declaredActivities, type Activity, type ActivityDef, type ActivityGroup, type SocietyActivityRow } from './activities';
export { CAPABILITY_META, CAPABILITY_CATEGORIES, modulesForCapability, type CapabilityMeta, type CapabilityCategory } from './capabilityCatalog';
export { isModuleVisible, getVisibleGroups, type NavContext, type NavGroup } from './navVisibility';
export { navigationService, type NavigationService } from './navigationService';
