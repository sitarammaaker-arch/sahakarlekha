/**
 * HousingDataContext — Housing-cooperative domain state & workflows ONLY.
 *
 * This context does NOT fork the accounting / voucher / posting / reports / audit engines.
 * Those stay in DataContext (the single SSOT). HousingDataContext COMPOSES the core: it
 * reads `society` (FY-lock) and `accounts` from useData(), `societyId` from useAuth(), and
 * calls useData().addVoucher / cancelVoucher for all accounting. The posting law for the
 * domain lives in src/lib/housing/postingRules.ts (wired in a later delivery).
 *
 * Persistence mirrors the proven Labour/Member pattern: optimistic local + localStorage +
 * Supabase upsert, with RULE-1 visible rollback on cloud failure and a RULE-6 FY-lock guard
 * on every mutation. Behaviour here is migrated verbatim from DataContext (Delivery H0) —
 * same posting (Dr 3303 Maintenance Receivable / Cr 4101 Maintenance Charges), same
 * idempotent bill-run, same cascade-on-delete — only the home of the state changed.
 */
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import * as storage from '@/lib/storage';
import { ACCOUNT_IDS, getBankAccountIds } from '@/lib/storage';
import { computeBillLines, demandLegs, billTotal } from '@/lib/housing/billing';
import type { HousingFlat, MaintenanceBill, MaintenanceBillLine, HousingChargeHead, Voucher, LedgerAccount } from '@/types';

interface HousingDataContextValue {
  housingFlats: HousingFlat[];
  addHousingFlat: (data: Omit<HousingFlat, 'id' | 'createdAt'>) => HousingFlat;
  updateHousingFlat: (id: string, data: Partial<HousingFlat>) => void;
  deleteHousingFlat: (id: string) => void;

  maintenanceBills: MaintenanceBill[];
  generateMaintenanceBills: (data: { period: string; date?: string; flatIds?: string[] }) => MaintenanceBill[];
  deleteMaintenanceBill: (id: string) => void;
  recordMaintenanceCollection: (data: { billId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string; remarks?: string }) => Voucher;

  chargeHeads: HousingChargeHead[];
  addChargeHead: (data: Omit<HousingChargeHead, 'id' | 'createdAt'>) => HousingChargeHead;
  updateChargeHead: (id: string, data: Partial<HousingChargeHead>) => void;
  deleteChargeHead: (id: string) => void;

  // Fund (reserve) operations — each posts a tagged voucher; the fund account IS the record.
  recordFundContribution: (data: { fundAccountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; remarks?: string }) => Voucher;
  recordFundInterest: (data: { fundAccountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; remarks?: string }) => Voucher;
  recordFundUtilisation: (data: { fundAccountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; purpose?: string }) => Voucher;
}

const HousingDataContext = createContext<HousingDataContextValue | undefined>(undefined);

