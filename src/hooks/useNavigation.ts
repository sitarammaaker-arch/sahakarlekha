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
import { navigationService, declaredActivities, getVisibleGroups, trimSidebar, type NavContext, type NavGroup } from '@/lib/navigation';

/**
 * EVERY page this user may open, grouped (role + capability gates applied; NOT the sidebar trim). For search,
 * next-steps and the hub pages — a page hidden from the menu must still be findable (2026-10-10: #753's trim had
 * also removed those pages from Ctrl+K search and from next-steps).
 */
export function useAllNavigation(): NavGroup[] {
  const { society, societyCapabilities, societyActivities } = useData();
  const { hasPermission, isSuperAdmin, user } = useAuth();
  const societyType = society.societyType ?? 'other';
  return useMemo(() => {
    const capabilities = navigationService.resolveCapabilities(societyType, societyCapabilities, society.state, declaredActivities(societyActivities), society.activitiesCutoverEnabled);
    const ctx: NavContext = { societyType, capabilities, hasRole: hasPermission, userRole: user?.role, superAdminShowAll: isSuperAdmin };
    return getVisibleGroups(ctx);
  }, [societyType, society.state, society.activitiesCutoverEnabled, societyCapabilities, societyActivities, hasPermission, isSuperAdmin, user?.role]);
}

/** The classic (full) sidebar: every visible page minus the ones listed elsewhere (trimSidebar). */
export function useNavigation(): NavGroup[] {
  const all = useAllNavigation();
  const { society, vouchers } = useData();
  const { hasPermission, isSuperAdmin } = useAuth();
  return useMemo(() => {
    const pendingApprovals = vouchers.filter(v => !v.isDeleted && v.approvalStatus === 'pending').length;
    return trimSidebar(all, {
      fullDashboardRole: isSuperAdmin || hasPermission(['admin', 'accountant']),
      approvalRequired: !!society.approvalRequired,
      pendingApprovals,
    });
  }, [all, society.approvalRequired, vouchers, hasPermission, isSuperAdmin]);
}
