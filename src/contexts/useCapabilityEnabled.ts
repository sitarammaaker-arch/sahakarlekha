/**
 * J6b · is a capability on for the signed-in society? Resolved EXACTLY as the sidebar and CapabilityGuard
 * resolve it (navigationService.resolveCapabilities over type + capability rows + declared activities),
 * so a domain context loads its tables only when its module can actually be opened. A society that does
 * not use housing / labour / dairy no longer fetches those ~20 tables on every login.
 */
import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { navigationService, declaredActivities } from '@/lib/navigation';
import type { Capability } from '@/lib/navigation/capabilities';

export function useCapabilityEnabled(anyOf: readonly string[]): boolean {
  const { society, societyCapabilities, societyActivities } = useData();
  const key = anyOf.join(',');
  return useMemo(() => {
    const caps = navigationService.resolveCapabilities(
      society.societyType ?? 'other', societyCapabilities, society.state,
      declaredActivities(societyActivities), society.activitiesCutoverEnabled,
    );
    return key.split(',').some((c) => caps.has(c as Capability));
  }, [society.societyType, society.state, society.activitiesCutoverEnabled, societyCapabilities, societyActivities, key]);
}
