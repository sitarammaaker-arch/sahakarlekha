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
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { refuseIfWriteBlocked } from '@/lib/connectivity/writeBlock';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { fetchAllPaged } from '@/lib/supabasePaging';
import { applyLoadsTogether } from '@/lib/batchedLoads';
import { resolveJurisdiction } from '@/lib/jurisdiction';
import { reportError } from '@/lib/errorReporting';
import * as storage from '@/lib/storage';
import { pickEffectiveMspRate } from '@/lib/marketing/msp';
import { resolveProcurementAccountId } from '@/lib/procurement/accounts';
import { todayStr } from '@/lib/dateUtils';
import {
  agencyBalances, receiptCap, isRejectedQuality,
  AGENCY_RECEIPT_REF_TYPE, COMMISSION_RECEIPT_REF_TYPE, COMMISSION_ACCRUAL_REF_TYPE, type AgencyBalances,
} from '@/lib/procurement/agentFlow';
import type { Crop, Variety, Season, Agency, ProcurementCentre, MSPRate, DeductionRule, QualitySpec, BardanaType } from '@/lib/procurement';
import type { Transporter } from '@/lib/marketing/transport';
import type { Voucher } from '@/types';

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

  // Procurement masters — Season, Agency, Centre (M1b)
  seasons: Season[];
  addSeason: (data: { name: string; cropYear: string; startDate: string; endDate: string; nameHi?: string }) => Season;
  updateSeason: (id: string, data: Partial<Pick<Season, 'name' | 'cropYear' | 'startDate' | 'endDate' | 'nameHi'>>) => void;
  deleteSeason: (id: string) => void;
  agencies: Agency[];
  addAgency: (data: { name: string; code: string; kind: string; nameHi?: string; commissionRate?: number }) => Agency;
  updateAgency: (id: string, data: Partial<Pick<Agency, 'name' | 'code' | 'kind' | 'nameHi' | 'commissionRate'>>) => void;
  deleteAgency: (id: string) => void;
  centres: ProcurementCentre[];
  addCentre: (data: { name: string; code: string; agencyId: string; nameHi?: string }) => ProcurementCentre;
  updateCentre: (id: string, data: Partial<Pick<ProcurementCentre, 'name' | 'code' | 'nameHi'>>) => void;
  deleteCentre: (id: string) => void;

  // MSP rates — effective-dated per crop+season (M1c)
  mspRates: MSPRate[];
  addMspRate: (data: { cropId: string; seasonId: string; rate: number; effectiveFrom: string }) => MSPRate;
  deleteMspRate: (id: string) => void;
  /** Resolve ₹/qtl for a crop+season in force on `date` (default today); null if none applies. */
  resolveMspRate: (args: { cropId: string; seasonId: string; date?: string }) => number | null;

  // Deduction rules / Quality specs / Bardana types (M1d) — config consumed by quality (M2) & settlement (M3)
  deductionRules: DeductionRule[];
  addDeductionRule: (data: { code: string; basis: string; rate: number; accountId?: string; name?: string; nameHi?: string }) => DeductionRule;
  updateDeductionRule: (id: string, data: Partial<Pick<DeductionRule, 'code' | 'basis' | 'accountId' | 'name' | 'nameHi'>> & { rate?: number }) => void;
  deleteDeductionRule: (id: string) => void;
  qualitySpecs: QualitySpec[];
  addQualitySpec: (data: { cropId: string; seasonId: string; parameter: string; maxLimit: number }) => QualitySpec;
  deleteQualitySpec: (id: string) => void;
  bardanaTypes: BardanaType[];
  addBardanaType: (data: { name: string; capacityKg: number; nameHi?: string }) => BardanaType;
  deleteBardanaType: (id: string) => void;

  // Agency receipts (M3c) — derived from vouchers, no stored balance.
  /** MSP reimbursements received (Dr bank|cash / Cr MSP Receivable). */
  agencyReceipts: Voucher[];
  /** Commission received from the agency (Dr bank|cash / Cr Commission Receivable). */
  commissionReceipts: Voucher[];
  /** Net MSP Receivable outstanding (all agencies) = Σ Dr − Σ Cr across live vouchers. */
  agencyReceivableOutstanding: number;
  /** MSP / commission receivable split per agency (traced lot → centre → agency; receipts by refId). */
  mspBalances: AgencyBalances;
  commissionBalances: AgencyBalances;
  /** Money received from an agency against MSP (default) or commission. Refused above what is owed. */
  recordAgencyReceipt: (data: { amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; note?: string; agencyId?: string; against?: 'msp' | 'commission' }) => Voucher;
  deleteAgencyReceipt: (voucherId: string) => void;

  // Transport — transporter master (T1)
  transporters: Transporter[];
  addTransporter: (data: { name: string; nameHi?: string; vehicleNo?: string; phone?: string; ratePerQtl?: number }) => Transporter;
  updateTransporter: (id: string, data: Partial<Pick<Transporter, 'name' | 'nameHi' | 'vehicleNo' | 'phone' | 'ratePerQtl'>>) => void;
  deleteTransporter: (id: string) => void;

  // Procurement commission accrual (M3d) — Dr 3314 Commission Receivable / Cr 4206 Procurement Commission.
  commissionAccruals: Voucher[];
  /** Accrue commission for a lot (one per lot). amount = agency rate% × procurement value (caller computes); date = the lot's posting (J-Form) date. */
  accrueProcurementCommission: (data: { lotId: string; amount: number; note?: string; date?: string }) => Voucher;
  deleteCommissionAccrual: (voucherId: string) => void;
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
  const { society, procurementLots, procurementPostingRuleResults, procurementSettlements, procurementQualityTests, accounts, vouchers, addVoucher, cancelVoucher } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const societyId = user?.societyId || 'SOC001';
  // T-01: stamp BOTH tenancy keys (society_id + jurisdiction) — the value comes from the SSOT
  // resolver so a domain row carries the same jurisdiction the main context writes (anti-IRR-4).
  const withSoc = <T extends object>(d: T) => ({ ...d, society_id: societyId, jurisdiction: resolveJurisdiction(society?.state) });

  const societyRef = useRef(society);
  societyRef.current = society;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const guardFYLocked = useCallback((): boolean => {
    if (refuseIfWriteBlocked(toastRef.current)) return true; // F1: online-only entry (shared rule)
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
  const [seasons, setSeasonsState] = useState<Season[]>(() => storage.getProcurementSeasons());
  const [agencies, setAgenciesState] = useState<Agency[]>(() => storage.getProcurementAgencies());
  const [centres, setCentresState] = useState<ProcurementCentre[]>(() => storage.getProcurementCentres());
  const [mspRates, setMspRatesState] = useState<MSPRate[]>(() => storage.getProcurementMspRates());
  const [deductionRules, setDeductionRulesState] = useState<DeductionRule[]>(() => storage.getProcurementDeductionRules());
  const [qualitySpecs, setQualitySpecsState] = useState<QualitySpec[]>(() => storage.getProcurementQualitySpecs());
  const [bardanaTypes, setBardanaTypesState] = useState<BardanaType[]>(() => storage.getProcurementBardanaTypes());
  const [transporters, setTransportersState] = useState<Transporter[]>(() => storage.getMarketingTransporters());

  // J5: these masters used to load in 10 separate effects — 10 React commits after login, each
  // re-rendering every consumer. applyLoadsTogether applies them in one commit; each table keeps its own
  // fallback to the cached copy.
  useEffect(() => {
    const sid = user?.societyId;
    if (!sid) {
      setCropsState([]);
      setVarietiesState([]);
      setSeasonsState([]);
      setAgenciesState([]);
      setCentresState([]);
      setMspRatesState([]);
      setDeductionRulesState([]);
      setQualitySpecsState([]);
      setBardanaTypesState([]);
      setTransportersState([]);
      return;
    }
    applyLoadsTogether([
      [fetchAllPaged<Crop>('procurement_crops', sid), setCropsState, storage.getProcurementCrops],
      [fetchAllPaged<Variety>('procurement_varieties', sid), setVarietiesState, storage.getProcurementVarieties],
      [fetchAllPaged<Season>('procurement_seasons', sid), setSeasonsState, storage.getProcurementSeasons],
      [fetchAllPaged<Agency>('procurement_agencies', sid), setAgenciesState, storage.getProcurementAgencies],
      [fetchAllPaged<ProcurementCentre>('procurement_centres', sid), setCentresState, storage.getProcurementCentres],
      [fetchAllPaged<MSPRate>('procurement_msp_rates', sid), setMspRatesState, storage.getProcurementMspRates],
      [fetchAllPaged<DeductionRule>('procurement_deduction_rules', sid), setDeductionRulesState, storage.getProcurementDeductionRules],
      [fetchAllPaged<QualitySpec>('procurement_quality_specs', sid), setQualitySpecsState, storage.getProcurementQualitySpecs],
      [fetchAllPaged<BardanaType>('procurement_bardana_types', sid), setBardanaTypesState, storage.getProcurementBardanaTypes],
      [fetchAllPaged<Transporter>('marketing_transporters', sid), setTransportersState, storage.getMarketingTransporters],
    ], 'marketing masters');
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
        console.error('Crop save error:', error.message); reportError('marketing-save', error.message);
        setCropsState(prev => { const r = prev.filter(c => c.id !== crop.id); storage.setProcurementCrops(r); return r; });
        toastRef.current({ title: 'फसल सेव नहीं हुई', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_crops block चलाएँ।)`, variant: 'destructive', duration: 12000 });
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
          toastRef.current({ title: 'फसल अपडेट नहीं हुई', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: 'फसल हटी नहीं', description: `क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगी।`, variant: 'destructive', duration: 12000 });
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
        console.error('Seed crops error:', error.message); reportError('marketing-save', error.message);
        setCropsState(() => { storage.setProcurementCrops([]); return []; });
        toastRef.current({ title: 'फसलें सेव नहीं हुईं', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. (पहली बार: supabase-tables.sql का procurement_crops block चलाएँ।)`, variant: 'destructive', duration: 12000 });
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
        console.error('Variety save error:', error.message); reportError('marketing-save', error.message);
        setVarietiesState(prev => { const r = prev.filter(v => v.id !== variety.id); storage.setProcurementVarieties(r); return r; });
        toastRef.current({ title: 'किस्म सेव नहीं हुई', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_varieties block चलाएँ।)`, variant: 'destructive', duration: 12000 });
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
          toastRef.current({ title: 'किस्म अपडेट नहीं हुई', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: 'किस्म हटी नहीं', description: `क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगी।`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [varieties, procurementLots, societyId]);

  // ── Season CRUD ────────────────────────────────────────────────────────────────
  const addSeason = useCallback((data: { name: string; cropYear: string; startDate: string; endDate: string; nameHi?: string }): Season => {
    const now = new Date().toISOString();
    const empty = { ...data, id: '', createdAt: '', updatedAt: '' } as Season;
    if (guardFYLocked()) return empty;
    const season: Season = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    setSeasonsState(prev => { const u = [...prev, season]; storage.setProcurementSeasons(u); return u; });
    supabase.from('procurement_seasons').upsert(withSoc(season)).then(({ error }) => {
      if (error) {
        console.error('Season save error:', error.message); reportError('marketing-save', error.message);
        setSeasonsState(prev => { const r = prev.filter(s => s.id !== season.id); storage.setProcurementSeasons(r); return r; });
        toastRef.current({ title: 'सीज़न सेव नहीं हुआ', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_seasons block चलाएँ।)`, variant: 'destructive', duration: 12000 });
      }
    });
    return season;
  }, [societyId]);

  const updateSeason = useCallback((id: string, data: Partial<Pick<Season, 'name' | 'cropYear' | 'startDate' | 'endDate' | 'nameHi'>>) => {
    if (guardFYLocked()) return;
    setSeasonsState(prev => {
      const before = prev.find(s => s.id === id);
      const u = prev.map(s => s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s);
      storage.setProcurementSeasons(u);
      const next = u.find(s => s.id === id);
      if (next && before) supabase.from('procurement_seasons').upsert(withSoc(next)).then(({ error }) => {
        if (error) {
          setSeasonsState(p => { const r = p.map(s => s.id === id ? before : s); storage.setProcurementSeasons(r); return r; });
          toastRef.current({ title: 'सीज़न अपडेट नहीं हुआ', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteSeason = useCallback((id: string) => {
    if (guardFYLocked()) return;
    if (procurementLots.some(l => l.seasonId === id)) {
      toastRef.current({ title: 'सीज़न उपयोग में है', description: 'इस सीज़न के लॉट बन चुके हैं — इसे हटाया नहीं जा सकता।', variant: 'destructive' });
      return;
    }
    const before = seasons.find(s => s.id === id);
    if (!before) return;
    setSeasonsState(prev => { const r = prev.filter(s => s.id !== id); storage.setProcurementSeasons(r); return r; });
    supabase.from('procurement_seasons').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setSeasonsState(prev => { const u = [...prev, before]; storage.setProcurementSeasons(u); return u; });
        toastRef.current({ title: 'सीज़न हटा नहीं', description: `क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [seasons, procurementLots, societyId]);

  // ── Agency CRUD ────────────────────────────────────────────────────────────────
  const addAgency = useCallback((data: { name: string; code: string; kind: string; nameHi?: string }): Agency => {
    const now = new Date().toISOString();
    const empty = { ...data, id: '', createdAt: '', updatedAt: '' } as Agency;
    if (guardFYLocked()) return empty;
    const agency: Agency = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    setAgenciesState(prev => { const u = [...prev, agency]; storage.setProcurementAgencies(u); return u; });
    supabase.from('procurement_agencies').upsert(withSoc(agency)).then(({ error }) => {
      if (error) {
        console.error('Agency save error:', error.message); reportError('marketing-save', error.message);
        setAgenciesState(prev => { const r = prev.filter(a => a.id !== agency.id); storage.setProcurementAgencies(r); return r; });
        toastRef.current({ title: 'एजेंसी सेव नहीं हुई', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_agencies block चलाएँ।)`, variant: 'destructive', duration: 12000 });
      }
    });
    return agency;
  }, [societyId]);

  const updateAgency = useCallback((id: string, data: Partial<Pick<Agency, 'name' | 'code' | 'kind' | 'nameHi'>>) => {
    if (guardFYLocked()) return;
    setAgenciesState(prev => {
      const before = prev.find(a => a.id === id);
      const u = prev.map(a => a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a);
      storage.setProcurementAgencies(u);
      const next = u.find(a => a.id === id);
      if (next && before) supabase.from('procurement_agencies').upsert(withSoc(next)).then(({ error }) => {
        if (error) {
          setAgenciesState(p => { const r = p.map(a => a.id === id ? before : a); storage.setProcurementAgencies(r); return r; });
          toastRef.current({ title: 'एजेंसी अपडेट नहीं हुई', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteAgency = useCallback((id: string) => {
    if (guardFYLocked()) return;
    if (centres.some(c => c.agencyId === id)) {
      toastRef.current({ title: 'पहले केंद्र हटाएँ', description: 'इस एजेंसी के केंद्र मौजूद हैं — पहले उन्हें हटाएँ, फिर एजेंसी हटाएँ।', variant: 'destructive' });
      return;
    }
    const before = agencies.find(a => a.id === id);
    if (!before) return;
    setAgenciesState(prev => { const r = prev.filter(a => a.id !== id); storage.setProcurementAgencies(r); return r; });
    supabase.from('procurement_agencies').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setAgenciesState(prev => { const u = [...prev, before]; storage.setProcurementAgencies(u); return u; });
        toastRef.current({ title: 'एजेंसी हटी नहीं', description: `क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगी।`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [agencies, centres, societyId]);

  // ── Procurement Centre CRUD ──────────────────────────────────────────────────────
  const addCentre = useCallback((data: { name: string; code: string; agencyId: string; nameHi?: string }): ProcurementCentre => {
    const now = new Date().toISOString();
    const empty = { ...data, id: '', createdAt: '', updatedAt: '' } as ProcurementCentre;
    if (guardFYLocked()) return empty;
    const centre: ProcurementCentre = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    setCentresState(prev => { const u = [...prev, centre]; storage.setProcurementCentres(u); return u; });
    supabase.from('procurement_centres').upsert(withSoc(centre)).then(({ error }) => {
      if (error) {
        console.error('Centre save error:', error.message); reportError('marketing-save', error.message);
        setCentresState(prev => { const r = prev.filter(c => c.id !== centre.id); storage.setProcurementCentres(r); return r; });
        toastRef.current({ title: 'केंद्र सेव नहीं हुआ', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_centres block चलाएँ।)`, variant: 'destructive', duration: 12000 });
      }
    });
    return centre;
  }, [societyId]);

  const updateCentre = useCallback((id: string, data: Partial<Pick<ProcurementCentre, 'name' | 'code' | 'nameHi'>>) => {
    if (guardFYLocked()) return;
    setCentresState(prev => {
      const before = prev.find(c => c.id === id);
      const u = prev.map(c => c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c);
      storage.setProcurementCentres(u);
      const next = u.find(c => c.id === id);
      if (next && before) supabase.from('procurement_centres').upsert(withSoc(next)).then(({ error }) => {
        if (error) {
          setCentresState(p => { const r = p.map(c => c.id === id ? before : c); storage.setProcurementCentres(r); return r; });
          toastRef.current({ title: 'केंद्र अपडेट नहीं हुआ', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteCentre = useCallback((id: string) => {
    if (guardFYLocked()) return;
    if (procurementLots.some(l => l.centreId === id)) {
      toastRef.current({ title: 'केंद्र उपयोग में है', description: 'इस केंद्र के लॉट बन चुके हैं — इसे हटाया नहीं जा सकता।', variant: 'destructive' });
      return;
    }
    const before = centres.find(c => c.id === id);
    if (!before) return;
    setCentresState(prev => { const r = prev.filter(c => c.id !== id); storage.setProcurementCentres(r); return r; });
    supabase.from('procurement_centres').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setCentresState(prev => { const u = [...prev, before]; storage.setProcurementCentres(u); return u; });
        toastRef.current({ title: 'केंद्र हटा नहीं', description: `क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [centres, procurementLots, societyId]);

  // ── MSP rate CRUD + resolver ─────────────────────────────────────────────────────
  const addMspRate = useCallback((data: { cropId: string; seasonId: string; rate: number; effectiveFrom: string }): MSPRate => {
    const now = new Date().toISOString();
    const rec: MSPRate = { id: crypto.randomUUID(), cropId: data.cropId, seasonId: data.seasonId, rate: { amount: data.rate, currency: 'INR' }, effectiveFrom: data.effectiveFrom, createdAt: now, updatedAt: now };
    if (guardFYLocked()) return { ...rec, id: '', createdAt: '', updatedAt: '' };
    setMspRatesState(prev => { const u = [...prev, rec]; storage.setProcurementMspRates(u); return u; });
    supabase.from('procurement_msp_rates').upsert(withSoc(rec)).then(({ error }) => {
      if (error) {
        console.error('MSP rate save error:', error.message); reportError('marketing-save', error.message);
        setMspRatesState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setProcurementMspRates(r); return r; });
        toastRef.current({ title: 'MSP दर सेव नहीं हुई', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_msp_rates block चलाएँ।)`, variant: 'destructive', duration: 12000 });
      }
    });
    return rec;
  }, [societyId]);

  const deleteMspRate = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const before = mspRates.find(r => r.id === id);
    if (!before) return;
    setMspRatesState(prev => { const r = prev.filter(x => x.id !== id); storage.setProcurementMspRates(r); return r; });
    supabase.from('procurement_msp_rates').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setMspRatesState(prev => { const u = [...prev, before]; storage.setProcurementMspRates(u); return u; });
        toastRef.current({ title: 'MSP दर हटी नहीं', description: `क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगी।`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [mspRates, societyId]);

  const resolveMspRate = useCallback(
    (args: { cropId: string; seasonId: string; date?: string }) =>
      pickEffectiveMspRate(mspRates, { cropId: args.cropId, seasonId: args.seasonId, date: args.date || new Date().toISOString().slice(0, 10) }),
    [mspRates],
  );

  // ── Deduction-rule CRUD ────────────────────────────────────────────────────────
  const addDeductionRule = useCallback((data: { code: string; basis: string; rate: number; accountId?: string; name?: string; nameHi?: string }): DeductionRule => {
    const now = new Date().toISOString();
    const rec: DeductionRule = { id: crypto.randomUUID(), code: data.code, basis: data.basis, rate: { value: data.rate }, accountId: data.accountId, name: data.name, nameHi: data.nameHi, createdAt: now, updatedAt: now };
    if (guardFYLocked()) return { ...rec, id: '', createdAt: '', updatedAt: '' };
    setDeductionRulesState(prev => { const u = [...prev, rec]; storage.setProcurementDeductionRules(u); return u; });
    supabase.from('procurement_deduction_rules').upsert(withSoc(rec)).then(({ error }) => {
      if (error) {
        console.error('Deduction rule save error:', error.message); reportError('marketing-save', error.message);
        setDeductionRulesState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setProcurementDeductionRules(r); return r; });
        toastRef.current({ title: 'कटौती नियम सेव नहीं हुआ', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_deduction_rules block + RLS चलाएँ।)`, variant: 'destructive', duration: 12000 });
      }
    });
    return rec;
  }, [societyId]);

  const updateDeductionRule = useCallback((id: string, data: Partial<Pick<DeductionRule, 'code' | 'basis' | 'accountId' | 'name' | 'nameHi'>> & { rate?: number }) => {
    if (guardFYLocked()) return;
    setDeductionRulesState(prev => {
      const before = prev.find(r => r.id === id);
      const u = prev.map(r => r.id === id ? { ...r, ...data, rate: data.rate != null ? { value: data.rate } : r.rate, updatedAt: new Date().toISOString() } : r);
      storage.setProcurementDeductionRules(u);
      const next = u.find(r => r.id === id);
      if (next && before) supabase.from('procurement_deduction_rules').upsert(withSoc(next)).then(({ error }) => {
        if (error) {
          setDeductionRulesState(p => { const r = p.map(x => x.id === id ? before : x); storage.setProcurementDeductionRules(r); return r; });
          toastRef.current({ title: 'कटौती नियम अपडेट नहीं हुआ', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteDeductionRule = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const before = deductionRules.find(r => r.id === id);
    if (!before) return;
    setDeductionRulesState(prev => { const r = prev.filter(x => x.id !== id); storage.setProcurementDeductionRules(r); return r; });
    supabase.from('procurement_deduction_rules').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setDeductionRulesState(prev => { const u = [...prev, before]; storage.setProcurementDeductionRules(u); return u; });
        toastRef.current({ title: 'कटौती नियम हटा नहीं', description: `क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [deductionRules, societyId]);

  // ── Quality-spec CRUD (add/delete; specs are per crop+season+parameter) ────────────
  const addQualitySpec = useCallback((data: { cropId: string; seasonId: string; parameter: string; maxLimit: number }): QualitySpec => {
    const now = new Date().toISOString();
    const rec: QualitySpec = { id: crypto.randomUUID(), cropId: data.cropId, seasonId: data.seasonId, parameter: data.parameter, maxLimit: data.maxLimit, createdAt: now, updatedAt: now };
    if (guardFYLocked()) return { ...rec, id: '', createdAt: '', updatedAt: '' };
    setQualitySpecsState(prev => { const u = [...prev, rec]; storage.setProcurementQualitySpecs(u); return u; });
    supabase.from('procurement_quality_specs').upsert(withSoc(rec)).then(({ error }) => {
      if (error) {
        console.error('Quality spec save error:', error.message); reportError('marketing-save', error.message);
        setQualitySpecsState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setProcurementQualitySpecs(r); return r; });
        toastRef.current({ title: 'गुणवत्ता मानक सेव नहीं हुआ', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_quality_specs block + RLS चलाएँ।)`, variant: 'destructive', duration: 12000 });
      }
    });
    return rec;
  }, [societyId]);

  const deleteQualitySpec = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const before = qualitySpecs.find(s => s.id === id);
    if (!before) return;
    setQualitySpecsState(prev => { const r = prev.filter(x => x.id !== id); storage.setProcurementQualitySpecs(r); return r; });
    supabase.from('procurement_quality_specs').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setQualitySpecsState(prev => { const u = [...prev, before]; storage.setProcurementQualitySpecs(u); return u; });
        toastRef.current({ title: 'गुणवत्ता मानक हटा नहीं', description: `क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [qualitySpecs, societyId]);

  // ── Bardana-type CRUD ──────────────────────────────────────────────────────────
  const addBardanaType = useCallback((data: { name: string; capacityKg: number; nameHi?: string }): BardanaType => {
    const now = new Date().toISOString();
    const rec: BardanaType = { id: crypto.randomUUID(), name: data.name, capacityKg: data.capacityKg, nameHi: data.nameHi, createdAt: now, updatedAt: now };
    if (guardFYLocked()) return { ...rec, id: '', createdAt: '', updatedAt: '' };
    setBardanaTypesState(prev => { const u = [...prev, rec]; storage.setProcurementBardanaTypes(u); return u; });
    supabase.from('procurement_bardana_types').upsert(withSoc(rec)).then(({ error }) => {
      if (error) {
        console.error('Bardana type save error:', error.message); reportError('marketing-save', error.message);
        setBardanaTypesState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setProcurementBardanaTypes(r); return r; });
        toastRef.current({ title: 'बारदाना सेव नहीं हुआ', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_bardana_types block + RLS चलाएँ।)`, variant: 'destructive', duration: 12000 });
      }
    });
    return rec;
  }, [societyId]);

  const deleteBardanaType = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const before = bardanaTypes.find(b => b.id === id);
    if (!before) return;
    setBardanaTypesState(prev => { const r = prev.filter(x => x.id !== id); storage.setProcurementBardanaTypes(r); return r; });
    supabase.from('procurement_bardana_types').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setBardanaTypesState(prev => { const u = [...prev, before]; storage.setProcurementBardanaTypes(u); return u; });
        toastRef.current({ title: 'बारदाना हटा नहीं', description: `क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [bardanaTypes, societyId]);

  // ── Transporter master CRUD (T1) ─────────────────────────────────────────────────
  const addTransporter = useCallback((data: { name: string; nameHi?: string; vehicleNo?: string; phone?: string; ratePerQtl?: number }): Transporter => {
    const now = new Date().toISOString();
    const rec: Transporter = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    if (guardFYLocked()) return { ...rec, id: '', createdAt: '', updatedAt: '' };
    setTransportersState(prev => { const u = [...prev, rec]; storage.setMarketingTransporters(u); return u; });
    supabase.from('marketing_transporters').upsert(withSoc(rec)).then(({ error }) => {
      if (error) {
        console.error('Transporter save error:', error.message); reportError('marketing-save', error.message);
        setTransportersState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setMarketingTransporters(r); return r; });
        toastRef.current({ title: 'ट्रांसपोर्टर सेव नहीं हुआ', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का marketing_transporters block + RLS चलाएँ।)`, variant: 'destructive', duration: 12000 });
      }
    });
    return rec;
  }, [societyId]);

  const updateTransporter = useCallback((id: string, data: Partial<Pick<Transporter, 'name' | 'nameHi' | 'vehicleNo' | 'phone' | 'ratePerQtl'>>) => {
    if (guardFYLocked()) return;
    setTransportersState(prev => {
      const before = prev.find(t => t.id === id);
      const u = prev.map(t => t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t);
      storage.setMarketingTransporters(u);
      const next = u.find(t => t.id === id);
      if (next && before) supabase.from('marketing_transporters').upsert(withSoc(next)).then(({ error }) => {
        if (error) {
          setTransportersState(p => { const r = p.map(t => t.id === id ? before : t); storage.setMarketingTransporters(r); return r; });
          toastRef.current({ title: 'ट्रांसपोर्टर अपडेट नहीं हुआ', description: `क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteTransporter = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const before = transporters.find(t => t.id === id);
    if (!before) return;
    setTransportersState(prev => { const r = prev.filter(t => t.id !== id); storage.setMarketingTransporters(r); return r; });
    supabase.from('marketing_transporters').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setTransportersState(prev => { const u = [...prev, before]; storage.setMarketingTransporters(u); return u; });
        toastRef.current({ title: 'ट्रांसपोर्टर हटा नहीं', description: `क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, variant: 'destructive', duration: 12000 });
      }
    });
  }, [transporters, societyId]);

  // ── Agency receipts (M3c) + procurement commission (M3d) ──────────────────────────
  // Derived from vouchers (the voucher IS the record — no stored balance, mirrors farmer payments).
  // Ledgers are resolved per society (template id or name) — a PACS / sugar chart may carry its own id.
  const mspReceivableId = resolveProcurementAccountId(accounts, 'agencyReceivable');
  const commissionReceivableId = resolveProcurementAccountId(accounts, 'commissionReceivable');
  const commissionIncomeId = resolveProcurementAccountId(accounts, 'commissionIncome');
  const agencyReceipts = vouchers.filter(v => !v.isDeleted && v.refType === AGENCY_RECEIPT_REF_TYPE);
  const commissionReceipts = vouchers.filter(v => !v.isDeleted && v.refType === COMMISSION_RECEIPT_REF_TYPE);
  const [mspBalances, commissionBalances] = useMemo(() => {
    const agencyIds = new Set(agencies.map(a => a.id));
    const balancesFor = (accountId: string | null): AgencyBalances => accountId
      ? agencyBalances({ vouchers, accountId, postingRuleResults: procurementPostingRuleResults, settlements: procurementSettlements, lots: procurementLots, centres, agencyIds })
      : { total: 0, byAgency: {}, unallocated: 0 };
    return [balancesFor(mspReceivableId), balancesFor(commissionReceivableId)];
  }, [vouchers, agencies, centres, procurementLots, procurementPostingRuleResults, procurementSettlements, mspReceivableId, commissionReceivableId]);
  const agencyReceivableOutstanding = mspBalances.total;

  const recordAgencyReceipt = useCallback((data: { amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; note?: string; agencyId?: string; against?: 'msp' | 'commission' }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'receipt', date: '', debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const amt = +Number(data.amount).toFixed(2);
    if (!(amt > 0)) { toastRef.current({ title: 'राशि डालें', description: 'प्राप्त राशि 0 से अधिक होनी चाहिए।', variant: 'destructive' }); return sentinel; }
    const isCommission = data.against === 'commission';
    const crAcc = isCommission ? commissionReceivableId : mspReceivableId;
    if (!crAcc) {
      toastRef.current({ title: isCommission ? 'प्राप्य कमीशन खाता नहीं' : 'प्राप्य MSP खाता नहीं', description: 'इस समिति के चार्ट में यह खाता नहीं है। "लेजर स्वच्छता" पेज पर "डोमेन खाते बनाएँ" दबाएँ।', variant: 'destructive', duration: 12000 });
      return sentinel;
    }
    const agency = data.agencyId ? agencies.find(a => a.id === data.agencyId) : undefined;
    if (data.agencyId && !agency) { toastRef.current({ title: 'एजेंसी नहीं मिली', description: 'एजेंसी दोबारा चुनें।', variant: 'destructive' }); return sentinel; }
    // Over-receipt guard: never more than what is owed (that agency's share, capped by the total).
    const cap = receiptCap(isCommission ? commissionBalances : mspBalances, data.agencyId);
    if (amt > cap) {
      toastRef.current({
        title: 'बकाया से अधिक राशि',
        description: `${agency ? `${agency.nameHi || agency.name} का ` : ''}${isCommission ? 'प्राप्य कमीशन' : 'प्राप्य MSP'} बकाया ₹${cap.toLocaleString('en-IN')} है — ₹${amt.toLocaleString('en-IN')} की रसीद नहीं बन सकती। अधिक राशि आई है तो पहले बकाया/लॉट जाँचें।`,
        variant: 'destructive', duration: 12000,
      });
      return sentinel;
    }
    const drAcc = data.mode === 'bank' ? (data.bankAccountId || storage.defaultBankAccountId(accounts)) : '3301';
    const what = isCommission ? 'कमीशन प्राप्ति' : 'MSP प्राप्ति';
    const voucher = addVoucher({
      type: 'receipt', date: data.date,
      debitAccountId: drAcc, creditAccountId: crAcc, amount: amt,
      lines: [{ id: crypto.randomUUID(), accountId: drAcc, type: 'Dr', amount: amt }, { id: crypto.randomUUID(), accountId: crAcc, type: 'Cr', amount: amt }],
      narration: `एजेंसी से ${what}${agency ? ` — ${agency.code || agency.name}` : ''}${data.note ? ` — ${data.note}` : ''}`,
      refType: isCommission ? COMMISSION_RECEIPT_REF_TYPE : AGENCY_RECEIPT_REF_TYPE,
      refId: agency?.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0]);
    if (!voucher?.id) return sentinel;
    toastRef.current({ title: '✅ रसीद दर्ज', description: `₹${amt.toLocaleString('en-IN')} — बचा बकाया ₹${(cap - amt).toLocaleString('en-IN')}` });
    return voucher;
  }, [agencies, addVoucher, mspReceivableId, commissionReceivableId, mspBalances, commissionBalances, user]);

  const deleteAgencyReceipt = useCallback((voucherId: string) => {
    if (guardFYLocked()) return;
    cancelVoucher(voucherId, 'Agency receipt reversed', user?.name || 'System', { viaParent: true });
  }, [cancelVoucher, user]);

  // ── Procurement commission accrual (M3d) ──────────────────────────────────────────
  const commissionAccruals = vouchers.filter(v => !v.isDeleted && v.refType === COMMISSION_ACCRUAL_REF_TYPE);

  const accrueProcurementCommission = useCallback((data: { lotId: string; amount: number; note?: string; date?: string }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'journal', date: '', debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const amt = +Number(data.amount).toFixed(2);
    if (!(amt > 0)) { toastRef.current({ title: 'कमीशन शून्य', description: 'एजेंसी की commission दर 0 है या procurement value शून्य।', variant: 'destructive' }); return sentinel; }
    if (procurementQualityTests.some(q => q.lotId === data.lotId && isRejectedQuality(q.result))) {
      toastRef.current({ title: 'लॉट अस्वीकृत है', description: 'अस्वीकृत लॉट पर कमीशन दर्ज नहीं हो सकता।', variant: 'destructive', duration: 10000 }); return sentinel;
    }
    // One commission accrual per lot.
    if (vouchers.some(v => !v.isDeleted && v.refType === COMMISSION_ACCRUAL_REF_TYPE && v.refId === data.lotId)) {
      toastRef.current({ title: 'कमीशन पहले से', description: 'इस लॉट का commission पहले ही दर्ज है।', variant: 'destructive' }); return sentinel;
    }
    if (!commissionReceivableId || !commissionIncomeId) {
      toastRef.current({ title: 'कमीशन खाता नहीं', description: 'चार्ट में "प्राप्य कमीशन" या "खरीद कमीशन" खाता नहीं मिला। "लेजर स्वच्छता" पेज पर "डोमेन खाते बनाएँ" दबाएँ।', variant: 'destructive', duration: 12000 }); return sentinel;
    }
    const voucher = addVoucher({
      // Commission is earned on the purchase — dated with the lot's posting (J-Form) day.
      type: 'journal', date: data.date || todayStr(),
      debitAccountId: commissionReceivableId, creditAccountId: commissionIncomeId, amount: amt,
      lines: [{ id: crypto.randomUUID(), accountId: commissionReceivableId, type: 'Dr', amount: amt }, { id: crypto.randomUUID(), accountId: commissionIncomeId, type: 'Cr', amount: amt }],
      narration: `खरीद कमीशन${data.note ? ` — ${data.note}` : ''}`,
      refType: COMMISSION_ACCRUAL_REF_TYPE, refId: data.lotId,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0]);
    if (!voucher?.id) return sentinel;
    toastRef.current({ title: '✅ कमीशन दर्ज', description: `₹${amt.toLocaleString('en-IN')} · ${voucher.date}` });
    return voucher;
  }, [vouchers, procurementQualityTests, commissionReceivableId, commissionIncomeId, addVoucher, user]);

  const deleteCommissionAccrual = useCallback((voucherId: string) => {
    if (guardFYLocked()) return;
    cancelVoucher(voucherId, 'Commission accrual reversed', user?.name || 'System', { viaParent: true });
  }, [cancelVoucher, user]);

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
      seasons,
      addSeason,
      updateSeason,
      deleteSeason,
      agencies,
      addAgency,
      updateAgency,
      deleteAgency,
      centres,
      addCentre,
      updateCentre,
      deleteCentre,
      mspRates,
      addMspRate,
      deleteMspRate,
      resolveMspRate,
      deductionRules,
      addDeductionRule,
      updateDeductionRule,
      deleteDeductionRule,
      qualitySpecs,
      addQualitySpec,
      deleteQualitySpec,
      bardanaTypes,
      addBardanaType,
      deleteBardanaType,
      transporters,
      addTransporter,
      updateTransporter,
      deleteTransporter,
      agencyReceipts,
      commissionReceipts,
      mspBalances,
      commissionBalances,
      agencyReceivableOutstanding,
      recordAgencyReceipt,
      deleteAgencyReceipt,
      commissionAccruals,
      accrueProcurementCommission,
      deleteCommissionAccrual,
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
