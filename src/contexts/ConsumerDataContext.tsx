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
import { resolveMemberReceivableAccountId, resolvePatronageDistributionAccountId, resolveRebatePayableAccountId, resolveDividendDistributionAccountId, resolveDividendPayableAccountId, resolveSalesReturnAccountId, MEMBER_RECEIVABLE_SUBTYPE, PATRONAGE_DISTRIBUTION_SUBTYPE, REBATE_PAYABLE_SUBTYPE, DIVIDEND_DISTRIBUTION_SUBTYPE, DIVIDEND_PAYABLE_SUBTYPE, SALES_RETURN_SUBTYPE } from '@/lib/consumer/accounts';
import { memberOutstanding, memberAgeing, type Ageing, type RecoveryRow } from '@/lib/consumer/credit';
import { computePatronageLines, computeDividendLines, patronageTotal, patronageLegs } from '@/lib/consumer/patronage';
import { poTotal, buildGrnInvoice } from '@/lib/consumer/purchaseOrder';
import { getBankAccountIds } from '@/lib/storage';
import { isUniqueViolation, nextDocSeq, MAX_RENUMBER_RETRIES } from '@/lib/dbRetry';
import type { ConsumerPrice, ConsumerPriceTier, Voucher, PatronageRun, PurchaseOrder, PurchaseOrderItem, Purchase, SalesReturn, SalesReturnItem, SalesReturnRefund, PurchaseReturn, PurchaseReturnItem, PurchaseReturnRefund } from '@/types';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

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

  // Purchase Order + GRN (approval-driven procurement). PO/GRN are tracking docs; goods
  // receipt creates the actual Purchase (invoice) via the shared addPurchase engine.
  purchaseOrders: PurchaseOrder[];
  createPurchaseOrder: (data: { supplierId?: string; supplierName: string; supplierPhone?: string; date: string; expectedDate?: string; items: PurchaseOrderItem[]; notes?: string }) => PurchaseOrder | null;
  approvePurchaseOrder: (id: string, data: { resolutionNo?: string }) => PurchaseOrder | null;
  /** Goods receipt (GRN): create the Purchase invoice for received qty, mark PO received. */
  receivePurchaseOrder: (id: string, data: { receivedQty?: Record<string, number>; paymentMode: 'cash' | 'bank' | 'credit'; bankAccountId?: string; date: string }) => Purchase | null;
  cancelPurchaseOrder: (id: string) => void;
  deletePurchaseOrder: (id: string) => void;

  // Sales Return (Feature 1) — reverse a posted sale; goods back in stock, income reduced,
  // GST output reversed, refund by cash/bank or adjusted against member/customer credit.
  salesReturns: SalesReturn[];
  addSalesReturn: (data: { originalSaleId: string; items: SalesReturnItem[]; refundMode: SalesReturnRefund; bankAccountId?: string; date: string }) => SalesReturn | null;
  deleteSalesReturn: (id: string) => void;

  purchaseReturns: PurchaseReturn[];
  addPurchaseReturn: (data: { originalPurchaseId: string; items: PurchaseReturnItem[]; refundMode: PurchaseReturnRefund; bankAccountId?: string; date: string }) => PurchaseReturn | null;
  deletePurchaseReturn: (id: string) => void;
}

const ConsumerDataContext = createContext<ConsumerDataContextValue | null>(null);

