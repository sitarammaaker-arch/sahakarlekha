/**
 * CapabilityGuard — route-level enforcement of the capability engine.
 *
 * Every authenticated route flows through one chokepoint (the local ProtectedRoute in App.tsx),
 * so this guard sits there once and covers all routes. It resolves the CURRENT route to its
 * module via MODULE_CATALOG and applies the SAME predicate the sidebar uses (isModuleVisible) —
 * nav and routes can therefore never disagree. Routes with no catalog entry (sub-pages, detail
 * views) are treated as universal and allowed.
 *
 * On a blocked route (e.g. a housing society typing /milk-collection) the user is redirected to
 * /dashboard with a Hindi-first toast. This closes the URL-bypass hole; it is presentation-layer
 * enforcement and does not replace server/RLS checks.
 */
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { MODULE_CATALOG, isModuleVisible, navigationService, declaredActivities, type NavContext } from '@/lib/navigation';

export function CapabilityGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { society, societyCapabilities, societyActivities } = useData();
  const { hasPermission, isSuperAdmin } = useAuth();
  const { language } = useLanguage();
  const societyType = society.societyType ?? 'other';

  const module = MODULE_CATALOG.find((m) => m.route === location.pathname);
  const ctx: NavContext = {
    societyType,
    // T-11: declared activities gate within entitlement, dormant behind the cutover flag (T-12).
    capabilities: navigationService.resolveCapabilities(societyType, societyCapabilities, society.state, declaredActivities(societyActivities)),
    hasRole: hasPermission,
    superAdminShowAll: isSuperAdmin, // matches useNavigation — super-admin bypasses gates
  };
  const blocked = !!module && !isModuleVisible(module, ctx);

  useEffect(() => {
    if (!blocked) return;
    toast({
      title: language === 'hi' ? 'उपलब्ध नहीं' : 'Not available',
      description:
        language === 'hi'
          ? 'यह सुविधा आपकी समिति के लिए उपलब्ध नहीं है।'
          : 'This feature is not available for your society.',
      variant: 'destructive',
    });
  }, [blocked, location.pathname, language]);

  if (blocked) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
