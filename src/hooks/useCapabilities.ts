/**
 * useCapabilities — the single hook for "which capabilities does the current society have?".
 * Wraps the same resolution useNavigation does internally (navigationService.resolveCapabilities
 * + super-admin bypass) so dashboard and search agree with the sidebar and route guard.
 * Pure consumer of the engine — adds no new resolution logic.
 */
import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { navigationService, declaredActivities, type Capability } from '@/lib/navigation';

export interface CapabilityState {
  capabilities: Set<Capability>;
  /** super-admin sees everything (matches NavContext.superAdminShowAll) */
  has: (capability: Capability) => boolean;
}

export function useCapabilities(): CapabilityState {
  const { society, societyCapabilities, societyActivities } = useData();
  const { isSuperAdmin } = useAuth();
  const societyType = society.societyType ?? 'other';

  return useMemo(() => {
    // T-11: pass declared activities (dormant behind the cutover flag). State stays unset here to
    // preserve this hook's exact prior resolution (it never applied jurisdiction packs).
    const capabilities = navigationService.resolveCapabilities(societyType, societyCapabilities, undefined, declaredActivities(societyActivities), society.activitiesCutoverEnabled);
    const has = (capability: Capability) => isSuperAdmin || capabilities.has(capability);
    return { capabilities, has };
  }, [societyType, societyCapabilities, societyActivities, society.activitiesCutoverEnabled, isSuperAdmin]);
}
