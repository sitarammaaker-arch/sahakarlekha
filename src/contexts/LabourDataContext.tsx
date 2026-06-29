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
import type { Worker } from '@/types';

interface LabourDataContextValue {
  workers: Worker[];
  addWorker: (data: Omit<Worker, 'id' | 'createdAt'>) => Worker;
  updateWorker: (id: string, data: Partial<Worker>) => void;
  deleteWorker: (id: string) => void;
}

const LabourDataContext = createContext<LabourDataContextValue | undefined>(undefined);

export function LabourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { society } = useData();            // compose core — FY-lock lives on society
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

  // Load workers when the society changes; Supabase is SSOT, localStorage is offline fallback.
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setWorkersState([]); return; }
    supabase.from('workers').select('*').eq('society_id', sid).then(
      ({ data, error }) => setWorkersState(error || !data ? storage.getWorkers() : (data as unknown as Worker[])),
      () => setWorkersState(storage.getWorkers()),
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

  return (
    <LabourDataContext.Provider value={{ workers, addWorker, updateWorker, deleteWorker }}>
      {children}
    </LabourDataContext.Provider>
  );
}

export function useLabourData(): LabourDataContextValue {
  const ctx = useContext(LabourDataContext);
  if (!ctx) throw new Error('useLabourData must be used within a LabourProvider');
  return ctx;
}
