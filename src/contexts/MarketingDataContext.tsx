/**
 * MarketingDataContext — Cooperative Marketing domain state & workflows ONLY.
 *
 * This context does NOT fork the accounting / voucher / posting / settlement / reports / audit
 * engines. Those stay in DataContext (the single SSOT). It COMPOSES the core: reads `society`
 * (FY-lock) and `accounts` from useData(), and (in later phases) calls useData().addVoucher /
 * addAccount for all accounting, plus reuses the existing procurement engine (src/lib/procurement)
 * for the MSP farmer chain. Persistence (added from M1 onward) mirrors the Dairy/Housing pattern:
 * optimistic local + localStorage + Supabase upsert with RULE-1 visible rollback and a RULE-6
 * FY-lock guard.
 *
 * M0 (this slice) is the behaviour-preserving scaffold: it establishes the domain seam and the
 * `marketing` navigation group. It holds NO domain state yet — masters (Season / Agency / Centre /
 * Crop / Variety / MSP-rate / QualitySpec / DeductionRule / Bardana) land in M1, the procurement
 * operator hot-path in M2, dedicated-account settlement posting in M3, and registers in M4.
 */
import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';

interface MarketingDataContextValue {
  marketingReady: boolean;
  guardFYLocked: () => boolean;
}

const MarketingDataContext = createContext<MarketingDataContextValue | null>(null);

export function MarketingProvider({ children }: { children: ReactNode }) {
  const { society } = useData();
  const { toast } = useToast();

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
    <MarketingDataContext.Provider value={{ marketingReady: true, guardFYLocked }}>
      {children}
    </MarketingDataContext.Provider>
  );
}

export function useMarketingData(): MarketingDataContextValue {
  const ctx = useContext(MarketingDataContext);
  if (!ctx) throw new Error('useMarketingData must be used within a MarketingProvider');
  return ctx;
}
