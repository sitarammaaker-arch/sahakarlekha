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
import { resolveMemberReceivableAccountId, resolvePatronageDistributionAccountId, resolveRebatePayableAccountId, resolveDividendDistributionAccountId, resolveDividendPayableAccountId, MEMBER_RECEIVABLE_SUBTYPE, PATRONAGE_DISTRIBUTION_SUBTYPE, REBATE_PAYABLE_SUBTYPE, DIVIDEND_DISTRIBUTION_SUBTYPE, DIVIDEND_PAYABLE_SUBTYPE } from '@/lib/consumer/accounts';
import { memberOutstanding, memberAgeing, type Ageing, type RecoveryRow } from '@/lib/consumer/credit';
import { computePatronageLines, computeDividendLines, patronageTotal, patronageLegs } from '@/lib/consumer/patronage';
import { getBankAccountIds } from '@/lib/storage';
import type { ConsumerPrice, ConsumerPriceTier, Voucher, PatronageRun } from '@/types';

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

  // Patronage rebate (C4) — year-end member rebate on purchases, resolution-gated.
  patronageRuns: PatronageRun[];
  /** Preview + create a draft run: rebate = ratePct% of each active member's purchases in [from,to]. */
  createPatronageRun: (args: { from: string; to: string; ratePct: number; fyLabel?: string }) => PatronageRun | null;
  /** Preview + create a draft DIVIDEND run: ratePct% of each active member's paid-up share capital. */
  createDividendRun: (args: { ratePct: number; fyLabel?: string }) => PatronageRun | null;
  /** Approve (resolution no. mandatory) → posts Dr patronage-distribution / Cr member-rebate-payable. */
  approvePatronageRun: (args: { runId: string; resolutionNo: string; resolutionDate?: string }) => PatronageRun | null;
  /** Pay out an approved run: Dr rebate-payable / Cr Cash|Bank (clamped to outstanding). */
  recordPatronagePayment: (args: { runId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }) => Voucher | null;
  deletePatronageRun: (runId: string) => void;
}

const ConsumerDataContext = createContext<ConsumerDataContextValue | null>(null);

