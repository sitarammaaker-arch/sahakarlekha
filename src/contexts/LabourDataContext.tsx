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
import type { Worker, Department, LedgerAccount } from '@/types';

interface LabourDataContextValue {
  workers: Worker[];
  addWorker: (data: Omit<Worker, 'id' | 'createdAt'>) => Worker;
  updateWorker: (id: string, data: Partial<Worker>) => void;
  deleteWorker: (id: string) => void;

  departments: Department[];
  addDepartment: (data: Omit<Department, 'id' | 'departmentCode' | 'accountId' | 'createdAt'>) => Department;
  updateDepartment: (id: string, data: Partial<Omit<Department, 'id' | 'departmentCode' | 'accountId' | 'createdAt'>>) => void;
  deleteDepartment: (id: string) => void;
}

const LabourDataContext = createContext<LabourDataContextValue | undefined>(undefined);

export function LabourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Compose core (never fork): FY-lock from society; sub-ledger via the core account engine.
  const { society, accounts, vouchers, addAccount, updateAccount, deleteAccount } = useData();
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

  // Load when the society changes; Supabase is SSOT, localStorage is offline fallback.
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setWorkersState([]); setDepartmentsState([]); return; }
    supabase.from('workers').select('*').eq('society_id', sid).then(
      ({ data, error }) => setWorkersState(error || !data ? storage.getWorkers() : (data as unknown as Worker[])),
      () => setWorkersState(storage.getWorkers()),
    );
    supabase.from('departments').select('*').eq('society_id', sid).then(
      ({ data, error }) => setDepartmentsState(error || !data ? storage.getDepartments() : (data as unknown as Department[])),
      () => setDepartmentsState(storage.getDepartments()),
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

  return (
    <LabourDataContext.Provider value={{ workers, addWorker, updateWorker, deleteWorker, departments, addDepartment, updateDepartment, deleteDepartment }}>
      {children}
    </LabourDataContext.Provider>
  );
}

export function useLabourData(): LabourDataContextValue {
  const ctx = useContext(LabourDataContext);
  if (!ctx) throw new Error('useLabourData must be used within a LabourProvider');
  return ctx;
}