export function ConsumerProvider({ children }: { children: ReactNode }) {
  const { society, accounts, addAccount, vouchers, sales, members, addVoucher, cancelVoucher, updateMember, addPurchase, addStockMovement, purchases, suppliers, stockItems } = useData();
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
    const needSalesRet = resolveSalesReturnAccountId(accounts) === null;
    if (!needRecv && !needDist && !needPay && !needDivDist && !needDivPay && !needSalesRet) { seededRef.current = true; return; }
    seededRef.current = true; // attempt once per mount
    if (needRecv) addAccount({ name: 'Member Purchase Receivable', nameHi: 'सदस्य खरीद प्राप्य', type: 'asset', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '3300', subtype: MEMBER_RECEIVABLE_SUBTYPE });
    if (needDist) addAccount({ name: 'Patronage Rebate Distribution', nameHi: 'संरक्षण रिबेट वितरण', type: 'equity', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '1200', subtype: PATRONAGE_DISTRIBUTION_SUBTYPE });
    if (needPay) addAccount({ name: 'Member Rebate Payable', nameHi: 'देय सदस्य रिबेट', type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100', subtype: REBATE_PAYABLE_SUBTYPE });
    if (needDivDist) addAccount({ name: 'Dividend Distribution', nameHi: 'लाभांश वितरण', type: 'equity', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '1200', subtype: DIVIDEND_DISTRIBUTION_SUBTYPE });
    if (needDivPay) addAccount({ name: 'Dividend Payable', nameHi: 'देय लाभांश', type: 'liability', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '2100', subtype: DIVIDEND_PAYABLE_SUBTYPE });
    if (needSalesRet) addAccount({ name: 'Sales Return', nameHi: 'बिक्री वापसी', type: 'income', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '4100', subtype: SALES_RETURN_SUBTYPE });
  }, [user?.societyId, isSuperAdmin, society?.societyType, society?.fyLocked, accounts, addAccount]);

  const memberReceivableAccountId = resolveMemberReceivableAccountId(accounts);

  // ── Sales Returns (Feature 1) — state + load ────────────────────────────────
  const [salesReturns, setSalesReturnsState] = useState<SalesReturn[]>(() => storage.getSalesReturns());
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setSalesReturnsState([]); return; }
    supabase.from('sales_returns').select('*').eq('society_id', sid).then(
      ({ data, error }) => setSalesReturnsState(error || !data ? storage.getSalesReturns() : (data as SalesReturn[])),
      () => setSalesReturnsState(storage.getSalesReturns()),
    );
  }, [user?.societyId]);
  const activeReturns = salesReturns.filter(r => !r.isDeleted);

  const [purchaseReturns, setPurchaseReturnsState] = useState<PurchaseReturn[]>(() => storage.getPurchaseReturns());
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setPurchaseReturnsState([]); return; }
    supabase.from('purchase_returns').select('*').eq('society_id', sid).then(
      ({ data, error }) => setPurchaseReturnsState(error || !data ? storage.getPurchaseReturns() : (data as PurchaseReturn[])),
      () => setPurchaseReturnsState(storage.getPurchaseReturns()),
    );
  }, [user?.societyId]);

  const memberRecoveries = vouchers.filter(v => v.refType === RECOVERY_REF);
  const recoveryRows: RecoveryRow[] = memberRecoveries.map(v => ({ memberId: v.memberId, amount: v.amount, isDeleted: v.isDeleted }));

  const getMemberOutstanding = useCallback(
    (memberId: string) => memberOutstanding(sales, recoveryRows, memberId, activeReturns),
    [sales, recoveryRows, activeReturns],
  );
  const getMemberAgeing = useCallback(
    (memberId: string, asOf?: string) => memberAgeing(sales, recoveryRows, memberId, asOf || new Date().toISOString().slice(0, 10), activeReturns),
    [sales, recoveryRows, activeReturns],
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
    const lines = computePatronageLines(sales, members, { from: args.from, to: args.to, ratePct: args.ratePct }, activeReturns);
    if (lines.length === 0) { toastRef.current({ title: 'कोई राशि नहीं', description: 'इस अवधि में किसी सक्रिय सदस्य की खरीद नहीं।', variant: 'destructive' }); return null; }
    const total = patronageTotal(lines);
    const run: PatronageRun = { id: crypto.randomUUID(), kind: 'patronage', from: args.from, to: args.to, ratePct: args.ratePct, fyLabel: args.fyLabel, resolutionNo: '', lines, total, status: 'draft', amountPaid: 0, createdAt: new Date().toISOString() };
    commitPatronageRun(run, null);
    toastRef.current({ title: 'रिबेट रन बनाया (draft)', description: `${lines.length} सदस्य · कुल ₹${total.toLocaleString('en-IN')}` });
    return run;
  }, [sales, members, activeReturns, guardFYLocked, commitPatronageRun]);

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

  // ── Purchase Order + GRN (approval-driven procurement) ──────────────────────
  const [purchaseOrders, setPOState] = useState<PurchaseOrder[]>(() => storage.getConsumerPurchaseOrders());
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setPOState([]); return; }
    supabase.from('consumer_purchase_orders').select('*').eq('society_id', sid).then(
      ({ data, error }) => setPOState(error || !data ? storage.getConsumerPurchaseOrders() : (data as PurchaseOrder[])),
      () => setPOState(storage.getConsumerPurchaseOrders()),
    );
  }, [user?.societyId]);

  const commitPO = useCallback((next: PurchaseOrder, revertTo: PurchaseOrder | null, onFail?: () => void) => {
    setPOState(prev => { const u = prev.some(p => p.id === next.id) ? prev.map(p => p.id === next.id ? next : p) : [...prev, next]; storage.setConsumerPurchaseOrders(u); return u; });
    supabase.from('consumer_purchase_orders').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('PO save error:', error.message);
        setPOState(prev => { const u = revertTo ? prev.map(p => p.id === next.id ? revertTo : p) : prev.filter(p => p.id !== next.id); storage.setConsumerPurchaseOrders(u); return u; });
        onFail?.();
        toastRef.current({ title: 'खरीद ऑर्डर सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. (Pehli baar: consumer_purchase_orders block chalayein.)`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [societyId]);

  const createPurchaseOrder = useCallback((data: { supplierId?: string; supplierName: string; supplierPhone?: string; date: string; expectedDate?: string; items: PurchaseOrderItem[]; notes?: string }): PurchaseOrder | null => {
    if (guardFYLocked()) return null;
    const items = data.items.filter(i => i.itemId && i.qty > 0);
    if (items.length === 0) { toastRef.current({ title: 'कोई वस्तु नहीं', description: 'कम-से-कम एक वस्तु + मात्रा डालें।', variant: 'destructive' }); return null; }
    if (!data.supplierName?.trim()) { toastRef.current({ title: 'आपूर्तिकर्ता चुनें', variant: 'destructive' }); return null; }
    const fy = society.financialYear;
    const seq = purchaseOrders.filter(p => p.poNo?.includes(fy)).reduce((m, p) => { const x = p.poNo?.match(/\/(\d+)$/); return x ? Math.max(m, parseInt(x[1], 10)) : m; }, 0) + 1;
    const po: PurchaseOrder = {
      id: crypto.randomUUID(), poNo: `PO/${fy}/${String(seq).padStart(3, '0')}`,
      date: data.date, supplierId: data.supplierId, supplierName: data.supplierName.trim(), supplierPhone: data.supplierPhone,
      expectedDate: data.expectedDate, items, total: poTotal(items), status: 'draft', notes: data.notes, createdAt: new Date().toISOString(),
    };
    commitPO(po, null);
    toastRef.current({ title: `खरीद ऑर्डर बना — ${po.poNo}`, description: `${items.length} वस्तु · ₹${po.total.toLocaleString('en-IN')}` });
    return po;
  }, [purchaseOrders, society.financialYear, guardFYLocked, commitPO]);

  const approvePurchaseOrder = useCallback((id: string, data: { resolutionNo?: string }): PurchaseOrder | null => {
    if (guardFYLocked()) return null;
    const cur = purchaseOrders.find(p => p.id === id);
    if (!cur || cur.status !== 'draft') { toastRef.current({ title: 'केवल draft ऑर्डर approve होगा', variant: 'destructive' }); return null; }
    const next: PurchaseOrder = { ...cur, status: 'approved', approvedBy: user?.name || 'admin', approvedAt: new Date().toISOString(), resolutionNo: data.resolutionNo?.trim() || undefined };
    commitPO(next, cur);
    toastRef.current({ title: `✅ ऑर्डर approved — ${cur.poNo}` });
    return next;
  }, [purchaseOrders, guardFYLocked, commitPO, user]);

  const receivePurchaseOrder = useCallback((id: string, data: { receivedQty?: Record<string, number>; billedRate?: Record<string, number>; gstPct?: number; interState?: boolean; paymentMode: 'cash' | 'bank' | 'credit'; bankAccountId?: string; date: string }): Purchase | null => {
    if (guardFYLocked()) return null;
    const cur = purchaseOrders.find(p => p.id === id);
    if (!cur || cur.status !== 'approved') { toastRef.current({ title: 'पहले ऑर्डर approve करें', variant: 'destructive' }); return null; }
    const items: PurchaseOrderItem[] = cur.items.map(i => ({ ...i, receivedQty: data.receivedQty?.[i.itemId] ?? i.qty }));
    // ECR-21 Phase 2: value the invoice at the supplier's actual billed rate (default PO rate)
    // + real GST split, so input credit posts and the 3-way match sees a genuine variance.
    const invoice = buildGrnInvoice(items, { billedRate: data.billedRate, gstPct: data.gstPct, interState: data.interState });
    if (invoice.items.length === 0) { toastRef.current({ title: 'कोई माल प्राप्त नहीं', description: 'कम-से-कम एक वस्तु की received मात्रा डालें।', variant: 'destructive' }); return null; }
    try {
      const purchase = addPurchase({
        date: data.date, supplierName: cur.supplierName, supplierPhone: cur.supplierPhone, supplierId: cur.supplierId,
        items: invoice.items, totalAmount: invoice.netAmount, discount: 0, netAmount: invoice.netAmount,
        cgstPct: invoice.cgstPct, sgstPct: invoice.sgstPct, igstPct: invoice.igstPct, tdsPct: 0,
        cgstAmount: invoice.cgstAmount, sgstAmount: invoice.sgstAmount, igstAmount: invoice.igstAmount, tdsAmount: 0,
        taxAmount: invoice.taxAmount, grandTotal: invoice.grandTotal, paymentMode: data.paymentMode, bankAccountId: data.bankAccountId,
        narration: `PO ${cur.poNo} — माल प्राप्ति (GRN)`, createdBy: user?.name ?? 'admin',
      });
      if (!purchase?.id) return null;
      const next: PurchaseOrder = { ...cur, items, status: 'received', receivedAt: new Date().toISOString(), purchaseId: purchase.id, purchaseNo: purchase.purchaseNo };
      commitPO(next, cur);
      toastRef.current({ title: `✅ माल प्राप्त — ${purchase.purchaseNo}`, description: 'स्टॉक अपडेट + खरीद दर्ज' });
      return purchase;
    } catch (err) {
      toastRef.current({ title: 'माल प्राप्ति दर्ज नहीं हुई', description: err instanceof Error ? err.message : undefined, variant: 'destructive', duration: 10000 });
      return null;
    }
  }, [purchaseOrders, guardFYLocked, commitPO, addPurchase, user]);

  const cancelPurchaseOrder = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const cur = purchaseOrders.find(p => p.id === id);
    if (!cur) return;
    if (cur.status === 'received') { toastRef.current({ title: 'माल प्राप्त हो चुका', description: 'received ऑर्डर cancel नहीं होगा।', variant: 'destructive' }); return; }
    commitPO({ ...cur, status: 'cancelled' }, cur);
  }, [purchaseOrders, guardFYLocked, commitPO]);

  const deletePurchaseOrder = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const cur = purchaseOrders.find(p => p.id === id);
    if (!cur) return;
    commitPO({ ...cur, isDeleted: true }, cur);
  }, [purchaseOrders, guardFYLocked, commitPO]);

  // ── Sales Return (Feature 1) ────────────────────────────────────────────────
  const commitSalesReturn = useCallback((next: SalesReturn, revertTo: SalesReturn | null, onFail?: () => void) => {
    setSalesReturnsState(prev => { const u = prev.some(r => r.id === next.id) ? prev.map(r => r.id === next.id ? next : r) : [...prev, next]; storage.setSalesReturns(u); return u; });
    // On a duplicate returnNo (another till minted the same number), bump + retry.
    // revertTo === null means a fresh insert — the only case eligible for renumber.
    const attempt = (row: SalesReturn, tries: number) => {
      supabase.from('sales_returns').upsert(withSoc(row)).then(({ error }) => {
        if (!error) return;
        if (isUniqueViolation(error) && revertTo === null && tries < MAX_RENUMBER_RETRIES) {
          setSalesReturnsState(prev => {
            const fy = societyRef.current.financialYear;
            const seq = nextDocSeq(prev.filter(r => r.id !== row.id).map(r => r.returnNo), fy);
            const renumbered = { ...row, returnNo: `SRET/${fy}/${String(seq).padStart(3, '0')}` };
            const u = prev.map(r => r.id === row.id ? renumbered : r); storage.setSalesReturns(u);
            attempt(renumbered, tries + 1);
            return u;
          });
          return;
        }
        console.error('Sales return save error:', error.message);
        setSalesReturnsState(prev => { const u = revertTo ? prev.map(r => r.id === row.id ? revertTo : r) : prev.filter(r => r.id !== row.id); storage.setSalesReturns(u); return u; });
        onFail?.();
        toastRef.current({ title: 'बिक्री वापसी सेव नहीं हुई', description: `Cloud save fail — ${error.message}. (Pehli baar: sales_returns block chalayein.)`, variant: 'destructive', duration: 12000 });
      });
    };
    attempt(next, 0);
  }, [societyId]);

  const addSalesReturn = useCallback((data: { originalSaleId: string; items: SalesReturnItem[]; refundMode: SalesReturnRefund; bankAccountId?: string; date: string }): SalesReturn | null => {
    if (guardFYLocked()) return null;
    const sale = sales.find(s => s.id === data.originalSaleId && !(s as { isDeleted?: boolean }).isDeleted);
    if (!sale) { toastRef.current({ title: 'मूल बिक्री नहीं मिली', variant: 'destructive' }); return null; }
    const salesReturnAccId = resolveSalesReturnAccountId(accounts);
    if (!salesReturnAccId) { toastRef.current({ title: 'बिक्री वापसी खाता नहीं मिला', description: 'Sales Return account missing — reload once.', variant: 'destructive', duration: 12000 }); return null; }
    const items = data.items.filter(i => i.itemId && i.qty > 0).map(i => ({ ...i, amount: round2(i.qty * i.rate) }));
    if (items.length === 0) { toastRef.current({ title: 'कोई मात्रा नहीं', description: 'कम-से-कम एक वस्तु की वापसी मात्रा डालें।', variant: 'destructive' }); return null; }
    // Cap: returned qty (incl. prior returns) must not exceed sold qty.
    const priorByItem = new Map<string, number>();
    salesReturns.filter(r => !r.isDeleted && r.originalSaleId === sale.id).forEach(r => r.items.forEach(it => priorByItem.set(it.itemId, (priorByItem.get(it.itemId) || 0) + it.qty)));
    for (const it of items) {
      const sold = sale.items.find(si => si.itemId === it.itemId)?.qty || 0;
      if (it.qty + (priorByItem.get(it.itemId) || 0) > sold) { toastRef.current({ title: 'बेची गई मात्रा से अधिक वापसी नहीं', description: it.itemName, variant: 'destructive' }); return null; }
    }
    const netAmount = round2(items.reduce((s, i) => s + i.amount, 0));
    // Proportional GST reversal from the original sale.
    const ratio = (sale.netAmount || 0) > 0 ? netAmount / sale.netAmount : 0;
    const cgstAmount = round2((sale.cgstAmount || 0) * ratio);
    const sgstAmount = round2((sale.sgstAmount || 0) * ratio);
    const igstAmount = round2((sale.igstAmount || 0) * ratio);
    const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);
    const grandTotal = round2(netAmount + taxAmount);
    if (!(grandTotal > 0)) { toastRef.current({ title: 'वापसी राशि शून्य', variant: 'destructive' }); return null; }
    const fy = society.financialYear;
    const seq = salesReturns.filter(r => r.returnNo?.includes(fy)).reduce((m, r) => { const x = r.returnNo?.match(/\/(\d+)$/); return x ? Math.max(m, parseInt(x[1], 10)) : m; }, 0) + 1;
    const returnNo = `SRET/${fy}/${String(seq).padStart(3, '0')}`;
    // Refund destination: cash/bank, else adjust the buyer's credit (member receivable / debtor).
    const creditAccId = data.refundMode === 'cash' ? '3301'
      : data.refundMode === 'bank' ? (data.bankAccountId || getBankAccountIds(accounts)[0] || '3302')
      : (sale.memberId ? (resolveMemberReceivableAccountId(accounts) || '3303') : (sale.customerId ? '3303' : '3303'));
    const lid = () => crypto.randomUUID();
    const lines: { id: string; accountId: string; type: 'Dr' | 'Cr'; amount: number }[] = [{ id: lid(), accountId: salesReturnAccId, type: 'Dr', amount: netAmount }];
    if (taxAmount > 0) lines.push({ id: lid(), accountId: '2201', type: 'Dr', amount: taxAmount });
    lines.push({ id: lid(), accountId: creditAccId, type: 'Cr', amount: grandTotal });
    const voucher = addVoucher({
      type: 'credit_note', date: data.date,
      debitAccountId: salesReturnAccId, creditAccountId: creditAccId, amount: grandTotal, lines,
      narration: `बिक्री वापसी — ${sale.saleNo}`, refType: 'sale.return', refId: sale.id,
      createdBy: user?.name ?? 'admin',
    } as Parameters<typeof addVoucher>[0]);
    if (!voucher?.id) return null;
    // Goods back in stock (positive adjustment; canonical stock formula adds it).
    items.forEach(it => addStockMovement({ date: data.date, itemId: it.itemId, type: 'adjustment', qty: it.qty, rate: it.rate, amount: it.amount, referenceNo: returnNo, narration: `Sales return ${sale.saleNo}` }));
    const ret: SalesReturn = {
      id: lid(), returnNo, date: data.date, originalSaleId: sale.id, saleNo: sale.saleNo,
      customerName: sale.customerName, memberId: sale.memberId, customerId: sale.customerId,
      items, netAmount, cgstAmount, sgstAmount, igstAmount, taxAmount, grandTotal,
      refundMode: data.refundMode, bankAccountId: data.bankAccountId, voucherId: voucher.id,
      createdBy: user?.name ?? 'admin', createdAt: new Date().toISOString(),
    };
    commitSalesReturn(ret, null, () => cancelVoucher(voucher.id, 'Sales return rolled back (cloud save failed)', user?.name || 'System'));
    toastRef.current({ title: `✅ वापसी दर्ज — ${returnNo}`, description: `स्टॉक वापस + ₹${grandTotal.toLocaleString('en-IN')}` });
    return ret;
  }, [sales, salesReturns, accounts, society.financialYear, guardFYLocked, addVoucher, cancelVoucher, addStockMovement, commitSalesReturn, user]);

  const deleteSalesReturn = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const cur = salesReturns.find(r => r.id === id);
    if (!cur || cur.isDeleted) return;
    if (cur.voucherId) cancelVoucher(cur.voucherId, 'Sales return deleted', user?.name || 'System');
    // Reverse the stock that was added back (compensating negative adjustment).
    const today = new Date().toISOString().slice(0, 10);
    cur.items.forEach(it => addStockMovement({ date: today, itemId: it.itemId, type: 'adjustment', qty: -it.qty, rate: it.rate, amount: -it.amount, referenceNo: `${cur.returnNo}/REV`, narration: `Sales return reversed ${cur.saleNo}` }));
    commitSalesReturn({ ...cur, isDeleted: true }, cur);
  }, [salesReturns, guardFYLocked, cancelVoucher, addStockMovement, commitSalesReturn, user]);

  // ── Purchase Return / Returns Outward — Debit Note (Feature 2) ───────────────
  const commitPurchaseReturn = useCallback((next: PurchaseReturn, revertTo: PurchaseReturn | null, onFail?: () => void) => {
    setPurchaseReturnsState(prev => { const u = prev.some(r => r.id === next.id) ? prev.map(r => r.id === next.id ? next : r) : [...prev, next]; storage.setPurchaseReturns(u); return u; });
    const attempt = (row: PurchaseReturn, tries: number) => {
      supabase.from('purchase_returns').upsert(withSoc(row)).then(({ error }) => {
        if (!error) return;
        if (isUniqueViolation(error) && revertTo === null && tries < MAX_RENUMBER_RETRIES) {
          setPurchaseReturnsState(prev => {
            const fy = societyRef.current.financialYear;
            const seq = nextDocSeq(prev.filter(r => r.id !== row.id).map(r => r.returnNo), fy);
            const renumbered = { ...row, returnNo: `PRET/${fy}/${String(seq).padStart(3, '0')}` };
            const u = prev.map(r => r.id === row.id ? renumbered : r); storage.setPurchaseReturns(u);
            attempt(renumbered, tries + 1);
            return u;
          });
          return;
        }
        console.error('Purchase return save error:', error.message);
        setPurchaseReturnsState(prev => { const u = revertTo ? prev.map(r => r.id === row.id ? revertTo : r) : prev.filter(r => r.id !== row.id); storage.setPurchaseReturns(u); return u; });
        onFail?.();
        toastRef.current({ title: 'खरीद वापसी सेव नहीं हुई', description: `Cloud save fail — ${error.message}. (Pehli baar: purchase_returns block chalayein.)`, variant: 'destructive', duration: 12000 });
      });
    };
    attempt(next, 0);
  }, [societyId]);

  const addPurchaseReturn = useCallback((data: { originalPurchaseId: string; items: PurchaseReturnItem[]; refundMode: PurchaseReturnRefund; bankAccountId?: string; date: string }): PurchaseReturn | null => {
    if (guardFYLocked()) return null;
    const purchase = purchases.find(p => p.id === data.originalPurchaseId && !(p as { isDeleted?: boolean }).isDeleted);
    if (!purchase) { toastRef.current({ title: 'मूल खरीद नहीं मिली', variant: 'destructive' }); return null; }
    const items = data.items.filter(i => i.itemId && i.qty > 0).map(i => ({ ...i, amount: round2(i.qty * i.rate) }));
    if (items.length === 0) { toastRef.current({ title: 'कोई मात्रा नहीं', description: 'कम-से-कम एक वस्तु की वापसी मात्रा डालें।', variant: 'destructive' }); return null; }
    // Cap: returned qty (incl. prior returns) must not exceed purchased qty.
    const priorByItem = new Map<string, number>();
    purchaseReturns.filter(r => !r.isDeleted && r.originalPurchaseId === purchase.id).forEach(r => r.items.forEach(it => priorByItem.set(it.itemId, (priorByItem.get(it.itemId) || 0) + it.qty)));
    for (const it of items) {
      const bought = purchase.items.find(pi => pi.itemId === it.itemId)?.qty || 0;
      if (it.qty + (priorByItem.get(it.itemId) || 0) > bought) { toastRef.current({ title: 'खरीदी गई मात्रा से अधिक वापसी नहीं', description: it.itemName, variant: 'destructive' }); return null; }
    }
    const netAmount = round2(items.reduce((s, i) => s + i.amount, 0));
    // Proportional GST-ITC reversal from the original purchase.
    const ratio = (purchase.netAmount || 0) > 0 ? netAmount / purchase.netAmount : 0;
    const cgstAmount = round2((purchase.cgstAmount || 0) * ratio);
    const sgstAmount = round2((purchase.sgstAmount || 0) * ratio);
    const igstAmount = round2((purchase.igstAmount || 0) * ratio);
    const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);
    const grandTotal = round2(netAmount + taxAmount);
    if (!(grandTotal > 0)) { toastRef.current({ title: 'वापसी राशि शून्य', variant: 'destructive' }); return null; }
    const fy = society.financialYear;
    const seq = purchaseReturns.filter(r => r.returnNo?.includes(fy)).reduce((m, r) => { const x = r.returnNo?.match(/\/(\d+)$/); return x ? Math.max(m, parseInt(x[1], 10)) : m; }, 0) + 1;
    const returnNo = `PRET/${fy}/${String(seq).padStart(3, '0')}`;
    // Refund source: cash/bank received back, else adjust the supplier's payable.
    const supplierAccId = purchase.supplierId ? (suppliers.find(s => s.id === purchase.supplierId)?.accountId || '2101') : '2101';
    const debitAccId = data.refundMode === 'cash' ? '3301'
      : data.refundMode === 'bank' ? (data.bankAccountId || getBankAccountIds(accounts)[0] || '3302')
      : supplierAccId;
    const lid = () => crypto.randomUUID();
    // Cr: Purchases A/c — split by each item's purchaseAccountId (faithful inverse of the purchase Dr).
    const totalItemAmount = items.reduce((s, i) => s + i.amount, 0) || 1;
    const purchaseAccBuckets = new Map<string, number>();
    items.forEach(it => {
      const acc = stockItems.find(s => s.id === it.itemId)?.purchaseAccountId || '5101';
      const itemNet = (it.amount / totalItemAmount) * netAmount;
      purchaseAccBuckets.set(acc, (purchaseAccBuckets.get(acc) || 0) + itemNet);
    });
    const lines: { id: string; accountId: string; type: 'Dr' | 'Cr'; amount: number }[] = [];
    purchaseAccBuckets.forEach((amt, accId) => { const r = round2(amt); if (r > 0) lines.push({ id: lid(), accountId: accId, type: 'Cr', amount: r }); });
    if (taxAmount > 0) lines.push({ id: lid(), accountId: '3310', type: 'Cr', amount: taxAmount });
    lines.push({ id: lid(), accountId: debitAccId, type: 'Dr', amount: grandTotal });
    const primaryCrAcc = purchaseAccBuckets.size > 0 ? [...purchaseAccBuckets.keys()][0] : '5101';
    const voucher = addVoucher({
      type: 'debit_note', date: data.date,
      debitAccountId: debitAccId, creditAccountId: primaryCrAcc, amount: grandTotal, lines,
      narration: `खरीद वापसी — ${purchase.purchaseNo}`, refType: 'purchase.return', refId: purchase.id,
      createdBy: user?.name ?? 'admin',
    } as Parameters<typeof addVoucher>[0]);
    if (!voucher?.id) return null;
    // Goods leave stock (negative adjustment; canonical stock formula subtracts it).
    items.forEach(it => addStockMovement({ date: data.date, itemId: it.itemId, type: 'adjustment', qty: -it.qty, rate: it.rate, amount: -it.amount, referenceNo: returnNo, narration: `Purchase return ${purchase.purchaseNo}` }));
    const ret: PurchaseReturn = {
      id: lid(), returnNo, date: data.date, originalPurchaseId: purchase.id, purchaseNo: purchase.purchaseNo,
      supplierName: purchase.supplierName, supplierId: purchase.supplierId,
      items, netAmount, cgstAmount, sgstAmount, igstAmount, taxAmount, grandTotal,
      refundMode: data.refundMode, bankAccountId: data.bankAccountId, voucherId: voucher.id,
      createdBy: user?.name ?? 'admin', createdAt: new Date().toISOString(),
    };
    commitPurchaseReturn(ret, null, () => cancelVoucher(voucher.id, 'Purchase return rolled back (cloud save failed)', user?.name || 'System'));
    toastRef.current({ title: `✅ खरीद वापसी दर्ज — ${returnNo}`, description: `स्टॉक कम + ₹${grandTotal.toLocaleString('en-IN')}` });
    return ret;
  }, [purchases, purchaseReturns, suppliers, stockItems, accounts, society.financialYear, guardFYLocked, addVoucher, cancelVoucher, addStockMovement, commitPurchaseReturn, user]);

  const deletePurchaseReturn = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const cur = purchaseReturns.find(r => r.id === id);
    if (!cur || cur.isDeleted) return;
    if (cur.voucherId) cancelVoucher(cur.voucherId, 'Purchase return deleted', user?.name || 'System');
    // Restore the stock that left (compensating positive adjustment).
    const today = new Date().toISOString().slice(0, 10);
    cur.items.forEach(it => addStockMovement({ date: today, itemId: it.itemId, type: 'adjustment', qty: it.qty, rate: it.rate, amount: it.amount, referenceNo: `${cur.returnNo}/REV`, narration: `Purchase return reversed ${cur.purchaseNo}` }));
    commitPurchaseReturn({ ...cur, isDeleted: true }, cur);
  }, [purchaseReturns, guardFYLocked, cancelVoucher, addStockMovement, commitPurchaseReturn, user]);

  return (
    <ConsumerDataContext.Provider value={{
      consumerReady: true, guardFYLocked,
      consumerPrices, addConsumerPrice, deleteConsumerPrice, resolvePrice,
      memberReceivableAccountId, memberRecoveries, recordMemberRecovery, deleteMemberRecovery,
      getMemberOutstanding, getMemberAgeing, setMemberCreditLimit,
      patronageRuns, createPatronageRun, createDividendRun, approvePatronageRun, recordPatronagePayment, deletePatronageRun,
      purchaseOrders, createPurchaseOrder, approvePurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder, deletePurchaseOrder,
      salesReturns, addSalesReturn, deleteSalesReturn,
      purchaseReturns, addPurchaseReturn, deletePurchaseReturn,
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
