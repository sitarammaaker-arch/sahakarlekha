/**
 * DairyDataContext — Dairy-cooperative domain state & workflows ONLY (Delivery D0 scaffold).
 *
 * This context does NOT fork the accounting / voucher / posting / reports / audit engines.
 * Those stay in DataContext (the single SSOT). Like HousingDataContext, it COMPOSES the core:
 * it reads `society` (FY-lock) and `accounts` from useData(), `societyId` from useAuth(), and
 * will call useData().addVoucher / cancelVoucher for all accounting. The posting law for the
 * domain will live in src/lib/dairy/postingRules.ts (wired in a later delivery, mapping only
 * to dedicated milk ledgers — see the C-A conflict resolution).
 *
 * D0 is a behaviour-preserving scaffold: it establishes the provider + hook + FY-lock guard so
 * later deliveries (D1 masters + pricing, D2 collection hot-path that ABSORBS the existing
 * MilkCollection page, D3 settlement cycle …) can grow domain state here without touching the
 * shared engines. No dairy entities, tables, or account changes ship in D0.
 */
import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';

interface DairyDataContextValue {
  /** D0 scaffold marker — the domain provider is mounted and composing the core engines. */
  dairyReady: boolean;
  /** RULE-6 FY-lock guard: returns true (and toasts) when the FY is audit-locked. */
  guardFYLocked: () => boolean;
}

const DairyDataContext = createContext<DairyDataContextValue | null>(null);

export function DairyProvider({ children }: { children: ReactNode }) {
  // Compose the core (never fork): FY-lock lives on society; societyId comes from auth.
  const { society } = useData();
  useAuth();
  const { toast } = useToast();

  // Fresh ref so the guard never reads a stale society inside empty-dep callbacks (Housing pattern).
  const societyRef = useRef(society);
  societyRef.current = society;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const guardFYLocked = useCallback((): boolean => {
    if (societyRef.current?.fyLocked) {
      toastRef.current({
        title: 'FY Locked',
        description: 'Cannot modify data while the Financial Year is audit-locked. (वित्तीय वर्ष लॉक है)',
        variant: 'destructive',
      });
      return true;
    }
    return false;
  }, []);

  return (
    <DairyDataContext.Provider value={{ dairyReady: true, guardFYLocked }}>
      {children}
    </DairyDataContext.Provider>
  );
}

export function useDairyData(): DairyDataContextValue {
  const ctx = useContext(DairyDataContext);
  if (!ctx) throw new Error('useDairyData must be used within a DairyProvider');
  return ctx;
}
