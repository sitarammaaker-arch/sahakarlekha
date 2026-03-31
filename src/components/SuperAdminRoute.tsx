import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  children: React.ReactNode;
}

/**
 * Guards routes that require super-admin (platform owner) access.
 * Redirects to /dashboard if the user is authenticated but not a super admin,
 * or to /login if not authenticated at all.
 */
export function SuperAdminRoute({ children }: Props) {
  const { isAuthenticated, isSuperAdmin } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isSuperAdmin)    return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