export function ConsumerProvider({ children }: { children: ReactNode }) {
  const { society, accounts, addAccount, vouchers, sales, members, addVoucher, cancelVoucher, updateMember } = useData();
  const { user, isSuperAdmin } = useAuth();
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
    // Only seed once AUTHENTICATED — addAccount writes to the society-scoped `accounts` table,
    // which RLS rejects pre-login (no session → the "SOC001" fallback fails the with-check, e.g.
    // when a consumer society is still cached on the login screen). Guard BEFORE setting
    // seededRef so it retries after login. (Deps include user?.societyId.)
    if (!user?.societyId) return;
    // A platform super-admin is JWT-less (societyId 'PLATFORM', no Supabase auth.uid) → the
    // society-scoped `accounts` RLS rejects any insert ("new row violates row-level security
    // policy for table accounts"). Never seed the chart from the super-admin context; a real
    // society user (with a session) seeds it on their normal login.
    if (isSuperAdmin) return;
    if (society?.societyType !== 'consumer') return;
    if (!accounts || accounts.length === 0) return;
    if (society.fyLocked) return; // seeding mutates the chart; retry on a later unlocked load
    const needRecv = resolveMemberReceivableAccountId(accounts) === null;
    const needDist = resolvePatronageDistributionAccountId(accounts) === null;
    const needPay = resolveRebatePayableAccountId(accounts) === null;
    const needDivDist = resolveDividendDistributionAccountId(accounts) === null;
    const needDivPay = resolveDividendPayableAccountId(accounts) === null;
    if (!needRecv && !needDist && !needPay && !needDivDist && !needDivPay) { seededRef.current = true; return; }
    seededRef.current = true; // attempt once per mount
    if (needRecv) addAccount({ name: 'Member Purchase Receivable', nameHi: 'सदस्य खरीद प्राप्य', type: 'asset', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '3300', subtype: MEMBER_RECEIVABLE_SUBTYPE });
    if (needDist) addAccount({ name: 'Patronage Rebate Distribution', nameHi: 'संरक्षण रिबेट वितरण', type: 'equity', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '1200', subtype: PATRONAGE_DISTRIBUTION_SUBTYPE });
    if (needPay) addAccount({ name: 'Member Rebate Payable', nameHi: 'देय सदस्य रिबेट', type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100', subtype: REBATE_PAYABLE_SUBTYPE });
    if (needDivDist) addAccount({ name: 'Dividend Distribution', nameHi: 'लाभांश वितरण', type: 'equity', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '1200', subtype: DIVIDEND_DISTRIBUTION_SUBTYPE });
    if (needDivPay) addAccount({ name: 'Dividend Payable', nameHi: 'देय लाभांश', type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100', subtype: DIVIDEND_PAYABLE_SUBTYPE });
  }, [user?.societyId, isSuperAdmin, society?.societyType, society?.fyLocked, accounts, addAccount]);

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

  // ── C4: patronage rebate runs (draft → approve → pay), mirrors Dairy distribution ──
  const [patronageRuns, setPatronageRunsState] = useState<PatronageRun[]>(() => storage.getConsumerPatronageRuns());
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setPatronageRunsState([]); return; }
    supabase.from('consumer_patronage_runs').select('*').eq('society_id', sid).then(
      ({ data, error }) => setPatronageRunsState(error || !data ? storage.getConsumerPatronageRuns() : (data as PatronageRun[])),
      () => setPatronageRunsState(storage.getConsumerPatronageRuns()),
    );
  }, [user?.societyId]);

  const commitPatronageRun = useCallback((next: PatronageRun, revertTo: PatronageRun | null, onFail?: () => void) => {
    setPatronageRunsState(prev => { const u = prev.some(r => r.id === next.id) ? prev.map(r => r.id === next.id ? next : r) : [...prev, next]; storage.setConsumerPatronageRuns(u); return u; });
    supabase.from('consumer_patronage_runs').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('Patronage save error:', error.message);
        setPatronageRunsState(prev => { const u = revertTo ? prev.map(r => r.id === next.id ? revertTo : r) : prev.filter(r => r.id !== next.id); storage.setConsumerPatronageRuns(u); return u; });
        onFail?.();
        toastRef.current({ title: 'रिबेट रन सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data. (Pehli baar: consumer_patronage_runs block chalayein.)`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [societyId]);

  const createPatronageRun = useCallback((args: { from: string; to: string; ratePct: number; fyLabel?: string }): PatronageRun | null => {
    if (guardFYLocked()) return null;
    if (!(args.ratePct > 0)) { toastRef.current({ title: 'दर ज़रूरी', description: 'धनात्मक रिबेट % डालें।', variant: 'destructive' }); return null; }
    const lines = computePatronageLines(sales, members, { from: args.from, to: args.to, ratePct: args.ratePct });
    if (lines.length === 0) { toastRef.current({ title: 'कोई राशि नहीं', description: 'इस अवधि में किसी सक्रिय सदस्य की खरीद नहीं।', variant: 'destructive' }); return null; }
    const total = patronageTotal(lines);
    const run: PatronageRun = { id: crypto.randomUUID(), kind: 'patronage', from: args.from, to: args.to, ratePct: args.ratePct, fyLabel: args.fyLabel, resolutionNo: '', lines, total, status: 'draft', amountPaid: 0, createdAt: new Date().toISOString() };
    commitPatronageRun(run, null);
    toastRef.current({ title: 'रिबेट रन बनाया (draft)', description: `${lines.length} सदस्य · कुल ₹${total.toLocaleString('en-IN')}` });
    return run;
  }, [sales, members, guardFYLocked, commitPatronageRun]);

  const createDividendRun = useCallback((args: { ratePct: number; fyLabel?: string }): PatronageRun | null => {
    if (guardFYLocked()) return null;
    if (!(args.ratePct > 0)) { toastRef.current({ title: 'दर ज़रूरी', description: 'धनात्मक लाभांश % डालें।', variant: 'destructive' }); return null; }
    const lines = computeDividendLines(members, args.ratePct);
    if (lines.length === 0) { toastRef.current({ title: 'कोई राशि नहीं', description: 'किसी सक्रिय सदस्य की शेयर पूंजी नहीं।', variant: 'destructive' }); return null; }
    const total = patronageTotal(lines);
    const run: PatronageRun = { id: crypto.randomUUID(), kind: 'dividend', from: '', to: '', ratePct: args.ratePct, fyLabel: args.fyLabel, resolutionNo: '', lines, total, status: 'draft', amountPaid: 0, createdAt: new Date().toISOString() };
    commitPatronageRun(run, null);
    toastRef.current({ title: 'लाभांश रन बनाया (draft)', description: `${lines.length} सदस्य · कुल ₹${total.toLocaleString('en-IN')}` });
    return run;
  }, [members, guardFYLocked, commitPatronageRun]);

  const approvePatronageRun = useCallback((args: { runId: string; resolutionNo: string; resolutionDate?: string }): PatronageRun | null => {
    if (guardFYLocked()) return null;
    const cur = patronageRuns.find(r => r.id === args.runId);
    if (!cur || cur.status !== 'draft') { toastRef.current({ title: 'पहले से approved', variant: 'destructive' }); return null; }
    if (!args.resolutionNo || !args.resolutionNo.trim()) { toastRef.current({ title: 'प्रस्ताव संख्या आवश्यक', description: 'रिबेट वितरण के लिए सभा/बोर्ड प्रस्ताव संख्या ज़रूरी है।', variant: 'destructive', duration: 10000 }); return null; }
    const isDiv = cur.kind === 'dividend';
    const label = isDiv ? 'लाभांश' : 'संरक्षण रिबेट';
    const distAcc = isDiv ? resolveDividendDistributionAccountId(accounts) : resolvePatronageDistributionAccountId(accounts);
    const payAcc = isDiv ? resolveDividendPayableAccountId(accounts) : resolveRebatePayableAccountId(accounts);
    if (!distAcc || !payAcc) { toastRef.current({ title: 'खाते नहीं मिले', description: 'Distribution / payable ledger missing — reload once.', variant: 'destructive', duration: 12000 }); return null; }
    const legs = patronageLegs(cur.total, distAcc, payAcc);
    if (legs.length === 0) { toastRef.current({ title: 'पोस्ट नहीं हुआ', variant: 'destructive' }); return null; }
    const voucher = addVoucher({
      type: 'journal', date: args.resolutionDate || new Date().toISOString().slice(0, 10),
      debitAccountId: distAcc, creditAccountId: payAcc, amount: cur.total,
      lines: legs.map(l => ({ id: crypto.randomUUID(), accountId: l.accountId, type: l.type, amount: l.amount })),
      narration: `${label} वितरण — प्रस्ताव ${args.resolutionNo} — कुल ₹${cur.total} (${cur.lines.length} सदस्य)`,
      refType: isDiv ? 'consumer.dividend' : 'consumer.patronage', refId: cur.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0]);
    if (!voucher?.id) return null;
    const next: PatronageRun = { ...cur, status: 'approved', resolutionNo: args.resolutionNo.trim(), resolutionDate: args.resolutionDate, voucherId: voucher.id, approvedAt: new Date().toISOString(), approvedBy: user?.name || 'admin' };
    commitPatronageRun(next, cur, () => cancelVoucher(voucher.id, `${label} approval rolled back (cloud save failed)`, user?.name || 'System'));
    toastRef.current({ title: `✅ ${label} approved`, description: `प्रस्ताव ${args.resolutionNo} — कुल ₹${cur.total.toLocaleString('en-IN')}` });
    return next;
  }, [patronageRuns, accounts, addVoucher, cancelVoucher, guardFYLocked, commitPatronageRun, user]);

  const recordPatronagePayment = useCallback((args: { runId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }): Voucher | null => {
    if (guardFYLocked()) return null;
    const cur = patronageRuns.find(r => r.id === args.runId);
    if (!cur || cur.status !== 'approved') { toastRef.current({ title: 'पहले approve करें', variant: 'destructive' }); return null; }
    const outstandingAmt = +(cur.total - cur.amountPaid).toFixed(2);
    const amount = +Math.min(args.amount, outstandingAmt).toFixed(2);
    if (!(amount > 0)) { toastRef.current({ title: 'कुछ बकाया नहीं', variant: 'destructive' }); return null; }
    const isDiv = cur.kind === 'dividend';
    const payAcc = isDiv ? resolveDividendPayableAccountId(accounts) : resolveRebatePayableAccountId(accounts);
    if (!payAcc) { toastRef.current({ title: 'देय खाता नहीं मिला', variant: 'destructive' }); return null; }
    const creditAcc = args.mode === 'bank' ? (args.bankAccountId || getBankAccountIds(accounts)[0] || '3302') : CASH_ACCOUNT;
    const voucher = addVoucher({
      type: 'payment', date: args.date,
      debitAccountId: payAcc, creditAccountId: creditAcc, amount,
      lines: [{ id: crypto.randomUUID(), accountId: payAcc, type: 'Dr', amount }, { id: crypto.randomUUID(), accountId: creditAcc, type: 'Cr', amount }],
      narration: `${isDiv ? 'लाभांश' : 'संरक्षण रिबेट'} भुगतान — प्रस्ताव ${cur.resolutionNo}`,
      refType: isDiv ? 'consumer.dividend.payment' : 'consumer.patronage.payment', refId: cur.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0]);
    if (!voucher?.id) return null;
    const next: PatronageRun = { ...cur, amountPaid: +(cur.amountPaid + amount).toFixed(2) };
    commitPatronageRun(next, cur, () => cancelVoucher(voucher.id, 'Patronage payment rolled back (cloud save failed)', user?.name || 'System'));
    toastRef.current({ title: '✅ भुगतान दर्ज', description: `₹${amount.toLocaleString('en-IN')}` });
    return voucher;
  }, [patronageRuns, accounts, addVoucher, cancelVoucher, guardFYLocked, commitPatronageRun, user]);

  const deletePatronageRun = useCallback((runId: string) => {
    if (guardFYLocked()) return;
    const cur = patronageRuns.find(r => r.id === runId);
    if (!cur) return;
    if (cur.status === 'approved' && cur.amountPaid > 0.005) { toastRef.current({ title: 'भुगतान मौजूद', description: 'पहले भुगतान reverse करें, फिर हटाएँ।', variant: 'destructive' }); return; }
    if (cur.status === 'approved' && cur.voucherId) cancelVoucher(cur.voucherId, 'Patronage run deleted', user?.name || 'System');
    commitPatronageRun({ ...cur, isDeleted: true }, cur);
  }, [patronageRuns, cancelVoucher, guardFYLocked, commitPatronageRun, user]);

  return (
    <ConsumerDataContext.Provider value={{
      consumerReady: true, guardFYLocked,
      consumerPrices, addConsumerPrice, deleteConsumerPrice, resolvePrice,
      memberReceivableAccountId, memberRecoveries, recordMemberRecovery, deleteMemberRecovery,
      getMemberOutstanding, getMemberAgeing, setMemberCreditLimit,
      patronageRuns, createPatronageRun, createDividendRun, approvePatronageRun, recordPatronagePayment, deletePatronageRun,
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
