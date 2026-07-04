/**
 * useNavigation (C2) — the single bridge between the app and the navigation engine.
 * Reads the current society + user, resolves capabilities, and returns the visible
 * sidebar groups. In C2 every module is universal and capability templates are empty,
 * so the output is identical to the old hardcoded sidebar (role-filtered as before).
 *
 * Capability overrides (society_settings.capability_overrides) and super-admin
 * show-all arrive in C3/C5 — wired here without touching the Sidebar.
 */
import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { navigationService, getVisibleGroups, type NavContext, type NavGroup } from '@/lib/navigation';

export function useNavigation(): NavGroup[] {
  const { society, societyCapabilities } = useData();
  const { hasPermission, isSuperAdmin } = useAuth();
  const societyType = society.societyType ?? 'other';

  return useMemo(() => {
    const capabilities = navigationService.resolveCapabilities(societyType, societyCapabilities, society.state);
    const ctx: NavContext = {
      societyType,
      capabilities,
      hasRole: hasPermission,
      superAdminShowAll: isSuperAdmin,   // C7: platform super-admin bypasses role + capability gates
    };
    return getVisibleGroups(ctx);
  }, [societyType, society.state, societyCapabilities, hasPermission, isSuperAdmin]);
}
