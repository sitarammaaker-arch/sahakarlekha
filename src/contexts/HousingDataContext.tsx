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
import { computeBillLines, demandLegs, billTotal, round2, gstLineForBill } from '@/lib/housing/billing';
import { plannedBillInterest } from '@/lib/housing/arrears';
import { buildMemberStatement } from '@/lib/housing/statement';
import type { HousingFlat, MaintenanceBill, MaintenanceBillLine, HousingChargeHead, HousingFundInvestment, HousingComplaint, HousingParking, HousingTransfer, HousingInsurance, HousingAmc, HousingDocument, HousingBuilding, Voucher, LedgerAccount } from '@/types';

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
  recordFundUtilisation: (data: { fundAccountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; purpose?: string; resolutionNo?: string; resolutionDate?: string }) => Voucher;

  // Arrears: accrue simple interest on overdue principal up to a date (idempotent per bill).
  runArrearsInterest: (data: { asOnDate: string; annualRatePct: number; flatIds?: string[] }) => { count: number; total: number };

  // Fund investments (FDR earmarking): Dr investment asset / Cr bank; the fund account is unchanged.
  fundInvestments: HousingFundInvestment[];
  addFundInvestment: (data: { fundAccountId: string; investmentAccountId: string; amount: number; date: string; mode: 'cash' | 'bank'; bankAccountId?: string; instrument?: string; institution?: string; maturityDate?: string; interestRate?: number }) => HousingFundInvestment;
  redeemFundInvestment: (data: { id: string; date: string; mode: 'cash' | 'bank'; bankAccountId?: string; maturityAmount?: number }) => void;
  deleteFundInvestment: (id: string) => void;

  // Operational & governance registers (non-financial CRUD; transfer posts the fee/premium).
  complaints: HousingComplaint[];
  addComplaint: (data: Omit<HousingComplaint, 'id' | 'complaintNo' | 'createdAt'>) => HousingComplaint;
  updateComplaint: (id: string, data: Partial<HousingComplaint>) => void;
  deleteComplaint: (id: string) => void;

  parkingSlots: HousingParking[];
  addParking: (data: Omit<HousingParking, 'id' | 'createdAt'>) => HousingParking;
  updateParking: (id: string, data: Partial<HousingParking>) => void;
  deleteParking: (id: string) => void;

  transfers: HousingTransfer[];
  recordFlatTransfer: (data: { flatId: string; toMemberId: string; date: string; transferType?: 'sale' | 'nominee' | 'legal_heir'; transferFee?: number; premium?: number; mode?: 'cash' | 'bank'; bankAccountId?: string; resolutionNo?: string; resolutionDate?: string; remarks?: string }) => HousingTransfer;
  deleteFlatTransfer: (id: string) => void;

  insurances: HousingInsurance[];
  addInsurance: (data: Omit<HousingInsurance, 'id' | 'createdAt'>) => HousingInsurance;
  updateInsurance: (id: string, data: Partial<HousingInsurance>) => void;
  deleteInsurance: (id: string) => void;

  amcs: HousingAmc[];
  addAmc: (data: Omit<HousingAmc, 'id' | 'createdAt'>) => HousingAmc;
  updateAmc: (id: string, data: Partial<HousingAmc>) => void;
  deleteAmc: (id: string) => void;

  documents: HousingDocument[];
  addDocument: (data: Omit<HousingDocument, 'id' | 'createdAt'>) => HousingDocument;
  updateDocument: (id: string, data: Partial<HousingDocument>) => void;
  deleteDocument: (id: string) => void;

  buildings: HousingBuilding[];
  addBuilding: (data: Omit<HousingBuilding, 'id' | 'createdAt'>) => HousingBuilding;
  updateBuilding: (id: string, data: Partial<HousingBuilding>) => void;
  deleteBuilding: (id: string) => void;
}

const HousingDataContext = createContext<HousingDataContextValue | undefined>(undefined);

