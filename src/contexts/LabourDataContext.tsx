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
import { tr } from '@/lib/uiLang';
import { voucherRefusedToast, inFlightToast } from '@/lib/voucherRefused';
import { useLatest } from '@/hooks/useLatest';
import { useInFlight } from '@/hooks/useInFlight';
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { findVoucherOwner, type OwnerGroup } from '@/lib/voucherOwnership';
import { useCapabilityEnabled } from '@/contexts/useCapabilityEnabled';
import { refuseIfWriteBlocked } from '@/lib/connectivity/writeBlock';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { fetchAllPaged } from '@/lib/supabasePaging';
import { resolveJurisdiction } from '@/lib/jurisdiction';
import * as storage from '@/lib/storage';
import { resolveStatutory, type ParamSegment, type StatutoryParamKey } from '@/lib/rules/epfEsi';
import type { Worker, Department, DepartmentBill, DeptBillType, WorkerAdvance, PfEsiRun, LedgerAccount, Voucher } from '@/types';

// EPF/ESI rates & ceilings (statutory defaults; editable per run on the PF/ESI page).
// Employer EPF 12% = EPF 3.67% (A/c 1) + EPS 8.33% (A/c 10); plus EDLI 0.5% (A/c 21) +
// admin 0.5% (A/c 2) = 1% extra → employer total 13% of the EPF wage base.
export interface PfEsiConfig {
  epfRate: number; epfCeiling: number; epsRate: number; edliRate: number; adminRate: number;
  esiEmpRate: number; esiErRate: number; esiCeiling: number;
  /** The month's periods, each on one PF ceiling (from the dated rules). When the ceiling changes INSIDE the month
   *  (EPFO, 17 Sep 2026) the PF wage is day-weighted per period — the Salary page's rule. Absent / 1 segment ⇒ epfCeiling. */
  epfCeilingSegments?: ParamSegment[];
  /** Rule keys whose dated row is not yet verified against the notification — the page says so. */
  unverified?: StatutoryParamKey[];
}
/** Fallbacks ONLY for what the dated table (lib/rules/epfEsi) does not hold: EPS / EDLI / admin. */
export const PF_ESI_DEFAULTS: PfEsiConfig = {
  epfRate: 12, epfCeiling: 15000, epsRate: 8.33, edliRate: 0.5, adminRate: 0.5,
  esiEmpRate: 0.75, esiErRate: 3.25, esiCeiling: 21000,
};
/**
 * The labour PF/ESI basis for a wage month ('YYYY-MM') from the SAME dated rules as the Salary page and Payroll
 * (lib/rules/epfEsi — RULE 2, 2026-10-09). The ceiling, rates and ESI limit were hard-coded here (₹15,000), so labour
 * ignored a dated change the Salary page applied. EPS / EDLI / admin are not in the table and stay as before.
 */
