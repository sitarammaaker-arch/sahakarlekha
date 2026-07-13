/**
 * LabourDataContext — Labour-cooperative domain state & workflows ONLY.
 *
 * This context does NOT fork the accounting / voucher / settlement / posting / reports /
 * audit engines. Those stay in DataContext (the single SSOT). LabourDataContext COMPOSES
 * the core: it reads `society` (FY-lock) from useData(), `societyId` from useAuth(), and —
 * in later phases — will call useData().addVoucher / cancelVoucher and the shared
 * src/lib/posting helpers for any accounting. Here (Worker Master) there is no accounting.
 *
 * Persistence mirrors the proven Member pattern: optimistic local + localStorage + Supabase
 * upsert, with RULE-1 rollback on cloud failure and a RULE-6 FY-lock guard on every mutation.
 */
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import * as storage from '@/lib/storage';
import type { Worker, Department, DepartmentBill, DeptBillType, WorkerAdvance, PfEsiRun, LedgerAccount, Voucher } from '@/types';

// EPF/ESI rates & ceilings (statutory defaults; editable per run on the PF/ESI page).
// Employer EPF 12% = EPF 3.67% (A/c 1) + EPS 8.33% (A/c 10); plus EDLI 0.5% (A/c 21) +
// admin 0.5% (A/c 2) = 1% extra → employer total 13% of the EPF wage base.
export interface PfEsiConfig {
  epfRate: number; epfCeiling: number; epsRate: number; edliRate: number; adminRate: number;
  esiEmpRate: number; esiErRate: number; esiCeiling: number;
}
export const PF_ESI_DEFAULTS: PfEsiConfig = {
  epfRate: 12, epfCeiling: 15000, epsRate: 8.33, edliRate: 0.5, adminRate: 0.5,
  esiEmpRate: 0.75, esiErRate: 3.25, esiCeiling: 21000,
};
export interface PfEsiComputation {
  grossWages: number;
  epfEmployee: number; epfEmployer: number;       // employer EPF = 12% (incl. EPS)
  epfEps: number; epfAdminEdli: number;           // EPS portion (of the 12%) + EDLI+admin (the extra 1%)
  esiEmployee: number; esiEmployer: number;
  perWorker: { workerId: string; wage: number; epfEmp: number; epfEr: number; eps: number; edli: number; admin: number; esiEmp: number; esiEr: number }[];
}

interface LabourDataContextValue {
  workers: Worker[];
  addWorker: (data: Omit<Worker, 'id' | 'createdAt'>) => Worker;
  updateWorker: (id: string, data: Partial<Worker>) => void;
  deleteWorker: (id: string) => void;

  departments: Department[];
  addDepartment: (data: Omit<Department, 'id' | 'departmentCode' | 'accountId' | 'createdAt'>) => Department;
  updateDepartment: (id: string, data: Partial<Omit<Department, 'id' | 'departmentCode' | 'accountId' | 'createdAt'>>) => void;
  deleteDepartment: (id: string) => void;

  departmentBills: DepartmentBill[];
  addDepartmentBill: (data: { departmentId: string; workOrderId?: string; billType: DeptBillType; date: string; amount: number; narration?: string }) => DepartmentBill;
  recordDepartmentCollection: (data: { billId: string; amount: number; tdsAmount?: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string; remarks?: string }) => Voucher;
  deleteDepartmentBill: (id: string) => void;

  workerAdvances: WorkerAdvance[];
  addWorkerAdvance: (data: { workerId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; narration?: string }) => WorkerAdvance;
  recordAdvanceRecovery: (data: { advanceId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }) => Voucher;
  deleteWorkerAdvance: (id: string) => void;

  pfEsiRuns: PfEsiRun[];
  computePfEsi: (period: string, cfg: PfEsiConfig) => PfEsiComputation;
  postPfEsi: (period: string, cfg: PfEsiConfig, date: string) => PfEsiRun;
  depositPfEsi: (data: { runId: string; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }) => Voucher;
  deletePfEsiRun: (id: string) => void;
}

const LabourDataContext = createContext<LabourDataContextValue | undefined>(undefined);

