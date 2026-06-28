/** Capability-Based Navigation — public API (C1). Consumers import only from here. */
export * from './capabilities';
export { MODULE_CATALOG, type ModuleDefinition } from './moduleCatalog';
export { SOCIETY_TYPE_CAPABILITIES } from './societyTypeCapabilities';
export { resolveCapabilities } from './capabilityResolver';
export { isModuleVisible, getVisibleGroups, type NavContext, type NavGroup } from './navVisibility';
export { navigationService, type NavigationService } from './navigationService';