export function pfEsiDefaultsFor(period: string): PfEsiConfig {
  const law = resolveStatutory(`${period}-01`);
  return {
    ...PF_ESI_DEFAULTS,
    epfRate: law.pfEmployeeRate, epfCeiling: law.pfWageCeiling,
    esiEmpRate: law.esiEmployeeRate, esiErRate: law.esiEmployerRate, esiCeiling: law.esiWageLimit,
    epfCeilingSegments: law.pfCeilingSegments, unverified: law.unverified,
  };
}
export interface PfEsiComputation {
  grossWages: number;
  epfEmployee: number; epfEmployer: number;       // employer EPF = 12% (incl. EPS)
  epfEps: number; epfAdminEdli: number;           // EPS portion (of the 12%) + EDLI+admin (the extra 1%)
  esiEmployee: number; esiEmployer: number;
  perWorker: { workerId: string; wage: number; epfWage: number; epfEmp: number; epfEr: number; eps: number; edli: number; admin: number; esiEmp: number; esiEr: number }[];
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
  const { society, accounts, vouchers, musterEntries, addAccount, updateAccount, deleteAccount, addVoucher, cancelVoucher, getAccountBalance, registerVoucherOwner } = useData();
  // J6b: load this module's tables only when its capability is on for the society (same rule as the
  // sidebar / CapabilityGuard) — societies that don't use labour no longer fetch them on every login.
  const moduleOn = useCapabilityEnabled(['labour', 'pf_esi']);
  const loadSid = moduleOn ? user?.societyId : undefined;
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);
  // X-1: a voucher refused late → the domain record is not made either (rows are written only in onSaved).
  const voucherRefused = (title: string) => voucherRefusedToast(toastRef.current, title);
  const inFlight = useInFlight(() => inFlightToast(toastRef.current));

  const societyId = user?.societyId || 'SOC001';
  // T-01: stamp BOTH tenancy keys (society_id + jurisdiction) — the value comes from the SSOT
  // resolver so a domain row carries the same jurisdiction the main context writes (anti-IRR-4).
  const withSoc = <T extends object>(d: T) => ({ ...d, society_id: societyId, jurisdiction: resolveJurisdiction(society?.state) });

  const guardFYLocked = (): boolean => {
    if (refuseIfWriteBlocked(toastRef.current)) return true; // F1: online-only entry (shared rule)
    if (society?.fyLocked) {
      toastRef.current({ title: 'FY Locked', description: tr('Financial Year audit-locked है — डेटा बदला नहीं जा सकता।', 'Financial Year is audit-locked — data cannot be changed.'), variant: 'destructive' });
      return true;
    }
    return false;
  };

  const [workers, setWorkersState] = useState<Worker[]>(() => storage.getWorkers());
  const [departments, setDepartmentsState] = useState<Department[]>(() => storage.getDepartments());
  const [departmentBills, setDepartmentBillsState] = useState<DepartmentBill[]>(() => storage.getDepartmentBills());
  const [workerAdvances, setWorkerAdvancesState] = useState<WorkerAdvance[]>(() => storage.getWorkerAdvances());
  const [pfEsiRuns, setPfEsiRunsState] = useState<PfEsiRun[]>(() => storage.getPfEsiRuns());
  // X-1: updates applied in a voucher's onSaved start from the CURRENT rows.
  const departmentBillsLatest = useLatest(departmentBills);
  const workerAdvancesLatest = useLatest(workerAdvances);
  const pfEsiRunsLatest = useLatest(pfEsiRuns);
  // H / RULE 3: vouchers these documents carry are cancelled through the document, not alone.
  const ownerGroupsRef = useRef<OwnerGroup[]>([]);
  ownerGroupsRef.current = [{ label: tr('विभाग बिल', 'Department bill'), docs: departmentBills }, { label: tr('श्रमिक अग्रिम', 'Worker advance'), docs: workerAdvances }, { label: 'PF/ESI', docs: pfEsiRuns }];
  useEffect(() => registerVoucherOwner('labour', id => findVoucherOwner(ownerGroupsRef.current, id)), [registerVoucherOwner]);

  // Load when the society changes; Supabase is SSOT, localStorage is offline fallback.
  useEffect(() => {
    const sid = loadSid;
    if (!sid) { setWorkersState([]); setDepartmentsState([]); setDepartmentBillsState([]); setWorkerAdvancesState([]); setPfEsiRunsState([]); return; }
    fetchAllPaged<Worker>('workers', sid).then(
      ({ data, error }) => setWorkersState(error || !data ? storage.getWorkers() : (data as unknown as Worker[])),
      () => setWorkersState(storage.getWorkers()),
    );
    fetchAllPaged<Department>('departments', sid).then(
      ({ data, error }) => setDepartmentsState(error || !data ? storage.getDepartments() : (data as unknown as Department[])),
      () => setDepartmentsState(storage.getDepartments()),
    );
    fetchAllPaged<DepartmentBill>('department_bills', sid).then(
      ({ data, error }) => setDepartmentBillsState(error || !data ? storage.getDepartmentBills() : (data as unknown as DepartmentBill[])),
      () => setDepartmentBillsState(storage.getDepartmentBills()),
    );
    fetchAllPaged<WorkerAdvance>('worker_advances', sid).then(
      ({ data, error }) => setWorkerAdvancesState(error || !data ? storage.getWorkerAdvances() : (data as unknown as WorkerAdvance[])),
      () => setWorkerAdvancesState(storage.getWorkerAdvances()),
    );
    fetchAllPaged<PfEsiRun>('pf_esi_runs', sid).then(
      ({ data, error }) => setPfEsiRunsState(error || !data ? storage.getPfEsiRuns() : (data as unknown as PfEsiRun[])),
      () => setPfEsiRunsState(storage.getPfEsiRuns()),
    );
  }, [loadSid]);

  const addWorker = useCallback((data: Omit<Worker, 'id' | 'createdAt'>): Worker => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as Worker;
    const w: Worker = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setWorkersState(prev => { const u = [...prev, w]; storage.setWorkers(u); return u; });
    supabase.from('workers').upsert(withSoc(w)).then(({ error }) => {
      if (error) {
        console.error('Worker save error:', error.message);
        setWorkersState(prev => { const r = prev.filter(x => x.id !== w.id); storage.setWorkers(r); return r; });
        toastRef.current({ title: tr('श्रमिक सेव नहीं हुआ', 'Worker not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा जोड़ें।`, `Not saved to the cloud — ${error.message}. Refreshing will not cause any problem; please add it again.`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [workers, society, user]);

  const deleteWorker = useCallback((id: string) => {
    if (guardFYLocked()) return;
    // RULE 3: don't hard-delete a worker who still has live advances — that would orphan the advance
    // rows (and their recovery vouchers) against a gone workerId. Block and point at the dependents.
    const liveAdvances = workerAdvances.filter(a => !a.isDeleted && a.workerId === id).length;
    if (liveAdvances > 0) {
      toastRef.current({ title: tr('कर्मचारी डिलीट नहीं हो सकता', 'Worker cannot be deleted'), description: tr(`इस कर्मचारी के ${liveAdvances} live advance(s) हैं — पहले Worker Advances में वे delete करें, फिर कर्मचारी हटाएँ।`, `This worker has ${liveAdvances} live advance(s) — delete them in Worker Advances first, then remove the worker.`), variant: 'destructive', duration: 10000 });
      return;
    }
    const old = workers.find(x => x.id === id);
    setWorkersState(prev => { const u = prev.filter(x => x.id !== id); storage.setWorkers(u); return u; });
    supabase.from('workers').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Worker delete error:', error.message);
        if (old) setWorkersState(prev => { const u = [...prev, old]; storage.setWorkers(u); return u; });
        toastRef.current({ title: tr('डिलीट सेव नहीं हुआ', 'Delete not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('विभाग सेव नहीं हुआ', 'Department not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा; दोबारा जोड़ें।`, `Not saved to the cloud — ${error.message}. Refreshing will not cause any problem; please add it again.`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
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
      toastRef.current({ title: tr('विभाग डिलीट नहीं हो सकता', 'Department cannot be deleted'), description: tr(`इस विभाग के ${liveBills} live bill(s) हैं — पहले Department Billing में वे delete करें, फिर विभाग हटाएँ।`, `This department has ${liveBills} live bill(s) — delete them in Department Billing first, then remove the department.`), variant: 'destructive', duration: 10000 });
      return;
    }
    // Tally-style (परत 1): if the sub-ledger is NOT referenced by any live voucher but still carries
    // a balance, deleting it would drop that balance (an opening-only orphan). Block the whole delete
    // so the department + its account never partial-delete. A referenced account is fine — it is
    // rename-retained below (RULE-3), which preserves the balance for audit.
    const referenced = vouchers.some(v => !v.isDeleted && (v.debitAccountId === old.accountId || v.creditAccountId === old.accountId || (v.lines || []).some(l => l.accountId === old.accountId)));
    if (!referenced && Math.abs(getAccountBalance(old.accountId)) >= 0.005) {
      const abs = Math.abs(getAccountBalance(old.accountId)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      toastRef.current({ title: tr('पहले बैलेंस settle करें', 'Settle the balance first'), description: tr(`विभाग "${old.name}" के खाते पर ₹${abs} बाकी है — पहले इसे settle करें या journal से दूसरे खाते में भेजें, तभी delete होगा।`, `₹${abs} is still pending on the account of department "${old.name}" — settle it first or move it to another account by journal; only then can it be deleted.`), variant: 'destructive', duration: 12000 });
      return;
    }
    setDepartmentsState(prev => { const u = prev.filter(d => d.id !== id); storage.setDepartments(u); return u; });
    supabase.from('departments').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Department delete error:', error.message);
        setDepartmentsState(prev => { const u = [...prev, old]; storage.setDepartments(u); return u; });
        toastRef.current({ title: tr('डिलीट सेव नहीं हुआ', 'Delete not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
        return;
      }
      // Preserve audit tie-out: rename the sub-ledger if any voucher references it, else drop it.
      if (referenced) updateAccount(old.accountId, { name: `${old.name} [Department deleted]`, isSystem: false });
      else deleteAccount(old.accountId);
    });
  }, [departments, departmentBills, society, user, vouchers, updateAccount, deleteAccount, getAccountBalance]);

  // ── Department Bills (income side) — compose the core voucher engine ──────────
  // Bill: Dr department receivable / Cr 4203 Labour Charges (income), tagged workOrderId.
  // Collection: Dr Cash-Bank / Cr department receivable (partial allowed). RULE-1/RULE-6.
  const addDepartmentBill = useCallback((data: { departmentId: string; workOrderId?: string; billType: DeptBillType; date: string; amount: number; narration?: string }): DepartmentBill => {
    const sentinel = { id: '', billNo: '', departmentId: data.departmentId, billType: data.billType, date: data.date, amount: 0, paidAmount: 0, status: 'unpaid', createdAt: '' } as DepartmentBill;
    if (guardFYLocked()) return sentinel;
    const dept = departments.find(d => d.id === data.departmentId);
    if (!dept) { toastRef.current({ title: tr('विभाग नहीं मिला', 'Department not found'), description: 'Department not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    if (!(data.amount > 0)) { toastRef.current({ title: tr('राशि दर्ज करें', 'Enter an amount'), description: tr('बिल राशि 0 से अधिक होनी चाहिए।', 'Bill amount must be more than 0.'), variant: 'destructive', duration: 8000 }); return sentinel; }
    const id = crypto.randomUUID();
    const maxNum = departmentBills.reduce((max, b) => { const m = b.billNo?.match(/DB\/(\d+)/); return m ? Math.max(max, parseInt(m[1], 10)) : max; }, 0);
    const billNo = `DB/${String(maxNum + 1).padStart(4, '0')}`;
    const lid = () => crypto.randomUUID();
    if (!inFlight.begin('dept-bill:new')) return sentinel;   // X-1: one save at a time for this record
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
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>, {
      // X-1: the bill row is written only once the server has the voucher; a late refusal leaves nothing behind.
      onSaved: (sv) => {
        inFlight.end('dept-bill:new');
        const bill: DepartmentBill = { id, billNo, departmentId: data.departmentId, workOrderId: data.workOrderId, billType: data.billType, date: data.date, amount: data.amount, paidAmount: 0, status: 'unpaid', voucherId: sv.id, narration: data.narration, createdAt: new Date().toISOString() };
        setDepartmentBillsState(prev => { const u = [...prev, bill]; storage.setDepartmentBills(u); return u; });
        supabase.from('department_bills').upsert(withSoc(bill)).then(({ error }) => {
          if (error) {
            console.error('Department bill save error:', error.message);
            setDepartmentBillsState(prev => { const r = prev.filter(b => b.id !== bill.id); storage.setDepartmentBills(r); return r; });
            cancelVoucher(sv.id, 'Department bill rolled back (save failed)', user?.name || 'System', { viaParent: true });
            toastRef.current({ title: tr('बिल सेव नहीं हुआ', 'Bill not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. बिल वापस ले लिया गया; दोबारा करें।`, `Not saved to the cloud — ${error.message}. The bill has been withdrawn; please do it again.`), variant: 'destructive', duration: 12000 });
            return;
          }
          toastRef.current({ title: tr('विभाग बिल दर्ज हुआ', 'Department bill recorded'), description: `${billNo} · ${dept.name} · ₹${data.amount}`, duration: 6000 });
        });
      },
      onFailed: () => { inFlight.end('dept-bill:new'); voucherRefused(tr('विभाग बिल दर्ज नहीं हुआ', 'Department bill not recorded')); },
    });
    if (!voucher?.id) { inFlight.end('dept-bill:new'); return sentinel; }
    return { id, billNo, departmentId: data.departmentId, workOrderId: data.workOrderId, billType: data.billType, date: data.date, amount: data.amount, paidAmount: 0, status: 'unpaid', voucherId: voucher.id, narration: data.narration, createdAt: new Date().toISOString() };
  }, [departments, departmentBills, society, user, addVoucher, cancelVoucher]);

  const recordDepartmentCollection = useCallback((data: { billId: string; amount: number; tdsAmount?: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string; remarks?: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'receipt', date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const bill = departmentBills.find(b => b.id === data.billId && !b.isDeleted);
    if (!bill) { toastRef.current({ title: tr('बिल नहीं मिला', 'Bill not found'), description: 'Bill not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    const dept = departments.find(d => d.id === bill.departmentId);
    if (!dept) { toastRef.current({ title: tr('विभाग नहीं मिला', 'Department not found'), description: 'Department not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    const outstanding = +(bill.amount - bill.paidAmount).toFixed(2);
    if (!(data.amount > 0)) { toastRef.current({ title: tr('राशि डालें', 'Enter an amount'), description: tr('वसूली राशि 0 से अधिक होनी चाहिए।', 'Collection amount must be more than 0.'), variant: 'destructive', duration: 8000 }); return sentinel; }
    if (data.amount > outstanding + 0.005) { toastRef.current({ title: tr('राशि बकाया से अधिक', 'Amount is more than the outstanding'), description: tr(`वसूली ₹${data.amount} बकाया ₹${outstanding} से अधिक नहीं हो सकती।`, `Collection ₹${data.amount} cannot be more than the outstanding ₹${outstanding}.`), variant: 'destructive', duration: 9000 }); return sentinel; }
    // TDS deducted by the department on the gross settled amount → our receivable (3307).
    const tds = +(data.tdsAmount || 0).toFixed(2);
    // TDS may equal the gross (100%-withheld settlement → netCash 0); only > gross is invalid.
    if (tds < 0 || tds > data.amount + 0.005) { toastRef.current({ title: tr('TDS राशि गलत', 'Wrong TDS amount'), description: tr('TDS 0 से कम या वसूली-राशि से अधिक नहीं हो सकता।', 'TDS cannot be less than 0 or more than the collection amount.'), variant: 'destructive', duration: 9000 }); return sentinel; }
    const netCash = +(data.amount - tds).toFixed(2);
    const debitAcc = data.mode === 'cash' ? storage.ACCOUNT_IDS.CASH : (data.bankAccountId || storage.defaultBankAccountId(accounts) || storage.ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    const ref = data.reference?.trim() ? ` · Ref ${data.reference.trim()}` : '';
    const rem = data.remarks?.trim() ? ` · ${data.remarks.trim()}` : '';
    const tdsNarr = tds > 0 ? ` · TDS ₹${tds}` : '';
    if (!inFlight.begin(`dept-bill:${bill.id}`)) return sentinel;   // X-1: one save at a time for this record
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
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>, {
      // X-1: the bill moves only once the server has the receipt — from the CURRENT row, not the captured one.
      onSaved: (sv) => {
        inFlight.end(`dept-bill:${bill.id}`);
        const cur = departmentBillsLatest.current.find(b => b.id === bill.id) ?? bill;
        const newPaid = +(cur.paidAmount + data.amount).toFixed(2);
        const status: DepartmentBill['status'] = newPaid >= cur.amount - 0.005 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
        const next: DepartmentBill = { ...cur, paidAmount: newPaid, status };
        setDepartmentBillsState(prev => { const u = prev.map(b => b.id === bill.id ? next : b); storage.setDepartmentBills(u); return u; });
        supabase.from('department_bills').upsert(withSoc(next)).then(({ error }) => {
          if (error) {
            console.error('Department collection bill-update error:', error.message);
            setDepartmentBillsState(prev => { const u = prev.map(b => b.id === bill.id ? cur : b); storage.setDepartmentBills(u); return u; });
            cancelVoucher(sv.id, 'Department collection rolled back (bill update failed)', user?.name || 'System', { viaParent: true });
            toastRef.current({ title: tr('वसूली सेव नहीं हुई', 'Collection not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. रसीद वापस ले ली गई; दोबारा करें।`, `Not saved to the cloud — ${error.message}. The receipt has been withdrawn; please do it again.`), variant: 'destructive', duration: 12000 });
            return;
          }
          toastRef.current({ title: tr('वसूली दर्ज हुई', 'Collection recorded'), description: tr(`${bill.billNo} · ₹${data.amount} · ${status === 'paid' ? 'पूर्ण' : 'आंशिक'}`, `${bill.billNo} · ₹${data.amount} · ${status === 'paid' ? 'full' : 'partial'}`), duration: 6000 });
        });
      },
      onFailed: () => { inFlight.end(`dept-bill:${bill.id}`); voucherRefused(tr('वसूली दर्ज नहीं हुई', 'Collection not recorded')); },
    });
    if (!voucher?.id) { inFlight.end(`dept-bill:${bill.id}`); return sentinel; }
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
        toastRef.current({ title: tr('डिलीट सेव नहीं हुआ', 'Delete not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
        return;
      }
      // Cascade (RULE-3): cancel the bill voucher + all its collection vouchers.
      // H / RULE 3: the row is already gone — a refused cancel must not be silent.
      const okBill = !old.voucherId || cancelVoucher(old.voucherId, 'Department bill deleted', user?.name || 'System', { viaParent: true });
      const okColl = vouchers.filter(v => !v.isDeleted && v.refType === 'dept.collection' && v.refId === old.id).map(v => cancelVoucher(v.id, 'Department bill deleted (collection reversed)', user?.name || 'System', { viaParent: true })).every(Boolean);
      if (!okBill || !okColl) toastRef.current({ title: tr('वाउचर रद्द नहीं हुआ', 'Voucher not cancelled'), description: tr('रिकॉर्ड हट गया, पर उसका वाउचर रद्द नहीं हो सका (lock / अनुमति)। वाउचर screen से उसे रद्द करें — अब वह अनाथ है, इसलिए रद्द हो जाएगा।', 'The record was removed, but its voucher could not be cancelled (lock / permission). Cancel it from the Voucher screen — it is now an orphan, so it will cancel.'), variant: 'destructive', duration: 15000 });
    });
  }, [departmentBills, vouchers, society, user, cancelVoucher]);

  // ── Worker Advances — asset 3304 Loans & Advances; recovered over time ──────────
  // Give: Dr 3304 / Cr Cash-Bank. Recovery: Dr Cash-Bank / Cr 3304 (partial). RULE-1/RULE-6.
  const addWorkerAdvance = useCallback((data: { workerId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; narration?: string }): WorkerAdvance => {
    const sentinel = { id: '', advanceNo: '', workerId: data.workerId, date: data.date, amount: 0, recovered: 0, status: 'open', mode: data.mode, createdAt: '' } as WorkerAdvance;
    if (guardFYLocked()) return sentinel;
    const worker = workers.find(w => w.id === data.workerId);
    if (!worker) { toastRef.current({ title: tr('श्रमिक नहीं मिला', 'Worker not found'), description: 'Worker not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    if (!(data.amount > 0)) { toastRef.current({ title: tr('राशि दर्ज करें', 'Enter an amount'), description: tr('अग्रिम राशि 0 से अधिक होनी चाहिए।', 'Advance amount must be more than 0.'), variant: 'destructive', duration: 8000 }); return sentinel; }
    const id = crypto.randomUUID();
    const maxNum = workerAdvances.reduce((m, a) => { const x = a.advanceNo?.match(/ADV\/(\d+)/); return x ? Math.max(m, parseInt(x[1], 10)) : m; }, 0);
    const advanceNo = `ADV/${String(maxNum + 1).padStart(3, '0')}`;
    const creditAcc = data.mode === 'cash' ? storage.ACCOUNT_IDS.CASH : (data.bankAccountId || storage.defaultBankAccountId(accounts) || storage.ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    if (!inFlight.begin('worker-advance:new')) return sentinel;   // X-1: one save at a time for this record
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
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>, {
      // X-1: the advance row is written only once the server has the payment voucher.
      onSaved: (sv) => {
        inFlight.end('worker-advance:new');
        const adv: WorkerAdvance = { id, advanceNo, workerId: data.workerId, date: data.date, amount: data.amount, recovered: 0, status: 'open', mode: data.mode, voucherId: sv.id, narration: data.narration, createdAt: new Date().toISOString() };
        setWorkerAdvancesState(prev => { const u = [...prev, adv]; storage.setWorkerAdvances(u); return u; });
        supabase.from('worker_advances').upsert(withSoc(adv)).then(({ error }) => {
          if (error) {
            console.error('Worker advance save error:', error.message);
            setWorkerAdvancesState(prev => { const r = prev.filter(a => a.id !== adv.id); storage.setWorkerAdvances(r); return r; });
            cancelVoucher(sv.id, 'Worker advance rolled back (save failed)', user?.name || 'System', { viaParent: true });
            toastRef.current({ title: tr('अग्रिम सेव नहीं हुआ', 'Advance not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. वापस ले लिया गया; दोबारा करें।`, `Not saved to the cloud — ${error.message}. It has been withdrawn; please do it again.`), variant: 'destructive', duration: 12000 });
            return;
          }
          toastRef.current({ title: tr('श्रमिक अग्रिम दर्ज हुआ', 'Worker advance recorded'), description: `${advanceNo} · ${worker.name} · ₹${data.amount}`, duration: 6000 });
        });
      },
      onFailed: () => { inFlight.end('worker-advance:new'); voucherRefused(tr('श्रमिक अग्रिम दर्ज नहीं हुआ', 'Worker advance not recorded')); },
    });
    if (!voucher?.id) { inFlight.end('worker-advance:new'); return sentinel; }
    return { id, advanceNo, workerId: data.workerId, date: data.date, amount: data.amount, recovered: 0, status: 'open', mode: data.mode, voucherId: voucher.id, narration: data.narration, createdAt: new Date().toISOString() };
  }, [workers, workerAdvances, accounts, society, user, addVoucher, cancelVoucher]);

  const recordAdvanceRecovery = useCallback((data: { advanceId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'receipt', date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const adv = workerAdvances.find(a => a.id === data.advanceId && !a.isDeleted);
    if (!adv) { toastRef.current({ title: tr('अग्रिम नहीं मिला', 'Advance not found'), description: 'Advance not found', variant: 'destructive', duration: 8000 }); return sentinel; }
    const worker = workers.find(w => w.id === adv.workerId);
    const outstanding = +(adv.amount - adv.recovered).toFixed(2);
    if (!(data.amount > 0)) { toastRef.current({ title: tr('राशि डालें', 'Enter an amount'), description: tr('वसूली 0 से अधिक होनी चाहिए।', 'Recovery must be more than 0.'), variant: 'destructive', duration: 8000 }); return sentinel; }
    if (data.amount > outstanding + 0.005) { toastRef.current({ title: tr('राशि बकाया से अधिक', 'Amount is more than the outstanding'), description: tr(`वसूली ₹${data.amount} बकाया ₹${outstanding} से अधिक नहीं हो सकती।`, `Recovery ₹${data.amount} cannot be more than the outstanding ₹${outstanding}.`), variant: 'destructive', duration: 9000 }); return sentinel; }
    const debitAcc = data.mode === 'cash' ? storage.ACCOUNT_IDS.CASH : (data.bankAccountId || storage.defaultBankAccountId(accounts) || storage.ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    if (!inFlight.begin(`worker-advance:${adv.id}`)) return sentinel;   // X-1: one save at a time for this record
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
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>, {
      // X-1: the advance moves only once the server has the receipt — from the CURRENT row.
      onSaved: (sv) => {
        inFlight.end(`worker-advance:${adv.id}`);
        const cur = workerAdvancesLatest.current.find(a => a.id === adv.id) ?? adv;
        const newRec = +(cur.recovered + data.amount).toFixed(2);
        const next: WorkerAdvance = { ...cur, recovered: newRec, status: newRec >= cur.amount - 0.005 ? 'cleared' : 'open' };
        setWorkerAdvancesState(prev => { const u = prev.map(a => a.id === adv.id ? next : a); storage.setWorkerAdvances(u); return u; });
        supabase.from('worker_advances').upsert(withSoc(next)).then(({ error }) => {
          if (error) {
            console.error('Advance recovery update error:', error.message);
            setWorkerAdvancesState(prev => { const u = prev.map(a => a.id === adv.id ? cur : a); storage.setWorkerAdvances(u); return u; });
            cancelVoucher(sv.id, 'Advance recovery rolled back (update failed)', user?.name || 'System', { viaParent: true });
            toastRef.current({ title: tr('वसूली सेव नहीं हुई', 'Recovery not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. रसीद वापस ले ली गई; दोबारा करें।`, `Not saved to the cloud — ${error.message}. The receipt has been withdrawn; please do it again.`), variant: 'destructive', duration: 12000 });
            return;
          }
          toastRef.current({ title: tr('अग्रिम वसूली दर्ज हुई', 'Advance recovery recorded'), description: tr(`${adv.advanceNo} · ₹${data.amount} · ${next.status === 'cleared' ? 'पूर्ण' : 'आंशिक'}`, `${adv.advanceNo} · ₹${data.amount} · ${next.status === 'cleared' ? 'full' : 'partial'}`), duration: 6000 });
        });
      },
      onFailed: () => { inFlight.end(`worker-advance:${adv.id}`); voucherRefused(tr('अग्रिम वसूली दर्ज नहीं हुई', 'Advance recovery not recorded')); },
    });
    if (!voucher?.id) { inFlight.end(`worker-advance:${adv.id}`); return sentinel; }
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
        toastRef.current({ title: tr('डिलीट सेव नहीं हुआ', 'Delete not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
        return;
      }
      const okAdv = !old.voucherId || cancelVoucher(old.voucherId, 'Worker advance deleted', user?.name || 'System', { viaParent: true });   // H / RULE 3
      const okRec = vouchers.filter(v => !v.isDeleted && v.refType === 'worker.advance.recovery' && v.refId === old.id).map(v => cancelVoucher(v.id, 'Worker advance deleted (recovery reversed)', user?.name || 'System', { viaParent: true })).every(Boolean);
      if (!okAdv || !okRec) toastRef.current({ title: tr('वाउचर रद्द नहीं हुआ', 'Voucher not cancelled'), description: tr('रिकॉर्ड हट गया, पर उसका वाउचर रद्द नहीं हो सका (lock / अनुमति)। वाउचर screen से उसे रद्द करें — अब वह अनाथ है, इसलिए रद्द हो जाएगा।', 'The record was removed, but its voucher could not be cancelled (lock / permission). Cancel it from the Voucher screen — it is now an orphan, so it will cancel.'), variant: 'destructive', duration: 15000 });
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
      // PF wage: one ceiling, or — when the ceiling changes inside the month and the user did not override it —
      // day-weighted per period, exactly like computeStatutory (Salary).
      const segs = cfg.epfCeilingSegments ?? [];
      const segDays = segs.reduce((n, g) => n + g.days, 0);
      const useSegs = segs.length > 1 && segDays > 0 && cfg.epfCeiling === segs[0].value;
      const epfBase = useSegs
        ? +(segs.reduce((s, g) => s + Math.min(wage, g.value) * g.days, 0) / segDays).toFixed(2)
        : Math.min(wage, cfg.epfCeiling);
      const epfEmp = +(epfBase * cfg.epfRate / 100).toFixed(2);    // employee 12%
      const epfEr = epfEmp;                                        // employer EPF 12% = EPF 3.67% (A/c1) + EPS 8.33% (A/c10)
      const eps = +(epfBase * cfg.epsRate / 100).toFixed(2);       // EPS portion of the 12% (A/c10)
      const edli = +(epfBase * cfg.edliRate / 100).toFixed(2);     // EDLI 0.5% (A/c21)
      const admin = +(epfBase * cfg.adminRate / 100).toFixed(2);   // admin 0.5% (A/c2)
      const esiOn = wage <= cfg.esiCeiling ? wage : 0;             // ESI not applicable above the ceiling
      const esiEmp = Math.ceil(esiOn * cfg.esiEmpRate / 100);      // ESIC rule: round up to next rupee per employee
      const esiEr = Math.ceil(esiOn * cfg.esiErRate / 100);
      return { workerId, wage, epfWage: epfBase, epfEmp, epfEr, eps, edli, admin, esiEmp, esiEr };
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
    if (pfEsiRuns.some(r => !r.isDeleted && r.period === period)) { toastRef.current({ title: tr('पहले से दर्ज', 'Already recorded'), description: tr(`${period} की EPF/ESI देयता पहले ही पोस्ट हो चुकी है।`, `The EPF/ESI liability for ${period} has already been posted.`), variant: 'destructive', duration: 9000 }); return sentinel; }
    const c = computePfEsi(period, cfg);
    const empShare = +(c.epfEmployee + c.esiEmployee).toFixed(2);
    const epfTotal = +(c.epfEmployee + c.epfEmployer + c.epfAdminEdli).toFixed(2);   // A/c 1+10 + A/c 21+2
    const esiTotal = +(c.esiEmployee + c.esiEmployer).toFixed(2);
    if (epfTotal + esiTotal <= 0) { toastRef.current({ title: tr('कुछ दर्ज करने को नहीं', 'Nothing to record'), description: tr('इस महीने की मज़दूरी/अंशदान शून्य है।', 'Wages/contributions for this month are zero.'), variant: 'destructive', duration: 8000 }); return sentinel; }
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
    if (!inFlight.begin(`pf-esi:${period}`)) return sentinel;   // X-1: one save at a time for this record
    const voucher = addVoucher({
      type: 'journal', date,
      debitAccountId: '5203', creditAccountId: '2203', amount: +(epfTotal + esiTotal).toFixed(2),
      narration: `EPF/ESI देयता — ${period} (कर्मचारी ₹${empShare} + नियोक्ता ₹${(c.epfEmployer + c.epfAdminEdli + c.esiEmployer).toFixed(2)})`,
      refType: 'pf_esi.liability', refId: id,
      createdBy: user?.name || 'System',
      lines,
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>, {
      // X-1: the run row is written only once the server has the voucher (a refused run must not block a re-post).
      onSaved: (sv) => {
        inFlight.end(`pf-esi:${period}`);
        const run: PfEsiRun = { id, period, grossWages: c.grossWages, epfEmployee: c.epfEmployee, epfEmployer: c.epfEmployer, epfAdminEdli: c.epfAdminEdli, esiEmployee: c.esiEmployee, esiEmployer: c.esiEmployer, status: 'posted', voucherId: sv.id, createdAt: new Date().toISOString() };
        setPfEsiRunsState(prev => { const u = [...prev, run]; storage.setPfEsiRuns(u); return u; });
        supabase.from('pf_esi_runs').upsert(withSoc(run)).then(({ error }) => {
          if (error) {
            console.error('PF/ESI run save error:', error.message);
            setPfEsiRunsState(prev => { const r = prev.filter(x => x.id !== run.id); storage.setPfEsiRuns(r); return r; });
            cancelVoucher(sv.id, 'PF/ESI run rolled back (save failed)', user?.name || 'System', { viaParent: true });
            toastRef.current({ title: tr('EPF/ESI सेव नहीं हुआ', 'EPF/ESI not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. वापस ले लिया गया; दोबारा करें।`, `Not saved to the cloud — ${error.message}. It has been withdrawn; please do it again.`), variant: 'destructive', duration: 12000 });
            return;
          }
          toastRef.current({ title: tr('EPF/ESI देयता दर्ज हुई', 'EPF/ESI liability recorded'), description: `${period} · EPF ₹${epfTotal} · ESI ₹${esiTotal}`, duration: 6000 });
        });
      },
      onFailed: () => { inFlight.end(`pf-esi:${period}`); voucherRefused(tr('EPF/ESI देयता दर्ज नहीं हुई', 'EPF/ESI liability not recorded')); },
    });
    if (!voucher?.id) { inFlight.end(`pf-esi:${period}`); return sentinel; }
    return { id, period, grossWages: c.grossWages, epfEmployee: c.epfEmployee, epfEmployer: c.epfEmployer, epfAdminEdli: c.epfAdminEdli, esiEmployee: c.esiEmployee, esiEmployer: c.esiEmployer, status: 'posted', voucherId: voucher.id, createdAt: new Date().toISOString() };
  }, [pfEsiRuns, computePfEsi, society, user, addVoucher, cancelVoucher]);

  const depositPfEsi = useCallback((data: { runId: string; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'payment', date: data.date, debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const run = pfEsiRuns.find(r => r.id === data.runId && !r.isDeleted);
    if (!run) { toastRef.current({ title: tr('रन नहीं मिला', 'Run not found'), variant: 'destructive', duration: 8000 }); return sentinel; }
    if (run.status === 'deposited') { toastRef.current({ title: tr('पहले ही जमा', 'Already deposited'), description: tr('इस माह की EPF/ESI पहले ही जमा हो चुकी है।', 'EPF/ESI for this month has already been deposited.'), variant: 'destructive', duration: 8000 }); return sentinel; }
    const epfTotal = +(run.epfEmployee + run.epfEmployer + (run.epfAdminEdli || 0)).toFixed(2);
    const esiTotal = +(run.esiEmployee + run.esiEmployer).toFixed(2);
    const total = +(epfTotal + esiTotal).toFixed(2);
    const creditAcc = data.mode === 'cash' ? storage.ACCOUNT_IDS.CASH : (data.bankAccountId || storage.defaultBankAccountId(accounts) || storage.ACCOUNT_IDS.BANK);
    const lid = () => crypto.randomUUID();
    if (!inFlight.begin(`pf-esi-deposit:${run.id}`)) return sentinel;   // X-1: one save at a time for this record
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
    } as Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>, {
      // X-1: the run is marked deposited only once the server has the payment (a refused deposit must allow a retry).
      onSaved: (sv) => {
        inFlight.end(`pf-esi-deposit:${run.id}`);
        const cur = pfEsiRunsLatest.current.find(r => r.id === run.id) ?? run;
        const next: PfEsiRun = { ...cur, status: 'deposited', depositVoucherId: sv.id };
        setPfEsiRunsState(prev => { const u = prev.map(r => r.id === run.id ? next : r); storage.setPfEsiRuns(u); return u; });
        supabase.from('pf_esi_runs').upsert(withSoc(next)).then(({ error }) => {
          if (error) {
            console.error('PF/ESI deposit update error:', error.message);
            setPfEsiRunsState(prev => { const u = prev.map(r => r.id === run.id ? cur : r); storage.setPfEsiRuns(u); return u; });
            cancelVoucher(sv.id, 'PF/ESI deposit rolled back (update failed)', user?.name || 'System', { viaParent: true });
            toastRef.current({ title: tr('जमा सेव नहीं हुई', 'Deposit not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. वापस ले लिया गया।`, `Not saved to the cloud — ${error.message}. It has been withdrawn.`), variant: 'destructive', duration: 12000 });
            return;
          }
          toastRef.current({ title: tr('EPF/ESI जमा दर्ज हुई', 'EPF/ESI deposit recorded'), description: `${run.period} · ₹${total}`, duration: 6000 });
        });
      },
      onFailed: () => { inFlight.end(`pf-esi-deposit:${run.id}`); voucherRefused(tr('EPF/ESI जमा दर्ज नहीं हुई', 'EPF/ESI deposit not recorded')); },
    });
    if (!voucher?.id) { inFlight.end(`pf-esi-deposit:${run.id}`); return sentinel; }
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
        toastRef.current({ title: tr('डिलीट सेव नहीं हुआ', 'Delete not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
        return;
      }
      const okRun = !old.voucherId || cancelVoucher(old.voucherId, 'PF/ESI run deleted', user?.name || 'System', { viaParent: true });   // H / RULE 3
      const okDep = !old.depositVoucherId || cancelVoucher(old.depositVoucherId, 'PF/ESI run deleted (deposit reversed)', user?.name || 'System', { viaParent: true });
      if (!okRun || !okDep) toastRef.current({ title: tr('वाउचर रद्द नहीं हुआ', 'Voucher not cancelled'), description: tr('रिकॉर्ड हट गया, पर उसका वाउचर रद्द नहीं हो सका (lock / अनुमति)। वाउचर screen से उसे रद्द करें — अब वह अनाथ है, इसलिए रद्द हो जाएगा।', 'The record was removed, but its voucher could not be cancelled (lock / permission). Cancel it from the Voucher screen — it is now an orphan, so it will cancel.'), variant: 'destructive', duration: 15000 });
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
