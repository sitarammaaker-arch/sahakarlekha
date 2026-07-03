/**
 * MarketingDataContext — Cooperative Marketing domain state & workflows ONLY.
 *
 * This context does NOT fork the accounting / voucher / posting / settlement / reports / audit
 * engines. Those stay in DataContext (the single SSOT). It COMPOSES the core: reads `society`
 * (FY-lock) from useData() and (in later phases) calls addVoucher / addAccount for accounting,
 * plus reuses the existing procurement engine (src/lib/procurement + the frozen event-sourced
 * chain that lives in DataContext) for the MSP farmer flow.
 *
 * Boundary (decided at M1): the event-sourced procurement CHAIN (farmers / lots / J-Forms /
 * settlements) stays in the frozen core DataContext. Procurement CONFIG MASTERS (crops, varieties,
 * and — later — seasons / agencies / centres / MSP rates / deduction rules) live HERE, in the
 * bounded marketing seam, so the giant core context does not grow. Persistence mirrors the
 * Dairy/Housing pattern: optimistic local + localStorage + Supabase upsert with RULE-1 visible
 * rollback and a RULE-6 FY-lock guard.
 *
 * M1a (this slice) adds the Crop & Variety masters + a "seed standard crops" helper. Seasons /
 * agencies / centres land in M1b, effective-dated MSP rates in M1c, deduction/quality/bardana in M1d.
 */
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import * as storage from '@/lib/storage';
import type { Crop, Variety } from '@/lib/procurement';

interface MarketingDataContextValue {
  marketingReady: boolean;
  guardFYLocked: () => boolean;

  // Procurement masters — Crop & Variety (M1a)
  crops: Crop[];
  varieties: Variety[];
  addCrop: (data: { name: string; code: string; nameHi?: string }) => Crop;
  updateCrop: (id: string, data: Partial<Pick<Crop, 'name' | 'code' | 'nameHi'>>) => void;
  deleteCrop: (id: string) => void;
  /** Seed the five common Indian procurement crops (wheat/paddy/mustard/gram/bajra). No-op if any exist. */
  seedStandardCrops: () => void;
  addVariety: (data: { cropId: string; name: string; nameHi?: string }) => Variety;
  updateVariety: (id: string, data: Partial<Pick<Variety, 'name' | 'nameHi'>>) => void;
  deleteVariety: (id: string) => void;
}

const MarketingDataContext = createContext<MarketingDataContextValue | null>(null);

const STANDARD_CROPS: Array<{ name: string; code: string; nameHi: string }> = [
  { name: 'Wheat', code: 'WHT', nameHi: 'गेहूँ' },
  { name: 'Paddy', code: 'PDY', nameHi: 'धान' },
  { name: 'Mustard', code: 'MST', nameHi: 'सरसों' },
  { name: 'Gram', code: 'GRM', nameHi: 'चना' },
  { name: 'Bajra', code: 'BJR', nameHi: 'बाजरा' },
];

