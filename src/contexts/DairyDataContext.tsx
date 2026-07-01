/**
 * DairyDataContext — Dairy-cooperative domain state & workflows ONLY.
 *
 * This context does NOT fork the accounting / voucher / posting / reports / audit engines.
 * Those stay in DataContext (the single SSOT). It COMPOSES the core: reads `society` (FY-lock)
 * and `accounts` from useData(), `societyId` from useAuth(), and calls useData().addVoucher /
 * addAccount for all accounting. Persistence mirrors the Housing pattern: optimistic local +
 * localStorage + Supabase upsert with RULE-1 visible rollback and a RULE-6 FY-lock guard.
 *
 * Delivery D1 adds: Fat+SNF milk rate charts (master + pricing) and an additive "ensure-accounts"
 * seeder that creates the dedicated milk ledgers (procurement / bulk-sales) for a dairy society
 * that predates the D1 template — the C-A conflict resolution, so milk never posts to the generic
 * 4101/5101 fallbacks. The collection hot-path posting (which absorbs the existing MilkCollection
 * page — C-B) lands in D2.
 */
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import * as storage from '@/lib/storage';
import { priceMilk } from '@/lib/dairy/pricing';
import { resolveMilkProcurementAccountId, resolveMilkBulkSalesAccountId, resolveMilkPayableAccountId } from '@/lib/dairy/accounts';
import type { DairyRateChart } from '@/types';

interface DairyDataContextValue {
  dairyReady: boolean;
  guardFYLocked: () => boolean;

  // Rate charts (Fat + SNF pricing master)
  rateCharts: DairyRateChart[];
  addRateChart: (data: Omit<DairyRateChart, 'id' | 'createdAt'>) => DairyRateChart;
  updateRateChart: (id: string, data: Partial<DairyRateChart>) => void;
  deleteRateChart: (id: string) => void;
  /** Resolve ₹/L (and amount) for a collection using the chart in force on `date` (default today). */
  resolveMilkRate: (args: { fat: number; snf: number; qty: number; date?: string; season?: string }) => { rate: number | null; amount: number };

  // Dedicated milk ledgers resolved for this society (C-A) — null until seeded.
  milkProcurementAccountId: string | null;
  milkBulkSalesAccountId: string | null;
  milkPayableAccountId: string | null;
}

const DairyDataContext = createContext<DairyDataContextValue | null>(null);

export function DairyProvider({ children }: { children: ReactNode }) {
  const { society, accounts, addAccount } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const societyId = user?.societyId || 'SOC001';
  const withSoc = <T extends object>(d: T) => ({ ...d, society_id: societyId });

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

  // ── Rate-chart state (localStorage seed → Supabase load on session) ─────────
  const [rateCharts, setRateChartsState] = useState<DairyRateChart[]>(() => storage.getDairyRateCharts());

  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setRateChartsState([]); return; }
    supabase.from('dairy_rate_charts').select('*').eq('society_id', sid).then(
      ({ data, error }) => setRateChartsState(error || !data ? storage.getDairyRateCharts() : (data as DairyRateChart[])),
      () => setRateChartsState(storage.getDairyRateCharts()),
    );
  }, [user?.societyId]);

  // ── C-A ensure-accounts: seed dedicated milk ledgers for a pre-D1 dairy society (additive) ──
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (society?.societyType !== 'dairy') return;
    if (!accounts || accounts.length === 0) return;
    if (society.fyLocked) return; // seeding mutates the chart; retry on a later load when unlocked
    const needsProc = resolveMilkProcurementAccountId(accounts) === null;
    const needsSales = resolveMilkBulkSalesAccountId(accounts) === null;
    if (!needsProc && !needsSales) { seededRef.current = true; return; }
    seededRef.current = true; // attempt once per mount
    if (needsProc) {
      addAccount({ name: 'Milk Procurement (Direct)', nameHi: 'दुग्ध खरीदी लागत (प्रत्यक्ष)', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5100', subtype: 'milk_procurement' });
    }
    if (needsSales) {
      addAccount({ name: 'Milk Sales — Bulk / Union', nameHi: 'दुग्ध बिक्री — यूनियन', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4100', subtype: 'milk_sales' });
    }
  }, [society?.societyType, society?.fyLocked, accounts, addAccount]);

  const addRateChart = useCallback((data: Omit<DairyRateChart, 'id' | 'createdAt'>): DairyRateChart => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as DairyRateChart;
    const chart: DairyRateChart = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setRateChartsState(prev => { const u = [...prev, chart]; storage.setDairyRateCharts(u); return u; });
    supabase.from('dairy_rate_charts').upsert(withSoc(chart)).then(({ error }) => {
      if (error) {
        console.error('Rate chart save error:', error.message);
        setRateChartsState(prev => { const r = prev.filter(c => c.id !== chart.id); storage.setDairyRateCharts(r); return r; });
        toastRef.current({ title: 'रेट चार्ट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh karne par data lose nahi hoga. (Pehli baar: supabase-tables.sql ka dairy_rate_charts block chalayein.)`, variant: 'destructive', duration: 12000 });
      }
    });
    return chart;
  }, [societyId]);

  const updateRateChart = useCallback((id: string, data: Partial<DairyRateChart>) => {
    if (guardFYLocked()) return;
    setRateChartsState(prev => {
      const before = prev.find(c => c.id === id);
      const u = prev.map(c => c.id === id ? { ...c, ...data } : c);
      storage.setDairyRateCharts(u);
      const next = u.find(c => c.id === id);
      if (next && before) supabase.from('dairy_rate_charts').upsert(withSoc(next)).then(({ error }) => {
        if (error) {
          setRateChartsState(p => { const r = p.map(c => c.id === id ? before : c); storage.setDairyRateCharts(r); return r; });
          toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteRateChart = useCallback((id: string) => {
    if (guardFYLocked()) return;
    setRateChartsState(prev => {
      const before = prev.find(c => c.id === id);
      const u = prev.map(c => c.id === id ? { ...c, isDeleted: true } : c);
      storage.setDairyRateCharts(u);
      if (before) supabase.from('dairy_rate_charts').upsert(withSoc({ ...before, isDeleted: true })).then(({ error }) => {
        if (error) {
          setRateChartsState(p => { const r = p.map(c => c.id === id ? before : c); storage.setDairyRateCharts(r); return r; });
          toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const resolveMilkRate = useCallback(
    (args: { fat: number; snf: number; qty: number; date?: string; season?: string }) =>
      priceMilk(rateCharts, { fat: args.fat, snf: args.snf, qty: args.qty, date: args.date || new Date().toISOString().slice(0, 10), season: args.season }),
    [rateCharts],
  );

  return (
    <DairyDataContext.Provider value={{
      dairyReady: true,
      guardFYLocked,
      rateCharts,
      addRateChart,
      updateRateChart,
      deleteRateChart,
      resolveMilkRate,
      milkProcurementAccountId: resolveMilkProcurementAccountId(accounts),
      milkBulkSalesAccountId: resolveMilkBulkSalesAccountId(accounts),
      milkPayableAccountId: resolveMilkPayableAccountId(accounts),
    }}>
      {children}
    </DairyDataContext.Provider>
  );
}

export function useDairyData(): DairyDataContextValue {
  const ctx = useContext(DairyDataContext);
  if (!ctx) throw new Error('useDairyData must be used within a DairyProvider');
  return ctx;
}
