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
import type { Worker, Department, DepartmentBill, DeptBillType, LedgerAccount, Voucher } from '@/types';

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
}

const LabourDataContext = createContext<LabourDataContextValue | undefined>(undefined);

export function LabourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Compose core (never fork): FY-lock from society; sub-ledger via the core account engine.
  const { society, accounts, vouchers, addAccount, updateAccount, deleteAccount, addVoucher, cancelVoucher } = useData();
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

  // Load when the society changes; Supabase is SSOT, localStorage is offline fallback.
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setWorkersState([]); setDepartmentsState([]); setDepartmentBillsState([]); return; }
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
    const old = workers.find(x => x.id === id);
    setWorkersState(prev => { const u = prev.filter(x => x.id !== id); storage.setWorkers(u); return u; });
    supabase.from('workers').delete().eq('id', id).then(({ error }) => {
      if (error) {
        console.error('Worker delete error:', error.message);
        if (old) setWorkersState(prev => { const u = [...prev, old]; storage.setWorkers(u); return u; });
        toastRef.current({ title: 'डिलीट सेव नहीं हुआ', description: `Cloud save fail — ${error.message}. Refresh par data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [workers, society, user]);

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
  }, [departments, society, user, vouchers, updateAccount, deleteAccount]);

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
    if (tds < 0 || tds >= data.amount) { toastRef.current({ title: 'TDS राशि गलत', description: 'TDS 0 से कम या वसूली-राशि के बराबर/अधिक नहीं हो सकता।', variant: 'destructive', duration: 9000 }); return sentinel; }
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

  return (
    <LabourDataContext.Provider value={{ workers, addWorker, updateWorker, deleteWorker, departments, addDepartment, updateDepartment, deleteDepartment, departmentBills, addDepartmentBill, recordDepartmentCollection, deleteDepartmentBill }}>
      {children}
    </LabourDataContext.Provider>
  );
}

export function useLabourData(): LabourDataContextValue {
  const ctx = useContext(LabourDataContext);
  if (!ctx) throw new Error('useLabourData must be used within a LabourProvider');
  return ctx;
}
