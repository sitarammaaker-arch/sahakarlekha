/**
 * ConsumerDataContext — Consumer Cooperative store domain state ONLY.
 *
 * Does NOT fork the accounting / voucher / sales / inventory engines — those stay in
 * DataContext (the single SSOT); the Retail Counter posts through the core `addSale`.
 * This bounded seam owns the FIRST consumer-specific state: effective-dated TIER PRICING
 * (member / wholesale / promo overrides on top of the base retail `StockItem.saleRate`).
 *
 * The seam is introduced now (C2) because pricing is real consumer state with its own CRUD
 * and resolver — not before (C1 POS reused the core entirely, so an empty context would have
 * been scaffolding). Persistence mirrors the Dairy/Marketing pattern: optimistic local +
 * localStorage + Supabase upsert with RULE-1 visible rollback and a RULE-6 FY-lock guard.
 *
 * C2 exposes the 'member' tier in the UI; 'wholesale'/'promo' are schema-ready for later slices.
 */
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import * as storage from '@/lib/storage';
import { resolveItemPrice } from '@/lib/consumer/pricing';
import type { ConsumerPrice, ConsumerPriceTier } from '@/types';

interface ConsumerDataContextValue {
  consumerReady: boolean;
  guardFYLocked: () => boolean;

  // Effective-dated tier price overrides (C2). Retail = StockItem.saleRate (base).
  consumerPrices: ConsumerPrice[];
  addConsumerPrice: (data: { itemId: string; tier: ConsumerPriceTier; price: number; effectiveFrom: string }) => ConsumerPrice;
  deleteConsumerPrice: (id: string) => void;
  /** Unit price for an item at a tier on a date (default today). Falls back to saleRate. */
  resolvePrice: (item: { id: string; saleRate: number }, tier: string, date?: string) => number;
}

const ConsumerDataContext = createContext<ConsumerDataContextValue | null>(null);

export function ConsumerProvider({ children }: { children: ReactNode }) {
  const { society } = useData();
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

  // ── Price list (localStorage seed → Supabase load on session) ─────────────────
  const [consumerPrices, setPricesState] = useState<ConsumerPrice[]>(() => storage.getConsumerPrices());

  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setPricesState([]); return; }
    supabase.from('consumer_price_lists').select('*').eq('society_id', sid).then(
      ({ data, error }) => setPricesState(error || !data ? storage.getConsumerPrices() : (data as ConsumerPrice[])),
      () => setPricesState(storage.getConsumerPrices()),
    );
  }, [user?.societyId]);

  const addConsumerPrice = useCallback((data: { itemId: string; tier: ConsumerPriceTier; price: number; effectiveFrom: string }): ConsumerPrice => {
    const now = new Date().toISOString();
    const rec: ConsumerPrice = { id: crypto.randomUUID(), itemId: data.itemId, tier: data.tier, price: data.price, effectiveFrom: data.effectiveFrom, createdAt: now, updatedAt: now };
    if (guardFYLocked()) return { ...rec, id: '', createdAt: '', updatedAt: '' };
    setPricesState(prev => { const u = [...prev, rec]; storage.setConsumerPrices(u); return u; });
    supabase.from('consumer_price_lists').upsert(withSoc(rec)).then(({ error }) => {
      if (error) {
        console.error('Consumer price save error:', error.message);
        setPricesState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setConsumerPrices(r); return r; });
        toastRef.current({ title: 'मूल्य सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh karne par data lose nahi hoga. (Pehli baar: supabase-tables.sql ka consumer_price_lists block chalayein.)`, variant: 'destructive', duration: 12000 });
      }
    });
    return rec;
  }, [societyId]);

  const deleteConsumerPrice = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const before = consumerPrices.find(p => p.id === id);
    if (!before) return;
    setPricesState(prev => { const r = prev.filter(x => x.id !== id); storage.setConsumerPrices(r); return r; });
    supabase.from('consumer_price_lists').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setPricesState(prev => { const u = [...prev, before]; storage.setConsumerPrices(u); return u; });
        toastRef.current({ title: 'मूल्य हटा नहीं', description: `Cloud delete fail — ${error.message}. Refresh karne par wapas dikhega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [consumerPrices, societyId]);

  const resolvePrice = useCallback(
    (item: { id: string; saleRate: number }, tier: string, date?: string) =>
      resolveItemPrice(item, tier, consumerPrices, date || new Date().toISOString().slice(0, 10)),
    [consumerPrices],
  );

  return (
    <ConsumerDataContext.Provider value={{ consumerReady: true, guardFYLocked, consumerPrices, addConsumerPrice, deleteConsumerPrice, resolvePrice }}>
      {children}
    </ConsumerDataContext.Provider>
  );
}

export function useConsumerData() {
  const ctx = useContext(ConsumerDataContext);
  if (!ctx) throw new Error('useConsumerData must be used within a ConsumerProvider');
  return ctx;
}
