/**
 * Everything only the LOGGED-IN app needs: the data providers, the app layout and the route guard.
 *
 * App.tsx loads this module lazily, so a public page (landing, blog, guide, glossary, pricing …) never
 * downloads it. It used to be imported eagerly by App.tsx, which put DataContext, the six domain
 * contexts, the sidebar and the export registry in the entry chunk of every page.
 *
 * Nothing in here changed behaviour: the provider order, ProtectedRoute's checks and the layout are the
 * same code, moved. See lib/appDataPaths for which paths mount it.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DataProvider, useData } from '@/contexts/DataContext';
import { LabourProvider } from '@/contexts/LabourDataContext';
import { HousingProvider } from '@/contexts/HousingDataContext';
import { DairyProvider } from '@/contexts/DairyDataContext';
import { MarketingProvider } from '@/contexts/MarketingDataContext';
import { TransportOpsProvider } from '@/contexts/TransportOpsContext';
import { ConsumerProvider } from '@/contexts/ConsumerDataContext';
import ExportContextBinder from '@/components/ExportContextBinder';
import { MainLayout } from '@/components/layout/MainLayout';
import { CapabilityGuard } from '@/components/CapabilityGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useNoIndex } from '@/lib/useDocumentMeta';
import { needsAppData } from '@/lib/appDataPaths';
import { withNext } from '@/lib/auth/entryContext';
import { LOGOUT_REASON_KEY } from '@/lib/auth/loginFailure';

/** The data providers, in the order App.tsx always nested them. */
const AppDataProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DataProvider>
    <LabourProvider>
      <HousingProvider>
        <DairyProvider>
          <MarketingProvider>
            <TransportOpsProvider>
              <ConsumerProvider>
                <ExportContextBinder />
                {children}
              </ConsumerProvider>
            </TransportOpsProvider>
          </MarketingProvider>
        </DairyProvider>
      </HousingProvider>
    </LabourProvider>
  </DataProvider>
);
export default AppDataProviders;

/** Protected route body: login check, data-loading screen, then the app layout and capability guard. */
export const ProtectedShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { isLoading } = useData();
  const { pathname, search } = useLocation();
  // App-only screens must never be indexed (robots.txt + X-Robots-Tag are the
  // other two layers; this covers any route a crawler still reaches with JS).
  useNoIndex();
  // Was this screen opened while signed out (a bookmark, a link in an email)?
  const arrivedSignedOut = React.useRef(!isAuthenticated).current;

  if (!isAuthenticated) {
    // Remember where the user was going, so login can bring them back (audit 2026-11-16, J-3) — for a
    // screen opened while signed out, and after the idle sign-out. NOT after pressing Logout: the next
    // person to sign in on this computer should start at their own dashboard, not on this screen.
    let idle = false;
    try { idle = window.sessionStorage.getItem(LOGOUT_REASON_KEY) === 'idle'; } catch { /* storage blocked */ }
    const next = arrivedSignedOut || idle ? pathname + search : null;
    return <Navigate to={withNext('/login', next, needsAppData)} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">डेटा लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  return <MainLayout><CapabilityGuard><ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary></CapabilityGuard></MainLayout>;
};

/** The app layout on its own (the super-admin screens use it without the capability guard). */
export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => <MainLayout>{children}</MainLayout>;
