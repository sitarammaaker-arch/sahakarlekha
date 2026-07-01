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
import { computeGross, netPayable, sumDeductions, outstanding, settlementLegs } from '@/lib/dairy/settlement';
import type { DairyRateChart, MilkEntry, DairySettlement, DairyDeductionLine, Voucher } from '@/types';

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

  // Milk collection entries (D2 — absorbed from the former self-contained MilkCollection page)
  milkEntries: MilkEntry[];
  addMilkEntry: (data: Omit<MilkEntry, 'id' | 'createdAt'>) => MilkEntry;
  deleteMilkEntry: (id: string) => void;

  // Farmer settlement cycle (D3) — per-member, per-cycle payout (the authoritative posting path)
  settlements: DairySettlement[];
  /** Draft a settlement for a member's cycle; gross = accepted milk value in [from,to]. */
  createDairySettlement: (args: { memberId: string; from: string; to: string }) => DairySettlement;
  addDairyDeduction: (args: { settlementId: string; type: string; accountId: string; amount: number; remarks?: string }) => void;
  removeDairyDeduction: (args: { settlementId: string; lineId: string }) => void;
  /** Approve: lock net + post the compound voucher (Dr milk-cost gross / Cr payable net / Cr recoveries). */
  approveDairySettlement: (settlementId: string) => DairySettlement;
  /** Pay the (partial) net: Dr payable / Cr bank|cash; advances amountPaid. */
  recordDairySettlementPayment: (args: { settlementId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string }) => Voucher;
  deleteDairySettlement: (settlementId: string) => void;
}

const DairyDataContext = createContext<DairyDataContextValue | null>(null);

