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
import { tr } from '@/lib/uiLang';
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { refuseIfWriteBlocked } from '@/lib/connectivity/writeBlock';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { fetchAllPaged } from '@/lib/supabasePaging';
import { unlessEmpty } from '@/lib/emptyTables';
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
import { HIRED_TRIP_REF_TYPE, HIRED_TRIP_PAYMENT_REF_TYPE, tripFreight, tripBalance, type Transporter, type HiredTrip } from '@/lib/marketing/transport';
import type { BardanaMovement } from '@/lib/marketing/bardana';
import { DISPATCH_SHORTAGE_REF_TYPE, AGENCY_BILL_REF_TYPE, dispatchTotals, shortageOf, billBase, billTotals, nextDocNo, matchReceiptsToBills, type ProcurementDispatch, type AgencyBill, type AgencyBillLine } from '@/lib/marketing/agencyBilling';
import { findVoucherOwner } from '@/lib/voucherOwnership';
import { SCHEME_CLAIM_REF_TYPE, SCHEME_RECEIPT_REF_TYPE, schemeClaimBalance, type DealerLicence, type SchemeClaim } from '@/lib/marketing/dealerCompliance';
import { procurementLegsOf, FARMER_PAYMENT_REF_TYPE } from '@/lib/procurement/agentFlow';
import type { Arhtiya } from '@/lib/procurement';
import type { Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { toMinor, toRupees, addMinor } from '@/lib/money';

/** D2a: arhtiya master input. */
export type ArhtiyaInput = { name: string; nameHi?: string; licenceNo?: string; mobile?: string; damiRate?: number; damiBasis?: 'percent' | 'perQtl' };

/** Agency master input (D1 adds the own ledger + commission basis / income ledger). */
export type AgencyInput = { name: string; code: string; kind: string; nameHi?: string; commissionRate?: number; ledgerAccountId?: string; commissionBasis?: 'percent' | 'perQtl'; commissionIncomeAccountId?: string };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ACCOUNT_IDS_CASH = '3301';   // Cash in Hand (template id; same default the agency receipt uses)
/** Net Dr − Cr on one ledger across the given vouchers (rupees, paise-exact). */
function ledgerNet(vs: ReadonlyArray<Voucher>, accountId: string): number {
  let m = 0;
  for (const v of vs) for (const l of getVoucherLines(v)) if (l.accountId === accountId) m = addMinor(m, l.type === 'Dr' ? toMinor(Number(l.amount) || 0) : -toMinor(Number(l.amount) || 0));
  return toRupees(m);
}

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
  addAgency: (data: AgencyInput) => Agency;
  updateAgency: (id: string, data: Partial<AgencyInput>) => void;
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
  addDeductionRule: (data: { code: string; basis: string; rate: number; accountId?: string; name?: string; nameHi?: string; basisUnit?: DeductionRule['basisUnit'] }) => DeductionRule;
  updateDeductionRule: (id: string, data: Partial<Pick<DeductionRule, 'code' | 'basis' | 'accountId' | 'name' | 'nameHi' | 'basisUnit'>> & { rate?: number }) => void;
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

  // D2a — arhtiya master + bardana count register (registers only, no ledger posting)
  arhtiyas: Arhtiya[];
  addArhtiya: (data: ArhtiyaInput) => Arhtiya;
  updateArhtiya: (id: string, data: Partial<ArhtiyaInput>) => void;
  deleteArhtiya: (id: string) => void;
  bardanaMovements: BardanaMovement[];
  addBardanaMovement: (data: Omit<BardanaMovement, 'id' | 'createdAt' | 'updatedAt'>) => BardanaMovement;
  deleteBardanaMovement: (id: string) => void;
  // D3 — agency dispatch (+ posted shortage) and agency bills (+ posted incidentals)
  dispatches: ProcurementDispatch[];
  addDispatch: (data: { date: string; agencyId: string; lotIds: string[]; vehicleNo?: string; transporterId?: string; destination?: string; note?: string }) => ProcurementDispatch;
  acceptDispatch: (id: string, data: { acceptedQty: number; acceptedDate: string; shortageAccountId?: string }) => void;
  deleteDispatch: (id: string) => Promise<void>;
  agencyBills: AgencyBill[];
  addAgencyBill: (data: { date: string; agencyId: string; dispatchIds: string[]; lines: AgencyBillLine[]; note?: string }) => AgencyBill;
  approveAgencyBill: (id: string) => void;
  deleteAgencyBill: (id: string) => Promise<void>;
  /** Receipts per agency for bill matching: agency receipts (MSP) + payments the agency made to farmers directly. */
  billMatching: ReturnType<typeof matchReceiptsToBills>;
  /** Procurement value of a posted lot (net legs of its posting voucher); 0 when not posted. */
  lotValue: (lotId: string) => number;
  // E1 — FCO dealer licences (authorisation + Form O) and the general scheme-claim register
  dealerLicences: DealerLicence[];
  saveDealerLicence: (data: Omit<DealerLicence, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  deleteDealerLicence: (id: string) => void;
  schemeClaims: SchemeClaim[];
  addSchemeClaim: (data: { date: string; schemeName: string; authority?: string; period?: string; amount: number; creditAccountId: string; receivableAccountId: string; note?: string }) => void;
  recordSchemeReceipt: (claimId: string, data: { amount: number; date: string; mode: 'cash' | 'bank'; bankAccountId?: string; reference?: string }) => void;
  deleteSchemeClaim: (id: string) => Promise<void>;
  schemeReceipts: Voucher[];
  // Transport — transporter master (T1)
  transporters: Transporter[];
  addTransporter: (data: { name: string; nameHi?: string; vehicleNo?: string; phone?: string; ratePerQtl?: number; ledgerAccountId?: string }) => Transporter;
  updateTransporter: (id: string, data: Partial<Pick<Transporter, 'name' | 'nameHi' | 'vehicleNo' | 'phone' | 'ratePerQtl' | 'ledgerAccountId'>>) => void;
  // E2 — hired-truck trips (freight posted; payments derived)
  hiredTrips: HiredTrip[];
  addHiredTrip: (data: { date: string; transporterId: string; dispatchId?: string; vehicleNo?: string; fromPlace?: string; toPlace?: string; qty?: number; rate?: number; lump?: number; expenseAccountId: string; note?: string }) => void;
  payHiredTrip: (tripId: string, data: { amount: number; date: string; mode: 'cash' | 'bank'; bankAccountId?: string; reference?: string }) => void;
  deleteHiredTrip: (id: string) => Promise<void>;
  tripPayments: Voucher[];
  deleteTransporter: (id: string) => void;

  // Procurement commission accrual (M3d) — Dr 3314 Commission Receivable / Cr 4206 Procurement Commission.
  commissionAccruals: Voucher[];
  /** Accrue commission for a lot (one per lot). amount = agency rate% × procurement value (caller computes); date = the lot's posting (J-Form) date. */
  /** D1: agencyId routes the accrual — Dr the agency's own ledger (else 3314), Cr its commission income ledger (else 4206). */
  accrueProcurementCommission: (data: { lotId: string; amount: number; note?: string; date?: string; agencyId?: string; quiet?: boolean }) => Voucher;
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
  const { society, procurementLots, procurementPostingRuleResults, procurementSettlements, procurementQualityTests, accounts, vouchers, addVoucher, cancelVoucher, registerVoucherOwner, knownEmptyTables } = useData();
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
        description: tr('Cannot modify data while the Financial Year is audit-locked. (वित्तीय वर्ष लॉक है)', 'Cannot modify data while the Financial Year is audit-locked. (FY is locked)'),
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
  const [arhtiyas, setArhtiyasState] = useState<Arhtiya[]>(() => storage.getProcurementArhtiyas());
  const [bardanaMovements, setBardanaMovementsState] = useState<BardanaMovement[]>(() => storage.getProcurementBardanaMovements());
  const [dispatches, setDispatchesState] = useState<ProcurementDispatch[]>(() => storage.getProcurementDispatches());
  const [agencyBills, setAgencyBillsState] = useState<AgencyBill[]>(() => storage.getProcurementAgencyBills());
  const [dealerLicences, setDealerLicencesState] = useState<DealerLicence[]>(() => storage.getDealerLicences());
  const [schemeClaims, setSchemeClaimsState] = useState<SchemeClaim[]>(() => storage.getSchemeClaims());
  const [hiredTrips, setHiredTripsState] = useState<HiredTrip[]>(() => storage.getHiredTrips());

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
      setArhtiyasState([]);
      setBardanaMovementsState([]);
      setDispatchesState([]);
      setAgencyBillsState([]);
      setDealerLicencesState([]);
      setSchemeClaimsState([]);
      setHiredTripsState([]);
      return;
    }
    const empty = knownEmptyTables(sid);   // S2: one shared call; known-empty tables are not fetched
    applyLoadsTogether([
      [unlessEmpty(empty, 'procurement_crops', () => fetchAllPaged<Crop>('procurement_crops', sid)), setCropsState, storage.getProcurementCrops],
      [unlessEmpty(empty, 'procurement_varieties', () => fetchAllPaged<Variety>('procurement_varieties', sid)), setVarietiesState, storage.getProcurementVarieties],
      [unlessEmpty(empty, 'procurement_seasons', () => fetchAllPaged<Season>('procurement_seasons', sid)), setSeasonsState, storage.getProcurementSeasons],
      [unlessEmpty(empty, 'procurement_agencies', () => fetchAllPaged<Agency>('procurement_agencies', sid)), setAgenciesState, storage.getProcurementAgencies],
      [unlessEmpty(empty, 'procurement_centres', () => fetchAllPaged<ProcurementCentre>('procurement_centres', sid)), setCentresState, storage.getProcurementCentres],
      [unlessEmpty(empty, 'procurement_msp_rates', () => fetchAllPaged<MSPRate>('procurement_msp_rates', sid)), setMspRatesState, storage.getProcurementMspRates],
      [unlessEmpty(empty, 'procurement_deduction_rules', () => fetchAllPaged<DeductionRule>('procurement_deduction_rules', sid)), setDeductionRulesState, storage.getProcurementDeductionRules],
      [unlessEmpty(empty, 'procurement_quality_specs', () => fetchAllPaged<QualitySpec>('procurement_quality_specs', sid)), setQualitySpecsState, storage.getProcurementQualitySpecs],
      [unlessEmpty(empty, 'procurement_bardana_types', () => fetchAllPaged<BardanaType>('procurement_bardana_types', sid)), setBardanaTypesState, storage.getProcurementBardanaTypes],
      [unlessEmpty(empty, 'marketing_transporters', () => fetchAllPaged<Transporter>('marketing_transporters', sid)), setTransportersState, storage.getMarketingTransporters],
      [unlessEmpty(empty, 'procurement_arhtiyas', () => fetchAllPaged<Arhtiya>('procurement_arhtiyas', sid)), setArhtiyasState, storage.getProcurementArhtiyas],
      [unlessEmpty(empty, 'procurement_bardana_movements', () => fetchAllPaged<BardanaMovement>('procurement_bardana_movements', sid)), setBardanaMovementsState, storage.getProcurementBardanaMovements],
      [unlessEmpty(empty, 'procurement_dispatches', () => fetchAllPaged<ProcurementDispatch>('procurement_dispatches', sid)), setDispatchesState, storage.getProcurementDispatches],
      [unlessEmpty(empty, 'procurement_agency_bills', () => fetchAllPaged<AgencyBill>('procurement_agency_bills', sid)), setAgencyBillsState, storage.getProcurementAgencyBills],
      [unlessEmpty(empty, 'marketing_dealer_licences', () => fetchAllPaged<DealerLicence>('marketing_dealer_licences', sid)), setDealerLicencesState, storage.getDealerLicences],
      [unlessEmpty(empty, 'marketing_scheme_claims', () => fetchAllPaged<SchemeClaim>('marketing_scheme_claims', sid)), setSchemeClaimsState, storage.getSchemeClaims],
      [unlessEmpty(empty, 'marketing_hired_trips', () => fetchAllPaged<HiredTrip>('marketing_hired_trips', sid)), setHiredTripsState, storage.getHiredTrips],
    ], 'marketing masters');
  }, [user?.societyId, knownEmptyTables]);

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
        toastRef.current({ title: tr('फसल सेव नहीं हुई', 'Crop not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_crops block चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (First time: run the procurement_crops block of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
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
          toastRef.current({ title: tr('फसल अपडेट नहीं हुई', 'Crop not updated'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteCrop = useCallback((id: string) => {
    if (guardFYLocked()) return;
    // RULE-3: never orphan. Block if any variety or any procurement lot references this crop.
    if (varieties.some(v => v.cropId === id)) {
      toastRef.current({ title: tr('पहले किस्में हटाएँ', 'Delete the varieties first'), description: tr('इस फसल की किस्में मौजूद हैं — पहले उन्हें हटाएँ, फिर फसल हटाएँ।', 'This crop has varieties — delete them first, then delete the crop.'), variant: 'destructive' });
      return;
    }
    if (procurementLots.some(l => l.cropId === id)) {
      toastRef.current({ title: tr('फसल उपयोग में है', 'Crop is in use'), description: tr('इस फसल के लॉट बन चुके हैं — इसे हटाया नहीं जा सकता।', 'Lots have already been made for this crop — it cannot be deleted.'), variant: 'destructive' });
      return;
    }
    const before = crops.find(c => c.id === id);
    if (!before) return;
    setCropsState(prev => { const r = prev.filter(c => c.id !== id); storage.setProcurementCrops(r); return r; });
    supabase.from('procurement_crops').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setCropsState(prev => { const u = [...prev, before]; storage.setProcurementCrops(u); return u; });
        toastRef.current({ title: tr('फसल हटी नहीं', 'Crop not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगी।`, `Not deleted from the cloud — ${error.message}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('फसलें सेव नहीं हुईं', 'Crops not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. (पहली बार: supabase-tables.sql का procurement_crops block चलाएँ।)`, `Not saved to the cloud — ${error.message}. (First time: run the procurement_crops block of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
      } else {
        toastRef.current({ title: tr('✅ मानक फसलें जोड़ी गईं', '✅ Standard crops added'), description: tr('गेहूँ · धान · सरसों · चना · बाजरा', 'Wheat · Paddy · Mustard · Gram · Bajra') });
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
        toastRef.current({ title: tr('किस्म सेव नहीं हुई', 'Variety not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_varieties block चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (First time: run the procurement_varieties block of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
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
          toastRef.current({ title: tr('किस्म अपडेट नहीं हुई', 'Variety not updated'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteVariety = useCallback((id: string) => {
    if (guardFYLocked()) return;
    if (procurementLots.some(l => l.varietyId === id)) {
      toastRef.current({ title: tr('किस्म उपयोग में है', 'Variety is in use'), description: tr('इस किस्म के लॉट बन चुके हैं — इसे हटाया नहीं जा सकता।', 'Lots have already been made for this variety — it cannot be deleted.'), variant: 'destructive' });
      return;
    }
    const before = varieties.find(v => v.id === id);
    if (!before) return;
    setVarietiesState(prev => { const r = prev.filter(v => v.id !== id); storage.setProcurementVarieties(r); return r; });
    supabase.from('procurement_varieties').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setVarietiesState(prev => { const u = [...prev, before]; storage.setProcurementVarieties(u); return u; });
        toastRef.current({ title: tr('किस्म हटी नहीं', 'Variety not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगी।`, `Not deleted from the cloud — ${error.message}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('सीज़न सेव नहीं हुआ', 'Season not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_seasons block चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (First time: run the procurement_seasons block of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
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
          toastRef.current({ title: tr('सीज़न अपडेट नहीं हुआ', 'Season not updated'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteSeason = useCallback((id: string) => {
    if (guardFYLocked()) return;
    if (procurementLots.some(l => l.seasonId === id)) {
      toastRef.current({ title: tr('सीज़न उपयोग में है', 'Season is in use'), description: tr('इस सीज़न के लॉट बन चुके हैं — इसे हटाया नहीं जा सकता।', 'Lots have already been made for this season — it cannot be deleted.'), variant: 'destructive' });
      return;
    }
    const before = seasons.find(s => s.id === id);
    if (!before) return;
    setSeasonsState(prev => { const r = prev.filter(s => s.id !== id); storage.setProcurementSeasons(r); return r; });
    supabase.from('procurement_seasons').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setSeasonsState(prev => { const u = [...prev, before]; storage.setProcurementSeasons(u); return u; });
        toastRef.current({ title: tr('सीज़न हटा नहीं', 'Season not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, `Not deleted from the cloud — ${error.message}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [seasons, procurementLots, societyId]);

  // ── Agency CRUD ────────────────────────────────────────────────────────────────
  // D1 (migration 136): ledgerAccountId / commissionBasis / commissionIncomeAccountId are written in a
  // step-2 update (RULE 1) — the base row saves before the migration; a miss is a mild warning.
  const persistAgencyExtras = (a: Agency) => {
    const extras = { ledgerAccountId: a.ledgerAccountId ?? null, commissionBasis: a.commissionBasis ?? null, commissionIncomeAccountId: a.commissionIncomeAccountId ?? null };
    if (!a.ledgerAccountId && !a.commissionBasis && !a.commissionIncomeAccountId) return;
    supabase.from('procurement_agencies').update(extras).eq('id', a.id).then(({ error }) => {
      if (!error) return;
      reportError('write-partial', error.message, { at: 'procurement_agencies D1 columns (migration 136)' });
      toastRef.current({ title: tr('एजेंसी सेव हुई, खाता-सेटिंग नहीं', 'Agency saved, account settings not saved'), description: tr(`एजेंसी का अपना खाता / कमीशन-आधार क्लाउड में सेव नहीं हुआ (migration 136 चलाएँ)। ${error.message}`, `The agency's own account / commission basis was not saved to the cloud (run migration 136). ${error.message}`), variant: 'default', duration: 12000 });
    });
  };
  const agencyBase = (a: Agency) => { const { ledgerAccountId: _l, commissionBasis: _b, commissionIncomeAccountId: _c, ...base } = a; return base; };

  const addAgency = useCallback((data: AgencyInput): Agency => {
    const now = new Date().toISOString();
    const empty = { ...data, id: '', createdAt: '', updatedAt: '' } as Agency;
    if (guardFYLocked()) return empty;
    const agency: Agency = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    setAgenciesState(prev => { const u = [...prev, agency]; storage.setProcurementAgencies(u); return u; });
    supabase.from('procurement_agencies').upsert(withSoc(agencyBase(agency))).then(({ error }) => {
      if (!error) { persistAgencyExtras(agency); return; }
      {
        console.error('Agency save error:', error.message); reportError('marketing-save', error.message);
        setAgenciesState(prev => { const r = prev.filter(a => a.id !== agency.id); storage.setProcurementAgencies(r); return r; });
        toastRef.current({ title: tr('एजेंसी सेव नहीं हुई', 'Agency not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_agencies block चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (First time: run the procurement_agencies block of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
      }
    });
    return agency;
  }, [societyId]);

  const updateAgency = useCallback((id: string, data: Partial<AgencyInput>) => {
    if (guardFYLocked()) return;
    setAgenciesState(prev => {
      const before = prev.find(a => a.id === id);
      const u = prev.map(a => a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a);
      storage.setProcurementAgencies(u);
      const next = u.find(a => a.id === id);
      if (next && before) supabase.from('procurement_agencies').upsert(withSoc(agencyBase(next))).then(({ error }) => {
        if (!error) { persistAgencyExtras(next); return; }
        {
          setAgenciesState(p => { const r = p.map(a => a.id === id ? before : a); storage.setProcurementAgencies(r); return r; });
          toastRef.current({ title: tr('एजेंसी अपडेट नहीं हुई', 'Agency not updated'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteAgency = useCallback((id: string) => {
    if (guardFYLocked()) return;
    if (centres.some(c => c.agencyId === id)) {
      toastRef.current({ title: tr('पहले केंद्र हटाएँ', 'Delete the centres first'), description: tr('इस एजेंसी के केंद्र मौजूद हैं — पहले उन्हें हटाएँ, फिर एजेंसी हटाएँ।', 'This agency has centres — delete them first, then delete the agency.'), variant: 'destructive' });
      return;
    }
    const before = agencies.find(a => a.id === id);
    if (!before) return;
    setAgenciesState(prev => { const r = prev.filter(a => a.id !== id); storage.setProcurementAgencies(r); return r; });
    supabase.from('procurement_agencies').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setAgenciesState(prev => { const u = [...prev, before]; storage.setProcurementAgencies(u); return u; });
        toastRef.current({ title: tr('एजेंसी हटी नहीं', 'Agency not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगी।`, `Not deleted from the cloud — ${error.message}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('केंद्र सेव नहीं हुआ', 'Centre not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_centres block चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (First time: run the procurement_centres block of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
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
          toastRef.current({ title: tr('केंद्र अपडेट नहीं हुआ', 'Centre not updated'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteCentre = useCallback((id: string) => {
    if (guardFYLocked()) return;
    if (procurementLots.some(l => l.centreId === id)) {
      toastRef.current({ title: tr('केंद्र उपयोग में है', 'Centre is in use'), description: tr('इस केंद्र के लॉट बन चुके हैं — इसे हटाया नहीं जा सकता।', 'Lots have already been made at this centre — it cannot be deleted.'), variant: 'destructive' });
      return;
    }
    const before = centres.find(c => c.id === id);
    if (!before) return;
    setCentresState(prev => { const r = prev.filter(c => c.id !== id); storage.setProcurementCentres(r); return r; });
    supabase.from('procurement_centres').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setCentresState(prev => { const u = [...prev, before]; storage.setProcurementCentres(u); return u; });
        toastRef.current({ title: tr('केंद्र हटा नहीं', 'Centre not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, `Not deleted from the cloud — ${error.message}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('MSP दर सेव नहीं हुई', 'MSP rate not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_msp_rates block चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (First time: run the procurement_msp_rates block of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('MSP दर हटी नहीं', 'MSP rate not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगी।`, `Not deleted from the cloud — ${error.message}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [mspRates, societyId]);

  const resolveMspRate = useCallback(
    (args: { cropId: string; seasonId: string; date?: string }) =>
      pickEffectiveMspRate(mspRates, { cropId: args.cropId, seasonId: args.seasonId, date: args.date || new Date().toISOString().slice(0, 10) }),
    [mspRates],
  );

  // ── Deduction-rule CRUD ────────────────────────────────────────────────────────
  // D2a (migration 137): basisUnit is a step-2 write. A per-quintal / per-bag rule whose unit did NOT
  // save would read back as a PERCENT rule (₹10/qtl → 10% of gross) — so that case rolls the rule back
  // (destructive toast); a plain % rule needs no step 2.
  const persistRuleUnit = (r: DeductionRule, rollback: () => void, prevUnit?: DeductionRule['basisUnit']) => {
    if (!r.basisUnit && !prevUnit) return;
    supabase.from('procurement_deduction_rules').update({ basisUnit: r.basisUnit ?? null }).eq('id', r.id).then(({ error }) => {
      if (!error) return;
      reportError('write-partial', error.message, { at: 'procurement_deduction_rules.basisUnit (migration 137)' });
      rollback();
      toastRef.current({ title: tr('कटौती नियम सेव नहीं हुआ', 'Deduction rule not saved'), description: tr(`प्रति क्विंटल / प्रति बोरी इकाई क्लाउड में सेव नहीं हुई (migration 137 चलाएँ) — गलत % कटौती से बचाने के लिए नियम वापस लिया गया। ${error.message}`, `The per-quintal / per-bag unit was not saved to the cloud (run migration 137) — the rule was withdrawn to avoid a wrong % deduction. ${error.message}`), variant: 'destructive', duration: 15000 });
    });
  };
  const addDeductionRule = useCallback((data: { code: string; basis: string; rate: number; accountId?: string; name?: string; nameHi?: string; basisUnit?: DeductionRule['basisUnit'] }): DeductionRule => {
    const now = new Date().toISOString();
    const rec: DeductionRule = { id: crypto.randomUUID(), code: data.code, basis: data.basis, rate: { value: data.rate }, accountId: data.accountId, name: data.name, nameHi: data.nameHi, basisUnit: data.basisUnit && data.basisUnit !== 'percent' ? data.basisUnit : undefined, createdAt: now, updatedAt: now };
    if (guardFYLocked()) return { ...rec, id: '', createdAt: '', updatedAt: '' };
    setDeductionRulesState(prev => { const u = [...prev, rec]; storage.setProcurementDeductionRules(u); return u; });
    const { basisUnit: _unit, ...recBase } = rec;
    supabase.from('procurement_deduction_rules').upsert(withSoc(recBase)).then(({ error }) => {
      if (!error) { persistRuleUnit(rec, () => setDeductionRulesState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setProcurementDeductionRules(r); return r; })); return; }
      {
        console.error('Deduction rule save error:', error.message); reportError('marketing-save', error.message);
        setDeductionRulesState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setProcurementDeductionRules(r); return r; });
        toastRef.current({ title: tr('कटौती नियम सेव नहीं हुआ', 'Deduction rule not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_deduction_rules block + RLS चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (First time: run the procurement_deduction_rules block + RLS of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
      }
    });
    return rec;
  }, [societyId]);

  const updateDeductionRule = useCallback((id: string, data: Partial<Pick<DeductionRule, 'code' | 'basis' | 'accountId' | 'name' | 'nameHi' | 'basisUnit'>> & { rate?: number }) => {
    if (guardFYLocked()) return;
    setDeductionRulesState(prev => {
      const before = prev.find(r => r.id === id);
      const u = prev.map(r => r.id === id ? { ...r, ...data, rate: data.rate != null ? { value: data.rate } : r.rate, updatedAt: new Date().toISOString() } : r);
      storage.setProcurementDeductionRules(u);
      const next = u.find(r => r.id === id);
      if (next && before) supabase.from('procurement_deduction_rules').upsert(withSoc((({ basisUnit: _u, ...b }) => b)(next))).then(({ error }) => {
        if (!error) { persistRuleUnit(next, () => setDeductionRulesState(p => { const r = p.map(x => x.id === id ? before : x); storage.setProcurementDeductionRules(r); return r; }), before.basisUnit); return; }
        {
          setDeductionRulesState(p => { const r = p.map(x => x.id === id ? before : x); storage.setProcurementDeductionRules(r); return r; });
          toastRef.current({ title: tr('कटौती नियम अपडेट नहीं हुआ', 'Deduction rule not updated'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('कटौती नियम हटा नहीं', 'Deduction rule not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, `Not deleted from the cloud — ${error.message}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('गुणवत्ता मानक सेव नहीं हुआ', 'Quality spec not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_quality_specs block + RLS चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (First time: run the procurement_quality_specs block + RLS of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('गुणवत्ता मानक हटा नहीं', 'Quality spec not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, `Not deleted from the cloud — ${error.message}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('बारदाना सेव नहीं हुआ', 'Bardana (gunny bag) type not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का procurement_bardana_types block + RLS चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (First time: run the procurement_bardana_types block + RLS of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
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
        toastRef.current({ title: tr('बारदाना हटा नहीं', 'Bardana (gunny bag) type not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, `Not deleted from the cloud — ${error.message}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [bardanaTypes, societyId]);

  // ── D2a: Arhtiya master CRUD (register only) ────────────────────────────────────────
  const addArhtiya = useCallback((data: ArhtiyaInput): Arhtiya => {
    const now = new Date().toISOString();
    const rec: Arhtiya = { licenceNo: '', ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    if (guardFYLocked()) return { ...rec, id: '' };
    if (!data.name?.trim()) { toastRef.current({ title: tr('आढ़ती का नाम आवश्यक', 'Arhtiya name is required'), variant: 'destructive' }); return { ...rec, id: '' }; }
    setArhtiyasState(prev => { const u = [...prev, rec]; storage.setProcurementArhtiyas(u); return u; });
    supabase.from('procurement_arhtiyas').upsert(withSoc(rec)).then(({ error }) => {
      if (!error) return;
      console.error('Arhtiya save error:', error.message); reportError('marketing-save', error.message);
      setArhtiyasState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setProcurementArhtiyas(r); return r; });
      toastRef.current({ title: tr('आढ़ती सेव नहीं हुआ', 'Arhtiya not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (migration 137 चलाई है?)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (Has migration 137 been run?)`), variant: 'destructive', duration: 12000 });
    });
    return rec;
  }, [societyId]);

  const updateArhtiya = useCallback((id: string, data: Partial<ArhtiyaInput>) => {
    if (guardFYLocked()) return;
    const before = arhtiyas.find(a => a.id === id);
    if (!before) return;
    const next: Arhtiya = { ...before, ...data, updatedAt: new Date().toISOString() };
    setArhtiyasState(prev => { const u = prev.map(a => a.id === id ? next : a); storage.setProcurementArhtiyas(u); return u; });
    supabase.from('procurement_arhtiyas').upsert(withSoc(next)).then(({ error }) => {
      if (!error) return;
      setArhtiyasState(p => { const r = p.map(a => a.id === id ? before : a); storage.setProcurementArhtiyas(r); return r; });
      toastRef.current({ title: tr('आढ़ती अपडेट नहीं हुआ', 'Arhtiya not updated'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
    });
  }, [arhtiyas, societyId]);

  const deleteArhtiya = useCallback((id: string) => {
    if (guardFYLocked()) return;
    if (procurementLots.some(l => l.arhtiyaId === id) || bardanaMovements.some(m => m.partyType === 'arhtiya' && m.partyId === id)) {
      toastRef.current({ title: tr('हटा नहीं सकते', 'Cannot delete'), description: tr('इस आढ़ती के लॉट या बारदाना एंट्री मौजूद हैं।', 'This arhtiya has lots or bardana entries.'), variant: 'destructive', duration: 9000 });
      return;
    }
    const before = arhtiyas.find(a => a.id === id);
    if (!before) return;
    setArhtiyasState(prev => { const r = prev.filter(a => a.id !== id); storage.setProcurementArhtiyas(r); return r; });
    supabase.from('procurement_arhtiyas').delete().eq('id', id).eq('society_id', societyId).select('id').then(({ data, error }) => {
      if (!error && data?.length) return;
      setArhtiyasState(prev => { const u = [...prev, before]; storage.setProcurementArhtiyas(u); return u; });
      toastRef.current({ title: tr('आढ़ती हटा नहीं', 'Arhtiya not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error?.message || 'अनुमति नहीं'}. Refresh करने पर वापस दिखेगा।`, `Not deleted from the cloud — ${error?.message || 'not permitted'}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
    });
  }, [arhtiyas, procurementLots, bardanaMovements, societyId]);

  // ── D2a: Bardana count register ─────────────────────────────────────────────────────
  const addBardanaMovement = useCallback((data: Omit<BardanaMovement, 'id' | 'createdAt' | 'updatedAt'>): BardanaMovement => {
    const now = new Date().toISOString();
    const rec: BardanaMovement = { ...data, bags: Math.trunc(Number(data.bags) || 0), id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    if (guardFYLocked()) return { ...rec, id: '' };
    if (!(rec.bags > 0)) { toastRef.current({ title: tr('बोरी संख्या डालें', 'Enter the number of bags'), description: tr('बोरियों की संख्या 0 से अधिक होनी चाहिए।', 'The number of bags must be more than 0.'), variant: 'destructive' }); return { ...rec, id: '' }; }
    if (!rec.date) { toastRef.current({ title: tr('तारीख डालें', 'Enter the date'), variant: 'destructive' }); return { ...rec, id: '' }; }
    setBardanaMovementsState(prev => { const u = [...prev, rec]; storage.setProcurementBardanaMovements(u); return u; });
    supabase.from('procurement_bardana_movements').upsert(withSoc(rec)).then(({ error }) => {
      if (!error) return;
      console.error('Bardana save error:', error.message); reportError('marketing-save', error.message);
      setBardanaMovementsState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setProcurementBardanaMovements(r); return r; });
      toastRef.current({ title: tr('बारदाना एंट्री सेव नहीं हुई', 'Bardana entry not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (migration 137 चलाई है?)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (Has migration 137 been run?)`), variant: 'destructive', duration: 12000 });
    });
    return rec;
  }, [societyId]);

  const deleteBardanaMovement = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const before = bardanaMovements.find(m => m.id === id);
    if (!before) return;
    setBardanaMovementsState(prev => { const r = prev.filter(m => m.id !== id); storage.setProcurementBardanaMovements(r); return r; });
    supabase.from('procurement_bardana_movements').delete().eq('id', id).eq('society_id', societyId).select('id').then(({ data, error }) => {
      if (!error && data?.length) return;
      setBardanaMovementsState(prev => { const u = [...prev, before]; storage.setProcurementBardanaMovements(u); return u; });
      toastRef.current({ title: tr('एंट्री हटी नहीं', 'Entry not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error?.message || 'अनुमति नहीं'}. Refresh करने पर वापस दिखेगी।`, `Not deleted from the cloud — ${error?.message || 'not permitted'}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
    });
  }, [bardanaMovements, societyId]);

  // ── Transporter master CRUD (T1) ─────────────────────────────────────────────────
  // E2 (migration 141): ledgerAccountId is a step-2 write (RULE 1) — the master saves before the migration.
  const persistTransporterLedger = (t: Transporter) => {
    if (t.ledgerAccountId === undefined) return;
    supabase.from('marketing_transporters').update({ ledgerAccountId: t.ledgerAccountId || null }).eq('id', t.id).then(({ error }) => {
      if (!error) return;
      reportError('write-partial', error.message, { at: 'marketing_transporters.ledgerAccountId (migration 141)' });
      toastRef.current({ title: tr('ट्रांसपोर्टर सेव हुआ, खाता नहीं', 'Transporter saved, account not saved'), description: tr(`ट्रांसपोर्टर का खाता क्लाउड में सेव नहीं हुआ (migration 141 चलाएँ)। ${error.message}`, `The transporter's account was not saved to the cloud (run migration 141). ${error.message}`), variant: 'default', duration: 12000 });
    });
  };
  const transporterBase = (t: Transporter) => { const { ledgerAccountId: _l, ...b } = t; return b; };

  const addTransporter = useCallback((data: { name: string; nameHi?: string; vehicleNo?: string; phone?: string; ratePerQtl?: number; ledgerAccountId?: string }): Transporter => {
    const now = new Date().toISOString();
    const rec: Transporter = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    if (guardFYLocked()) return { ...rec, id: '', createdAt: '', updatedAt: '' };
    setTransportersState(prev => { const u = [...prev, rec]; storage.setMarketingTransporters(u); return u; });
    supabase.from('marketing_transporters').upsert(withSoc(transporterBase(rec))).then(({ error }) => {
      if (!error) { persistTransporterLedger(rec); return; }
      {
        console.error('Transporter save error:', error.message); reportError('marketing-save', error.message);
        setTransportersState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setMarketingTransporters(r); return r; });
        toastRef.current({ title: tr('ट्रांसपोर्टर सेव नहीं हुआ', 'Transporter not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का marketing_transporters block + RLS चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refresh will not leave anything wrong. (First time: run the marketing_transporters block + RLS of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
      }
    });
    return rec;
  }, [societyId]);

  const updateTransporter = useCallback((id: string, data: Partial<Pick<Transporter, 'name' | 'nameHi' | 'vehicleNo' | 'phone' | 'ratePerQtl' | 'ledgerAccountId'>>) => {
    if (guardFYLocked()) return;
    setTransportersState(prev => {
      const before = prev.find(t => t.id === id);
      const u = prev.map(t => t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t);
      storage.setMarketingTransporters(u);
      const next = u.find(t => t.id === id);
      if (next && before) supabase.from('marketing_transporters').upsert(withSoc(transporterBase(next))).then(({ error }) => {
        if (!error) { persistTransporterLedger(next); return; }
        {
          setTransportersState(p => { const r = p.map(t => t.id === id ? before : t); storage.setMarketingTransporters(r); return r; });
          toastRef.current({ title: tr('ट्रांसपोर्टर अपडेट नहीं हुआ', 'Transporter not updated'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा।`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back.`), variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteTransporter = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const before = transporters.find(t => t.id === id);
    if (!before) return;
    if (hiredTrips.some(t => !t.isDeleted && t.transporterId === id)) {
      toastRef.current({ title: tr('हटा नहीं सकते', 'Cannot delete'), description: tr('इस ट्रांसपोर्टर की trips दर्ज हैं।', 'This transporter has trips recorded.'), variant: 'destructive', duration: 9000 });
      return;
    }
    setTransportersState(prev => { const r = prev.filter(t => t.id !== id); storage.setMarketingTransporters(r); return r; });
    supabase.from('marketing_transporters').delete().eq('id', id).eq('society_id', societyId).then(({ error }) => {
      if (error) {
        setTransportersState(prev => { const u = [...prev, before]; storage.setMarketingTransporters(u); return u; });
        toastRef.current({ title: tr('ट्रांसपोर्टर हटा नहीं', 'Transporter not deleted'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error.message}. Refresh करने पर वापस दिखेगा।`, `Not deleted from the cloud — ${error.message}. It will show again on Refresh.`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [transporters, hiredTrips, societyId]);

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
    const msp = balancesFor(mspReceivableId), com = balancesFor(commissionReceivableId);
    // D1: an agency with its OWN receivable ledger (MSP and commission both post there) is owed that
    // ledger's net balance. Anything still traced to it on the pooled 3308/3314 (posted before the
    // ledger was set) stays receivable as "unallocated" — a receipt without an agency clears it.
    const live = vouchers.filter(v => !v.isDeleted && v.approvalStatus !== 'rejected');
    for (const a of agencies) {
      if (!a.ledgerAccountId) continue;
      const own = ledgerNet(live, a.ledgerAccountId);
      msp.unallocated = r2(msp.unallocated + (msp.byAgency[a.id] ?? 0)); msp.byAgency[a.id] = own; msp.total = r2(msp.total + own);
      com.unallocated = r2(com.unallocated + (com.byAgency[a.id] ?? 0)); delete com.byAgency[a.id];
    }
    return [msp, com];
  }, [vouchers, agencies, centres, procurementLots, procurementPostingRuleResults, procurementSettlements, mspReceivableId, commissionReceivableId]);
  // The pooled 3308 / 3314 alone (receipts without an own-ledger agency credit these).
  const pooledNet = (accountId: string | null) => accountId ? ledgerNet(vouchers.filter(v => !v.isDeleted && v.approvalStatus !== 'rejected'), accountId) : 0;
  const agencyReceivableOutstanding = mspBalances.total;

  const recordAgencyReceipt = useCallback((data: { amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; note?: string; agencyId?: string; against?: 'msp' | 'commission' }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'receipt', date: '', debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const amt = +Number(data.amount).toFixed(2);
    if (!(amt > 0)) { toastRef.current({ title: tr('राशि डालें', 'Enter the amount'), description: tr('प्राप्त राशि 0 से अधिक होनी चाहिए।', 'The amount received must be more than 0.'), variant: 'destructive' }); return sentinel; }
    const isCommission = data.against === 'commission';
    const agencyRow = data.agencyId ? agencies.find(a => a.id === data.agencyId) : undefined;
    // D1: an agency with its own ledger is credited there for MSP AND commission alike.
    const crAcc = agencyRow?.ledgerAccountId || (isCommission ? commissionReceivableId : mspReceivableId);
    if (!crAcc) {
      toastRef.current({ title: isCommission ? tr('प्राप्य कमीशन खाता नहीं', 'Commission receivable account missing') : tr('प्राप्य MSP खाता नहीं', 'MSP receivable account missing'), description: tr('इस समिति के चार्ट में यह खाता नहीं है। "लेजर स्वच्छता" पेज पर "डोमेन खाते बनाएँ" दबाएँ।', 'This account is not in this society\'s chart. On the "Ledger Hygiene" page, press "Create domain accounts".'), variant: 'destructive', duration: 12000 });
      return sentinel;
    }
    const agency = data.agencyId ? agencies.find(a => a.id === data.agencyId) : undefined;
    if (data.agencyId && !agency) { toastRef.current({ title: tr('एजेंसी नहीं मिली', 'Agency not found'), description: tr('एजेंसी दोबारा चुनें।', 'Select the agency again.'), variant: 'destructive' }); return sentinel; }
    // Over-receipt guard: never more than what is owed (that agency's share, capped by the total).
    const cap = agency?.ledgerAccountId
      ? Math.max(0, mspBalances.byAgency[agency.id] ?? 0)
      : data.agencyId
        ? receiptCap(isCommission ? commissionBalances : mspBalances, data.agencyId)
        : Math.max(0, pooledNet(isCommission ? commissionReceivableId : mspReceivableId));
    if (amt > cap) {
      toastRef.current({
        title: tr('बकाया से अधिक राशि', 'Amount is more than the outstanding'),
        description: tr(`${agency ? `${agency.nameHi || agency.name} का ` : ''}${isCommission ? 'प्राप्य कमीशन' : 'प्राप्य MSP'} बकाया ₹${cap.toLocaleString('en-IN')} है — ₹${amt.toLocaleString('en-IN')} की रसीद नहीं बन सकती। अधिक राशि आई है तो पहले बकाया/लॉट जाँचें।`, `${agency ? `${agency.name || agency.nameHi}: ` : ''}${isCommission ? 'Commission receivable' : 'MSP receivable'} outstanding is ₹${cap.toLocaleString('en-IN')} — a receipt of ₹${amt.toLocaleString('en-IN')} cannot be made. If a larger amount has come in, first check the outstanding/lots.`),
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
    toastRef.current({ title: tr('✅ रसीद दर्ज', '✅ Receipt recorded'), description: tr(`₹${amt.toLocaleString('en-IN')} — बचा बकाया ₹${(cap - amt).toLocaleString('en-IN')}`, `₹${amt.toLocaleString('en-IN')} — outstanding left ₹${(cap - amt).toLocaleString('en-IN')}`) });
    return voucher;
  }, [agencies, addVoucher, mspReceivableId, commissionReceivableId, mspBalances, commissionBalances, user]);

  const deleteAgencyReceipt = useCallback((voucherId: string) => {
    if (guardFYLocked()) return;
    cancelVoucher(voucherId, 'Agency receipt reversed', user?.name || 'System', { viaParent: true });
  }, [cancelVoucher, user]);

  // ── D3: agency dispatch + shortage, agency bills ───────────────────────────────────────
  // Founder 2026-10-25: shortage is POSTED (Dr shortage ledger / Cr agency receivable) and a bill's
  // incidentals are POSTED on approval (Dr agency receivable / Cr each line's ledger). Each voucher
  // is owned by its dispatch / bill (cancel only through it); the voucher is saved FIRST and the row
  // follows its onSaved — a row that then fails cancels the voucher again (RULE 1).
  const dispatchesRef = useRef(dispatches); dispatchesRef.current = dispatches;
  const billsRef = useRef(agencyBills); billsRef.current = agencyBills;
  useEffect(() => registerVoucherOwner('marketing-agency', id => findVoucherOwner([
    { label: tr('एजेंसी डिस्पैच (कमी)', 'Agency dispatch (shortage)'), docs: dispatchesRef.current },
    { label: tr('एजेंसी बिल', 'Agency bill'), docs: billsRef.current },
  ], id)), [registerVoucherOwner]);

  const liveVouchers = useMemo(() => vouchers.filter(v => !v.isDeleted && v.approvalStatus !== 'rejected'), [vouchers]);
  const lotValue = useCallback((lotId: string): number => {
    const rr = procurementPostingRuleResults.find(r => r.lotId === lotId);
    const ev = rr ? liveVouchers.find(v => v.origin === 'engine' && v.refType === 'posting.rule.result' && v.refId === rr.id && !v.reversedBy) : undefined;
    return ev ? procurementLegsOf(ev).value : 0;
  }, [procurementPostingRuleResults, liveVouchers]);
  const agencyOfLot = useCallback((lotId: string) => {
    const l = procurementLots.find(x => x.id === lotId);
    return l ? centres.find(c => c.id === l.centreId)?.agencyId : undefined;
  }, [procurementLots, centres]);
  const receivableOf = (agencyId: string) => agencies.find(a => a.id === agencyId)?.ledgerAccountId || mspReceivableId;
  const persistRow = <T extends object>(table: string, row: T) => supabase.from(table).upsert(withSoc(row));

  const addDispatch = useCallback((data: { date: string; agencyId: string; lotIds: string[]; vehicleNo?: string; transporterId?: string; destination?: string; note?: string }): ProcurementDispatch => {
    const now = new Date().toISOString();
    const blank = { id: '', dispatchNo: '', date: data.date, agencyId: data.agencyId, lotIds: [], dispatchedQty: 0, dispatchedValue: 0, status: 'dispatched', createdAt: '', updatedAt: '' } as ProcurementDispatch;
    if (guardFYLocked()) return blank;
    const refuse = (d: string) => { toastRef.current({ title: tr('डिस्पैच नहीं बना', 'Dispatch not created'), description: d, variant: 'destructive', duration: 10000 }); return blank; };
    if (!data.agencyId || !agencies.some(a => a.id === data.agencyId)) return refuse(tr('एजेंसी चुनें।', 'Select an agency.'));
    if (!data.lotIds.length) return refuse(tr('कम से कम एक लॉट चुनें।', 'Select at least one lot.'));
    const inLive = new Set(dispatches.filter(d => !d.isDeleted).flatMap(d => d.lotIds));
    const lots = data.lotIds.map(id => procurementLots.find(l => l.id === id));
    for (const l of lots) {
      if (!l) return refuse(tr('कोई लॉट नहीं मिला — पेज refresh करें।', 'No lot found — refresh the page.'));
      if (l.cancelledAt) return refuse(tr('रद्द लॉट डिस्पैच नहीं हो सकता।', 'A cancelled lot cannot be dispatched.'));
      if (procurementQualityTests.some(q => q.lotId === l.id && isRejectedQuality(q.result))) return refuse(tr('अस्वीकृत लॉट डिस्पैच नहीं हो सकता।', 'A rejected lot cannot be dispatched.'));
      if (!(lotValue(l.id) > 0)) return refuse(tr('केवल बहीखाते में पोस्ट हुए लॉट डिस्पैच हो सकते हैं।', 'Only lots posted to the books can be dispatched.'));
      if (inLive.has(l.id)) return refuse(tr('एक लॉट पहले से किसी डिस्पैच में है।', 'A lot is already in another dispatch.'));
      const ag = agencyOfLot(l.id);
      if (ag && ag !== data.agencyId) return refuse(tr('चुने गए लॉट किसी दूसरी एजेंसी के केंद्र के हैं।', 'The selected lots belong to another agency\'s centre.'));
    }
    const tot = dispatchTotals(lots.map(l => ({ quantity: l!.quantity, value: lotValue(l!.id), bags: l!.bags })));
    const rec: ProcurementDispatch = {
      id: crypto.randomUUID(), dispatchNo: nextDocNo('DSP', dispatches.map(d => d.dispatchNo)), date: data.date, agencyId: data.agencyId, lotIds: [...data.lotIds],
      vehicleNo: data.vehicleNo?.trim() || undefined, transporterId: data.transporterId || undefined, destination: data.destination?.trim() || undefined,
      dispatchedQty: tot.qty, dispatchedValue: tot.value, bags: tot.bags || undefined, status: 'dispatched', note: data.note?.trim() || undefined, isDeleted: false, createdAt: now, updatedAt: now,
    };
    setDispatchesState(prev => { const u = [...prev, rec]; storage.setProcurementDispatches(u); return u; });
    persistRow('procurement_dispatches', rec).then(({ error }) => {
      if (!error) return;
      reportError('marketing-save', error.message);
      setDispatchesState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setProcurementDispatches(r); return r; });
      toastRef.current({ title: tr('डिस्पैच सेव नहीं हुआ', 'Dispatch not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. (migration 139 चलाई है?)`, `Not saved to the cloud — ${error.message}. (Has migration 139 been run?)`), variant: 'destructive', duration: 12000 });
    });
    toastRef.current({ title: tr('डिस्पैच दर्ज', 'Dispatch recorded'), description: tr(`${rec.dispatchNo} · ${rec.dispatchedQty} क्विंटल`, `${rec.dispatchNo} · ${rec.dispatchedQty} quintal`) });
    return rec;
  }, [agencies, dispatches, procurementLots, procurementQualityTests, lotValue, agencyOfLot, societyId]);

  const acceptDispatch = useCallback((id: string, data: { acceptedQty: number; acceptedDate: string; shortageAccountId?: string }) => {
    if (guardFYLocked()) return;
    const d = dispatches.find(x => x.id === id && !x.isDeleted);
    if (!d || d.status !== 'dispatched') return;
    const sh = shortageOf(d.dispatchedQty, d.dispatchedValue, data.acceptedQty);
    if (!sh) { toastRef.current({ title: tr('मात्रा ठीक नहीं', 'Quantity is not right'), description: tr('स्वीकृत मात्रा 0 से कम या भेजी मात्रा से अधिक नहीं हो सकती।', 'Accepted quantity cannot be less than 0 or more than the quantity sent.'), variant: 'destructive', duration: 9000 }); return; }
    if (!data.acceptedDate) { toastRef.current({ title: tr('तारीख डालें', 'Enter the date'), variant: 'destructive' }); return; }
    const recv = receivableOf(d.agencyId);
    const now = new Date().toISOString();
    const next: ProcurementDispatch = { ...d, acceptedQty: data.acceptedQty, acceptedDate: data.acceptedDate, shortageQty: sh.qty, shortageValue: sh.value, shortageAccountId: sh.value > 0 ? data.shortageAccountId : undefined, status: 'accepted', updatedAt: now };
    const saveRow = (row: ProcurementDispatch, onFail?: () => void) => {
      setDispatchesState(prev => { const u = prev.map(x => x.id === id ? row : x); storage.setProcurementDispatches(u); return u; });
      persistRow('procurement_dispatches', row).then(({ error }) => {
        if (!error) return;
        reportError('marketing-save', error.message);
        setDispatchesState(prev => { const u = prev.map(x => x.id === id ? d : x); storage.setProcurementDispatches(u); return u; });
        onFail?.();
        toastRef.current({ title: tr('स्वीकृति सेव नहीं हुई', 'Acceptance not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.${onFail ? ' कमी का वाउचर भी रद्द किया गया।' : ''}`, `Not saved to the cloud — ${error.message}.${onFail ? ' The shortage voucher was also cancelled.' : ''}`), variant: 'destructive', duration: 12000 });
      });
    };
    if (!(sh.value > 0)) { saveRow(next); toastRef.current({ title: tr('एजेंसी स्वीकृति दर्ज', 'Agency acceptance recorded'), description: tr(`${d.dispatchNo} · कोई कमी नहीं`, `${d.dispatchNo} · no shortage`) }); return; }
    const shortAcc = data.shortageAccountId && accounts.find(a => a.id === data.shortageAccountId && !a.isGroup && a.type === 'expense');
    if (!shortAcc) { toastRef.current({ title: tr('कमी का खाता चुनें', 'Select the shortage account'), description: tr('कमी (shortage) के लिए एक खर्च खाता चुनें, जैसे "Shortage A/c"।', 'Select an expense account for the shortage, such as "Shortage A/c".'), variant: 'destructive', duration: 10000 }); return; }
    if (!recv) { toastRef.current({ title: tr('एजेंसी प्राप्य खाता नहीं', 'Agency receivable account missing'), description: tr('"लेजर स्वच्छता" पर "डोमेन खाते बनाएँ" दबाएँ या एजेंसी का खाता चुनें।', 'On "Ledger Hygiene", press "Create domain accounts", or select the agency\'s account.'), variant: 'destructive', duration: 12000 }); return; }
    const v = addVoucher({
      type: 'journal', date: data.acceptedDate,
      debitAccountId: shortAcc.id, creditAccountId: recv, amount: sh.value,
      lines: [{ id: crypto.randomUUID(), accountId: shortAcc.id, type: 'Dr', amount: sh.value }, { id: crypto.randomUUID(), accountId: recv, type: 'Cr', amount: sh.value }],
      narration: `डिस्पैच ${d.dispatchNo} में कमी — ${sh.qty} क्विंटल`,
      refType: DISPATCH_SHORTAGE_REF_TYPE, refId: d.agencyId,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0], {
      onSaved: (sv) => saveRow({ ...next, shortageVoucherId: sv.id }, () => cancelVoucher(sv.id, 'Dispatch acceptance not saved (auto-rollback)', user?.name || 'System', { viaParent: true })),
      onFailed: () => toastRef.current({ title: tr('स्वीकृति दर्ज नहीं हुई', 'Acceptance not recorded'), description: tr('कमी का वाउचर सेव नहीं हुआ, इसलिए डिस्पैच अभी "भेजा गया" ही है — दोबारा करें।', 'The shortage voucher was not saved, so the dispatch is still "Sent" — please try again.'), variant: 'destructive', duration: 12000 }),
    });
    if (v?.id) toastRef.current({ title: tr('एजेंसी स्वीकृति दर्ज', 'Agency acceptance recorded'), description: tr(`${d.dispatchNo} · कमी ${sh.qty} क्विंटल · ₹${sh.value.toLocaleString('en-IN')}`, `${d.dispatchNo} · shortage ${sh.qty} quintal · ₹${sh.value.toLocaleString('en-IN')}`) });
  }, [dispatches, agencies, accounts, mspReceivableId, addVoucher, cancelVoucher, user, societyId]);

  const deleteDispatch = useCallback(async (id: string) => {
    if (guardFYLocked()) return;
    const d = dispatches.find(x => x.id === id && !x.isDeleted);
    if (!d) return;
    if (agencyBills.some(b => !b.isDeleted && b.dispatchIds.includes(id))) {
      toastRef.current({ title: tr('पहले बिल हटाएँ', 'Delete the bill first'), description: tr('यह डिस्पैच एक एजेंसी बिल में है — पहले वह बिल हटाएँ।', 'This dispatch is in an agency bill — delete that bill first.'), variant: 'destructive', duration: 10000 });
      return;
    }
    const gone: ProcurementDispatch = { ...d, isDeleted: true, updatedAt: new Date().toISOString() };
    const { error } = await persistRow('procurement_dispatches', gone);
    if (error) { toastRef.current({ title: tr('डिस्पैच हटा नहीं', 'Dispatch not deleted'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. कुछ नहीं बदला।`, `Not saved to the cloud — ${error.message}. Nothing was changed.`), variant: 'destructive', duration: 12000 }); return; }
    setDispatchesState(prev => { const u = prev.map(x => x.id === id ? gone : x); storage.setProcurementDispatches(u); return u; });
    if (d.shortageVoucherId && !cancelVoucher(d.shortageVoucherId, `Dispatch ${d.dispatchNo} deleted`, user?.name || 'System', { viaParent: true })) {
      toastRef.current({ title: tr('⚠ डिस्पैच हटा, कमी का वाउचर नहीं', '⚠ Dispatch deleted, shortage voucher not cancelled'), description: tr('कमी का वाउचर रद्द नहीं हो सका — ऊपर की चेतावनी देखें।', 'The shortage voucher could not be cancelled — see the warning above.'), variant: 'destructive', duration: 15000 });
    }
  }, [dispatches, agencyBills, cancelVoucher, user, societyId]);

  const addAgencyBill = useCallback((data: { date: string; agencyId: string; dispatchIds: string[]; lines: AgencyBillLine[]; note?: string }): AgencyBill => {
    const now = new Date().toISOString();
    const blank = { id: '', billNo: '', date: data.date, agencyId: data.agencyId, dispatchIds: [], qty: 0, mspValue: 0, lines: [], incidentalTotal: 0, total: 0, status: 'draft', createdAt: '', updatedAt: '' } as AgencyBill;
    if (guardFYLocked()) return blank;
    const refuse = (t: string) => { toastRef.current({ title: tr('बिल नहीं बना', 'Bill not created'), description: t, variant: 'destructive', duration: 10000 }); return blank; };
    const billed = new Set(agencyBills.filter(b => !b.isDeleted).flatMap(b => b.dispatchIds));
    const ds = data.dispatchIds.map(id => dispatches.find(d => d.id === id && !d.isDeleted));
    if (!ds.length) return refuse(tr('कम से कम एक स्वीकृत डिस्पैच चुनें।', 'Select at least one accepted dispatch.'));
    for (const d of ds) {
      if (!d) return refuse(tr('कोई डिस्पैच नहीं मिला — पेज refresh करें।', 'No dispatch found — refresh the page.'));
      if (d.agencyId !== data.agencyId) return refuse(tr('सारे डिस्पैच उसी एजेंसी के हों।', 'All dispatches must be of the same agency.'));
      if (d.status !== 'accepted') return refuse(tr('पहले एजेंसी की स्वीकृति (मात्रा) दर्ज करें।', 'First record the agency\'s acceptance (quantity).'));
      if (billed.has(d.id)) return refuse(tr('एक डिस्पैच पहले से किसी बिल में है।', 'A dispatch is already in another bill.'));
    }
    for (const l of data.lines) {
      if (!l.label.trim() || !(l.amount > 0)) return refuse(tr('हर पंक्ति में नाम और राशि हो।', 'Every row must have a name and an amount.'));
      if (!accounts.some(a => a.id === l.accountId && !a.isGroup)) return refuse(tr(`"${l.label}" के लिए खाता चुनें।`, `Select an account for "${l.label}".`));
    }
    const base = billBase(ds as ProcurementDispatch[]);
    const tot = billTotals(base.value, data.lines);
    const rec: AgencyBill = {
      id: crypto.randomUUID(), billNo: nextDocNo('ABL', agencyBills.map(b => b.billNo)), date: data.date, agencyId: data.agencyId, dispatchIds: [...data.dispatchIds],
      qty: base.qty, mspValue: base.value, lines: data.lines.map(l => ({ ...l, label: l.label.trim() })), incidentalTotal: tot.incidentalTotal, total: tot.total,
      status: 'draft', note: data.note?.trim() || undefined, isDeleted: false, createdAt: now, updatedAt: now,
    };
    setAgencyBillsState(prev => { const u = [...prev, rec]; storage.setProcurementAgencyBills(u); return u; });
    persistRow('procurement_agency_bills', rec).then(({ error }) => {
      if (!error) return;
      reportError('marketing-save', error.message);
      setAgencyBillsState(prev => { const r = prev.filter(x => x.id !== rec.id); storage.setProcurementAgencyBills(r); return r; });
      toastRef.current({ title: tr('बिल सेव नहीं हुआ', 'Bill not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. (migration 139 चलाई है?)`, `Not saved to the cloud — ${error.message}. (Has migration 139 been run?)`), variant: 'destructive', duration: 12000 });
    });
    toastRef.current({ title: tr('बिल ड्राफ्ट बना', 'Draft bill created'), description: `${rec.billNo} · ₹${rec.total.toLocaleString('en-IN')}` });
    return rec;
  }, [agencyBills, dispatches, accounts, societyId]);

  const approveAgencyBill = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const b = agencyBills.find(x => x.id === id && !x.isDeleted);
    if (!b || b.status !== 'draft') return;
    const recv = receivableOf(b.agencyId);
    const now = new Date().toISOString();
    const saveApproved = (voucherId?: string, onFail?: () => void) => {
      const next: AgencyBill = { ...b, status: 'approved', voucherId, updatedAt: now };
      setAgencyBillsState(prev => { const u = prev.map(x => x.id === id ? next : x); storage.setProcurementAgencyBills(u); return u; });
      persistRow('procurement_agency_bills', next).then(({ error }) => {
        if (!error) return;
        reportError('marketing-save', error.message);
        setAgencyBillsState(prev => { const u = prev.map(x => x.id === id ? b : x); storage.setProcurementAgencyBills(u); return u; });
        onFail?.();
        toastRef.current({ title: tr('बिल स्वीकृत नहीं हुआ', 'Bill not approved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.${onFail ? ' उसका वाउचर भी रद्द किया गया।' : ''}`, `Not saved to the cloud — ${error.message}.${onFail ? ' Its voucher was also cancelled.' : ''}`), variant: 'destructive', duration: 12000 });
      });
    };
    if (!(b.incidentalTotal > 0)) { saveApproved(); toastRef.current({ title: tr('बिल स्वीकृत', 'Bill approved'), description: `${b.billNo} · ₹${b.total.toLocaleString('en-IN')}` }); return; }
    if (!recv) { toastRef.current({ title: tr('एजेंसी प्राप्य खाता नहीं', 'Agency receivable account missing'), description: tr('"लेजर स्वच्छता" पर "डोमेन खाते बनाएँ" दबाएँ या एजेंसी का खाता चुनें।', 'On "Ledger Hygiene", press "Create domain accounts", or select the agency\'s account.'), variant: 'destructive', duration: 12000 }); return; }
    const v = addVoucher({
      type: 'journal', date: b.date,
      debitAccountId: recv, creditAccountId: b.lines[0].accountId, amount: b.incidentalTotal,
      lines: [
        { id: crypto.randomUUID(), accountId: recv, type: 'Dr', amount: b.incidentalTotal },
        ...b.lines.map(l => ({ id: crypto.randomUUID(), accountId: l.accountId, type: 'Cr' as const, amount: l.amount })),
      ],
      narration: `एजेंसी बिल ${b.billNo} — खर्च (incidentals)`,
      refType: AGENCY_BILL_REF_TYPE, refId: b.agencyId,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0], {
      onSaved: (sv) => saveApproved(sv.id, () => cancelVoucher(sv.id, 'Agency bill approval not saved (auto-rollback)', user?.name || 'System', { viaParent: true })),
      onFailed: () => toastRef.current({ title: tr('बिल स्वीकृत नहीं हुआ', 'Bill not approved'), description: tr('बिल का वाउचर सेव नहीं हुआ, इसलिए बिल अभी ड्राफ्ट है — दोबारा करें।', 'The bill\'s voucher was not saved, so the bill is still a draft — please try again.'), variant: 'destructive', duration: 12000 }),
    });
    if (v?.id) toastRef.current({ title: tr('बिल स्वीकृत', 'Bill approved'), description: tr(`${b.billNo} · खर्च ₹${b.incidentalTotal.toLocaleString('en-IN')} एजेंसी प्राप्य में`, `${b.billNo} · expenses ₹${b.incidentalTotal.toLocaleString('en-IN')} added to agency receivable`) });
  }, [agencyBills, agencies, mspReceivableId, addVoucher, cancelVoucher, user, societyId]);

  // Receipts per agency for matching: agency receipts (refId = agency) + farmer payments the agency made
  // DIRECTLY (a farmer.payment voucher that credits an agency receivable), traced to the lot's agency.
  const billMatching = useMemo(() => {
    const ledgerAgency = new Map(agencies.filter(a => a.ledgerAccountId).map(a => [a.ledgerAccountId!, a.id]));
    const receivables = new Set([mspReceivableId, ...ledgerAgency.keys()].filter(Boolean) as string[]);
    const rows: { agencyId?: string; amount: number }[] = [];
    for (const v of liveVouchers) {
      if (v.refType === AGENCY_RECEIPT_REF_TYPE && v.refId) rows.push({ agencyId: v.refId, amount: v.amount });
      else if (v.refType === FARMER_PAYMENT_REF_TYPE) {
        const cr = v.lines?.find(l => l.type === 'Cr')?.accountId || v.creditAccountId;
        if (!receivables.has(cr)) continue;
        const ev = liveVouchers.find(x => x.id === v.refId);
        const rr = ev ? procurementPostingRuleResults.find(r => r.id === ev.refId) : undefined;
        rows.push({ agencyId: ledgerAgency.get(cr) || (rr ? agencyOfLot(rr.lotId) : undefined), amount: v.amount });
      }
    }
    return matchReceiptsToBills(agencyBills, rows);
  }, [liveVouchers, agencies, agencyBills, mspReceivableId, procurementPostingRuleResults, agencyOfLot]);

  const deleteAgencyBill = useCallback(async (id: string) => {
    if (guardFYLocked()) return;
    const b = agencyBills.find(x => x.id === id && !x.isDeleted);
    if (!b) return;
    if (b.status === 'approved' && (billMatching.byBill[b.id]?.received ?? 0) > 0.005) {
      toastRef.current({ title: tr('पहले रसीद देखें', 'Check the receipt first'), description: tr('इस बिल के बदले एजेंसी से राशि आ चुकी है — बिल हटाने से पहले संबंधित रसीद रद्द करें।', 'Money has already come from the agency against this bill — cancel the related receipt before deleting the bill.'), variant: 'destructive', duration: 12000 });
      return;
    }
    const gone: AgencyBill = { ...b, isDeleted: true, updatedAt: new Date().toISOString() };
    const { error } = await persistRow('procurement_agency_bills', gone);
    if (error) { toastRef.current({ title: tr('बिल हटा नहीं', 'Bill not deleted'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. कुछ नहीं बदला।`, `Not saved to the cloud — ${error.message}. Nothing was changed.`), variant: 'destructive', duration: 12000 }); return; }
    setAgencyBillsState(prev => { const u = prev.map(x => x.id === id ? gone : x); storage.setProcurementAgencyBills(u); return u; });
    if (b.voucherId && !cancelVoucher(b.voucherId, `Agency bill ${b.billNo} deleted`, user?.name || 'System', { viaParent: true })) {
      toastRef.current({ title: tr('⚠ बिल हटा, उसका वाउचर नहीं', '⚠ Bill deleted, its voucher not cancelled'), description: tr('बिल का वाउचर रद्द नहीं हो सका — ऊपर की चेतावनी देखें।', 'The bill\'s voucher could not be cancelled — see the warning above.'), variant: 'destructive', duration: 15000 });
    }
  }, [agencyBills, billMatching, cancelVoucher, user, societyId]);

  // ── E1: FCO dealer licences (register only) ────────────────────────────────────────
  const saveDealerLicence = useCallback((data: Omit<DealerLicence, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (guardFYLocked()) return;
    if (!data.licenceNo?.trim() && data.kind === 'authorisation') { toastRef.current({ title: tr('लाइसेंस नंबर डालें', 'Enter the licence number'), variant: 'destructive' }); return; }
    if (data.kind === 'sourceCertificate' && !data.sourceName?.trim() && !data.supplierId) { toastRef.current({ title: tr('स्रोत डालें', 'Enter the source'), description: tr('Form O किस स्रोत (कंपनी / पूल एजेंसी / थोक विक्रेता) का है?', 'Which source (company / pool agency / wholesaler) is this Form O from?'), variant: 'destructive' }); return; }
    if (data.issuedOn && data.validUpto && data.validUpto < data.issuedOn) { toastRef.current({ title: tr('तारीख ठीक नहीं', 'Date is not right'), description: tr('वैधता की तारीख जारी होने की तारीख से पहले नहीं हो सकती।', 'The validity date cannot be before the date of issue.'), variant: 'destructive' }); return; }
    const now = new Date().toISOString();
    const before = data.id ? dealerLicences.find(l => l.id === data.id) : undefined;
    const rec: DealerLicence = { ...(before || {}), ...data, id: data.id || crypto.randomUUID(), isDeleted: false, createdAt: before?.createdAt || now, updatedAt: now } as DealerLicence;
    setDealerLicencesState(prev => { const u = before ? prev.map(l => l.id === rec.id ? rec : l) : [...prev, rec]; storage.setDealerLicences(u); return u; });
    supabase.from('marketing_dealer_licences').upsert(withSoc(rec)).then(({ error }) => {
      if (!error) return;
      reportError('marketing-save', error.message);
      setDealerLicencesState(prev => { const u = before ? prev.map(l => l.id === rec.id ? before : l) : prev.filter(l => l.id !== rec.id); storage.setDealerLicences(u); return u; });
      toastRef.current({ title: tr('लाइसेंस सेव नहीं हुआ', 'Licence not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. (migration 140 चलाई है?)`, `Not saved to the cloud — ${error.message}. (Has migration 140 been run?)`), variant: 'destructive', duration: 12000 });
    });
  }, [dealerLicences, societyId]);

  const deleteDealerLicence = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const before = dealerLicences.find(l => l.id === id);
    if (!before) return;
    const gone = { ...before, isDeleted: true, updatedAt: new Date().toISOString() };
    setDealerLicencesState(prev => { const u = prev.map(l => l.id === id ? gone : l); storage.setDealerLicences(u); return u; });
    supabase.from('marketing_dealer_licences').upsert(withSoc(gone)).then(({ error }) => {
      if (!error) return;
      setDealerLicencesState(prev => { const u = prev.map(l => l.id === id ? before : l); storage.setDealerLicences(u); return u; });
      toastRef.current({ title: tr('लाइसेंस हटा नहीं', 'Licence not deleted'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
    });
  }, [dealerLicences, societyId]);

  // ── E1: general scheme-claim register (claim POSTED; receipts derived from vouchers) ──────
  // Claim: Dr receivable (3305 Subsidy Receivable by default) / Cr the society's chosen ledger — voucher
  // first, row on onSaved (a row that fails cancels it). The row owns the claim voucher. Receipts are
  // plain vouchers (refType scheme.claim.receipt, refId = claim) — received / outstanding are derived.
  const schemeRef = useRef(schemeClaims); schemeRef.current = schemeClaims;
  useEffect(() => registerVoucherOwner('marketing-scheme', id => findVoucherOwner([{ label: 'योजना दावा (Scheme claim)', docs: schemeRef.current }], id)), [registerVoucherOwner]);
  const schemeReceipts = useMemo(() => vouchers.filter(v => !v.isDeleted && v.approvalStatus !== 'rejected' && v.refType === SCHEME_RECEIPT_REF_TYPE), [vouchers]);

  const addSchemeClaim = useCallback((data: { date: string; schemeName: string; authority?: string; period?: string; amount: number; creditAccountId: string; receivableAccountId: string; note?: string }) => {
    if (guardFYLocked()) return;
    const refuse = (t: string) => toastRef.current({ title: tr('दावा दर्ज नहीं हुआ', 'Claim not recorded'), description: t, variant: 'destructive', duration: 10000 });
    const amt = toRupees(toMinor(Number(data.amount) || 0));
    if (!data.schemeName.trim()) return refuse(tr('योजना का नाम डालें।', 'Enter the scheme name.'));
    if (!(amt > 0)) return refuse(tr('राशि 0 से अधिक हो।', 'Amount must be more than 0.'));
    const recv = accounts.find(a => a.id === data.receivableAccountId && !a.isGroup && a.type === 'asset');
    const cr = accounts.find(a => a.id === data.creditAccountId && !a.isGroup);
    if (!recv) return refuse(tr('प्राप्य (asset) खाता चुनें — जैसे 3305 सब्सिडी प्राप्य।', 'Select a receivable (asset) account — such as 3305 Subsidy Receivable.'));
    if (!cr) return refuse(tr('जिस खाते में दावा जमा (Cr) हो, वह चुनें।', 'Select the account to which the claim is credited (Cr).'));
    const now = new Date().toISOString();
    const rec: SchemeClaim = { id: crypto.randomUUID(), claimNo: nextDocNo('SCL', schemeClaims.map(c => c.claimNo)), date: data.date, schemeName: data.schemeName.trim(), authority: data.authority?.trim() || undefined, period: data.period?.trim() || undefined, amount: amt, creditAccountId: cr.id, receivableAccountId: recv.id, note: data.note?.trim() || undefined, isDeleted: false, createdAt: now, updatedAt: now };
    addVoucher({
      type: 'journal', date: data.date,
      debitAccountId: recv.id, creditAccountId: cr.id, amount: amt,
      lines: [{ id: crypto.randomUUID(), accountId: recv.id, type: 'Dr', amount: amt }, { id: crypto.randomUUID(), accountId: cr.id, type: 'Cr', amount: amt }],
      narration: `योजना दावा ${rec.claimNo} — ${rec.schemeName}${rec.period ? ` (${rec.period})` : ''}`,
      refType: SCHEME_CLAIM_REF_TYPE, refId: rec.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0], {
      onSaved: (sv) => {
        const row = { ...rec, voucherId: sv.id };
        setSchemeClaimsState(prev => { const u = [...prev, row]; storage.setSchemeClaims(u); return u; });
        supabase.from('marketing_scheme_claims').upsert(withSoc(row)).then(({ error }) => {
          if (!error) { toastRef.current({ title: tr('योजना दावा दर्ज', 'Scheme claim recorded'), description: `${row.claimNo} · ₹${amt.toLocaleString('en-IN')}` }); return; }
          reportError('marketing-save', error.message);
          setSchemeClaimsState(prev => { const r = prev.filter(c => c.id !== row.id); storage.setSchemeClaims(r); return r; });
          cancelVoucher(sv.id, 'Scheme claim row not saved (auto-rollback)', user?.name || 'System', { viaParent: true });
          toastRef.current({ title: tr('दावा सेव नहीं हुआ', 'Claim not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. उसका वाउचर भी रद्द किया गया। (migration 140 चलाई है?)`, `Not saved to the cloud — ${error.message}. Its voucher was also cancelled. (Has migration 140 been run?)`), variant: 'destructive', duration: 12000 });
        });
      },
      onFailed: () => refuse(tr('दावे का वाउचर सेव नहीं हुआ — दोबारा करें।', 'The claim\'s voucher was not saved — please try again.')),
    });
  }, [accounts, schemeClaims, addVoucher, cancelVoucher, user, societyId]);

  const recordSchemeReceipt = useCallback((claimId: string, data: { amount: number; date: string; mode: 'cash' | 'bank'; bankAccountId?: string; reference?: string }) => {
    if (guardFYLocked()) return;
    const c = schemeClaims.find(x => x.id === claimId && !x.isDeleted);
    if (!c) return;
    const amt = toRupees(toMinor(Number(data.amount) || 0));
    const { outstanding } = schemeClaimBalance(c, schemeReceipts);
    if (!(amt > 0) || amt > outstanding + 0.005) { toastRef.current({ title: tr('राशि ठीक नहीं', 'Amount is not right'), description: tr(`दावे का बकाया ₹${outstanding.toLocaleString('en-IN')} है — उससे अधिक या शून्य की रसीद नहीं बन सकती।`, `The claim's outstanding is ₹${outstanding.toLocaleString('en-IN')} — a receipt cannot be more than that or zero.`), variant: 'destructive', duration: 10000 }); return; }
    const dr = data.mode === 'bank' ? (data.bankAccountId || storage.defaultBankAccountId(accounts)) : ACCOUNT_IDS_CASH;
    addVoucher({
      type: 'receipt', date: data.date,
      debitAccountId: dr, creditAccountId: c.receivableAccountId, amount: amt,
      lines: [{ id: crypto.randomUUID(), accountId: dr, type: 'Dr', amount: amt }, { id: crypto.randomUUID(), accountId: c.receivableAccountId, type: 'Cr', amount: amt }],
      narration: `योजना दावा ${c.claimNo} की प्राप्ति — ${c.schemeName}${data.reference ? ` · Ref ${data.reference}` : ''}`,
      refType: SCHEME_RECEIPT_REF_TYPE, refId: c.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0]);
  }, [schemeClaims, schemeReceipts, accounts, addVoucher, user]);

  const deleteSchemeClaim = useCallback(async (id: string) => {
    if (guardFYLocked()) return;
    const c = schemeClaims.find(x => x.id === id && !x.isDeleted);
    if (!c) return;
    if (schemeClaimBalance(c, schemeReceipts).received > 0.005) {
      toastRef.current({ title: tr('पहले रसीद रद्द करें', 'Cancel the receipt first'), description: tr('इस दावे की राशि आ चुकी है — पहले उसकी रसीद (वाउचर) रद्द करें।', 'Money for this claim has already come in — first cancel its receipt (voucher).'), variant: 'destructive', duration: 10000 });
      return;
    }
    const gone = { ...c, isDeleted: true, updatedAt: new Date().toISOString() };
    const { error } = await supabase.from('marketing_scheme_claims').upsert(withSoc(gone));
    if (error) { toastRef.current({ title: tr('दावा हटा नहीं', 'Claim not deleted'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. कुछ नहीं बदला।`, `Not saved to the cloud — ${error.message}. Nothing was changed.`), variant: 'destructive', duration: 12000 }); return; }
    setSchemeClaimsState(prev => { const u = prev.map(x => x.id === id ? gone : x); storage.setSchemeClaims(u); return u; });
    if (c.voucherId && !cancelVoucher(c.voucherId, `Scheme claim ${c.claimNo} deleted`, user?.name || 'System', { viaParent: true })) {
      toastRef.current({ title: tr('⚠ दावा हटा, वाउचर नहीं', '⚠ Claim deleted, voucher not cancelled'), description: tr('दावे का वाउचर रद्द नहीं हो सका — ऊपर की चेतावनी देखें।', 'The claim\'s voucher could not be cancelled — see the warning above.'), variant: 'destructive', duration: 15000 });
    }
  }, [schemeClaims, schemeReceipts, cancelVoucher, user, societyId]);

  // ── E2: hired-truck trips — freight POSTED (Dr expense / Cr transporter), payments derived ───
  const tripsRef = useRef(hiredTrips); tripsRef.current = hiredTrips;
  useEffect(() => registerVoucherOwner('marketing-trips', id => findVoucherOwner([{ label: 'किराये की trip (भाड़ा)', docs: tripsRef.current }], id)), [registerVoucherOwner]);
  const tripPayments = useMemo(() => vouchers.filter(v => !v.isDeleted && v.approvalStatus !== 'rejected' && v.refType === HIRED_TRIP_PAYMENT_REF_TYPE), [vouchers]);

  const addHiredTrip = useCallback((data: { date: string; transporterId: string; dispatchId?: string; vehicleNo?: string; fromPlace?: string; toPlace?: string; qty?: number; rate?: number; lump?: number; expenseAccountId: string; note?: string }) => {
    if (guardFYLocked()) return;
    const refuse = (t: string) => toastRef.current({ title: tr('trip दर्ज नहीं हुई', 'Trip not recorded'), description: t, variant: 'destructive', duration: 10000 });
    const transporter = transporters.find(t => t.id === data.transporterId);
    if (!transporter) return refuse(tr('ट्रांसपोर्टर चुनें।', 'Select a transporter.'));
    const payable = transporter.ledgerAccountId && accounts.find(a => a.id === transporter.ledgerAccountId && !a.isGroup && a.type === 'liability');
    if (!payable) return refuse(tr('पहले इस ट्रांसपोर्टर का खाता (देनदार ledger) चुनें या बनाएँ — ट्रांसपोर्टर संपादित करें।', 'First select or create this transporter\'s account (creditor ledger) — edit the transporter.'));
    const exp = accounts.find(a => a.id === data.expenseAccountId && !a.isGroup && a.type === 'expense');
    if (!exp) return refuse(tr('भाड़े का खर्च खाता चुनें।', 'Select the freight expense account.'));
    const freight = tripFreight(data.qty, data.rate, data.lump);
    if (!(freight > 0)) return refuse(tr('मात्रा × दर, या कुल भाड़ा भरें।', 'Fill in quantity × rate, or the total freight.'));
    const now = new Date().toISOString();
    const rec: HiredTrip = { id: crypto.randomUUID(), tripNo: nextDocNo('HTR', hiredTrips.map(t => t.tripNo)), date: data.date, transporterId: transporter.id, dispatchId: data.dispatchId || undefined, vehicleNo: (data.vehicleNo || transporter.vehicleNo || '').trim().toUpperCase() || undefined, fromPlace: data.fromPlace?.trim() || undefined, toPlace: data.toPlace?.trim() || undefined, qty: data.qty || undefined, rate: data.rate || undefined, freight, expenseAccountId: exp.id, payableAccountId: payable.id, note: data.note?.trim() || undefined, isDeleted: false, createdAt: now, updatedAt: now };
    addVoucher({
      type: 'journal', date: data.date,
      debitAccountId: exp.id, creditAccountId: payable.id, amount: freight,
      lines: [{ id: crypto.randomUUID(), accountId: exp.id, type: 'Dr', amount: freight }, { id: crypto.randomUUID(), accountId: payable.id, type: 'Cr', amount: freight }],
      narration: `भाड़ा ${rec.tripNo} — ${transporter.name}${rec.vehicleNo ? ` (${rec.vehicleNo})` : ''}${rec.fromPlace || rec.toPlace ? ` · ${rec.fromPlace || ''} → ${rec.toPlace || ''}` : ''}`,
      refType: HIRED_TRIP_REF_TYPE, refId: rec.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0], {
      onSaved: (sv) => {
        const row = { ...rec, voucherId: sv.id };
        setHiredTripsState(prev => { const u = [...prev, row]; storage.setHiredTrips(u); return u; });
        supabase.from('marketing_hired_trips').upsert(withSoc(row)).then(({ error }) => {
          if (!error) { toastRef.current({ title: tr('trip दर्ज', 'Trip recorded'), description: tr(`${row.tripNo} · भाड़ा ₹${freight.toLocaleString('en-IN')}`, `${row.tripNo} · freight ₹${freight.toLocaleString('en-IN')}`) }); return; }
          reportError('marketing-save', error.message);
          setHiredTripsState(prev => { const r = prev.filter(t => t.id !== row.id); storage.setHiredTrips(r); return r; });
          cancelVoucher(sv.id, 'Hired trip row not saved (auto-rollback)', user?.name || 'System', { viaParent: true });
          toastRef.current({ title: tr('trip सेव नहीं हुई', 'Trip not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. भाड़े का वाउचर भी रद्द किया गया। (migration 141 चलाई है?)`, `Not saved to the cloud — ${error.message}. The freight voucher was also cancelled. (Has migration 141 been run?)`), variant: 'destructive', duration: 12000 });
        });
      },
      onFailed: () => refuse(tr('भाड़े का वाउचर सेव नहीं हुआ — दोबारा करें।', 'The freight voucher was not saved — please try again.')),
    });
  }, [transporters, accounts, hiredTrips, addVoucher, cancelVoucher, user, societyId]);

  const payHiredTrip = useCallback((tripId: string, data: { amount: number; date: string; mode: 'cash' | 'bank'; bankAccountId?: string; reference?: string }) => {
    if (guardFYLocked()) return;
    const t = hiredTrips.find(x => x.id === tripId && !x.isDeleted);
    if (!t) return;
    const amt = toRupees(toMinor(Number(data.amount) || 0));
    const { outstanding } = tripBalance(t, tripPayments);
    if (!(amt > 0) || amt > outstanding + 0.005) { toastRef.current({ title: tr('राशि ठीक नहीं', 'Amount is not right'), description: tr(`trip का बकाया भाड़ा ₹${outstanding.toLocaleString('en-IN')} है — उससे अधिक या शून्य भुगतान नहीं।`, `The trip's outstanding freight is ₹${outstanding.toLocaleString('en-IN')} — payment cannot be more than that or zero.`), variant: 'destructive', duration: 10000 }); return; }
    const cr = data.mode === 'bank' ? (data.bankAccountId || storage.defaultBankAccountId(accounts)) : ACCOUNT_IDS_CASH;
    addVoucher({
      type: 'payment', date: data.date,
      debitAccountId: t.payableAccountId, creditAccountId: cr, amount: amt,
      lines: [{ id: crypto.randomUUID(), accountId: t.payableAccountId, type: 'Dr', amount: amt }, { id: crypto.randomUUID(), accountId: cr, type: 'Cr', amount: amt }],
      narration: `भाड़ा भुगतान ${t.tripNo}${data.reference ? ` · Ref ${data.reference}` : ''}`,
      refType: HIRED_TRIP_PAYMENT_REF_TYPE, refId: t.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0]);
  }, [hiredTrips, tripPayments, accounts, addVoucher, user]);

  const deleteHiredTrip = useCallback(async (id: string) => {
    if (guardFYLocked()) return;
    const t = hiredTrips.find(x => x.id === id && !x.isDeleted);
    if (!t) return;
    if (tripBalance(t, tripPayments).paid > 0.005) { toastRef.current({ title: tr('पहले भुगतान रद्द करें', 'Cancel the payment first'), description: tr('इस trip का भाड़ा चुकाया जा चुका है — पहले वह भुगतान वाउचर रद्द करें।', 'Freight for this trip has already been paid — first cancel that payment voucher.'), variant: 'destructive', duration: 10000 }); return; }
    const gone = { ...t, isDeleted: true, updatedAt: new Date().toISOString() };
    const { error } = await supabase.from('marketing_hired_trips').upsert(withSoc(gone));
    if (error) { toastRef.current({ title: tr('trip हटी नहीं', 'Trip not deleted'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. कुछ नहीं बदला।`, `Not saved to the cloud — ${error.message}. Nothing was changed.`), variant: 'destructive', duration: 12000 }); return; }
    setHiredTripsState(prev => { const u = prev.map(x => x.id === id ? gone : x); storage.setHiredTrips(u); return u; });
    if (t.voucherId && !cancelVoucher(t.voucherId, `Hired trip ${t.tripNo} deleted`, user?.name || 'System', { viaParent: true })) {
      toastRef.current({ title: tr('⚠ trip हटी, वाउचर नहीं', '⚠ Trip deleted, voucher not cancelled'), description: tr('भाड़े का वाउचर रद्द नहीं हो सका — ऊपर की चेतावनी देखें।', 'The freight voucher could not be cancelled — see the warning above.'), variant: 'destructive', duration: 15000 });
    }
  }, [hiredTrips, tripPayments, cancelVoucher, user, societyId]);

  // ── Procurement commission accrual (M3d) ──────────────────────────────────────────
  const commissionAccruals = vouchers.filter(v => !v.isDeleted && v.refType === COMMISSION_ACCRUAL_REF_TYPE);

  const accrueProcurementCommission = useCallback((data: { lotId: string; amount: number; note?: string; date?: string; agencyId?: string; quiet?: boolean }): Voucher => {
    const sentinel = { id: '', voucherNo: '', type: 'journal', date: '', debitAccountId: '', creditAccountId: '', amount: 0, narration: '', createdBy: '', createdAt: '' } as unknown as Voucher;
    if (guardFYLocked()) return sentinel;
    const amt = +Number(data.amount).toFixed(2);
    if (!(amt > 0)) { toastRef.current({ title: tr('कमीशन शून्य', 'Commission is zero'), description: tr('एजेंसी की commission दर 0 है या procurement value शून्य।', 'The agency\'s commission rate is 0 or the procurement value is zero.'), variant: 'destructive' }); return sentinel; }
    if (procurementLots.find(l => l.id === data.lotId)?.cancelledAt) {
      toastRef.current({ title: tr('लॉट रद्द है', 'Lot is cancelled'), description: tr('रद्द लॉट पर कमीशन दर्ज नहीं हो सकता।', 'Commission cannot be recorded on a cancelled lot.'), variant: 'destructive', duration: 10000 }); return sentinel;
    }
    if (procurementQualityTests.some(q => q.lotId === data.lotId && isRejectedQuality(q.result))) {
      toastRef.current({ title: tr('लॉट अस्वीकृत है', 'Lot is rejected'), description: tr('अस्वीकृत लॉट पर कमीशन दर्ज नहीं हो सकता।', 'Commission cannot be recorded on a rejected lot.'), variant: 'destructive', duration: 10000 }); return sentinel;
    }
    // One commission accrual per lot.
    if (vouchers.some(v => !v.isDeleted && v.refType === COMMISSION_ACCRUAL_REF_TYPE && v.refId === data.lotId)) {
      toastRef.current({ title: tr('कमीशन पहले से', 'Commission already recorded'), description: tr('इस लॉट का commission पहले ही दर्ज है।', 'Commission for this lot is already recorded.'), variant: 'destructive' }); return sentinel;
    }
    const ag = data.agencyId ? agencies.find(a => a.id === data.agencyId) : undefined;
    const drAcc = ag?.ledgerAccountId || commissionReceivableId;
    const crAcc = (ag?.commissionIncomeAccountId && accounts.some(a => a.id === ag.commissionIncomeAccountId && !a.isGroup)) ? ag.commissionIncomeAccountId : commissionIncomeId;
    if (!drAcc || !crAcc) {
      toastRef.current({ title: tr('कमीशन खाता नहीं', 'Commission account missing'), description: tr('चार्ट में "प्राप्य कमीशन" या "खरीद कमीशन" खाता नहीं मिला। "लेजर स्वच्छता" पेज पर "डोमेन खाते बनाएँ" दबाएँ।', 'No "Commission Receivable" or "Purchase Commission" account found in the chart. On the "Ledger Hygiene" page, press "Create domain accounts".'), variant: 'destructive', duration: 12000 }); return sentinel;
    }
    const voucher = addVoucher({
      // Commission is earned on the purchase — dated with the lot's posting (J-Form) day.
      type: 'journal', date: data.date || todayStr(),
      debitAccountId: drAcc, creditAccountId: crAcc, amount: amt,
      lines: [{ id: crypto.randomUUID(), accountId: drAcc, type: 'Dr', amount: amt }, { id: crypto.randomUUID(), accountId: crAcc, type: 'Cr', amount: amt }],
      narration: `खरीद कमीशन${data.note ? ` — ${data.note}` : ''}`,
      refType: COMMISSION_ACCRUAL_REF_TYPE, refId: data.lotId,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0]);
    if (!voucher?.id) return sentinel;
    toastRef.current({ title: data.quiet ? tr('कमीशन अपने-आप दर्ज', 'Commission recorded automatically') : tr('✅ कमीशन दर्ज', '✅ Commission recorded'), description: `₹${amt.toLocaleString('en-IN')} · ${voucher.date}` });
    return voucher;
  }, [vouchers, agencies, accounts, procurementLots, procurementQualityTests, commissionReceivableId, commissionIncomeId, addVoucher, user]);

  const deleteCommissionAccrual = useCallback((voucherId: string) => {
    if (guardFYLocked()) return;
    // Commission already received from the agency cannot be un-earned here: reversing the accrual would
    // leave Commission Receivable in credit. Cancel the commission receipt first.
    const acc = vouchers.find(v => v.id === voucherId && !v.isDeleted);
    const drAccount = acc ? (acc.lines?.find(l => l.type === 'Dr')?.accountId || acc.debitAccountId) : undefined;
    if (acc && drAccount && pooledNet(drAccount) - (acc.amount || 0) < -0.005) {
      toastRef.current({ title: tr('पहले कमीशन रसीद रद्द करें', 'Cancel the commission receipt first'), description: tr('इस कमीशन के बदले एजेंसी से राशि आ चुकी है। "एजेंसी रसीद" पेज पर वह रसीद पहले रद्द करें, फिर कमीशन रद्द करें।', 'Money has already come from the agency against this commission. On the "Agency Receipt" page, cancel that receipt first, then cancel the commission.'), variant: 'destructive', duration: 12000 });
      return;
    }
    cancelVoucher(voucherId, 'Commission accrual reversed', user?.name || 'System', { viaParent: true });
  }, [cancelVoucher, user, vouchers]);  // eslint-disable-line react-hooks/exhaustive-deps

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
      arhtiyas,
      addArhtiya,
      updateArhtiya,
      deleteArhtiya,
      bardanaMovements,
      addBardanaMovement,
      deleteBardanaMovement,
      dispatches,
      addDispatch,
      acceptDispatch,
      deleteDispatch,
      agencyBills,
      addAgencyBill,
      approveAgencyBill,
      deleteAgencyBill,
      billMatching,
      lotValue,
      dealerLicences,
      saveDealerLicence,
      deleteDealerLicence,
      schemeClaims,
      addSchemeClaim,
      recordSchemeReceipt,
      deleteSchemeClaim,
      schemeReceipts,
      hiredTrips,
      addHiredTrip,
      payHiredTrip,
      deleteHiredTrip,
      tripPayments,
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
