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
import { resolveMemberReceivableAccountId, MEMBER_RECEIVABLE_SUBTYPE } from '@/lib/consumer/accounts';
import { memberOutstanding, memberAgeing, type Ageing, type RecoveryRow } from '@/lib/consumer/credit';
import { getBankAccountIds } from '@/lib/storage';
import type { ConsumerPrice, ConsumerPriceTier, Voucher } from '@/types';

const CASH_ACCOUNT = '3301';   // Cash in Hand (CMS chart)
const RECOVERY_REF = 'consumer.member.recovery';

interface ConsumerDataContextValue {
  consumerReady: boolean;
  guardFYLocked: () => boolean;

  // Effective-dated tier price overrides (C2). Retail = StockItem.saleRate (base).
  consumerPrices: ConsumerPrice[];
  addConsumerPrice: (data: { itemId: string; tier: ConsumerPriceTier; price: number; effectiveFrom: string }) => ConsumerPrice;
  deleteConsumerPrice: (id: string) => void;
  /** Unit price for an item at a tier on a date (default today). Falls back to saleRate. */
  resolvePrice: (item: { id: string; saleRate: number }, tier: string, date?: string) => number;

  // Member store credit (C3). Single "Member Purchase Receivable" control (auto-created);
  // per-member outstanding is DERIVED from credit sales − recoveries.
  memberReceivableAccountId: string | null;
  memberRecoveries: Voucher[];
  /** Record a recovery receipt against a member's store credit: Dr Cash|Bank / Cr receivable. */
  recordMemberRecovery: (data: { memberId: string; memberName: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; note?: string }) => Voucher | null;
  deleteMemberRecovery: (voucherId: string) => void;
  /** Outstanding store credit for a member (Σ credit sales − Σ recoveries, ≥ 0). */
  getMemberOutstanding: (memberId: string) => number;
  /** FIFO ageing of a member's unpaid credit (default asOf today). */
  getMemberAgeing: (memberId: string, asOf?: string) => Ageing;
  /** Set a member's store-credit limit (0 = no cap). Wraps core updateMember. */
  setMemberCreditLimit: (memberId: string, limit: number) => void;
}

const ConsumerDataContext = createContext<ConsumerDataContextValue | null>(null);

export function ConsumerProvider({ children }: { children: ReactNode }) {
  const { society, accounts, addAccount, vouchers, sales, addVoucher, cancelVoucher, updateMember } = useData();
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

  // ── C3: ensure the "Member Purchase Receivable" control exists (auto-id; NOT 3306, which
  // is Rent Receivable in the CMS chart). Mirrors the Dairy dedicated-ledger seeder. ──
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (society?.societyType !== 'consumer') return;
    if (!accounts || accounts.length === 0) return;
    if (society.fyLocked) return; // seeding mutates the chart; retry on a later unlocked load
    if (resolveMemberReceivableAccountId(accounts) !== null) { seededRef.current = true; return; }
    seededRef.current = true; // attempt once per mount
    addAccount({ name: 'Member Purchase Receivable', nameHi: 'सदस्य खरीद प्राप्य', type: 'asset', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '3300', subtype: MEMBER_RECEIVABLE_SUBTYPE });
  }, [society?.societyType, society?.fyLocked, accounts, addAccount]);

  const memberReceivableAccountId = resolveMemberReceivableAccountId(accounts);

  const memberRecoveries = vouchers.filter(v => v.refType === RECOVERY_REF);
  const recoveryRows: RecoveryRow[] = memberRecoveries.map(v => ({ memberId: v.memberId, amount: v.amount, isDeleted: v.isDeleted }));

  const getMemberOutstanding = useCallback(
    (memberId: string) => memberOutstanding(sales, recoveryRows, memberId),
    [sales, recoveryRows],
  );
  const getMemberAgeing = useCallback(
    (memberId: string, asOf?: string) => memberAgeing(sales, recoveryRows, memberId, asOf || new Date().toISOString().slice(0, 10)),
    [sales, recoveryRows],
  );

  const recordMemberRecovery = useCallback((data: { memberId: string; memberName: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; note?: string }): Voucher | null => {
    if (guardFYLocked()) return null;
    if (!(data.amount > 0)) { toastRef.current({ title: 'मान्य राशि दर्ज करें', variant: 'destructive' }); return null; }
    if (!memberReceivableAccountId) { toastRef.current({ title: 'सदस्य प्राप्य खाता नहीं मिला', description: 'Member receivable account missing — reload once.', variant: 'destructive' }); return null; }
    const debit = data.mode === 'cash' ? CASH_ACCOUNT : (data.bankAccountId || getBankAccountIds(accounts)[0] || '3302');
    return addVoucher({
      type: 'receipt',
      date: data.date,
      debitAccountId: debit,
      creditAccountId: memberReceivableAccountId,
      amount: data.amount,
      memberId: data.memberId,
      narration: data.note?.trim() || `सदस्य उधार वसूली — ${data.memberName}`,
      createdBy: user?.name ?? 'Counter',
      refType: RECOVERY_REF,
      refId: data.memberId,
    });
  }, [memberReceivableAccountId, accounts, addVoucher, user]);

  const deleteMemberRecovery = useCallback((voucherId: string) => {
    if (guardFYLocked()) return;
    cancelVoucher(voucherId, 'Member recovery reversed', user?.name ?? 'Counter');
  }, [cancelVoucher, user]);

  const setMemberCreditLimit = useCallback((memberId: string, limit: number) => {
    updateMember(memberId, { creditLimit: Math.max(0, limit) });
  }, [updateMember]);

  return (
    <ConsumerDataContext.Provider value={{
      consumerReady: true, guardFYLocked,
      consumerPrices, addConsumerPrice, deleteConsumerPrice, resolvePrice,
      memberReceivableAccountId, memberRecoveries, recordMemberRecovery, deleteMemberRecovery,
      getMemberOutstanding, getMemberAgeing, setMemberCreditLimit,
    }}>
      {children}
    </ConsumerDataContext.Provider>
  );
}

export function useConsumerData() {
  const ctx = useContext(ConsumerDataContext);
  if (!ctx) throw new Error('useConsumerData must be used within a ConsumerProvider');
  return ctx;
}