export function DairyProvider({ children }: { children: ReactNode }) {
  const { society, accounts, members, addAccount, addVoucher, cancelVoucher } = useData();
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
  const [milkEntries, setMilkEntriesState] = useState<MilkEntry[]>(() => storage.getMilkEntries());
  const [settlements, setSettlementsState] = useState<DairySettlement[]>(() => storage.getDairySettlements());

  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setRateChartsState([]); return; }
    supabase.from('dairy_rate_charts').select('*').eq('society_id', sid).then(
      ({ data, error }) => setRateChartsState(error || !data ? storage.getDairyRateCharts() : (data as DairyRateChart[])),
      () => setRateChartsState(storage.getDairyRateCharts()),
    );
  }, [user?.societyId]);

  // Milk entries — SSOT load; C-B: adopt any rows left in the former page's bespoke
  // `sl_milk_entries_${sid}` key (offline-only entries that never synced) so nothing is lost.
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setMilkEntriesState([]); return; }
    let legacy: MilkEntry[] = [];
    try { const raw = localStorage.getItem(`sl_milk_entries_${sid}`); if (raw) legacy = JSON.parse(raw) as MilkEntry[]; } catch { /* ignore */ }
    const merge = (cloud: MilkEntry[]): MilkEntry[] => {
      if (!Array.isArray(legacy) || legacy.length === 0) return cloud;
      const ids = new Set(cloud.map(r => r.id));
      const merged = [...cloud, ...legacy.filter(r => r && r.id && !ids.has(r.id))];
      storage.setMilkEntries(merged);
      return merged;
    };
    supabase.from('milk_entries').select('*').eq('society_id', sid).then(
      ({ data, error }) => setMilkEntriesState(merge(error || !data ? storage.getMilkEntries() : (data as MilkEntry[]))),
      () => setMilkEntriesState(merge(storage.getMilkEntries())),
    );
  }, [user?.societyId]);

  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setSettlementsState([]); return; }
    supabase.from('dairy_settlements').select('*').eq('society_id', sid).then(
      ({ data, error }) => setSettlementsState(error || !data ? storage.getDairySettlements() : (data as DairySettlement[])),
      () => setSettlementsState(storage.getDairySettlements()),
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

  const addMilkEntry = useCallback((data: Omit<MilkEntry, 'id' | 'createdAt'>): MilkEntry => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as MilkEntry;
    const entry: MilkEntry = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setMilkEntriesState(prev => { const u = [...prev, entry]; storage.setMilkEntries(u); return u; });
    supabase.from('milk_entries').upsert(withSoc(entry)).then(({ error }) => {
      if (error) {
        console.error('Milk entry save error:', error.message);
        setMilkEntriesState(prev => { const r = prev.filter(e => e.id !== entry.id); storage.setMilkEntries(r); return r; });
        toastRef.current({ title: 'एंट्री सेव नहीं हुई', description: `Cloud save fail — ${error.message}. Refresh karne par data lose nahi hoga. (Pehli baar: supabase-tables.sql ka milk_entries block chalayein.)`, variant: 'destructive', duration: 12000 });
      }
    });
    return entry;
  }, [societyId]);

  const deleteMilkEntry = useCallback((id: string) => {
    if (guardFYLocked()) return;
    setMilkEntriesState(prev => {
      const before = prev.find(e => e.id === id);
      const u = prev.filter(e => e.id !== id);
      storage.setMilkEntries(u);
      if (before) supabase.from('milk_entries').delete().eq('id', id).then(({ error }) => {
        if (error) {
          setMilkEntriesState(p => { const r = [...p, before]; storage.setMilkEntries(r); return r; });
          toastRef.current({ title: 'डिलीट नहीं हुआ', description: `Cloud delete fail — ${error.message}. एंट्री वापस ले आई गई।`, variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  // ── Farmer settlement cycle (D3) — the authoritative per-member posting path ──
  const persistSettlement = useCallback((next: DairySettlement, revertTo: DairySettlement | null, onFail?: () => void) => {
    supabase.from('dairy_settlements').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('Settlement save error:', error.message);
        setSettlementsState(prev => { const u = revertTo ? prev.map(s => s.id === next.id ? revertTo : s) : prev.filter(s => s.id !== next.id); storage.setDairySettlements(u); return u; });
        onFail?.();
        toastRef.current({ title: 'सेटलमेंट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas. (Pehli baar: dairy_settlements block chalayein.)`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [societyId]);

  const commitSettlement = useCallback((next: DairySettlement, revertTo: DairySettlement | null, onFail?: () => void) => {
    setSettlementsState(prev => {
      const u = prev.some(s => s.id === next.id) ? prev.map(s => s.id === next.id ? next : s) : [...prev, next];
      storage.setDairySettlements(u); return u;
    });
    persistSettlement(next, revertTo, onFail);
  }, [persistSettlement]);

  const createDairySettlement = useCallback((args: { memberId: string; from: string; to: string }): DairySettlement => {
    const sentinel = { id: '' } as DairySettlement;
    if (guardFYLocked()) return sentinel;
    const member = members.find(m => m.id === args.memberId);
    if (!member) { toastRef.current({ title: 'सदस्य नहीं मिला', variant: 'destructive' }); return sentinel; }
    const gross = computeGross(milkEntries, args.memberId, args.from, args.to);
    if (gross <= 0) { toastRef.current({ title: 'कोई दूध नहीं', description: 'इस सदस्य का इस अवधि में कोई स्वीकृत संकलन नहीं।', variant: 'destructive' }); return sentinel; }
    const s: DairySettlement = {
      id: crypto.randomUUID(), memberId: member.id, memberName: member.name,
      from: args.from, to: args.to, gross, deductionLines: [], netPayable: gross, amountPaid: 0,
      status: 'draft', createdAt: new Date().toISOString(),
    };
    commitSettlement(s, null);
    toastRef.current({ title: 'सेटलमेंट बनाया (draft)', description: `${member.name} — सकल ₹${gross.toLocaleString('en-IN')}` });
    return s;
  }, [members, milkEntries, commitSettlement]);

  const addDairyDeduction = useCallback((args: { settlementId: string; type: string; accountId: string; amount: number; remarks?: string }) => {
    if (guardFYLocked()) return;
    const cur = settlements.find(s => s.id === args.settlementId);
    if (!cur || cur.status !== 'draft') { toastRef.current({ title: 'बदल नहीं सकते', description: 'Approved सेटलमेंट में कटौती नहीं जुड़ सकती।', variant: 'destructive' }); return; }
    if (!(args.amount > 0) || !args.accountId) { toastRef.current({ title: 'अधूरी कटौती', variant: 'destructive' }); return; }
    const line: DairyDeductionLine = { id: crypto.randomUUID(), type: args.type, accountId: args.accountId, amount: +args.amount.toFixed(2), remarks: args.remarks };
    const lines = [...cur.deductionLines, line];
    if (sumDeductions(lines) > cur.gross + 0.005) { toastRef.current({ title: 'कटौती सकल से ज़्यादा', description: 'कुल कटौती दूध-मूल्य से अधिक नहीं हो सकती।', variant: 'destructive' }); return; }
    const next: DairySettlement = { ...cur, deductionLines: lines, netPayable: netPayable(cur.gross, lines) };
    commitSettlement(next, cur);
  }, [settlements, commitSettlement]);

  const removeDairyDeduction = useCallback((args: { settlementId: string; lineId: string }) => {
    if (guardFYLocked()) return;
    const cur = settlements.find(s => s.id === args.settlementId);
    if (!cur || cur.status !== 'draft') return;
    const lines = cur.deductionLines.filter(l => l.id !== args.lineId);
    commitSettlement({ ...cur, deductionLines: lines, netPayable: netPayable(cur.gross, lines) }, cur);
  }, [settlements, commitSettlement]);

  const approveDairySettlement = useCallback((settlementId: string): DairySettlement => {
    const sentinel = { id: '' } as DairySettlement;
    if (guardFYLocked()) return sentinel;
    const cur = settlements.find(s => s.id === settlementId);
    if (!cur || cur.status !== 'draft') { toastRef.current({ title: 'पहले से approved', variant: 'destructive' }); return sentinel; }
    const milkCost = resolveMilkProcurementAccountId(accounts);
    const payable = resolveMilkPayableAccountId(accounts);
    if (!milkCost || !payable) { toastRef.current({ title: 'दुग्ध खाते नहीं मिले', description: 'Milk procurement / payable ledger missing.', variant: 'destructive', duration: 12000 }); return sentinel; }
    const legs = settlementLegs(cur.gross, cur.deductionLines, milkCost, payable);
    if (legs.length === 0) { toastRef.current({ title: 'पोस्ट नहीं हुआ', description: 'Legs balanced nahi (कटौती > सकल या खाता गुम).', variant: 'destructive' }); return sentinel; }
    const net = netPayable(cur.gross, cur.deductionLines);
    const voucher = addVoucher({
      type: 'journal', date: cur.to,
      debitAccountId: milkCost, creditAccountId: payable, amount: cur.gross,
      lines: legs.map(l => ({ id: crypto.randomUUID(), accountId: l.accountId, type: l.type, amount: l.amount })),
      narration: `दूध सेटलमेंट ${cur.memberName} — ${cur.from} से ${cur.to} (सकल ₹${cur.gross}, नेट ₹${net})`,
      refType: 'dairy.settlement', refId: cur.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0]);
    if (!voucher?.id) return sentinel;
    const no = 'DS/' + String(settlements.filter(s => s.status === 'approved' && !s.isDeleted).length + 1).padStart(4, '0');
    const next: DairySettlement = { ...cur, status: 'approved', settlementNo: no, netPayable: net, voucherId: voucher.id, approvedAt: new Date().toISOString(), approvedBy: user?.name || 'admin' };
    commitSettlement(next, cur, () => cancelVoucher(voucher.id, 'Settlement approval rolled back (cloud save failed)', user?.name || 'System'));
    toastRef.current({ title: '✅ सेटलमेंट approved', description: `${no} — नेट देय ₹${net.toLocaleString('en-IN')}` });
    return next;
  }, [settlements, accounts, addVoucher, cancelVoucher, commitSettlement, user]);

  const recordDairySettlementPayment = useCallback((args: { settlementId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string }): Voucher => {
    const sentinel = { id: '' } as Voucher;
    if (guardFYLocked()) return sentinel;
    const cur = settlements.find(s => s.id === args.settlementId);
    if (!cur || cur.status !== 'approved') { toastRef.current({ title: 'पहले approve करें', variant: 'destructive' }); return sentinel; }
    const out = outstanding(cur.netPayable, cur.amountPaid);
    const amount = +Math.min(args.amount, out).toFixed(2);
    if (!(amount > 0)) { toastRef.current({ title: 'कुछ बकाया नहीं', description: 'पूरा भुगतान हो चुका है।', variant: 'destructive' }); return sentinel; }
    const payable = resolveMilkPayableAccountId(accounts);
    if (!payable) { toastRef.current({ title: 'देय खाता नहीं मिला', variant: 'destructive' }); return sentinel; }
    const creditAcc = args.mode === 'bank' ? (args.bankAccountId || '3302') : '3301';
    const voucher = addVoucher({
      type: 'payment', date: args.date,
      debitAccountId: payable, creditAccountId: creditAcc, amount,
      lines: [{ id: crypto.randomUUID(), accountId: payable, type: 'Dr', amount }, { id: crypto.randomUUID(), accountId: creditAcc, type: 'Cr', amount }],
      narration: `दूध भुगतान ${cur.memberName} — ${cur.settlementNo || ''}${args.reference ? ` (${args.reference})` : ''}`,
      refType: 'dairy.settlement.payment', refId: cur.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0]);
    if (!voucher?.id) return sentinel;
    const next: DairySettlement = { ...cur, amountPaid: +(cur.amountPaid + amount).toFixed(2) };
    commitSettlement(next, cur, () => cancelVoucher(voucher.id, 'Payment rolled back (cloud save failed)', user?.name || 'System'));
    toastRef.current({ title: '✅ भुगतान दर्ज', description: `₹${amount.toLocaleString('en-IN')} — बकाया ₹${outstanding(cur.netPayable, next.amountPaid).toLocaleString('en-IN')}` });
    return voucher;
  }, [settlements, accounts, addVoucher, cancelVoucher, commitSettlement, user]);

  const deleteDairySettlement = useCallback((settlementId: string) => {
    if (guardFYLocked()) return;
    const cur = settlements.find(s => s.id === settlementId);
    if (!cur) return;
    if (cur.status === 'approved' && cur.amountPaid > 0.005) { toastRef.current({ title: 'भुगतान मौजूद', description: 'पहले भुगतान reverse करें, फिर हटाएँ।', variant: 'destructive' }); return; }
    if (cur.status === 'approved' && cur.voucherId) cancelVoucher(cur.voucherId, 'Settlement deleted', user?.name || 'System');
    commitSettlement({ ...cur, isDeleted: true }, cur);
  }, [settlements, cancelVoucher, commitSettlement, user]);

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
      milkEntries,
      addMilkEntry,
      deleteMilkEntry,
      settlements,
      createDairySettlement,
      addDairyDeduction,
      removeDairyDeduction,
      approveDairySettlement,
      recordDairySettlementPayment,
      deleteDairySettlement,
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