export function HousingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Compose core (never fork): FY-lock + chart from society; sub-ledgers + vouchers via the core engine.
  const { society, accounts, members, addAccount, addVoucher, cancelVoucher } = useData();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const societyId = user?.societyId || 'SOC001';
  const withSoc = <T extends object>(d: T) => ({ ...d, society_id: societyId });

  const guardFYLocked = (): boolean => {
    if (society?.fyLocked) {
      toastRef.current({ title: 'FY Locked', description: 'Financial Year audit-locked है — डेटा बदला नहीं जा सकता।', variant: 'destructive' });
      return true;
    }
    return false;
  };

  const [housingFlats, setHousingFlatsState] = useState<HousingFlat[]>(() => storage.getHousingFlats());
  const [maintenanceBills, setMaintenanceBillsState] = useState<MaintenanceBill[]>(() => storage.getMaintenanceBills());
  const [chargeHeads, setChargeHeadsState] = useState<HousingChargeHead[]>(() => storage.getHousingChargeHeads());

  // Load when the society changes; Supabase is SSOT, localStorage is offline fallback.
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setHousingFlatsState([]); setMaintenanceBillsState([]); setChargeHeadsState([]); return; }
    supabase.from('housing_flats').select('*').eq('society_id', sid).then(
      ({ data, error }) => setHousingFlatsState(error || !data ? storage.getHousingFlats() : (data as unknown as HousingFlat[])),
      () => setHousingFlatsState(storage.getHousingFlats()),
    );
    supabase.from('maintenance_bills').select('*').eq('society_id', sid).then(
      ({ data, error }) => setMaintenanceBillsState(error || !data ? storage.getMaintenanceBills() : (data as unknown as MaintenanceBill[])),
      () => setMaintenanceBillsState(storage.getMaintenanceBills()),
    );
    supabase.from('housing_charge_heads').select('*').eq('society_id', sid).then(
      ({ data, error }) => setChargeHeadsState(error || !data ? storage.getHousingChargeHeads() : (data as unknown as HousingChargeHead[])),
      () => setChargeHeadsState(storage.getHousingChargeHeads()),
    );
  }, [user?.societyId]);

  // ── Charge-head schedule (society-wide master; plain-table persistence + RULE-1 rollback) ──
  const addChargeHead = useCallback((data: Omit<HousingChargeHead, 'id' | 'createdAt'>): HousingChargeHead => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as HousingChargeHead;
    const head: HousingChargeHead = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setChargeHeadsState(prev => { const u = [...prev, head]; storage.setHousingChargeHeads(u); return u; });
    supabase.from('housing_charge_heads').upsert(withSoc(head)).then(({ error }) => {
      if (error) {
        console.error('Charge head save error:', error.message);
        setChargeHeadsState(prev => { const r = prev.filter(h => h.id !== head.id); storage.setHousingChargeHeads(r); return r; });
        toastRef.current({ title: 'शुल्क मद सेव नहीं हुई', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return head;
  }, []);

  const updateChargeHead = useCallback((id: string, data: Partial<HousingChargeHead>) => {
    if (guardFYLocked()) return;
    const old = chargeHeads.find(h => h.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setChargeHeadsState(prev => { const u = prev.map(h => h.id === id ? updated : h); storage.setHousingChargeHeads(u); return u; });
    supabase.from('housing_charge_heads').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('Charge head update error:', error.message);
        setChargeHeadsState(prev => { const u = prev.map(h => h.id === id ? old : h); storage.setHousingChargeHeads(u); return u; });
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [chargeHeads]);

  const deleteChargeHead = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = chargeHeads.find(h => h.id === id);
    setChargeHeadsState(prev => { const u = prev.filter(h => h.id !== id); storage.setHousingChargeHeads(u); return u; });
    supabase.from('housing_charge_heads').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Charge head delete error:', error.message);
        if (old) setChargeHeadsState(prev => { const u = [...prev, old]; storage.setHousingChargeHeads(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [chargeHeads]);

  // ── Flat / Unit master (Member-pattern persistence + RULE-1 rollback, RULE-6 FY-lock) ──
  const addHousingFlat = useCallback((data: Omit<HousingFlat, 'id' | 'createdAt'>): HousingFlat => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as HousingFlat;
    const flat: HousingFlat = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setHousingFlatsState(prev => { const u = [...prev, flat]; storage.setHousingFlats(u); return u; });
    supabase.from('housing_flats').upsert(withSoc(flat)).then(({ error }) => {
      if (error) {
        console.error('Housing flat save error:', error.message);
        setHousingFlatsState(prev => { const r = prev.filter(f => f.id !== flat.id); storage.setHousingFlats(r); return r; });
        toastRef.current({ title: 'फ्लैट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return flat;
  }, []);

  const updateHousingFlat = useCallback((id: string, data: Partial<HousingFlat>) => {
    if (guardFYLocked()) return;
    const old = housingFlats.find(f => f.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setHousingFlatsState(prev => { const u = prev.map(f => f.id === id ? updated : f); storage.setHousingFlats(u); return u; });
    supabase.from('housing_flats').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('Housing flat update error:', error.message);
        setHousingFlatsState(prev => { const u = prev.map(f => f.id === id ? old : f); storage.setHousingFlats(u); return u; });
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [housingFlats]);

  const deleteHousingFlat = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = housingFlats.find(f => f.id === id);
    setHousingFlatsState(prev => { const u = prev.filter(f => f.id !== id); storage.setHousingFlats(u); return u; });
    supabase.from('housing_flats').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Housing flat delete error:', error.message);
        if (old) setHousingFlatsState(prev => { const u = [...prev, old]; storage.setHousingFlats(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [housingFlats]);

  // ── Housing Maintenance Billing — one bill per flat per period; posts a receivable ──
  // voucher (Dr 3303 Maintenance Receivable / Cr 4101 Maintenance Charges) tagged to the
  // owner member. RULE-6 FY-lock, RULE-1 rollback (cancel the voucher if the bill row fails).
  const generateMaintenanceBills = useCallback((data: { period: string; date?: string; flatIds?: string[] }): MaintenanceBill[] => {
    if (guardFYLocked()) return [];
    if (!/^\d{4}-\d{2}$/.test(data.period || '')) {
      toastRef.current({ title: 'अवधि चुनें', description: 'महीना (YYYY-MM) चुनें। (Select a billing month)', variant: 'destructive', duration: 8000 });
      return [];
    }
    if (!accounts.some(a => a.id === '3303') || !accounts.some(a => a.id === '4101')) {
      toastRef.current({ title: 'खाते नहीं मिले', description: 'रखरखाव खाते (3303 / 4101) इस समिति के चार्ट में नहीं हैं। Housing chart सेट करें।', variant: 'destructive', duration: 10000 });
      return [];
    }
    const targets = housingFlats.filter(f => !f.isDeleted && (f.monthlyMaintenance || 0) > 0 && (!data.flatIds || data.flatIds.includes(f.id)));
    const billed = new Set(maintenanceBills.filter(b => !b.isDeleted && b.period === data.period).map(b => b.flatId));
    const date = data.date || new Date().toISOString().split('T')[0];
    const created: MaintenanceBill[] = [];
    const lid = () => crypto.randomUUID();

    // Resolve (find-or-create, deduped per owner member within AND across runs) the member's
    // receivable sub-ledger — a leaf under 3303 (mirrors the Departments sub-ledger pattern; 3303
    // stays a leaf so historical postings never orphan). Vacant flats fall back to the 3303 control.
    const recCache = new Map<string, string>();
    const flatRecUpdates = new Map<string, string>();  // flatId → receivableAccountId to backfill
    const resolveReceivable = (memberId?: string): string => {
      if (!memberId) return '3303';
      const cached = recCache.get(memberId);
      if (cached) return cached;
      const existing = housingFlats.find(f => !f.isDeleted && f.memberId === memberId && f.receivableAccountId && accounts.some(a => a.id === f.receivableAccountId))?.receivableAccountId;
      let accId = existing;
      if (!accId) {
        const mem = members.find(m => m.id === memberId);
        const label = mem ? `${mem.name} (${mem.memberId})` : memberId.slice(0, 8);
        const acc = addAccount({
          name: `Maintenance Receivable — ${label}`,
          nameHi: `प्राप्य रखरखाव — ${mem?.name || label}`,
          type: 'asset', openingBalance: 0, openingBalanceType: 'debit',
          isSystem: false, isGroup: false, parentId: '3303',
        } as Omit<LedgerAccount, 'id'>);
        accId = acc.id;
      }
      recCache.set(memberId, accId);
      return accId;
    };

    // Active society charge-head schedule (empty → single monthlyMaintenance line for back-compat).
    const activeHeads = chargeHeads.filter(h => !h.isDeleted && h.isActive !== false);
    for (const flat of targets) {
      if (billed.has(flat.id)) continue;
      const billLines: MaintenanceBillLine[] = activeHeads.length > 0
        ? computeBillLines(flat, chargeHeads)
        : (flat.monthlyMaintenance || 0) > 0
          ? [{ chargeHeadId: '', name: 'Maintenance', accountId: '4101', isFund: false, amount: +flat.monthlyMaintenance.toFixed(2) }]
          : [];
      const amount = billTotal(billLines);
      if (amount <= 0) continue;   // nothing billable for this flat this period
      const rec = resolveReceivable(flat.memberId);
      if (flat.memberId && flat.receivableAccountId !== rec) flatRecUpdates.set(flat.id, rec);
      const billId = crypto.randomUUID();
      // Balanced multi-leg demand: Dr <member receivable> total / Cr each head's own account
      // (income → I&E, fund → 1202/1204 corpus directly, pass-through → liability).
      const legs = demandLegs(rec, billLines);
      const v = addVoucher({
        type: 'journal', date,
        debitAccountId: rec, creditAccountId: billLines[0].accountId, amount,
        narration: `रखरखाव बिल ${data.period} — ${flat.flatNo}`,
        refType: 'maintenance.bill', refId: billId,
        memberId: flat.memberId,
        createdBy: user?.name || 'System',
        lines: legs.map(l => ({ id: lid(), accountId: l.accountId, type: l.type, amount: l.amount })),
      });
      if (!v.id) continue;
      created.push({ id: billId, billNo: `${data.period}/${flat.flatNo}`, flatId: flat.id, flatNo: flat.flatNo, memberId: flat.memberId, period: data.period, date, amount, voucherId: v.id, receivableAccountId: rec, lines: billLines, paidAmount: 0, status: 'unpaid', isDeleted: false, createdAt: new Date().toISOString() });
    }
    if (created.length === 0) {
      toastRef.current({ title: 'कोई नया बिल नहीं', description: 'इस अवधि के लिए सभी पात्र फ्लैट पहले से बिल हो चुके हैं या कोई पात्र फ्लैट नहीं।', variant: 'default', duration: 8000 });
      return [];
    }
    // Backfill receivableAccountId onto billed flats so future runs reuse the same sub-ledger
    // (best-effort; the bill's own receivableAccountId is the authoritative link for collection).
    if (flatRecUpdates.size > 0) {
      setHousingFlatsState(prev => {
        const u = prev.map(f => flatRecUpdates.has(f.id) ? { ...f, receivableAccountId: flatRecUpdates.get(f.id) } : f);
        storage.setHousingFlats(u); return u;
      });
      flatRecUpdates.forEach((rec, flatId) => {
        const flat = housingFlats.find(f => f.id === flatId);
        if (flat) supabase.from('housing_flats').upsert(withSoc({ ...flat, receivableAccountId: rec })).then(({ error }) => { if (error) console.warn('Flat receivable backfill (non-fatal):', error.message); });
      });
    }
    setMaintenanceBillsState(prev => { const u = [...prev, ...created]; storage.setMaintenanceBills(u); return u; });
    created.forEach(bill => {
      supabase.from('maintenance_bills').upsert(withSoc(bill)).then(({ error }) => {
        if (error) {
          console.error('Maintenance bill save error:', error.message);
          setMaintenanceBillsState(prev => { const r = prev.filter(b => b.id !== bill.id); storage.setMaintenanceBills(r); return r; });
          if (bill.voucherId) cancelVoucher(bill.voucherId, 'Maintenance bill save failed (auto-rollback)', user?.name || 'System');
          toastRef.current({ title: 'बिल सेव नहीं हुआ', description: `${bill.billNo} — cloud save fail (${error.message}). इसका receivable voucher वापस ले लिया गया।`, variant: 'destructive', duration: 12000 });
        }
      });
    });
    toastRef.current({ title: 'रखरखाव बिल बने', description: `${created.length} बिल · अवधि ${data.period}`, duration: 6000 });
    return created;
  }, [accounts, housingFlats, maintenanceBills, chargeHeads, members, addAccount, addVoucher, cancelVoucher, user]);

  const deleteMaintenanceBill = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const bill = maintenanceBills.find(b => b.id === id && !b.isDeleted);
    if (!bill) return;
    // RULE 3: cancel the linked receivable voucher so no ghost receivable/income lingers.
    if (bill.voucherId) cancelVoucher(bill.voucherId, `Maintenance bill ${bill.billNo} deleted`, user?.name || 'System');
    setMaintenanceBillsState(prev => { const u = prev.filter(b => b.id !== id); storage.setMaintenanceBills(u); return u; });
    supabase.from('maintenance_bills').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Maintenance bill delete error:', error.message);
        setMaintenanceBillsState(prev => { const u = [...prev, bill]; storage.setMaintenanceBills(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [maintenanceBills, cancelVoucher, user]);

  // Maintenance Collection — record a receipt against a bill: Dr Cash/Bank / Cr 3303
  // Maintenance Receivable. Advances bill.paidAmount/status. Voucher is the authoritative
  // base; on a bill-update failure the voucher is cancelled and progress reverts (RULE 1).
  const recordMaintenanceCollection = useCallback((data: { billId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string; remarks?: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'receipt', date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const bill = maintenanceBills.find(b => b.id === data.billId && !b.isDeleted);
    if (!bill) { toastRef.current({ title: 'बिल नहीं मिला', description: 'Bill not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    const outstanding = +(bill.amount - bill.paidAmount).toFixed(2);
    if (!(data.amount > 0)) { toastRef.current({ title: 'राशि डालें', description: 'भुगतान राशि 0 से अधिक होनी चाहिए।', variant: 'destructive', duration: 8000 }); return sentinel; }
    if (data.amount > outstanding) { toastRef.current({ title: 'राशि बकाया से अधिक', description: `भुगतान ₹${data.amount} बकाया ₹${outstanding} से अधिक नहीं हो सकता।`, variant: 'destructive', duration: 9000 }); return sentinel; }
    // Credit the exact account the demand debited (owner-member sub-ledger, or the 3303 control).
    const creditAcc = bill.receivableAccountId || '3303';
    const debitAcc = data.mode === 'cash' ? ACCOUNT_IDS.CASH : (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    const ref = data.reference?.trim() ? ` · Ref ${data.reference.trim()}` : '';
    const rem = data.remarks?.trim() ? ` · ${data.remarks.trim()}` : '';
    const voucher = addVoucher({
      type: 'receipt', date: data.date,
      debitAccountId: debitAcc, creditAccountId: creditAcc, amount: data.amount,
      narration: `रखरखाव वसूली — ${bill.billNo}${ref}${rem}`,
      refType: 'maintenance.receipt', refId: bill.id,
      memberId: bill.memberId,
      createdBy: user?.name || 'System',
      lines: [
        { id: lid(), accountId: debitAcc, type: 'Dr', amount: data.amount },
        { id: lid(), accountId: creditAcc, type: 'Cr', amount: data.amount },
      ],
    });
    if (!voucher.id) return sentinel;
    const newPaid = +(bill.paidAmount + data.amount).toFixed(2);
    const status: MaintenanceBill['status'] = newPaid >= bill.amount - 0.005 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
    const next: MaintenanceBill = { ...bill, paidAmount: newPaid, status };
    setMaintenanceBillsState(prev => { const u = prev.map(b => b.id === bill.id ? next : b); storage.setMaintenanceBills(u); return u; });
    supabase.from('maintenance_bills').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('Maintenance collection bill-update error:', error.message);
        setMaintenanceBillsState(prev => { const u = prev.map(b => b.id === bill.id ? bill : b); storage.setMaintenanceBills(u); return u; });
        cancelVoucher(voucher.id, 'Maintenance collection rolled back (bill update failed)', user?.name || 'System');
        toastRef.current({ title: 'वसूली सेव नहीं हुई', description: `Cloud save fail — ${error.message}. रसीद वापस ले ली गई; दोबारा करें।`, variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: 'वसूली दर्ज हुई', description: `${bill.billNo} · ₹${data.amount} · ${status === 'paid' ? 'पूर्ण' : 'आंशिक'}`, duration: 6000 });
    return voucher;
  }, [maintenanceBills, accounts, addVoucher, cancelVoucher, user]);

  // ── Fund (reserve) movement — Dr bank / Cr fund (contribution, interest) or Dr fund / Cr bank
  // (utilisation). The voucher is the record; addVoucher owns the two-step persist + L1 rollback,
  // so no separate entity to reconcile. FY-lock via guardFYLocked.
  const FUND_NARRATION: Record<string, string> = {
    'fund.contribution': 'निधि अंशदान', 'fund.interest': 'निधि ब्याज', 'fund.utilisation': 'निधि उपयोग',
  };
  const postFundMovement = useCallback((data: { fundAccountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; note?: string; refType: string; toFund: boolean }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'journal', date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const fund = accounts.find(a => a.id === data.fundAccountId);
    if (!fund) { toastRef.current({ title: 'निधि खाता नहीं मिला', description: 'Fund account not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    if (!(data.amount > 0)) { toastRef.current({ title: 'राशि डालें', description: 'राशि 0 से अधिक होनी चाहिए।', variant: 'destructive', duration: 8000 }); return sentinel; }
    const bankAcc = data.mode === 'cash' ? ACCOUNT_IDS.CASH : (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    const note = data.note?.trim() ? ` · ${data.note.trim()}` : '';
    const debitAcc = data.toFund ? bankAcc : data.fundAccountId;   // toFund → Dr bank/Cr fund; else Dr fund/Cr bank
    const creditAcc = data.toFund ? data.fundAccountId : bankAcc;
    const v = addVoucher({
      type: data.toFund ? 'receipt' : 'payment', date: data.date,
      debitAccountId: debitAcc, creditAccountId: creditAcc, amount: data.amount,
      narration: `${FUND_NARRATION[data.refType] || 'निधि'} — ${fund.nameHi || fund.name}${note}`,
      refType: data.refType, refId: data.fundAccountId,
      createdBy: user?.name || 'System',
      lines: [
        { id: lid(), accountId: debitAcc, type: 'Dr', amount: data.amount },
        { id: lid(), accountId: creditAcc, type: 'Cr', amount: data.amount },
      ],
    });
    if (v.id) toastRef.current({ title: 'निधि प्रविष्टि दर्ज', description: `${fund.nameHi || fund.name} · ₹${data.amount}`, duration: 6000 });
    return v;
  }, [accounts, addVoucher, user]);

  const recordFundContribution = useCallback((data: { fundAccountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; remarks?: string }): Voucher =>
    postFundMovement({ ...data, note: data.remarks, refType: 'fund.contribution', toFund: true }), [postFundMovement]);
  const recordFundInterest = useCallback((data: { fundAccountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; remarks?: string }): Voucher =>
    postFundMovement({ ...data, note: data.remarks, refType: 'fund.interest', toFund: true }), [postFundMovement]);
  const recordFundUtilisation = useCallback((data: { fundAccountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; purpose?: string }): Voucher =>
    postFundMovement({ ...data, note: data.purpose, refType: 'fund.utilisation', toFund: false }), [postFundMovement]);

  return (
    <HousingDataContext.Provider value={{
      housingFlats, addHousingFlat, updateHousingFlat, deleteHousingFlat,
      maintenanceBills, generateMaintenanceBills, deleteMaintenanceBill, recordMaintenanceCollection,
      chargeHeads, addChargeHead, updateChargeHead, deleteChargeHead,
      recordFundContribution, recordFundInterest, recordFundUtilisation,
    }}>
      {children}
    </HousingDataContext.Provider>
  );
}

export function useHousingData(): HousingDataContextValue {
  const ctx = useContext(HousingDataContext);
  if (!ctx) throw new Error('useHousingData must be used within a HousingProvider');
  return ctx;
}