export function LabourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Compose core (never fork): FY-lock from society; sub-ledger via the core account engine.
  const { society, accounts, vouchers, musterEntries, addAccount, updateAccount, deleteAccount, addVoucher, cancelVoucher } = useData();
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

  const [workers, setWorkersState] = useState<Worker[]>(() => storage.getWorkers());
  const [departments, setDepartmentsState] = useState<Department[]>(() => storage.getDepartments());
  const [departmentBills, setDepartmentBillsState] = useState<DepartmentBill[]>(() => storage.getDepartmentBills());
  const [workerAdvances, setWorkerAdvancesState] = useState<WorkerAdvance[]>(() => storage.getWorkerAdvances());
  const [pfEsiRuns, setPfEsiRunsState] = useState<PfEsiRun[]>(() => storage.getPfEsiRuns());

  // Load when the society changes; Supabase is SSOT, localStorage is offline fallback.
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setWorkersState([]); setDepartmentsState([]); setDepartmentBillsState([]); setWorkerAdvancesState([]); setPfEsiRunsState([]); return; }
    supabase.from('workers').select('*').eq('society_id', sid).then(
      ({ data, error }) => setWorkersState(error || !data ? storage.getWorkers() : (data as unknown as Worker[])),
      () => setWorkersState(storage.getWorkers()),
    );
    supabase.from('departments').select('*').eq('society_id', sid).then(
      ({ data, error }) => setDepartmentsState(error || !data ? storage.getDepartments() : (data as unknown as Department[])),
      () => setDepartmentsState(storage.getDepartments()),
    );
    supabase.from('department_bills').select('*').eq('society_id', sid).then(
      ({ data, error }) => setDepartmentBillsState(error || !data ? storage.getDepartmentBills() : (data as unknown as DepartmentBill[])),
      () => setDepartmentBillsState(storage.getDepartmentBills()),
    );
    supabase.from('worker_advances').select('*').eq('society_id', sid).then(
      ({ data, error }) => setWorkerAdvancesState(error || !data ? storage.getWorkerAdvances() : (data as unknown as WorkerAdvance[])),
      () => setWorkerAdvancesState(storage.getWorkerAdvances()),
    );
    supabase.from('pf_esi_runs').select('*').eq('society_id', sid).then(
      ({ data, error }) => setPfEsiRunsState(error || !data ? storage.getPfEsiRuns() : (data as unknown as PfEsiRun[])),
      () => setPfEsiRunsState(storage.getPfEsiRuns()),
    );
  }, [user?.societyId]);

  const addWorker = useCallback((data: Omit<Worker, 'id' | 'createdAt'>): Worker => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as Worker;
    const w: Worker = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setWorkersState(prev => { const u = [...prev, w]; storage.setWorkers(u); return u; });
    supabase.from('workers').upsert(withSoc(w)).then(({ error }) => {
      if (error) {
        console.error('Worker save error:', error.message);
        setWorkersState(prev => { const r = prev.filter(x => x.id !== w.id); storage.setWorkers(r); return r; });
        toastRef.current({ title: 'श्रमिक सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return w;
  }, [society, user]);

  const updateWorker = useCallback((id: string, data: Partial<Worker>) => {
    if (guardFYLocked()) return;
    const old = workers.find(x => x.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setWorkersState(prev => { const u = prev.map(x => x.id === id ? updated : x); storage.setWorkers(u); return u; });
    supabase.from('workers').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('Worker update error:', error.message);
        setWorkersState(prev => { const u = prev.map(x => x.id === id ? old : x); storage.setWorkers(u); return u; });
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [workers, society, user]);

  const deleteWorker = useCallback((id: string) => {
    if (guardFYLocked()) return;
    // RULE 3: don't hard-delete a worker who still has live advances — that would orphan the advance
    // rows (and their recovery vouchers) against a gone workerId. Block and point at the dependents.
    const liveAdvances = workerAdvances.filter(a => !a.isDeleted && a.workerId === id).length;
    if (liveAdvances > 0) {
      toastRef.current({ title: 'कर्मचारी डिलीट नहीं हो सकता', description: `इस कर्मचारी के ${liveAdvances} live advance(s) हैं — पहले Worker Advances में वे delete करें, फिर कर्मचारी हटाएँ।`, variant: 'destructive', duration: 10000 });
      return;
    }
    const old = workers.find(x => x.id === id);
    setWorkersState(prev => { const u = prev.filter(x => x.id !== id); storage.setWorkers(u); return u; });
    supabase.from('workers').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Worker delete error:', error.message);
        if (old) setWorkersState(prev => { const u = [...prev, old]; storage.setWorkers(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [workers, workerAdvances, society, user]);

  // ── Department / Principal-Employer master — debtor with auto sub-ledger (under 3303) ──
  // Reuses the core account engine via useData().addAccount/updateAccount/deleteAccount.
  const addDepartment = useCallback((data: Omit<Department, 'id' | 'departmentCode' | 'accountId' | 'createdAt'>): Department => {
    if (guardFYLocked()) return { ...data, id: '', departmentCode: '', accountId: '', createdAt: '' } as Department;
    // Auto-create the receivable sub-ledger under Sundry Debtors (3303) via the core engine.
    const account = addAccount({
      name: data.name,
      nameHi: data.name,
      type: 'asset',
      openingBalance: data.openingBalance || 0,
      openingBalanceType: 'debit',
      isSystem: false,
      isGroup: false,
      parentId: '3303',
    } as Omit<LedgerAccount, 'id'>);
    const maxNum = departments.reduce((max, d) => { const m = d.departmentCode?.match(/DEP\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
    const dep: Department = { ...data, id: crypto.randomUUID(), departmentCode: `DEP/${String(maxNum + 1).padStart(3, '0')}`, accountId: account.id, createdAt: new Date().toISOString() };
    setDepartmentsState(prev => { const u = [...prev, dep]; storage.setDepartments(u); return u; });
    supabase.from('departments').upsert(withSoc(dep)).then(({ error }) => {
      if (error) {
        console.error('Department save error:', error.message);
        setDepartmentsState(prev => { const r = prev.filter(d => d.id !== dep.id); storage.setDepartments(r); return r; });
        deleteAccount(account.id);   // roll back the orphan sub-ledger (brand new, no refs)
        toastRef.current({ title: 'विभाग सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data lose nahi hoga; dobara jodein.`, variant: 'destructive', duration: 12000 });
      }
    });
    return dep;
  }, [departments, society, user, addAccount, deleteAccount]);

  const updateDepartment = useCallback((id: string, data: Partial<Omit<Department, 'id' | 'departmentCode' | 'accountId' | 'createdAt'>>) => {
    if (guardFYLocked()) return;
    const old = departments.find(d => d.id === id);
    if (!old) return;
    const updated = { ...old, ...data };
    setDepartmentsState(prev => { const u = prev.map(d => d.id === id ? updated : d); storage.setDepartments(u); return u; });
    if (data.name && data.name !== old.name) updateAccount(old.accountId, { name: data.name, nameHi: data.name });
    supabase.from('departments').upsert(withSoc(updated)).then(({ error }) => {
      if (error) {
        console.error('Department update error:', error.message);
        setDepartmentsState(prev => { const u = prev.map(d => d.id === id ? old : d); storage.setDepartments(u); return u; });
        if (data.name && data.name !== old.name) updateAccount(old.accountId, { name: old.name, nameHi: old.name });
        toastRef.current({ title: 'अपडेट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [departments, society, user, updateAccount]);

  const deleteDepartment = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = departments.find(d => d.id === id);
    if (!old) return;
    // RULE 3: don't hard-delete a department that still has live bills — that would orphan them against
    // a gone departmentId while their receivable/collection vouchers stay live. Block and point at them,
    // mirroring Housing's deleteHousingFlat.
    const liveBills = departmentBills.filter(b => !b.isDeleted && b.departmentId === id).length;
    if (liveBills > 0) {
      toastRef.current({ title: 'विभाग डिलीट नहीं हो सकता', description: `इस विभाग के ${liveBills} live bill(s) हैं — पहले Department Billing में वे delete करें, फिर विभाग हटाएँ।`, variant: 'destructive', duration: 10000 });
      return;
    }
    setDepartmentsState(prev => { const u = prev.filter(d => d.id !== id); storage.setDepartments(u); return u; });
    supabase.from('departments').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Department delete error:', error.message);
        setDepartmentsState(prev => { const u = [...prev, old]; storage.setDepartments(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
        return;
      }
      // Preserve audit tie-out: rename the sub-ledger if any voucher references it, else drop it.
      const referenced = vouchers.some(v => !v.isDeleted && (v.debitAccountId === old.accountId || v.creditAccountId === old.accountId || (v.lines || []).some(l => l.accountId === old.accountId)));
      if (referenced) updateAccount(old.accountId, { name: `${old.name} [Department deleted]`, isSystem: false });
      else deleteAccount(old.accountId);
    });
  }, [departments, departmentBills, society, user, vouchers, updateAccount, deleteAccount]);

  // ── Department Bills (income side) — compose the core voucher engine ──────────
  // Bill: Dr department receivable / Cr 4203 Labour Charges (income), tagged workOrderId.
  // Collection: Dr Cash-Bank / Cr department receivable (partial allowed). RULE-1/RULE-6.
  const addDepartmentBill = useCallback((data: { departmentId: string; workOrderId?: string; billType: DeptBillType; date: string; amount: number; narration?: string }): DepartmentBill => {
    const sentinel = { id: '', billNo: '', departmentId: data.departmentId, billType: data.billType, date: data.date, amount: 0, paidAmount: 0, status: 'unpaid', createdAt: '' } as DepartmentBill;
    if (guardFYLocked()) return sentinel;
    const dept = departments.find(d => d.id === data.departmentId);
    if (!dept) { toastRef.current({ title: 'विभाग नहीं मिला', description: 'Department not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    if (!(data.amount > 0)) { toastRef.current({ title: 'राशि दर्ज करें', description: 'बिल राशि 0 से अधिक होनी चाहिए।', variant: 'destructive', duration: 8000 }); return sentinel; }
    const id = crypto.randomUUID();
    const maxNum = departmentBills.reduce((max, b) => { const m = b.billNo?.match(/DB\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
    const billNo = `DB/${String(maxNum + 1).padStart(4, '0')}`;
    const lid = () => crypto.randomUUID();
    const voucher = addVoucher({
      type: 'journal', date: data.date,
      debitAccountId: dept.accountId, creditAccountId: '4203', amount: data.amount,
      narration: `विभाग बिल — ${billNo} · ${dept.name}${data.narration ? ` · ${data.narration}` : ''}`,
      refType: 'dept.bill', refId: id, workOrderId: data.workOrderId,
      createdBy: user?.name || 'System',
      lines: [
        { id: lid(), accountId: dept.accountId, type: 'Dr', amount: data.amount },
        { id: lid(), accountId: '4203', type: 'Cr', amount: data.amount },
      ],
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>);
    if (!voucher.id) return sentinel;
    const bill: DepartmentBill = { id, billNo, departmentId: data.departmentId, workOrderId: data.workOrderId, billType: data.billType, date: data.date, amount: data.amount, paidAmount: 0, status: 'unpaid', voucherId: voucher.id, narration: data.narration, createdAt: new Date().toISOString() };
    setDepartmentBillsState(prev => { const u = [...prev, bill]; storage.setDepartmentBills(u); return u; });
    supabase.from('department_bills').upsert(withSoc(bill)).then(({ error }) => {
      if (error) {
        console.error('Department bill save error:', error.message);
        setDepartmentBillsState(prev => { const r = prev.filter(b => b.id !== bill.id); storage.setDepartmentBills(r); return r; });
        cancelVoucher(voucher.id, 'Department bill rolled back (save failed)', user?.name || 'System');
        toastRef.current({ title: 'बिल सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. बिल वापस ले लिया गया; दोबारा करें।`, variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: 'विभाग बिल दर्ज हुआ', description: `${billNo} · ${dept.name} · ₹${data.amount}`, duration: 6000 });
    return bill;
  }, [departments, departmentBills, society, user, addVoucher, cancelVoucher]);

  const recordDepartmentCollection = useCallback((data: { billId: string; amount: number; tdsAmount?: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string; remarks?: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'receipt', date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const bill = departmentBills.find(b => b.id === data.billId && !b.isDeleted);
    if (!bill) { toastRef.current({ title: 'बिल नहीं मिला', description: 'Bill not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    const dept = departments.find(d => d.id === bill.departmentId);
    if (!dept) { toastRef.current({ title: 'विभाग नहीं मिला', description: 'Department not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    const outstanding = +(bill.amount - bill.paidAmount).toFixed(2);
    if (!(data.amount > 0)) { toastRef.current({ title: 'राशि डालें', description: 'वसूली राशि 0 से अधिक होनी चाहिए।', variant: 'destructive', duration: 8000 }); return sentinel; }
    if (data.amount > outstanding + 0.005) { toastRef.current({ title: 'राशि बकाया से अधिक', description: `वसूली ₹${data.amount} बकाया ₹${outstanding} से अधिक नहीं हो सकती।`, variant: 'destructive', duration: 9000 }); return sentinel; }
    // TDS deducted by the department on the gross settled amount → our receivable (3307).
    const tds = +(data.tdsAmount || 0).toFixed(2);
    // TDS may equal the gross (100%-withheld settlement → netCash 0); only > gross is invalid.
    if (tds < 0 || tds > data.amount + 0.005) { toastRef.current({ title: 'TDS राशि गलत', description: 'TDS 0 से कम या वसूली-राशि से अधिक नहीं हो सकता।', variant: 'destructive', duration: 9000 }); return sentinel; }
    const netCash = +(data.amount - tds).toFixed(2);
    const debitAcc = data.mode === 'cash' ? storage.ACCOUNT_IDS.CASH : (data.bankAccountId || storage.getBankAccountIds(accounts)[0] || storage.ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    const ref = data.reference?.trim() ? ` · Ref ${data.reference.trim()}` : '';
    const rem = data.remarks?.trim() ? ` · ${data.remarks.trim()}` : '';
    const tdsNarr = tds > 0 ? ` · TDS ₹${tds}` : '';
    const voucher = addVoucher({
      type: 'receipt', date: data.date,
      // Header keeps the cash/bank receipt; lines carry the full split (incl. TDS receivable).
      debitAccountId: debitAcc, creditAccountId: dept.accountId, amount: data.amount,
      narration: `विभाग वसूली — ${bill.billNo} · ${dept.name}${tdsNarr}${ref}${rem}`,
      refType: 'dept.collection', refId: bill.id, workOrderId: bill.workOrderId,
      createdBy: user?.name || 'System',
      lines: [
        ...(netCash > 0 ? [{ id: lid(), accountId: debitAcc, type: 'Dr' as const, amount: netCash }] : []),
        ...(tds > 0 ? [{ id: lid(), accountId: '3307', type: 'Dr' as const, amount: tds }] : []),   // TDS Receivable
        { id: lid(), accountId: dept.accountId, type: 'Cr' as const, amount: data.amount },
      ],
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>);
    if (!voucher.id) return sentinel;
    const newPaid = +(bill.paidAmount + data.amount).toFixed(2);
    const status: DepartmentBill['status'] = newPaid >= bill.amount - 0.005 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
    const next: DepartmentBill = { ...bill, paidAmount: newPaid, status };
    setDepartmentBillsState(prev => { const u = prev.map(b => b.id === bill.id ? next : b); storage.setDepartmentBills(u); return u; });
    supabase.from('department_bills').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('Department collection bill-update error:', error.message);
        setDepartmentBillsState(prev => { const u = prev.map(b => b.id === bill.id ? bill : b); storage.setDepartmentBills(u); return u; });
        cancelVoucher(voucher.id, 'Department collection rolled back (bill update failed)', user?.name || 'System');
        toastRef.current({ title: 'वसूली सेव नहीं हुई', description: `Cloud save fail — ${error.message}. रसीद वापस ले ली गई; दोबारा करें।`, variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: 'वसूली दर्ज हुई', description: `${bill.billNo} · ₹${data.amount} · ${status === 'paid' ? 'पूर्ण' : 'आंशिक'}`, duration: 6000 });
    return voucher;
  }, [departmentBills, departments, accounts, society, user, addVoucher, cancelVoucher]);

  const deleteDepartmentBill = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = departmentBills.find(b => b.id === id);
    if (!old) return;
    setDepartmentBillsState(prev => { const u = prev.filter(b => b.id !== id); storage.setDepartmentBills(u); return u; });
    supabase.from('department_bills').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Department bill delete error:', error.message);
        setDepartmentBillsState(prev => { const u = [...prev, old]; storage.setDepartmentBills(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
        return;
      }
      // Cascade (RULE-3): cancel the bill voucher + all its collection vouchers.
      if (old.voucherId) cancelVoucher(old.voucherId, 'Department bill deleted', user?.name || 'System');
      vouchers.filter(v => !v.isDeleted && v.refType === 'dept.collection' && v.refId === old.id).forEach(v => cancelVoucher(v.id, 'Department bill deleted (collection reversed)', user?.name || 'System'));
    });
  }, [departmentBills, vouchers, society, user, cancelVoucher]);

  // ── Worker Advances — asset 3304 Loans & Advances; recovered over time ──────────
  // Give: Dr 3304 / Cr Cash-Bank. Recovery: Dr Cash-Bank / Cr 3304 (partial). RULE-1/RULE-6.
  const addWorkerAdvance = useCallback((data: { workerId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; narration?: string }): WorkerAdvance => {
    const sentinel = { id: '', advanceNo: '', workerId: data.workerId, date: data.date, amount: 0, recovered: 0, status: 'open', mode: data.mode, createdAt: '' } as WorkerAdvance;
    if (guardFYLocked()) return sentinel;
    const worker = workers.find(w => w.id === data.workerId);
    if (!worker) { toastRef.current({ title: 'श्रमिक नहीं मिला', description: 'Worker not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    if (!(data.amount > 0)) { toastRef.current({ title: 'राशि दर्ज करें', description: 'अग्रिम राशि 0 से अधिक होनी चाहिए।', variant: 'destructive', duration: 8000 }); return sentinel; }
    const id = crypto.randomUUID();
    const maxNum = workerAdvances.reduce((m, a) => { const x = a.advanceNo?.match(/ADV\/(\d+)/); return x ? Math.max(m, parseInt(x[1], 10)) : m; }, 0);
    const advanceNo = `ADV/${String(maxNum + 1).padStart(3, '0')}`;
    const creditAcc = data.mode === 'cash' ? storage.ACCOUNT_IDS.CASH : (data.bankAccountId || storage.getBankAccountIds(accounts)[0] || storage.ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    const voucher = addVoucher({
      type: 'payment', date: data.date,
      debitAccountId: '3304', creditAccountId: creditAcc, amount: data.amount,
      narration: `श्रमिक अग्रिम — ${advanceNo} · ${worker.name}${data.narration ? ` · ${data.narration}` : ''}`,
      refType: 'worker.advance', refId: id,
      createdBy: user?.name || 'System',
      lines: [
        { id: lid(), accountId: '3304', type: 'Dr', amount: data.amount },
        { id: lid(), accountId: creditAcc, type: 'Cr', amount: data.amount },
      ],
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>);
    if (!voucher.id) return sentinel;
    const adv: WorkerAdvance = { id, advanceNo, workerId: data.workerId, date: data.date, amount: data.amount, recovered: 0, status: 'open', mode: data.mode, voucherId: voucher.id, narration: data.narration, createdAt: new Date().toISOString() };
    setWorkerAdvancesState(prev => { const u = [...prev, adv]; storage.setWorkerAdvances(u); return u; });
    supabase.from('worker_advances').upsert(withSoc(adv)).then(({ error }) => {
      if (error) {
        console.error('Worker advance save error:', error.message);
        setWorkerAdvancesState(prev => { const r = prev.filter(a => a.id !== adv.id); storage.setWorkerAdvances(r); return r; });
        cancelVoucher(voucher.id, 'Worker advance rolled back (save failed)', user?.name || 'System');
        toastRef.current({ title: 'अग्रिम सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. वापस ले लिया गया; दोबारा करें।`, variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: 'श्रमिक अग्रिम दर्ज हुआ', description: `${advanceNo} · ${worker.name} · ₹${data.amount}`, duration: 6000 });
    return adv;
  }, [workers, workerAdvances, accounts, society, user, addVoucher, cancelVoucher]);

  const recordAdvanceRecovery = useCallback((data: { advanceId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'receipt', date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const adv = workerAdvances.find(a => a.id === data.advanceId && !a.isDeleted);
    if (!adv) { toastRef.current({ title: 'अग्रिम नहीं मिला', description: 'Advance not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    const worker = workers.find(w => w.id === adv.workerId);
    const outstanding = +(adv.amount - adv.recovered).toFixed(2);
    if (!(data.amount > 0)) { toastRef.current({ title: 'राशि डालें', description: 'वसूली 0 से अधिक होनी चाहिए।', variant: 'destructive', duration: 8000 }); return sentinel; }
    if (data.amount > outstanding + 0.005) { toastRef.current({ title: 'राशि बकाया से अधिक', description: `वसूली ₹${data.amount} बकाया ₹${outstanding} से अधिक नहीं हो सकती।`, variant: 'destructive', duration: 9000 }); return sentinel; }
    const debitAcc = data.mode === 'cash' ? storage.ACCOUNT_IDS.CASH : (data.bankAccountId || storage.getBankAccountIds(accounts)[0] || storage.ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    const voucher = addVoucher({
      type: 'receipt', date: data.date,
      debitAccountId: debitAcc, creditAccountId: '3304', amount: data.amount,
      narration: `अग्रिम वसूली — ${adv.advanceNo} · ${worker?.name || ''}`,
      refType: 'worker.advance.recovery', refId: adv.id,
      createdBy: user?.name || 'System',
      lines: [
        { id: lid(), accountId: debitAcc, type: 'Dr', amount: data.amount },
        { id: lid(), accountId: '3304', type: 'Cr', amount: data.amount },
      ],
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>);
    if (!voucher.id) return sentinel;
    const newRec = +(adv.recovered + data.amount).toFixed(2);
    const next: WorkerAdvance = { ...adv, recovered: newRec, status: newRec >= adv.amount - 0.005 ? 'cleared' : 'open' };
    setWorkerAdvancesState(prev => { const u = prev.map(a => a.id === adv.id ? next : a); storage.setWorkerAdvances(u); return u; });
    supabase.from('worker_advances').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('Advance recovery update error:', error.message);
        setWorkerAdvancesState(prev => { const u = prev.map(a => a.id === adv.id ? adv : a); storage.setWorkerAdvances(u); return u; });
        cancelVoucher(voucher.id, 'Advance recovery rolled back (update failed)', user?.name || 'System');
        toastRef.current({ title: 'वसूली सेव नहीं हुई', description: `Cloud save fail — ${error.message}. रसीद वापस ले ली गई; दोबारा करें।`, variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: 'अग्रिम वसूली दर्ज हुई', description: `${adv.advanceNo} · ₹${data.amount} · ${next.status === 'cleared' ? 'पूर्ण' : 'आंशिक'}`, duration: 6000 });
    return voucher;
  }, [workerAdvances, workers, accounts, society, user, addVoucher, cancelVoucher]);

  const deleteWorkerAdvance = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = workerAdvances.find(a => a.id === id);
    if (!old) return;
    setWorkerAdvancesState(prev => { const u = prev.filter(a => a.id !== id); storage.setWorkerAdvances(u); return u; });
    supabase.from('worker_advances').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Worker advance delete error:', error.message);
        setWorkerAdvancesState(prev => { const u = [...prev, old]; storage.setWorkerAdvances(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
        return;
      }
      if (old.voucherId) cancelVoucher(old.voucherId, 'Worker advance deleted', user?.name || 'System');
      vouchers.filter(v => !v.isDeleted && v.refType === 'worker.advance.recovery' && v.refId === old.id).forEach(v => cancelVoucher(v.id, 'Worker advance deleted (recovery reversed)', user?.name || 'System'));
    });
  }, [workerAdvances, vouchers, society, user, cancelVoucher]);

  // ── EPF / ESI (monthly, statutory) — computed from the month's muster wages ──────
  // Employee share is deducted from wages payable (2109); employer share is an expense
  // (5203 PF / 5204 ESI). Both credit the statutory payables (2203 EPF / 2204 ESI).
  const computePfEsi = useCallback((period: string, cfg: PfEsiConfig): PfEsiComputation => {
    const rows = musterEntries.filter(m => !m.isDeleted && m.period === period);
    const byWorker = new Map<string, number>();
    rows.forEach(m => { byWorker.set(m.memberId, (byWorker.get(m.memberId) || 0) + (m.daysWorked || 0) * (m.dailyWage || 0)); });
    const perWorker = Array.from(byWorker.entries()).map(([workerId, wage]) => {
      const epfBase = Math.min(wage, cfg.epfCeiling);
      const epfEmp = +(epfBase * cfg.epfRate / 100).toFixed(2);    // employee 12%
      const epfEr = epfEmp;                                        // employer EPF 12% = EPF 3.67% (A/c1) + EPS 8.33% (A/c10)
      const eps = +(epfBase * cfg.epsRate / 100).toFixed(2);       // EPS portion of the 12% (A/c10)
      const edli = +(epfBase * cfg.edliRate / 100).toFixed(2);     // EDLI 0.5% (A/c21)
      const admin = +(epfBase * cfg.adminRate / 100).toFixed(2);   // admin 0.5% (A/c2)
      const esiOn = wage <= cfg.esiCeiling ? wage : 0;             // ESI not applicable above the ceiling
      const esiEmp = Math.ceil(esiOn * cfg.esiEmpRate / 100);      // ESIC rule: round up to next rupee per employee
      const esiEr = Math.ceil(esiOn * cfg.esiErRate / 100);
      return { workerId, wage, epfEmp, epfEr, eps, edli, admin, esiEmp, esiEr };
    });
    const sum = (f: (w: PfEsiComputation['perWorker'][number]) => number) => +perWorker.reduce((s, w) => s + f(w), 0).toFixed(2);
    return {
      grossWages: sum(w => w.wage),
      epfEmployee: sum(w => w.epfEmp), epfEmployer: sum(w => w.epfEr),
      epfEps: sum(w => w.eps), epfAdminEdli: sum(w => w.edli + w.admin),
      esiEmployee: sum(w => w.esiEmp), esiEmployer: sum(w => w.esiEr),
      perWorker,
    };
  }, [musterEntries]);

  const postPfEsi = useCallback((period: string, cfg: PfEsiConfig, date: string): PfEsiRun => {
    const sentinel = { id: '', period, grossWages: 0, epfEmployee: 0, epfEmployer: 0, esiEmployee: 0, esiEmployer: 0, status: 'posted', createdAt: '' } as PfEsiRun;
    if (guardFYLocked()) return sentinel;
    if (pfEsiRuns.some(r => !r.isDeleted && r.period === period)) { toastRef.current({ title: 'पहले से दर्ज', description: `${period} की EPF/ESI देयता पहले ही पोस्ट हो चुकी है।`, variant: 'destructive', duration: 9000 }); return sentinel; }
    const c = computePfEsi(period, cfg);
    const empShare = +(c.epfEmployee + c.esiEmployee).toFixed(2);
    const epfTotal = +(c.epfEmployee + c.epfEmployer + c.epfAdminEdli).toFixed(2);   // A/c 1+10 + A/c 21+2
    const esiTotal = +(c.esiEmployee + c.esiEmployer).toFixed(2);
    if (epfTotal + esiTotal <= 0) { toastRef.current({ title: 'कुछ दर्ज करने को नहीं', description: 'इस महीने की मज़दूरी/अंशदान शून्य है।', variant: 'destructive', duration: 8000 }); return sentinel; }
    const id = crypto.randomUUID();
    const lid = () => crypto.randomUUID();
    const lines = [
      ...(empShare > 0 ? [{ id: lid(), accountId: '2109', type: 'Dr' as const, amount: empShare }] : []),       // employee share deducted from wages payable
      ...(c.epfEmployer > 0 ? [{ id: lid(), accountId: '5203', type: 'Dr' as const, amount: c.epfEmployer }] : []),      // employer EPF 12% (EPF+EPS)
      ...(c.epfAdminEdli > 0 ? [{ id: lid(), accountId: '5209', type: 'Dr' as const, amount: c.epfAdminEdli }] : []),    // EDLI 0.5% + admin 0.5%
      ...(c.esiEmployer > 0 ? [{ id: lid(), accountId: '5204', type: 'Dr' as const, amount: c.esiEmployer }] : []),
      ...(epfTotal > 0 ? [{ id: lid(), accountId: '2203', type: 'Cr' as const, amount: epfTotal }] : []),
      ...(esiTotal > 0 ? [{ id: lid(), accountId: '2204', type: 'Cr' as const, amount: esiTotal }] : []),
    ];
    const voucher = addVoucher({
      type: 'journal', date,
      debitAccountId: '5203', creditAccountId: '2203', amount: +(epfTotal + esiTotal).toFixed(2),
      narration: `EPF/ESI देयता — ${period} (कर्मचारी ₹${empShare} + नियोक्ता ₹${(c.epfEmployer + c.epfAdminEdli + c.esiEmployer).toFixed(2)})`,
      refType: 'pf_esi.liability', refId: id,
      createdBy: user?.name || 'System',
      lines,
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>);
    if (!voucher.id) return sentinel;
    const run: PfEsiRun = { id, period, grossWages: c.grossWages, epfEmployee: c.epfEmployee, epfEmployer: c.epfEmployer, epfAdminEdli: c.epfAdminEdli, esiEmployee: c.esiEmployee, esiEmployer: c.esiEmployer, status: 'posted', voucherId: voucher.id, createdAt: new Date().toISOString() };
    setPfEsiRunsState(prev => { const u = [...prev, run]; storage.setPfEsiRuns(u); return u; });
    supabase.from('pf_esi_runs').upsert(withSoc(run)).then(({ error }) => {
      if (error) {
        console.error('PF/ESI run save error:', error.message);
        setPfEsiRunsState(prev => { const r = prev.filter(x => x.id !== run.id); storage.setPfEsiRuns(r); return r; });
        cancelVoucher(voucher.id, 'PF/ESI run rolled back (save failed)', user?.name || 'System');
        toastRef.current({ title: 'EPF/ESI सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. वापस ले लिया गया; दोबारा करें।`, variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: 'EPF/ESI देयता दर्ज हुई', description: `${period} · EPF ₹${epfTotal} · ESI ₹${esiTotal}`, duration: 6000 });
    return run;
  }, [pfEsiRuns, computePfEsi, society, user, addVoucher, cancelVoucher]);

  const depositPfEsi = useCallback((data: { runId: string; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'payment', date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const run = pfEsiRuns.find(r => r.id === data.runId && !r.isDeleted);
    if (!run) { toastRef.current({ title: 'रन नहीं मिला', variant: 'destructive', duration: 8000 }); return sentinel; }
    if (run.status === 'deposited') { toastRef.current({ title: 'पहले ही जमा', description: 'इस माह की EPF/ESI पहले ही जमा हो चुकी है।', variant: 'destructive', duration: 8000 }); return sentinel; }
    const epfTotal = +(run.epfEmployee + run.epfEmployer + (run.epfAdminEdli || 0)).toFixed(2);
    const esiTotal = +(run.esiEmployee + run.esiEmployer).toFixed(2);
    const total = +(epfTotal + esiTotal).toFixed(2);
    const creditAcc = data.mode === 'cash' ? storage.ACCOUNT_IDS.CASH : (data.bankAccountId || storage.getBankAccountIds(accounts)[0] || storage.ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    const voucher = addVoucher({
      type: 'payment', date: data.date,
      debitAccountId: '2203', creditAccountId: creditAcc, amount: total,
      narration: `EPF/ESI जमा — ${run.period}`,
      refType: 'pf_esi.deposit', refId: run.id,
      createdBy: user?.name || 'System',
      lines: [
        ...(epfTotal > 0 ? [{ id: lid(), accountId: '2203', type: 'Dr' as const, amount: epfTotal }] : []),
        ...(esiTotal > 0 ? [{ id: lid(), accountId: '2204', type: 'Dr' as const, amount: esiTotal }] : []),
        { id: lid(), accountId: creditAcc, type: 'Cr' as const, amount: total },
      ],
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>);
    if (!voucher.id) return sentinel;
    const next: PfEsiRun = { ...run, status: 'deposited', depositVoucherId: voucher.id };
    setPfEsiRunsState(prev => { const u = prev.map(r => r.id === run.id ? next : r); storage.setPfEsiRuns(u); return u; });
    supabase.from('pf_esi_runs').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('PF/ESI deposit update error:', error.message);
        setPfEsiRunsState(prev => { const u = prev.map(r => r.id === run.id ? run : r); storage.setPfEsiRuns(u); return u; });
        cancelVoucher(voucher.id, 'PF/ESI deposit rolled back (update failed)', user?.name || 'System');
        toastRef.current({ title: 'जमा सेव नहीं हुई', description: `Cloud save fail — ${error.message}. वापस ले लिया गया।`, variant: 'destructive', duration: 12000 });
      }
    });
    toastRef.current({ title: 'EPF/ESI जमा दर्ज हुई', description: `${run.period} · ₹${total}`, duration: 6000 });
    return voucher;
  }, [pfEsiRuns, accounts, society, user, addVoucher, cancelVoucher]);

  const deletePfEsiRun = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const old = pfEsiRuns.find(r => r.id === id);
    if (!old) return;
    setPfEsiRunsState(prev => { const u = prev.filter(r => r.id !== id); storage.setPfEsiRuns(u); return u; });
    supabase.from('pf_esi_runs').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('PF/ESI run delete error:', error.message);
        setPfEsiRunsState(prev => { const u = [...prev, old]; storage.setPfEsiRuns(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}.`, variant: 'destructive', duration: 12000 });
        return;
      }
      if (old.voucherId) cancelVoucher(old.voucherId, 'PF/ESI run deleted', user?.name || 'System');
      if (old.depositVoucherId) cancelVoucher(old.depositVoucherId, 'PF/ESI run deleted (deposit reversed)', user?.name || 'System');
    });
  }, [pfEsiRuns, society, user, cancelVoucher]);

  return (
    <LabourDataContext.Provider value={{ workers, addWorker, updateWorker, deleteWorker, departments, addDepartment, updateDepartment, deleteDepartment, departmentBills, addDepartmentBill, recordDepartmentCollection, deleteDepartmentBill, workerAdvances, addWorkerAdvance, recordAdvanceRecovery, deleteWorkerAdvance, pfEsiRuns, computePfEsi, postPfEsi, depositPfEsi, deletePfEsiRun }}>
      {children}
    </LabourDataContext.Provider>
  );
}

export function useLabourData(): LabourDataContextValue {
  const ctx = useContext(LabourDataContext);
  if (!ctx) throw new Error('useLabourData must be used within a LabourProvider');
  return ctx;
}
