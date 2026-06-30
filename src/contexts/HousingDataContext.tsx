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
import type { HousingFlat, MaintenanceBill, Voucher } from '@/types';

interface HousingDataContextValue {
  housingFlats: HousingFlat[];
  addHousingFlat: (data: Omit<HousingFlat, 'id' | 'createdAt'>) => HousingFlat;
  updateHousingFlat: (id: string, data: Partial<HousingFlat>) => void;
  deleteHousingFlat: (id: string) => void;

  maintenanceBills: MaintenanceBill[];
  generateMaintenanceBills: (data: { period: string; date?: string; flatIds?: string[] }) => MaintenanceBill[];
  deleteMaintenanceBill: (id: string) => void;
  recordMaintenanceCollection: (data: { billId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string; remarks?: string }) => Voucher;
}

const HousingDataContext = createContext<HousingDataContextValue | undefined>(undefined);

export function HousingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Compose core (never fork): FY-lock + chart from society; vouchers via the core engine.
  const { society, accounts, addVoucher, cancelVoucher } = useData();
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

  // Load when the society changes; Supabase is SSOT, localStorage is offline fallback.
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setHousingFlatsState([]); setMaintenanceBillsState([]); return; }
    supabase.from('housing_flats').select('*').eq('society_id', sid).then(
      ({ data, error }) => setHousingFlatsState(error || !data ? storage.getHousingFlats() : (data as unknown as HousingFlat[])),
      () => setHousingFlatsState(storage.getHousingFlats()),
    );
    supabase.from('maintenance_bills').select('*').eq('society_id', sid).then(
      ({ data, error }) => setMaintenanceBillsState(error || !data ? storage.getMaintenanceBills() : (data as unknown as MaintenanceBill[])),
      () => setMaintenanceBillsState(storage.getMaintenanceBills()),
    );
  }, [user?.societyId]);

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
    for (const flat of targets) {
      if (billed.has(flat.id)) continue;
      const amount = +flat.monthlyMaintenance.toFixed(2);
      const billId = crypto.randomUUID();
      const v = addVoucher({
        type: 'journal', date,
        debitAccountId: '3303', creditAccountId: '4101', amount,
        narration: `रखरखाव बिल ${data.period} — ${flat.flatNo}`,
        refType: 'maintenance.bill', refId: billId,
        memberId: flat.memberId,
        createdBy: user?.name || 'System',
        lines: [
          { id: lid(), accountId: '3303', type: 'Dr', amount },
          { id: lid(), accountId: '4101', type: 'Cr', amount },
        ],
      });
      if (!v.id) continue;
      created.push({ id: billId, billNo: `${data.period}/${flat.flatNo}`, flatId: flat.id, flatNo: flat.flatNo, memberId: flat.memberId, period: data.period, date, amount, voucherId: v.id, paidAmount: 0, status: 'unpaid', isDeleted: false, createdAt: new Date().toISOString() });
    }
    if (created.length === 0) {
      toastRef.current({ title: 'कोई नया बिल नहीं', description: 'इस अवधि के लिए सभी पात्र फ्लैट पहले से बिल हो चुके हैं या कोई पात्र फ्लैट नहीं।', variant: 'default', duration: 8000 });
      return [];
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
  }, [accounts, housingFlats, maintenanceBills, addVoucher, cancelVoucher, user]);

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
    const creditAcc = '3303';
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

  return (
    <HousingDataContext.Provider value={{
      housingFlats, addHousingFlat, updateHousingFlat, deleteHousingFlat,
      maintenanceBills, generateMaintenanceBills, deleteMaintenanceBill, recordMaintenanceCollection,
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