export function MarketingProvider({ children }: { children: ReactNode }) {
  const { society, procurementLots } = useData();
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

  // ── Crop & Variety masters (localStorage seed → Supabase load on session) ─────
  const [crops, setCropsState] = useState<Crop[]>(() => storage.getProcurementCrops());
  const [varieties, setVarietiesState] = useState<Variety[]>(() => storage.getProcurementVarieties());

  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setCropsState([]); return; }
    supabase.from('procurement_crops').select('*').eq('society_id', sid).then(
      ({ data, error }) => setCropsState(error || !data ? storage.getProcurementCrops() : (data as Crop[])),
      () => setCropsState(storage.getProcurementCrops()),
    );
  }, [user?.societyId]);

  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) { setVarietiesState([]); return; }
    supabase.from('procurement_varieties').select('*').eq('society_id', sid).then(
      ({ data, error }) => setVarietiesState(error || !data ? storage.getProcurementVarieties() : (data as Variety[])),
      () => setVarietiesState(storage.getProcurementVarieties()),
    );
  }, [user?.societyId]);

  // ── Crop CRUD ────────────────────────────────────────────────────────────────
  const addCrop = useCallback((data: { name: string; code: string; nameHi?: string }): Crop => {
    const now = new Date().toISOString();
    const empty = { ...data, id: '', createdAt: '', updatedAt: '' } as Crop;
    if (guardFYLocked()) return empty;
    const crop: Crop = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    setCropsState(prev => { const u = [...prev, crop]; storage.setProcurementCrops(u); return u; });
    supabase.from('procurement_crops').upsert(withSoc(crop)).then(({ error }) => {
      if (error) {
        console.error('Crop save error:', error.message);
        setCropsState(prev => { const r = prev.filter(c => c.id !== crop.id); storage.setProcurementCrops(r); return r; });
        toastRef.current({ title: 'फसल सेव नहीं हुई', description: `Cloud save fail — ${error.message}. Refresh karne par data lose nahi hoga. (Pehli baar: supabase-tables.sql ka procurement_crops block chalayein.)`, variant: 'destructive', duration: 12000 });
      }
    });
    return crop;
  }, [societyId]);

  const updateCrop = useCallback((id: string, data: Partial<Pick<Crop, 'name' | 'code' | 'nameHi'>>) => {
    if (guardFYLocked()) return;
    setCropsState(prev => {
      const before = prev.find(c => c.id === id);
      const u = prev.map(c => c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c);
      storage.setProcurementCrops(u);
      const next = u.find(c => c.id === id);
      if (next && before) supabase.from('procurement_crops').upsert(withSoc(next)).then(({ error }) => {
        if (error) {
          setCropsState(p => { const r = p.map(c => c.id === id ? before : c); storage.setProcurementCrops(r); return r; });
          toastRef.current({ title: 'फसल अपडेट नहीं हुई', description: `Cloud save fail — ${error.message}. Refresh karne par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteCrop = useCallback((id: string) => {
    if (guardFYLocked()) return;
    // RULE-3: never orphan. Block if any variety or any procurement lot references this crop.
    if (varieties.some(v => v.cropId === id)) {
      toastRef.current({ title: 'पहले किस्में हटाएँ', description: 'इस फसल की किस्में मौजूद हैं — पहले उन्हें हटाएँ, फिर फसल हटाएँ।', variant: 'destructive' });
      return;
    }
    if (procurementLots.some(l => l.cropId === id)) {
      toastRef.current({ title: 'फसल उपयोग में है', description: 'इस फसल के लॉट बन चुके हैं — इसे हटाया नहीं जा सकता।', variant: 'destructive' });
      return;
    }
    const before = crops.find(c => c.id === id);
    if (!before) return;
    setCropsState(prev => { const r = prev.filter(c => c.id !== id); storage.setProcurementCrops(r); return r; });
    supabase.from('procurement_crops').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setCropsState(prev => { const u = [...prev, before]; storage.setProcurementCrops(u); return u; });
        toastRef.current({ title: 'फसल हटी नहीं', description: `Cloud delete fail — ${error.message}. Refresh karne par wapas dikhegi.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [crops, varieties, procurementLots, societyId]);

  const seedStandardCrops = useCallback(() => {
    if (guardFYLocked()) return;
    if (crops.length > 0) return; // only seed an empty master
    const now = new Date().toISOString();
    const seeded: Crop[] = STANDARD_CROPS.map(c => ({ ...c, id: crypto.randomUUID(), createdAt: now, updatedAt: now }));
    setCropsState(() => { storage.setProcurementCrops(seeded); return seeded; });
    supabase.from('procurement_crops').upsert(seeded.map(withSoc)).then(({ error }) => {
      if (error) {
        console.error('Seed crops error:', error.message);
        setCropsState(() => { storage.setProcurementCrops([]); return []; });
        toastRef.current({ title: 'फसलें सेव नहीं हुईं', description: `Cloud save fail — ${error.message}. (Pehli baar: supabase-tables.sql ka procurement_crops block chalayein.)`, variant: 'destructive', duration: 12000 });
      } else {
        toastRef.current({ title: '✅ मानक फसलें जोड़ी गईं', description: 'गेहूँ · धान · सरसों · चना · बाजरा' });
      }
    });
  }, [crops, societyId]);

  // ── Variety CRUD ───────────────────────────────────────────────────────────────
  const addVariety = useCallback((data: { cropId: string; name: string; nameHi?: string }): Variety => {
    const now = new Date().toISOString();
    const empty = { ...data, id: '', createdAt: '', updatedAt: '' } as Variety;
    if (guardFYLocked()) return empty;
    const variety: Variety = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    setVarietiesState(prev => { const u = [...prev, variety]; storage.setProcurementVarieties(u); return u; });
    supabase.from('procurement_varieties').upsert(withSoc(variety)).then(({ error }) => {
      if (error) {
        console.error('Variety save error:', error.message);
        setVarietiesState(prev => { const r = prev.filter(v => v.id !== variety.id); storage.setProcurementVarieties(r); return r; });
        toastRef.current({ title: 'किस्म सेव नहीं हुई', description: `Cloud save fail — ${error.message}. Refresh karne par data lose nahi hoga. (Pehli baar: supabase-tables.sql ka procurement_varieties block chalayein.)`, variant: 'destructive', duration: 12000 });
      }
    });
    return variety;
  }, [societyId]);

  const updateVariety = useCallback((id: string, data: Partial<Pick<Variety, 'name' | 'nameHi'>>) => {
    if (guardFYLocked()) return;
    setVarietiesState(prev => {
      const before = prev.find(v => v.id === id);
      const u = prev.map(v => v.id === id ? { ...v, ...data, updatedAt: new Date().toISOString() } : v);
      storage.setProcurementVarieties(u);
      const next = u.find(v => v.id === id);
      if (next && before) supabase.from('procurement_varieties').upsert(withSoc(next)).then(({ error }) => {
        if (error) {
          setVarietiesState(p => { const r = p.map(v => v.id === id ? before : v); storage.setProcurementVarieties(r); return r; });
          toastRef.current({ title: 'किस्म अपडेट नहीं हुई', description: `Cloud save fail — ${error.message}. Refresh karne par purana data wapas aa jayega.`, variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteVariety = useCallback((id: string) => {
    if (guardFYLocked()) return;
    if (procurementLots.some(l => l.varietyId === id)) {
      toastRef.current({ title: 'किस्म उपयोग में है', description: 'इस किस्म के लॉट बन चुके हैं — इसे हटाया नहीं जा सकता।', variant: 'destructive' });
      return;
    }
    const before = varieties.find(v => v.id === id);
    if (!before) return;
    setVarietiesState(prev => { const r = prev.filter(v => v.id !== id); storage.setProcurementVarieties(r); return r; });
    supabase.from('procurement_varieties').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setVarietiesState(prev => { const u = [...prev, before]; storage.setProcurementVarieties(u); return u; });
        toastRef.current({ title: 'किस्म हटी नहीं', description: `Cloud delete fail — ${error.message}. Refresh karne par wapas dikhegi.`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [varieties, procurementLots, societyId]);

  return (
    <MarketingDataContext.Provider value={{
      marketingReady: true,
      guardFYLocked,
      crops,
      varieties,
      addCrop,
      updateCrop,
      deleteCrop,
      seedStandardCrops,
      addVariety,
      updateVariety,
      deleteVariety,
    }}>
      {children}
    </MarketingDataContext.Provider>
  );
}

export function useMarketingData(): MarketingDataContextValue {
  const ctx = useContext(MarketingDataContext);
  if (!ctx) throw new Error('useMarketingData must be used within a MarketingProvider');
  return ctx;
}