export function HousingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Compose core (never fork): FY-lock + chart from society; sub-ledgers + vouchers via the core engine.
  const { society, accounts, members, vouchers, addAccount, addVoucher, cancelVoucher } = useData();
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
  const [fundInvestments, setFundInvestmentsState] = useState<HousingFundInvestment[]>(() => storage.getHousingFundInvestments());
  const [complaints, setComplaintsState] = useState<HousingComplaint[]>(() => storage.getHousingComplaints());
  const [parkingSlots, setParkingState] = useState<HousingParking[]>(() => storage.getHousingParking());
  const [transfers, setTransfersState] = useState<HousingTransfer[]>(() => storage.getHousingTransfers());
  const [insurances, setInsurancesState] = useState<HousingInsurance[]>(() => storage.getHousingInsurance());
  const [amcs, setAmcsState] = useState<HousingAmc[]>(() => storage.getHousingAmc());
  const [documents, setDocumentsState] = useState<HousingDocument[]>(() => storage.getHousingDocuments());
  const [buildings, setBuildingsState] = useState<HousingBuilding[]>(() => storage.getHousingBuildings());

  // Load when the society changes; Supabase is SSOT, localStorage is offline fallback.
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setHousingFlatsState([]); setMaintenanceBillsState([]); setChargeHeadsState([]); setFundInvestmentsState([]); setComplaintsState([]); setParkingState([]); setTransfersState([]); setInsurancesState([]); setAmcsState([]); setDocumentsState([]); setBuildingsState([]); return; }
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
    supabase.from('housing_fund_investments').select('*').eq('society_id', sid).then(
      ({ data, error }) => setFundInvestmentsState(error || !data ? storage.getHousingFundInvestments() : (data as unknown as HousingFundInvestment[])),
      () => setFundInvestmentsState(storage.getHousingFundInvestments()),
    );
    supabase.from('housing_complaints').select('*').eq('society_id', sid).then(
      ({ data, error }) => setComplaintsState(error || !data ? storage.getHousingComplaints() : (data as unknown as HousingComplaint[])),
      () => setComplaintsState(storage.getHousingComplaints()),
    );
    supabase.from('housing_parking').select('*').eq('society_id', sid).then(
      ({ data, error }) => setParkingState(error || !data ? storage.getHousingParking() : (data as unknown as HousingParking[])),
      () => setParkingState(storage.getHousingParking()),
    );
    supabase.from('housing_transfers').select('*').eq('society_id', sid).then(
      ({ data, error }) => setTransfersState(error || !data ? storage.getHousingTransfers() : (data as unknown as HousingTransfer[])),
      () => setTransfersState(storage.getHousingTransfers()),
    );
    supabase.from('housing_insurance').select('*').eq('society_id', sid).then(
      ({ data, error }) => setInsurancesState(error || !data ? storage.getHousingInsurance() : (data as unknown as HousingInsurance[])),
      () => setInsurancesState(storage.getHousingInsurance()),
    );
    supabase.from('housing_amc').select('*').eq('society_id', sid).then(
      ({ data, error }) => setAmcsState(error || !data ? storage.getHousingAmc() : (data as unknown as HousingAmc[])),
      () => setAmcsState(storage.getHousingAmc()),
    );
    supabase.from('housing_documents').select('*').eq('society_id', sid).then(
      ({ data, error }) => setDocumentsState(error || !data ? storage.getHousingDocuments() : (data as unknown as HousingDocument[])),
      () => setDocumentsState(storage.getHousingDocuments()),
    );
    supabase.from('housing_buildings').select('*').eq('society_id', sid).then(
      ({ data, error }) => setBuildingsState(error || !data ? storage.getHousingBuildings() : (data as unknown as HousingBuilding[])),
      () => setBuildingsState(storage.getHousingBuildings()),
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
      // GST (R2a): only when the society has enabled it AND the flat's taxable base > ₹7,500.
      const gst = gstLineForBill(billLines, { enabled: !!society.maintenanceGstEnabled, rate: society.maintenanceGstRate ?? 18, gstAccountId: '2201' });
      if (gst && accounts.some(a => a.id === '2201')) billLines.push(gst);
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
  }, [accounts, housingFlats, maintenanceBills, chargeHeads, members, society, addAccount, addVoucher, cancelVoucher, user]);

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
  // Governance gate (R2b): fund utilisation above the threshold requires a committee/AGM
  // resolution reference; it is stored in the voucher narration for the audit trail.
  const FUND_RESOLUTION_THRESHOLD = 50000;
  const recordFundUtilisation = useCallback((data: { fundAccountId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; purpose?: string; resolutionNo?: string; resolutionDate?: string }): Voucher => {
    if (data.amount > FUND_RESOLUTION_THRESHOLD && !data.resolutionNo?.trim()) {
      toastRef.current({ title: 'प्रस्ताव संख्या आवश्यक', description: `₹${FUND_RESOLUTION_THRESHOLD} से ऊपर निधि उपयोग के लिए समिति/AGM प्रस्ताव संख्या दर्ज करना आवश्यक है।`, variant: 'destructive', duration: 12000 });
      return { id: '', voucherNo: '', type: 'payment', date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    }
    const resNote = data.resolutionNo?.trim() ? `प्रस्ताव ${data.resolutionNo.trim()}${data.resolutionDate ? ` (${data.resolutionDate})` : ''}` : '';
    const note = [data.purpose?.trim(), resNote].filter(Boolean).join(' · ') || undefined;
    return postFundMovement({ fundAccountId: data.fundAccountId, amount: data.amount, mode: data.mode, bankAccountId: data.bankAccountId, date: data.date, note, refType: 'fund.utilisation', toFund: false });
  }, [postFundMovement]);

  // Accrue simple interest on each open bill's outstanding principal up to `asOnDate` at an annual
  // rate: Dr <member receivable> / Cr 4402 Interest on Defaulters, refType 'maintenance.interest'.
  // Idempotent per bill — plannedBillInterest charges only the period since the last interest
  // voucher (derived from vouchers), so re-running the same date charges nothing.
  const runArrearsInterest = useCallback((data: { asOnDate: string; annualRatePct: number; flatIds?: string[] }): { count: number; total: number } => {
    if (guardFYLocked()) return { count: 0, total: 0 };
    if (!(data.annualRatePct > 0)) { toastRef.current({ title: 'ब्याज दर डालें', description: 'वार्षिक ब्याज दर 0 से अधिक होनी चाहिए।', variant: 'destructive', duration: 8000 }); return { count: 0, total: 0 }; }
    if (!accounts.some(a => a.id === '4402')) { toastRef.current({ title: 'खाता नहीं मिला', description: 'ब्याज खाता (4402 — चूककर्ताओं पर ब्याज) चार्ट में नहीं है।', variant: 'destructive', duration: 10000 }); return { count: 0, total: 0 }; }
    const openBills = maintenanceBills.filter(b => !b.isDeleted && (!data.flatIds || data.flatIds.includes(b.flatId)));
    const lid = () => crypto.randomUUID();
    let count = 0, total = 0;
    for (const bill of openBills) {
      const p = plannedBillInterest(bill, vouchers, data.asOnDate, data.annualRatePct);
      if (p.amount <= 0) continue;
      const rec = bill.receivableAccountId || '3303';
      const v = addVoucher({
        type: 'journal', date: data.asOnDate,
        debitAccountId: rec, creditAccountId: '4402', amount: p.amount,
        narration: `ब्याज (विलंब) — ${bill.billNo} · ${p.days} दिन @ ${data.annualRatePct}%`,
        refType: 'maintenance.interest', refId: bill.id,
        memberId: bill.memberId, createdBy: user?.name || 'System',
        lines: [
          { id: lid(), accountId: rec, type: 'Dr', amount: p.amount },
          { id: lid(), accountId: '4402', type: 'Cr', amount: p.amount },
        ],
      });
      if (v.id) { count++; total = round2(total + p.amount); }
    }
    if (count > 0) toastRef.current({ title: 'ब्याज दर्ज हुआ', description: `${count} बिल · कुल ब्याज ₹${round2(total)}`, duration: 7000 });
    else toastRef.current({ title: 'कोई ब्याज नहीं', description: 'इस तिथि तक कोई नया ब्याज देय नहीं (बकाया नहीं या पहले से लगाया जा चुका)।', variant: 'default', duration: 8000 });
    return { count, total: round2(total) };
  }, [accounts, maintenanceBills, vouchers, addVoucher, user]);

  // ── Fund investment (FDR earmarking) — Dr investment asset / Cr bank. The fund corpus (its own
  // account) is unchanged; this records how the corpus is DEPLOYED. Entity + voucher with RULE-1
  // rollback (cancel the voucher if the row fails to persist), mirroring the Department pattern.
  const addFundInvestment = useCallback((data: { fundAccountId: string; investmentAccountId: string; amount: number; date: string; mode: 'cash' | 'bank'; bankAccountId?: string; instrument?: string; institution?: string; maturityDate?: string; interestRate?: number }): HousingFundInvestment => {
    const blank = { ...data, id: '', status: 'active' as const, createdAt: '' } as HousingFundInvestment;
    if (guardFYLocked()) return blank;
    if (!accounts.some(a => a.id === data.fundAccountId) || !accounts.some(a => a.id === data.investmentAccountId)) {
      toastRef.current({ title: 'खाता नहीं मिला', description: 'निधि या निवेश खाता चार्ट में नहीं है।', variant: 'destructive', duration: 9000 }); return blank;
    }
    if (!(data.amount > 0)) { toastRef.current({ title: 'राशि डालें', description: 'निवेश राशि 0 से अधिक होनी चाहिए।', variant: 'destructive', duration: 8000 }); return blank; }
    const bankAcc = data.mode === 'cash' ? ACCOUNT_IDS.CASH : (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK);
    const fund = accounts.find(a => a.id === data.fundAccountId)!;
    const lid = () => crypto.randomUUID();
    const id = crypto.randomUUID();
    const v = addVoucher({
      type: 'journal', date: data.date,
      debitAccountId: data.investmentAccountId, creditAccountId: bankAcc, amount: data.amount,
      narration: `निधि निवेश — ${fund.nameHi || fund.name}${data.instrument ? ` · ${data.instrument}` : ''}`,
      refType: 'fund.investment', refId: id,
      createdBy: user?.name || 'System',
      lines: [
        { id: lid(), accountId: data.investmentAccountId, type: 'Dr', amount: data.amount },
        { id: lid(), accountId: bankAcc, type: 'Cr', amount: data.amount },
      ],
    });
    if (!v.id) return blank;
    const inv: HousingFundInvestment = { id, fundAccountId: data.fundAccountId, investmentAccountId: data.investmentAccountId, instrument: data.instrument, institution: data.institution, amount: data.amount, date: data.date, maturityDate: data.maturityDate, interestRate: data.interestRate, voucherId: v.id, status: 'active', isDeleted: false, createdAt: new Date().toISOString() };
    setFundInvestmentsState(prev => { const u = [...prev, inv]; storage.setHousingFundInvestments(u); return u; });
    supabase.from('housing_fund_investments').upsert(withSoc(inv)).then(({ error }) => {
      if (error) {
        console.error('Fund investment save error:', error.message);
        setFundInvestmentsState(prev => { const r = prev.filter(x => x.id !== inv.id); storage.setHousingFundInvestments(r); return r; });
        cancelVoucher(v.id, 'Fund investment save failed (auto-rollback)', user?.name || 'System');
        toastRef.current({ title: 'निवेश सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. इसका voucher वापस ले लिया गया।`, variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: 'निधि निवेश दर्ज', description: `${fund.nameHi || fund.name} · ₹${data.amount}`, duration: 6000 });
    return inv;
  }, [accounts, addVoucher, cancelVoucher, user]);

  const redeemFundInvestment = useCallback((data: { id: string; date: string; mode: 'cash' | 'bank'; bankAccountId?: string; maturityAmount?: number }) => {
    if (guardFYLocked()) return;
    const inv = fundInvestments.find(i => i.id === data.id && !i.isDeleted);
    if (!inv || inv.status === 'redeemed') return;
    const bankAcc = data.mode === 'cash' ? ACCOUNT_IDS.CASH : (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    // Redeem at maturity value if given: principal returns to bank, and any interest earned accrues
    // DIRECTLY to the fund's own corpus (ring-fenced fund investment income) — consistent with the
    // direct-to-fund policy. If the fund account is somehow missing, fall back to principal-only.
    let gross = data.maturityAmount && data.maturityAmount > inv.amount ? round2(data.maturityAmount) : inv.amount;
    let interest = round2(gross - inv.amount);
    if (interest > 0 && !accounts.some(a => a.id === inv.fundAccountId)) { gross = inv.amount; interest = 0; }
    const lines = [
      { id: lid(), accountId: bankAcc, type: 'Dr' as const, amount: gross },
      { id: lid(), accountId: inv.investmentAccountId, type: 'Cr' as const, amount: inv.amount },
    ];
    if (interest > 0) lines.push({ id: lid(), accountId: inv.fundAccountId, type: 'Cr' as const, amount: interest });
    const v = addVoucher({
      type: 'journal', date: data.date,
      debitAccountId: bankAcc, creditAccountId: inv.investmentAccountId, amount: gross,
      narration: `निधि निवेश भुनाया — ${inv.instrument || 'FDR'}${interest > 0 ? ` (मूल ₹${inv.amount} + ब्याज ₹${interest})` : ''}`,
      refType: 'fund.redemption', refId: inv.id,
      createdBy: user?.name || 'System',
      lines,
    });
    if (!v.id) return;
    const next: HousingFundInvestment = { ...inv, status: 'redeemed', redemptionVoucherId: v.id };
    setFundInvestmentsState(prev => { const u = prev.map(i => i.id === inv.id ? next : i); storage.setHousingFundInvestments(u); return u; });
    supabase.from('housing_fund_investments').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('Fund investment redeem error:', error.message);
        setFundInvestmentsState(prev => { const u = prev.map(i => i.id === inv.id ? inv : i); storage.setHousingFundInvestments(u); return u; });
        cancelVoucher(v.id, 'Redemption rolled back (row update failed)', user?.name || 'System');
        toastRef.current({ title: 'भुनाना सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: 'निवेश भुनाया गया', description: `₹${gross} बैंक में वापस${interest > 0 ? ` · ब्याज ₹${interest} निधि में` : ''}`, duration: 6000 });
  }, [fundInvestments, accounts, addVoucher, cancelVoucher, user]);

  const deleteFundInvestment = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const inv = fundInvestments.find(i => i.id === id);
    if (!inv) return;
    if (inv.voucherId) cancelVoucher(inv.voucherId, `Fund investment deleted`, user?.name || 'System');
    if (inv.redemptionVoucherId) cancelVoucher(inv.redemptionVoucherId, `Fund investment deleted (redemption reversed)`, user?.name || 'System');
    setFundInvestmentsState(prev => { const u = prev.filter(i => i.id !== id); storage.setHousingFundInvestments(u); return u; });
    supabase.from('housing_fund_investments').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Fund investment delete error:', error.message);
        setFundInvestmentsState(prev => { const u = [...prev, inv]; storage.setHousingFundInvestments(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [fundInvestments, cancelVoucher, user]);

  // ── Complaints register (operational; Member-pattern persistence + RULE-1 rollback) ──
  const addComplaint = useCallback((data: Omit<HousingComplaint, 'id' | 'complaintNo' | 'createdAt'>): HousingComplaint => {
    if (guardFYLocked()) return { ...data, id: '', complaintNo: '', createdAt: '' } as HousingComplaint;
    const maxNum = complaints.reduce((m, c) => { const x = c.complaintNo?.match(/C\/(\d+)/); return x ? Math.max(m, parseInt(x[1], 10)) : m; }, 0);
    const c: HousingComplaint = { ...data, id: crypto.randomUUID(), complaintNo: `C/${String(maxNum + 1).padStart(4, '0')}`, createdAt: new Date().toISOString() };
    setComplaintsState(prev => { const u = [...prev, c]; storage.setHousingComplaints(u); return u; });
    supabase.from('housing_complaints').upsert(withSoc(c)).then(({ error }) => {
      if (error) {
        console.error('Complaint save error:', error.message);
        setComplaintsState(prev => { const r = prev.filter(x => x.id !== c.id); storage.setHousingComplaints(r); return r; });
        toastRef.current({ title: 'शिकायत सेव नहीं हुई', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return c;
  }, [complaints]);

  const updateComplaint = useCallback((id: string, data: Partial<HousingComplaint>) => {
    if (guardFYLocked()) return;
    const old = complaints.find(c => c.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setComplaintsState(prev => { const u = prev.map(c => c.id === id ? updated : c); storage.setHousingComplaints(u); return u; });
    supabase.from('housing_complaints').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('Complaint update error:', error.message);
        setComplaintsState(prev => { const u = prev.map(c => c.id === id ? old : c); storage.setHousingComplaints(u); return u; });
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [complaints]);

  const deleteComplaint = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = complaints.find(c => c.id === id);
    setComplaintsState(prev => { const u = prev.filter(c => c.id !== id); storage.setHousingComplaints(u); return u; });
    supabase.from('housing_complaints').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Complaint delete error:', error.message);
        if (old) setComplaintsState(prev => { const u = [...prev, old]; storage.setHousingComplaints(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [complaints]);

  // ── Parking register (operational; allotment record) ──
  const addParking = useCallback((data: Omit<HousingParking, 'id' | 'createdAt'>): HousingParking => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as HousingParking;
    const p: HousingParking = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setParkingState(prev => { const u = [...prev, p]; storage.setHousingParking(u); return u; });
    supabase.from('housing_parking').upsert(withSoc(p)).then(({ error }) => {
      if (error) {
        console.error('Parking save error:', error.message);
        setParkingState(prev => { const r = prev.filter(x => x.id !== p.id); storage.setHousingParking(r); return r; });
        toastRef.current({ title: 'पार्किंग सेव नहीं हुई', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return p;
  }, []);

  const updateParking = useCallback((id: string, data: Partial<HousingParking>) => {
    if (guardFYLocked()) return;
    const old = parkingSlots.find(p => p.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setParkingState(prev => { const u = prev.map(p => p.id === id ? updated : p); storage.setHousingParking(u); return u; });
    supabase.from('housing_parking').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('Parking update error:', error.message);
        setParkingState(prev => { const u = prev.map(p => p.id === id ? old : p); storage.setHousingParking(u); return u; });
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [parkingSlots]);

  const deleteParking = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = parkingSlots.find(p => p.id === id);
    setParkingState(prev => { const u = prev.filter(p => p.id !== id); storage.setHousingParking(u); return u; });
    supabase.from('housing_parking').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Parking delete error:', error.message);
        if (old) setParkingState(prev => { const u = [...prev, old]; storage.setHousingParking(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [parkingSlots]);

  // ── Flat transfer — reassign owner + optionally post fee (→ 4201) & premium (→ 1202 corpus).
  // Clears the flat's receivableAccountId so the next bill resolves the NEW owner's sub-ledger.
  const recordFlatTransfer = useCallback((data: { flatId: string; toMemberId: string; date: string; transferType?: 'sale' | 'nominee' | 'legal_heir'; transferFee?: number; premium?: number; mode?: 'cash' | 'bank'; bankAccountId?: string; resolutionNo?: string; resolutionDate?: string; remarks?: string }): HousingTransfer => {
    const blank = { id: '', flatId: data.flatId, toMemberId: data.toMemberId, date: data.date, createdAt: '' } as HousingTransfer;
    if (guardFYLocked()) return blank;
    const flat = housingFlats.find(f => f.id === data.flatId && !f.isDeleted);
    if (!flat) { toastRef.current({ title: 'फ्लैट नहीं मिला', description: 'Flat not found', variant: 'destructive', duration: 8000 }); return blank; }
    if (!data.toMemberId) { toastRef.current({ title: 'नया सदस्य चुनें', description: 'Select the new owner', variant: 'destructive', duration: 8000 }); return blank; }
    // No-dues gate (bye-law practice): a flat with outstanding maintenance/interest cannot be
    // transferred until cleared — reuses the member-statement helper on THIS flat's bills.
    const flatBills = maintenanceBills.filter(b => !b.isDeleted && b.flatId === flat.id);
    const flatOutstanding = round2(buildMemberStatement(flatBills, vouchers).outstanding);
    if (flatOutstanding > 0.005) {
      toastRef.current({ title: 'बकाया शेष है', description: `इस फ्लैट पर ₹${flatOutstanding} बकाया है — पहले वसूली करें, फिर हस्तांतरण करें।`, variant: 'destructive', duration: 12000 });
      return blank;
    }
    const fee = round2(data.transferFee || 0);
    const prem = round2(data.premium || 0);
    const id = crypto.randomUUID();
    const lid = () => crypto.randomUUID();
    let voucherId: string | undefined;
    if (fee + prem > 0) {
      const bankAcc = data.mode === 'cash' ? ACCOUNT_IDS.CASH : (data.bankAccountId || getBankAccountIds(accounts)[0] || ACCOUNT_IDS.BANK);
      const feeAcc = accounts.some(a => a.id === '4201') ? '4201' : '4400';
      const premAcc = accounts.some(a => a.id === '1202') ? '1202' : feeAcc;
      const lines = [{ id: lid(), accountId: bankAcc, type: 'Dr' as const, amount: round2(fee + prem) }];
      if (fee > 0) lines.push({ id: lid(), accountId: feeAcc, type: 'Cr' as const, amount: fee });
      if (prem > 0) lines.push({ id: lid(), accountId: premAcc, type: 'Cr' as const, amount: prem });
      const v = addVoucher({
        type: 'receipt', date: data.date,
        debitAccountId: bankAcc, creditAccountId: feeAcc, amount: round2(fee + prem),
        narration: `हस्तांतरण शुल्क — ${flat.flatNo}${prem > 0 ? ` (शुल्क ₹${fee} + प्रीमियम ₹${prem})` : ''}`,
        refType: 'housing.transfer', refId: id, memberId: data.toMemberId, createdBy: user?.name || 'System',
        lines,
      });
      if (!v.id) return blank;
      voucherId = v.id;
    }
    const oldOwner = flat.memberId;
    // Owner changes; the share cert follows the flat (a flat property). The nominee was the OLD
    // owner's — reset it so the new owner records their own (R3).
    updateHousingFlat(flat.id, { memberId: data.toMemberId, receivableAccountId: undefined, associateMemberId: undefined, nomineeName: undefined, nomineeRelation: undefined, nomineePhone: undefined });
    const t: HousingTransfer = { id, flatId: flat.id, flatNo: flat.flatNo, fromMemberId: oldOwner, toMemberId: data.toMemberId, date: data.date, transferType: data.transferType || 'sale', transferFee: fee || undefined, premium: prem || undefined, voucherId, resolutionNo: data.resolutionNo?.trim() || undefined, resolutionDate: data.resolutionDate || undefined, remarks: data.remarks, isDeleted: false, createdAt: new Date().toISOString() };
    setTransfersState(prev => { const u = [...prev, t]; storage.setHousingTransfers(u); return u; });
    supabase.from('housing_transfers').upsert(withSoc(t)).then(({ error }) => {
      if (error) {
        console.error('Transfer save error:', error.message);
        setTransfersState(prev => { const r = prev.filter(x => x.id !== t.id); storage.setHousingTransfers(r); return r; });
        updateHousingFlat(flat.id, { memberId: oldOwner, receivableAccountId: flat.receivableAccountId, associateMemberId: flat.associateMemberId, nomineeName: flat.nomineeName, nomineeRelation: flat.nomineeRelation, nomineePhone: flat.nomineePhone });
        if (voucherId) cancelVoucher(voucherId, 'Transfer save failed (auto-rollback)', user?.name || 'System');
        toastRef.current({ title: 'हस्तांतरण सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. मालिक व शुल्क वापस ले लिए गए।`, variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: 'फ्लैट हस्तांतरित', description: `${flat.flatNo}${fee + prem > 0 ? ` · ₹${round2(fee + prem)}` : ''}`, duration: 6000 });
    return t;
  }, [housingFlats, maintenanceBills, vouchers, accounts, addVoucher, cancelVoucher, updateHousingFlat, user]);

  const deleteFlatTransfer = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const t = transfers.find(x => x.id === id);
    if (!t) return;
    // Cancels the fee voucher; does NOT auto-revert ownership (the flat may have had later activity).
    if (t.voucherId) cancelVoucher(t.voucherId, `Transfer ${t.flatNo} deleted`, user?.name || 'System');
    setTransfersState(prev => { const u = prev.filter(x => x.id !== id); storage.setHousingTransfers(u); return u; });
    supabase.from('housing_transfers').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Transfer delete error:', error.message);
        setTransfersState(prev => { const u = [...prev, t]; storage.setHousingTransfers(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [transfers, cancelVoucher, user]);

  // ── Insurance register (operational; plain-table persistence + RULE-1 rollback) ──
  const addInsurance = useCallback((data: Omit<HousingInsurance, 'id' | 'createdAt'>): HousingInsurance => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as HousingInsurance;
    const p: HousingInsurance = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setInsurancesState(prev => { const u = [...prev, p]; storage.setHousingInsurance(u); return u; });
    supabase.from('housing_insurance').upsert(withSoc(p)).then(({ error }) => {
      if (error) {
        console.error('Insurance save error:', error.message);
        setInsurancesState(prev => { const r = prev.filter(x => x.id !== p.id); storage.setHousingInsurance(r); return r; });
        toastRef.current({ title: 'बीमा सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return p;
  }, []);
  const updateInsurance = useCallback((id: string, data: Partial<HousingInsurance>) => {
    if (guardFYLocked()) return;
    const old = insurances.find(x => x.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setInsurancesState(prev => { const u = prev.map(x => x.id === id ? updated : x); storage.setHousingInsurance(u); return u; });
    supabase.from('housing_insurance').upsert(withSoc(updated)).then(({ error }) => {
      if (error) { console.error('Insurance update error:', error.message); setInsurancesState(prev => { const u = prev.map(x => x.id === id ? old : x); storage.setHousingInsurance(u); return u; }); toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 }); }
    });
  }, [insurances]);
  const deleteInsurance = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = insurances.find(x => x.id === id);
    setInsurancesState(prev => { const u = prev.filter(x => x.id !== id); storage.setHousingInsurance(u); return u; });
    supabase.from('housing_insurance').delete().eq('id', id).then(({ error }) => {
      if (error) { console.error('Insurance delete error:', error.message); if (old) setInsurancesState(prev => { const u = [...prev, old]; storage.setHousingInsurance(u); return u; }); toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 }); }
    });
  }, [insurances]);

  // ── AMC / vendor contract register (operational) ──
  const addAmc = useCallback((data: Omit<HousingAmc, 'id' | 'createdAt'>): HousingAmc => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as HousingAmc;
    const p: HousingAmc = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setAmcsState(prev => { const u = [...prev, p]; storage.setHousingAmc(u); return u; });
    supabase.from('housing_amc').upsert(withSoc(p)).then(({ error }) => {
      if (error) {
        console.error('AMC save error:', error.message);
        setAmcsState(prev => { const r = prev.filter(x => x.id !== p.id); storage.setHousingAmc(r); return r; });
        toastRef.current({ title: 'AMC सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return p;
  }, []);
  const updateAmc = useCallback((id: string, data: Partial<HousingAmc>) => {
    if (guardFYLocked()) return;
    const old = amcs.find(x => x.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setAmcsState(prev => { const u = prev.map(x => x.id === id ? updated : x); storage.setHousingAmc(u); return u; });
    supabase.from('housing_amc').upsert(withSoc(updated)).then(({ error }) => {
      if (error) { console.error('AMC update error:', error.message); setAmcsState(prev => { const u = prev.map(x => x.id === id ? old : x); storage.setHousingAmc(u); return u; }); toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 }); }
    });
  }, [amcs]);
  const deleteAmc = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = amcs.find(x => x.id === id);
    setAmcsState(prev => { const u = prev.filter(x => x.id !== id); storage.setHousingAmc(u); return u; });
    supabase.from('housing_amc').delete().eq('id', id).then(({ error }) => {
      if (error) { console.error('AMC delete error:', error.message); if (old) setAmcsState(prev => { const u = [...prev, old]; storage.setHousingAmc(u); return u; }); toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 }); }
    });
  }, [amcs]);

  // ── Legal / statutory document register (operational) ──
  const addDocument = useCallback((data: Omit<HousingDocument, 'id' | 'createdAt'>): HousingDocument => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as HousingDocument;
    const p: HousingDocument = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setDocumentsState(prev => { const u = [...prev, p]; storage.setHousingDocuments(u); return u; });
    supabase.from('housing_documents').upsert(withSoc(p)).then(({ error }) => {
      if (error) {
        console.error('Document save error:', error.message);
        setDocumentsState(prev => { const r = prev.filter(x => x.id !== p.id); storage.setHousingDocuments(r); return r; });
        toastRef.current({ title: 'दस्तावेज़ सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return p;
  }, []);
  const updateDocument = useCallback((id: string, data: Partial<HousingDocument>) => {
    if (guardFYLocked()) return;
    const old = documents.find(x => x.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setDocumentsState(prev => { const u = prev.map(x => x.id === id ? updated : x); storage.setHousingDocuments(u); return u; });
    supabase.from('housing_documents').upsert(withSoc(updated)).then(({ error }) => {
      if (error) { console.error('Document update error:', error.message); setDocumentsState(prev => { const u = prev.map(x => x.id === id ? old : x); storage.setHousingDocuments(u); return u; }); toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 }); }
    });
  }, [documents]);
  const deleteDocument = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = documents.find(x => x.id === id);
    setDocumentsState(prev => { const u = prev.filter(x => x.id !== id); storage.setHousingDocuments(u); return u; });
    supabase.from('housing_documents').delete().eq('id', id).then(({ error }) => {
      if (error) { console.error('Document delete error:', error.message); if (old) setDocumentsState(prev => { const u = [...prev, old]; storage.setHousingDocuments(u); return u; }); toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 }); }
    });
  }, [documents]);

  // ── Building / wing master (operational) ──
  const addBuilding = useCallback((data: Omit<HousingBuilding, 'id' | 'createdAt'>): HousingBuilding => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as HousingBuilding;
    const p: HousingBuilding = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setBuildingsState(prev => { const u = [...prev, p]; storage.setHousingBuildings(u); return u; });
    supabase.from('housing_buildings').upsert(withSoc(p)).then(({ error }) => {
      if (error) {
        console.error('Building save error:', error.message);
        setBuildingsState(prev => { const r = prev.filter(x => x.id !== p.id); storage.setHousingBuildings(r); return r; });
        toastRef.current({ title: 'भवन सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return p;
  }, []);
  const updateBuilding = useCallback((id: string, data: Partial<HousingBuilding>) => {
    if (guardFYLocked()) return;
    const old = buildings.find(x => x.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setBuildingsState(prev => { const u = prev.map(x => x.id === id ? updated : x); storage.setHousingBuildings(u); return u; });
    supabase.from('housing_buildings').upsert(withSoc(updated)).then(({ error }) => {
      if (error) { console.error('Building update error:', error.message); setBuildingsState(prev => { const u = prev.map(x => x.id === id ? old : x); storage.setHousingBuildings(u); return u; }); toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 }); }
    });
  }, [buildings]);
  const deleteBuilding = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = buildings.find(x => x.id === id);
    setBuildingsState(prev => { const u = prev.filter(x => x.id !== id); storage.setHousingBuildings(u); return u; });
    supabase.from('housing_buildings').delete().eq('id', id).then(({ error }) => {
      if (error) { console.error('Building delete error:', error.message); if (old) setBuildingsState(prev => { const u = [...prev, old]; storage.setHousingBuildings(u); return u; }); toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 }); }
    });
  }, [buildings]);

  return (
    <HousingDataContext.Provider value={{
      housingFlats, addHousingFlat, updateHousingFlat, deleteHousingFlat,
      maintenanceBills, generateMaintenanceBills, deleteMaintenanceBill, recordMaintenanceCollection,
      chargeHeads, addChargeHead, updateChargeHead, deleteChargeHead,
      recordFundContribution, recordFundInterest, recordFundUtilisation,
      runArrearsInterest,
      fundInvestments, addFundInvestment, redeemFundInvestment, deleteFundInvestment,
      complaints, addComplaint, updateComplaint, deleteComplaint,
      parkingSlots, addParking, updateParking, deleteParking,
      transfers, recordFlatTransfer, deleteFlatTransfer,
      insurances, addInsurance, updateInsurance, deleteInsurance,
      amcs, addAmc, updateAmc, deleteAmc,
      documents, addDocument, updateDocument, deleteDocument,
      buildings, addBuilding, updateBuilding, deleteBuilding,
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
