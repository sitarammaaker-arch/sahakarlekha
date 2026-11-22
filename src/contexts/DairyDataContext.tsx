/**
 * DairyDataContext — Dairy-cooperative domain state & workflows ONLY.
 *
 * This context does NOT fork the accounting / voucher / posting / reports / audit engines.
 * Those stay in DataContext (the single SSOT). It COMPOSES the core: reads `society` (FY-lock)
 * and `accounts` from useData(), `societyId` from useAuth(), and calls useData().addVoucher
 * for all accounting. Persistence mirrors the Housing pattern: optimistic local +
 * localStorage + Supabase upsert with RULE-1 visible rollback and a RULE-6 FY-lock guard.
 *
 * Delivery D1 adds: Fat+SNF milk rate charts (master + pricing). Dedicated milk ledgers
 * (procurement / bulk-sales) for a dairy society that predates the D1 template — the C-A conflict
 * resolution, so milk never posts to the generic 4101/5101 fallbacks — are created by the explicit
 * admin provisioning action (useDomainAccountProvisioning), no longer by a load-time seeder. The collection hot-path posting (which absorbs the existing MilkCollection
 * page — C-B) lands in D2.
 */
import { tr } from '@/lib/uiLang';
import type { LooseRow } from '@/lib/dbRow';
import { voucherRefusedToast, inFlightToast } from '@/lib/voucherRefused';
import { useLatest } from '@/hooks/useLatest';
import { useInFlight } from '@/hooks/useInFlight';
import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { findVoucherOwner, figureAfterCancel, type OwnerGroup } from '@/lib/voucherOwnership';
import { useCapabilityEnabled } from '@/contexts/useCapabilityEnabled';
import { refuseIfWriteBlocked } from '@/lib/connectivity/writeBlock';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { patchRow } from '@/lib/rowPatch';
import { fetchAllPaged } from '@/lib/supabasePaging';
import { resolveJurisdiction } from '@/lib/jurisdiction';
import { reportError } from '@/lib/errorReporting';
import * as storage from '@/lib/storage';
import { priceMilk } from '@/lib/dairy/pricing';
import { resolveMilkProcurementAccountId, resolveMilkBulkSalesAccountId, resolveMilkPayableAccountId, resolveUnionReceivableAccountId, resolveMemberInputReceivableAccountId, resolveBonusDistributionAccountId, resolveBonusPayableAccountId, resolveDividendDistributionAccountId, resolveDividendPayableAccountId } from '@/lib/dairy/accounts';
import { computeGross, netPayable, sumDeductions, outstanding, settlementLegs } from '@/lib/dairy/settlement';
import { memberInputOutstanding, type InputBalance } from '@/lib/dairy/inputs';
import { computeBonusLines, computeDividendLines, distributionTotal, distributionLegs } from '@/lib/dairy/distribution';
import { resolveDairyPostingLegs } from '@/lib/dairy/postingRules';
import { buildEngineVoucherLines } from '@/lib/posting/engineVoucher';
import type { DairyRateChart, MilkEntry, DairySettlement, DairyDeductionLine, DairyDispatch, DairyInputIssue, DairyDistribution, DairyBonusBasis, Voucher } from '@/types';

interface DairyDataContextValue {
  dairyReady: boolean;
  guardFYLocked: () => boolean;

  // Rate charts (Fat + SNF pricing master)
  rateCharts: DairyRateChart[];
  addRateChart: (data: Omit<DairyRateChart, 'id' | 'createdAt'>) => DairyRateChart;
  updateRateChart: (id: string, data: Partial<DairyRateChart>) => void;
  deleteRateChart: (id: string) => void;
  /** Resolve ₹/L (and amount) for a collection using the chart in force on `date` (default today). */
  resolveMilkRate: (args: { fat: number; snf: number; qty: number; date?: string; season?: string }) => { rate: number | null; amount: number };

  // Dedicated milk ledgers resolved for this society (C-A) — null until seeded.
  milkProcurementAccountId: string | null;
  milkBulkSalesAccountId: string | null;
  milkPayableAccountId: string | null;

  // Milk collection entries (D2 — absorbed from the former self-contained MilkCollection page)
  milkEntries: MilkEntry[];
  addMilkEntry: (data: Omit<MilkEntry, 'id' | 'createdAt'>) => MilkEntry;
  deleteMilkEntry: (id: string) => void;

  // Farmer settlement cycle (D3) — per-member, per-cycle payout (the authoritative posting path)
  settlements: DairySettlement[];
  /** Draft a settlement for a member's cycle; gross = accepted milk value in [from,to]. */
  createDairySettlement: (args: { memberId: string; from: string; to: string }) => DairySettlement;
  addDairyDeduction: (args: { settlementId: string; type: string; accountId: string; amount: number; remarks?: string }) => void;
  removeDairyDeduction: (args: { settlementId: string; lineId: string }) => void;
  /** Approve: lock net + post the compound voucher (Dr milk-cost gross / Cr payable net / Cr recoveries). */
  approveDairySettlement: (settlementId: string) => DairySettlement;
  /** Pay the (partial) net: Dr payable / Cr bank|cash; advances amountPaid. */
  recordDairySettlementPayment: (args: { settlementId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string }) => Voucher;
  deleteDairySettlement: (settlementId: string) => void;

  // Milk dispatch to the Union (D4 — revenue side)
  dispatches: DairyDispatch[];
  /** Record a dispatch; posts the sale Dr Union Receivable (3303) / Cr Milk Sales — Bulk (4106). */
  recordDairyDispatch: (data: Omit<DairyDispatch, 'id' | 'createdAt' | 'amount' | 'voucherId' | 'amountReceived'>) => DairyDispatch;
  /** Receive a union payment against a dispatch: Dr bank|cash / Cr 3303; advances amountReceived. */
  receiveUnionPayment: (args: { dispatchId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }) => Voucher;
  deleteDairyDispatch: (dispatchId: string) => void;

  // Member input issue: feed / medicine / AI on credit (D4b)
  inputIssues: DairyInputIssue[];
  /** Record an input issue; posts Dr Member Input Receivable (3305) / Cr the income account. */
  recordDairyInputIssue: (data: Omit<DairyInputIssue, 'id' | 'createdAt' | 'voucherId'>) => DairyInputIssue;
  deleteDairyInputIssue: (id: string) => void;
  /** Dedicated 3305 ledger (null until seeded) + a member's derived input balance for recovery. */
  memberInputReceivableAccountId: string | null;
  getMemberInputBalance: (memberId: string) => InputBalance;

  // Year-end distribution: patronage bonus / dividend (D6, governance-gated)
  distributions: DairyDistribution[];
  /** Draft a bonus (milk-supply) or dividend (share-capital) run; computes per-member lines. */
  createDairyDistribution: (args: { kind: 'bonus'; from: string; to: string; basis: DairyBonusBasis; rate: number } | { kind: 'dividend'; rate: number; fyLabel?: string }) => DairyDistribution;
  /** Approve (resolutionNo MANDATORY): posts Dr distribution equity / Cr payable for the total. */
  approveDairyDistribution: (args: { distributionId: string; resolutionNo: string; resolutionDate?: string }) => DairyDistribution;
  /** Pay the (partial) total: Dr payable / Cr bank|cash; advances amountPaid. */
  recordDistributionPayment: (args: { distributionId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }) => Voucher;
  deleteDairyDistribution: (distributionId: string) => void;
}

const DairyDataContext = createContext<DairyDataContextValue | null>(null);

export function DairyProvider({ children }: { children: ReactNode }) {
  const { society, accounts, members, addVoucher, cancelVoucher, registerVoucherOwner, registerVoucherCancelFollower } = useData();
  const { user } = useAuth();
  // J6b: load this module's tables only when its capability is on for the society (same rule as the
  // sidebar / CapabilityGuard) — societies that don't use dairy no longer fetch them on every login.
  const moduleOn = useCapabilityEnabled(['dairy_collection']);
  const loadSid = moduleOn ? user?.societyId : undefined;
  const { toast } = useToast();
  const societyId = user?.societyId || 'SOC001';
  // T-01: stamp BOTH tenancy keys (society_id + jurisdiction) — the value comes from the SSOT
  // resolver so a domain row carries the same jurisdiction the main context writes (anti-IRR-4).
  const withSoc = <T extends object>(d: T): LooseRow => ({ ...d, society_id: societyId, jurisdiction: resolveJurisdiction(society?.state) });

  const societyRef = useRef(society);
  societyRef.current = society;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  // X-1: a voucher refused late → the domain record is not made either (rows are written only in onSaved).
  const voucherRefused = (title: string) => voucherRefusedToast(toastRef.current, title);
  const inFlight = useInFlight(() => inFlightToast(toastRef.current));

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

  // ── Rate-chart state (localStorage seed → Supabase load on session) ─────────
  const [rateCharts, setRateChartsState] = useState<DairyRateChart[]>(() => storage.getDairyRateCharts());
  const [milkEntries, setMilkEntriesState] = useState<MilkEntry[]>(() => storage.getMilkEntries());
  const [settlements, setSettlementsState] = useState<DairySettlement[]>(() => storage.getDairySettlements());
  const [dispatches, setDispatchesState] = useState<DairyDispatch[]>(() => storage.getDairyDispatches());
  const [inputIssues, setInputIssuesState] = useState<DairyInputIssue[]>(() => storage.getDairyInputIssues());
  const [distributions, setDistributionsState] = useState<DairyDistribution[]>(() => storage.getDairyDistributions());
  // X-1: updates applied in a voucher's onSaved start from the CURRENT rows.
  const settlementsLatest = useLatest(settlements);
  const dispatchesLatest = useLatest(dispatches);
  const distributionsLatest = useLatest(distributions);
  // H / RULE 3: vouchers these documents carry are cancelled through the document, not alone.
  const ownerGroupsRef = useRef<OwnerGroup[]>([]);
  ownerGroupsRef.current = [{ label: tr('दूध भुगतान (Settlement)', 'Milk payment (Settlement)'), docs: settlements }, { label: tr('दूध डिस्पैच', 'Milk dispatch'), docs: dispatches }, { label: tr('इनपुट वितरण', 'Input distribution'), docs: inputIssues }, { label: tr('बोनस/लाभ वितरण', 'Bonus/profit distribution'), docs: distributions }];
  useEffect(() => registerVoucherOwner('dairy', id => findVoucherOwner(ownerGroupsRef.current, id)), [registerVoucherOwner]);

  useEffect(() => {
    const sid = loadSid;
    if (!sid) { setRateChartsState([]); return; }
    fetchAllPaged<DairyRateChart>('dairy_rate_charts', sid).then(
      ({ data, error }) => setRateChartsState(error || !data ? storage.getDairyRateCharts() : (data as DairyRateChart[])),
      () => setRateChartsState(storage.getDairyRateCharts()),
    );
  }, [loadSid]);

  // Milk entries — SSOT load; C-B: adopt any rows left in the former page's bespoke
  // `sl_milk_entries_${sid}` key (offline-only entries that never synced) so nothing is lost.
  useEffect(() => {
    const sid = loadSid;
    if (!sid) { setMilkEntriesState([]); return; }
    let legacy: MilkEntry[] = [];
    try { const raw = localStorage.getItem(`sl_milk_entries_${sid}`); if (raw) legacy = JSON.parse(raw) as MilkEntry[]; } catch { /* ignore */ }
    const merge = (cloud: MilkEntry[]): MilkEntry[] => {
      if (!Array.isArray(legacy) || legacy.length === 0) return cloud;
      const ids = new Set(cloud.map(r => r.id));
      const merged = [...cloud, ...legacy.filter(r => r && r.id && !ids.has(r.id))];
      storage.setMilkEntries(merged);
      // A1 fix: retire the bespoke legacy key once adopted, so a subsequently-deleted
      // entry can never be resurrected by a re-merge on the next load.
      try { localStorage.removeItem(`sl_milk_entries_${sid}`); } catch { /* ignore */ }
      return merged;
    };
    fetchAllPaged<MilkEntry>('milk_entries', sid).then(
      ({ data, error }) => setMilkEntriesState(merge(error || !data ? storage.getMilkEntries() : (data as MilkEntry[]))),
      () => setMilkEntriesState(merge(storage.getMilkEntries())),
    );
  }, [loadSid]);

  useEffect(() => {
    const sid = loadSid;
    if (!sid) { setSettlementsState([]); return; }
    fetchAllPaged<DairySettlement>('dairy_settlements', sid).then(
      ({ data, error }) => setSettlementsState(error || !data ? storage.getDairySettlements() : (data as DairySettlement[])),
      () => setSettlementsState(storage.getDairySettlements()),
    );
  }, [loadSid]);

  useEffect(() => {
    const sid = loadSid;
    if (!sid) { setDispatchesState([]); return; }
    fetchAllPaged<DairyDispatch>('dairy_dispatches', sid).then(
      ({ data, error }) => setDispatchesState(error || !data ? storage.getDairyDispatches() : (data as DairyDispatch[])),
      () => setDispatchesState(storage.getDairyDispatches()),
    );
  }, [loadSid]);

  useEffect(() => {
    const sid = loadSid;
    if (!sid) { setInputIssuesState([]); return; }
    fetchAllPaged<DairyInputIssue>('dairy_input_issues', sid).then(
      ({ data, error }) => setInputIssuesState(error || !data ? storage.getDairyInputIssues() : (data as DairyInputIssue[])),
      () => setInputIssuesState(storage.getDairyInputIssues()),
    );
  }, [loadSid]);

  useEffect(() => {
    const sid = loadSid;
    if (!sid) { setDistributionsState([]); return; }
    fetchAllPaged<DairyDistribution>('dairy_distributions', sid).then(
      ({ data, error }) => setDistributionsState(error || !data ? storage.getDairyDistributions() : (data as DairyDistribution[])),
      () => setDistributionsState(storage.getDairyDistributions()),
    );
  }, [loadSid]);

  // C-A dedicated milk ledgers (procurement, bulk sales, member input receivable, bonus
  // distribution + payable) are NOT created here. The old load-time seeder wrote duplicate accounts
  // (RM-05); they are now provisioned only by an explicit admin action — Ledger Hygiene →
  // "डोमेन खाते बनाएँ" (useDomainAccountProvisioning). Posting paths refuse with a toast while missing.

  const addRateChart = useCallback((data: Omit<DairyRateChart, 'id' | 'createdAt'>): DairyRateChart => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as DairyRateChart;
    const chart: DairyRateChart = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setRateChartsState(prev => { const u = [...prev, chart]; storage.setDairyRateCharts(u); return u; });
    supabase.from('dairy_rate_charts').upsert(withSoc(chart)).then(({ error }) => {
      if (error) {
        console.error('Rate chart save error:', error.message); reportError('dairy-save', error.message);
        setRateChartsState(prev => { const r = prev.filter(c => c.id !== chart.id); storage.setDairyRateCharts(r); return r; });
        toastRef.current({ title: tr('रेट चार्ट सेव नहीं हुआ', 'Rate chart not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का dairy_rate_charts block चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refreshing will not cause any problem. (First time: run the dairy_rate_charts block of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
      }
    });
    return chart;
  }, [societyId]);

  const updateRateChart = useCallback((id: string, data: Partial<DairyRateChart>) => {
    if (guardFYLocked()) return;
    setRateChartsState(prev => {
      const before = prev.find(c => c.id === id);
      const u = prev.map(c => c.id === id ? { ...c, ...data } : c);
      storage.setDairyRateCharts(u);
      const next = u.find(c => c.id === id);
      if (next && before) patchRow('dairy_rate_charts', id, before, next).then(({ error }) => {
        if (error) {
          setRateChartsState(p => { const r = p.map(c => c.id === id ? before : c); storage.setDairyRateCharts(r); return r; });
          toastRef.current({ title: tr('अपडेट सेव नहीं हुआ', 'Update not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const deleteRateChart = useCallback((id: string) => {
    if (guardFYLocked()) return;
    setRateChartsState(prev => {
      const before = prev.find(c => c.id === id);
      const u = prev.map(c => c.id === id ? { ...c, isDeleted: true } : c);
      storage.setDairyRateCharts(u);
      if (before) supabase.from('dairy_rate_charts').upsert(withSoc({ ...before, isDeleted: true })).then(({ error }) => {
        if (error) {
          setRateChartsState(p => { const r = p.map(c => c.id === id ? before : c); storage.setDairyRateCharts(r); return r; });
          toastRef.current({ title: tr('डिलीट सेव नहीं हुआ', 'Delete not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}.`, `Not saved to the cloud — ${error.message}.`), variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId]);

  const addMilkEntry = useCallback((data: Omit<MilkEntry, 'id' | 'createdAt'>): MilkEntry => {
    if (guardFYLocked()) return { ...data, id: '', createdAt: '' } as MilkEntry;
    const entry: MilkEntry = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setMilkEntriesState(prev => { const u = [...prev, entry]; storage.setMilkEntries(u); return u; });
    supabase.from('milk_entries').upsert(withSoc(entry)).then(({ error }) => {
      if (error) {
        console.error('Milk entry save error:', error.message); reportError('dairy-save', error.message);
        setMilkEntriesState(prev => { const r = prev.filter(e => e.id !== entry.id); storage.setMilkEntries(r); return r; });
        toastRef.current({ title: tr('एंट्री सेव नहीं हुई', 'Entry not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर कुछ ग़लत नहीं होगा। (पहली बार: supabase-tables.sql का milk_entries block चलाएँ।)`, `Not saved to the cloud — ${error.message}. Refreshing will not cause any problem. (First time: run the milk_entries block of supabase-tables.sql.)`), variant: 'destructive', duration: 12000 });
      }
    });
    return entry;
  }, [societyId]);

  const deleteMilkEntry = useCallback((id: string) => {
    if (guardFYLocked()) return;
    // A6 fix: an entry inside an APPROVED settlement's window was already paid on a frozen gross —
    // deleting it would break the collection-register / passbook tie-out. Block it.
    const entry = milkEntries.find(e => e.id === id);
    if (entry) {
      const locked = settlements.find(s => !s.isDeleted && s.status === 'approved' && s.memberId === entry.memberId && (s.from || '') <= entry.date && (s.to || '') >= entry.date);
      if (locked) { toastRef.current({ title: tr('सेटलमेंट में शामिल', 'Included in a settlement'), description: tr(`यह एंट्री ${locked.settlementNo || 'approved सेटलमेंट'} में गिनी जा चुकी है — पहले सेटलमेंट reverse करें।`, `This entry is already counted in ${locked.settlementNo || 'an approved settlement'} — reverse the settlement first.`), variant: 'destructive', duration: 10000 }); return; }
    }
    setMilkEntriesState(prev => {
      const before = prev.find(e => e.id === id);
      const u = prev.filter(e => e.id !== id);
      storage.setMilkEntries(u);
      if (before) supabase.from('milk_entries').delete().eq('id', id).then(({ error }) => {
        if (error) {
          setMilkEntriesState(p => { const r = [...p, before]; storage.setMilkEntries(r); return r; });
          toastRef.current({ title: tr('डिलीट नहीं हुआ', 'Delete failed'), description: tr(`क्लाउड से हटाना नहीं हुआ — ${error.message}. एंट्री वापस ले आई गई।`, `Could not delete from the cloud — ${error.message}. The entry has been restored.`), variant: 'destructive', duration: 12000 });
        }
      });
      return u;
    });
  }, [societyId, milkEntries, settlements]);

  // ── Farmer settlement cycle (D3) — the authoritative per-member posting path ──
  const persistSettlement = useCallback((next: DairySettlement, revertTo: DairySettlement | null, onFail?: () => void) => {
    supabase.from('dairy_settlements').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('Settlement save error:', error.message); reportError('dairy-save', error.message);
        setSettlementsState(prev => { const u = revertTo ? prev.map(s => s.id === next.id ? revertTo : s) : prev.filter(s => s.id !== next.id); storage.setDairySettlements(u); return u; });
        onFail?.();
        toastRef.current({ title: tr('सेटलमेंट सेव नहीं हुआ', 'Settlement not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा। (पहली बार: dairy_settlements block चलाएँ।)`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back. (First time: run the dairy_settlements block.)`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [societyId]);

  const commitSettlement = useCallback((next: DairySettlement, revertTo: DairySettlement | null, onFail?: () => void) => {
    setSettlementsState(prev => {
      const u = prev.some(s => s.id === next.id) ? prev.map(s => s.id === next.id ? next : s) : [...prev, next];
      storage.setDairySettlements(u); return u;
    });
    persistSettlement(next, revertTo, onFail);
  }, [persistSettlement]);

  const createDairySettlement = useCallback((args: { memberId: string; from: string; to: string }): DairySettlement => {
    const sentinel = { id: '' } as DairySettlement;
    if (guardFYLocked()) return sentinel;
    const member = members.find(m => m.id === args.memberId);
    if (!member) { toastRef.current({ title: tr('सदस्य नहीं मिला', 'Member not found'), variant: 'destructive' }); return sentinel; }
    // A2 fix: block overlapping settlement windows for the same member — otherwise the
    // milk cost for the overlapping days would be accrued (Dr 5108 / Cr 2102) twice.
    const overlap = settlements.find(s => !s.isDeleted && s.memberId === args.memberId && (s.from || '') <= args.to && (s.to || '') >= args.from);
    if (overlap) { toastRef.current({ title: tr('अवधि ओवरलैप', 'Period overlap'), description: tr(`इस सदस्य का ${overlap.from}→${overlap.to} सेटलमेंट पहले से है — अवधि दोहराई नहीं जा सकती।`, `This member already has a settlement for ${overlap.from}→${overlap.to} — the period cannot be repeated.`), variant: 'destructive', duration: 10000 }); return sentinel; }
    const gross = computeGross(milkEntries, args.memberId, args.from, args.to);
    if (gross <= 0) { toastRef.current({ title: tr('कोई दूध नहीं', 'No milk'), description: tr('इस सदस्य का इस अवधि में कोई स्वीकृत संकलन नहीं।', 'This member has no accepted collection in this period.'), variant: 'destructive' }); return sentinel; }
    const s: DairySettlement = {
      id: crypto.randomUUID(), memberId: member.id, memberName: member.name,
      from: args.from, to: args.to, gross, deductionLines: [], netPayable: gross, amountPaid: 0,
      status: 'draft', createdAt: new Date().toISOString(),
    };
    commitSettlement(s, null);
    toastRef.current({ title: tr('सेटलमेंट बनाया (draft)', 'Settlement created (draft)'), description: tr(`${member.name} — सकल ₹${gross.toLocaleString('en-IN')}`, `${member.name} — gross ₹${gross.toLocaleString('en-IN')}`) });
    return s;
  }, [members, milkEntries, settlements, commitSettlement]);

  const addDairyDeduction = useCallback((args: { settlementId: string; type: string; accountId: string; amount: number; remarks?: string }) => {
    if (guardFYLocked()) return;
    const cur = settlements.find(s => s.id === args.settlementId);
    if (!cur || cur.status !== 'draft') { toastRef.current({ title: tr('बदल नहीं सकते', 'Cannot change'), description: tr('Approved सेटलमेंट में कटौती नहीं जुड़ सकती।', 'A deduction cannot be added to an approved settlement.'), variant: 'destructive' }); return; }
    if (!(args.amount > 0) || !args.accountId) { toastRef.current({ title: tr('अधूरी कटौती', 'Incomplete deduction'), variant: 'destructive' }); return; }
    // A5 fix: any deduction crediting the Member Input Receivable account is an input recovery —
    // cap it at the member's CURRENT derived outstanding so a manual line or a double-click can
    // never recover more feed/medicine than was issued (which would silently over-charge milk).
    const inputAcct = resolveMemberInputReceivableAccountId(accounts);
    let amount = +args.amount.toFixed(2);
    if (inputAcct && args.accountId === inputAcct) {
      const remaining = memberInputOutstanding(inputIssues, settlements, cur.memberId, inputAcct).outstanding;
      if (remaining <= 0.005) { toastRef.current({ title: tr('कोई बकाया आदान नहीं', 'No input dues outstanding'), description: tr('इस सदस्य का पूरा आदान पहले ही वसूल हो चुका है।', 'This member\'s inputs have already been fully recovered.'), variant: 'destructive' }); return; }
      if (amount > remaining) amount = remaining;
    }
    const line: DairyDeductionLine = { id: crypto.randomUUID(), type: args.type, accountId: args.accountId, amount, remarks: args.remarks };
    const lines = [...cur.deductionLines, line];
    if (sumDeductions(lines) > cur.gross + 0.005) { toastRef.current({ title: tr('कटौती सकल से ज़्यादा', 'Deduction is more than gross'), description: tr('कुल कटौती दूध-मूल्य से अधिक नहीं हो सकती।', 'Total deductions cannot be more than the milk value.'), variant: 'destructive' }); return; }
    const next: DairySettlement = { ...cur, deductionLines: lines, netPayable: netPayable(cur.gross, lines) };
    commitSettlement(next, cur);
  }, [settlements, inputIssues, accounts, commitSettlement]);

  const removeDairyDeduction = useCallback((args: { settlementId: string; lineId: string }) => {
    if (guardFYLocked()) return;
    const cur = settlements.find(s => s.id === args.settlementId);
    if (!cur || cur.status !== 'draft') return;
    const lines = cur.deductionLines.filter(l => l.id !== args.lineId);
    commitSettlement({ ...cur, deductionLines: lines, netPayable: netPayable(cur.gross, lines) }, cur);
  }, [settlements, commitSettlement]);

  const approveDairySettlement = useCallback((settlementId: string): DairySettlement => {
    const sentinel = { id: '' } as DairySettlement;
    if (guardFYLocked()) return sentinel;
    const cur = settlements.find(s => s.id === settlementId);
    if (!cur || cur.status !== 'draft') { toastRef.current({ title: tr('पहले से approved', 'Already approved'), variant: 'destructive' }); return sentinel; }
    const milkCost = resolveMilkProcurementAccountId(accounts);
    const payable = resolveMilkPayableAccountId(accounts);
    if (!milkCost || !payable) { toastRef.current({ title: tr('दुग्ध खाते नहीं मिले', 'Milk accounts not found'), description: tr('Milk procurement / payable ledger missing — Ledger Hygiene पर "डोमेन खाते बनाएँ" चलाएँ; फिर भी न मिले तो Ledger Heads पर खाता जोड़ें (admin).', 'Milk procurement / payable ledger missing — run "Create domain accounts" on Ledger Hygiene; if it is still missing, add the account in Ledger Heads (admin).'), variant: 'destructive', duration: 12000 }); return sentinel; }
    const legs = settlementLegs(cur.gross, cur.deductionLines, milkCost, payable);
    if (legs.length === 0) { toastRef.current({ title: tr('पोस्ट नहीं हुआ', 'Not posted'), description: tr('एंट्री के दोनों पक्ष बराबर नहीं (कटौती > सकल या खाता गुम)।', 'The two sides of the entry are not equal (deduction > gross, or an account is missing).'), variant: 'destructive' }); return sentinel; }
    const net = netPayable(cur.gross, cur.deductionLines);
    if (!inFlight.begin(`dairy-settlement:${cur.id}`)) return sentinel;   // X-1: one save at a time for this record
    const voucher = addVoucher({
      type: 'journal', date: cur.to,
      debitAccountId: milkCost, creditAccountId: payable, amount: cur.gross,
      lines: legs.map(l => ({ id: crypto.randomUUID(), accountId: l.accountId, type: l.type, amount: l.amount })),
      narration: `दूध सेटलमेंट ${cur.memberName} — ${cur.from} से ${cur.to} (सकल ₹${cur.gross}, नेट ₹${net})`,
      refType: 'dairy.settlement', refId: cur.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0], {
      // X-1: approved (and numbered) only once the server has the voucher; a late refusal leaves the draft as it was.
      onSaved: (sv) => {
        inFlight.end(`dairy-settlement:${cur.id}`);
        const latest = settlementsLatest.current;
        const now = latest.find(s => s.id === cur.id) ?? cur;
        const no = 'DS/' + String(latest.filter(s => s.status === 'approved' && !s.isDeleted).length + 1).padStart(4, '0');
        const next: DairySettlement = { ...now, status: 'approved', settlementNo: no, netPayable: net, voucherId: sv.id, approvedAt: new Date().toISOString(), approvedBy: user?.name || 'admin' };
        commitSettlement(next, now, () => cancelVoucher(sv.id, 'Settlement approval rolled back (cloud save failed)', user?.name || 'System', { viaParent: true, rollback: true }));
        toastRef.current({ title: tr('✅ सेटलमेंट approved', '✅ Settlement approved'), description: tr(`${no} — नेट देय ₹${net.toLocaleString('en-IN')}`, `${no} — net payable ₹${net.toLocaleString('en-IN')}`) });
      },
      onFailed: () => { inFlight.end(`dairy-settlement:${cur.id}`); voucherRefused(tr('सेटलमेंट approve नहीं हुआ', 'Settlement not approved')); },
    });
    if (!voucher?.id) { inFlight.end(`dairy-settlement:${cur.id}`); return sentinel; }
    return { ...cur, status: 'approved', netPayable: net, voucherId: voucher.id };
  }, [settlements, accounts, addVoucher, cancelVoucher, commitSettlement, user]);

  const recordDairySettlementPayment = useCallback((args: { settlementId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string; reference?: string }): Voucher => {
    const sentinel = { id: '' } as Voucher;
    if (guardFYLocked()) return sentinel;
    const cur = settlements.find(s => s.id === args.settlementId);
    if (!cur || cur.status !== 'approved') { toastRef.current({ title: tr('पहले approve करें', 'Approve it first'), variant: 'destructive' }); return sentinel; }
    const out = outstanding(cur.netPayable, cur.amountPaid);
    const amount = +Math.min(args.amount, out).toFixed(2);
    if (!(amount > 0)) { toastRef.current({ title: tr('कुछ बकाया नहीं', 'Nothing outstanding'), description: tr('पूरा भुगतान हो चुका है।', 'Full payment has already been made.'), variant: 'destructive' }); return sentinel; }
    const payable = resolveMilkPayableAccountId(accounts);
    if (!payable) { toastRef.current({ title: tr('देय खाता नहीं मिला', 'Payable account not found'), variant: 'destructive' }); return sentinel; }
    const creditAcc = args.mode === 'bank' ? (args.bankAccountId || storage.defaultBankAccountId(accounts)) : '3301';
    if (!inFlight.begin(`dairy-settlement:${cur.id}`)) return sentinel;   // X-1: one save at a time for this record
    const voucher = addVoucher({
      type: 'payment', date: args.date,
      debitAccountId: payable, creditAccountId: creditAcc, amount,
      lines: [{ id: crypto.randomUUID(), accountId: payable, type: 'Dr', amount }, { id: crypto.randomUUID(), accountId: creditAcc, type: 'Cr', amount }],
      narration: `दूध भुगतान ${cur.memberName} — ${cur.settlementNo || ''}${args.reference ? ` (${args.reference})` : ''}`,
      refType: 'dairy.settlement.payment', refId: cur.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0], {
      // X-1: the paid amount moves only once the server has the payment — from the CURRENT row.
      onSaved: (sv) => {
        inFlight.end(`dairy-settlement:${cur.id}`);
        const now = settlementsLatest.current.find(s => s.id === cur.id) ?? cur;
        const next: DairySettlement = { ...now, amountPaid: +(now.amountPaid + amount).toFixed(2) };
        commitSettlement(next, now, () => cancelVoucher(sv.id, 'Payment rolled back (cloud save failed)', user?.name || 'System', { viaParent: true, rollback: true }));
        toastRef.current({ title: tr('✅ भुगतान दर्ज', '✅ Payment recorded'), description: tr(`₹${amount.toLocaleString('en-IN')} — बकाया ₹${outstanding(now.netPayable, next.amountPaid).toLocaleString('en-IN')}`, `₹${amount.toLocaleString('en-IN')} — outstanding ₹${outstanding(now.netPayable, next.amountPaid).toLocaleString('en-IN')}`) });
      },
      onFailed: () => { inFlight.end(`dairy-settlement:${cur.id}`); voucherRefused(tr('भुगतान दर्ज नहीं हुआ', 'Payment not recorded')); },
    });
    if (!voucher?.id) { inFlight.end(`dairy-settlement:${cur.id}`); return sentinel; }
    return voucher;
  }, [settlements, accounts, addVoucher, cancelVoucher, commitSettlement, user]);

  const deleteDairySettlement = useCallback((settlementId: string) => {
    if (guardFYLocked()) return;
    const cur = settlements.find(s => s.id === settlementId);
    if (!cur) return;
    if (cur.status === 'approved' && cur.amountPaid > 0.005) { toastRef.current({ title: tr('भुगतान मौजूद', 'Payment exists'), description: tr('पहले भुगतान reverse करें, फिर हटाएँ।', 'Reverse the payment first, then delete.'), variant: 'destructive' }); return; }
    // H / RULE 3: abort if the voucher cannot be cancelled — the document must not outlive it.
    // X-3: marked deleted only once the cloud has CONFIRMED the cancel (not when it was merely started).
    const markDeleted = () => commitSettlement({ ...cur, isDeleted: true }, cur);
    if (cur.status === 'approved' && cur.voucherId) cancelVoucher(cur.voucherId, 'Settlement deleted', user?.name || 'System', { viaParent: true, onCancelled: markDeleted });
    else markDeleted();
  }, [settlements, cancelVoucher, commitSettlement, user]);

  // ── Milk dispatch to the Union (D4 — revenue side) ──
  const commitDispatch = useCallback((next: DairyDispatch, revertTo: DairyDispatch | null, onFail?: () => void) => {
    setDispatchesState(prev => { const u = prev.some(d => d.id === next.id) ? prev.map(d => d.id === next.id ? next : d) : [...prev, next]; storage.setDairyDispatches(u); return u; });
    supabase.from('dairy_dispatches').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('Dispatch save error:', error.message); reportError('dairy-save', error.message);
        setDispatchesState(prev => { const u = revertTo ? prev.map(d => d.id === next.id ? revertTo : d) : prev.filter(d => d.id !== next.id); storage.setDairyDispatches(u); return u; });
        onFail?.();
        toastRef.current({ title: tr('डिस्पैच सेव नहीं हुआ', 'Dispatch not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा। (पहली बार: dairy_dispatches block चलाएँ।)`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back. (First time: run the dairy_dispatches block.)`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [societyId]);

  const recordDairyDispatch = useCallback((data: Omit<DairyDispatch, 'id' | 'createdAt' | 'amount' | 'voucherId' | 'amountReceived'>): DairyDispatch => {
    const sentinel = { id: '' } as DairyDispatch;
    if (guardFYLocked()) return sentinel;
    const qty = data.qty || 0, rate = data.rate || 0;
    const amount = +(qty * rate).toFixed(2);
    if (qty <= 0 || amount <= 0) { toastRef.current({ title: tr('अधूरी जानकारी', 'Incomplete details'), description: tr('लीटर और दर ज़रूरी हैं।', 'Litres and rate are required.'), variant: 'destructive' }); return sentinel; }
    const rcv = resolveUnionReceivableAccountId(accounts);
    const sales = resolveMilkBulkSalesAccountId(accounts);
    if (!rcv || !sales) { toastRef.current({ title: tr('खाते नहीं मिले', 'Accounts not found'), description: tr('Union receivable / bulk-sales ledger missing — Ledger Hygiene पर "डोमेन खाते बनाएँ" चलाएँ; फिर भी न मिले तो Ledger Heads पर खाता जोड़ें (admin).', 'Union receivable / bulk-sales ledger missing — run "Create domain accounts" on Ledger Hygiene; if it is still missing, add the account in Ledger Heads (admin).'), variant: 'destructive', duration: 12000 }); return sentinel; }
    const binding = { 'milk.dispatch.receivable': rcv, 'milk.bulk.sales': sales };
    const specs = buildEngineVoucherLines(resolveDairyPostingLegs('RecogniseMilkDispatch', { amount, currency: 'INR' }, binding, accounts));
    if (specs.length !== 2) { toastRef.current({ title: tr('पोस्ट नहीं हुआ', 'Not posted'), description: tr('एंट्री के खाते तय नहीं हो सके।', 'The accounts for the entry could not be determined.'), variant: 'destructive' }); return sentinel; }
    const dr = specs.find(s => s.type === 'Dr'); const cr = specs.find(s => s.type === 'Cr');
    const d: DairyDispatch = { ...data, id: crypto.randomUUID(), amount, voucherId: '', amountReceived: 0, createdAt: new Date().toISOString() };
    if (!inFlight.begin('dairy-dispatch:new')) return sentinel;   // X-1: one save at a time for this record
    const voucher = addVoucher({
      type: 'journal', date: data.date,
      debitAccountId: dr!.accountId, creditAccountId: cr!.accountId, amount,
      lines: specs.map(s => ({ id: crypto.randomUUID(), accountId: s.accountId, type: s.type, amount: s.amount })),
      narration: `दूध डिस्पैच ${data.unionName} — ${qty} लीटर @ ₹${rate}`,
      refType: 'dairy.dispatch',
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0], {
      // X-1: the dispatch row is written only once the server has the voucher.
      onSaved: (sv) => {
        inFlight.end('dairy-dispatch:new');
        commitDispatch({ ...d, voucherId: sv.id }, null, () => cancelVoucher(sv.id, 'Dispatch rolled back (cloud save failed)', user?.name || 'System', { viaParent: true, rollback: true }));
        toastRef.current({ title: tr('✅ डिस्पैच दर्ज', '✅ Dispatch recorded'), description: tr(`${data.unionName} — बिक्री ₹${amount.toLocaleString('en-IN')}`, `${data.unionName} — sale ₹${amount.toLocaleString('en-IN')}`) });
      },
      onFailed: () => { inFlight.end('dairy-dispatch:new'); voucherRefused(tr('डिस्पैच दर्ज नहीं हुआ', 'Dispatch not recorded')); },
    });
    if (!voucher?.id) { inFlight.end('dairy-dispatch:new'); return sentinel; }
    return { ...d, voucherId: voucher.id };
  }, [accounts, addVoucher, cancelVoucher, commitDispatch, user]);

  const receiveUnionPayment = useCallback((args: { dispatchId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }): Voucher => {
    const sentinel = { id: '' } as Voucher;
    if (guardFYLocked()) return sentinel;
    const cur = dispatches.find(d => d.id === args.dispatchId && !d.isDeleted);
    if (!cur) return sentinel;
    const due = +(cur.amount - cur.amountReceived).toFixed(2);
    const amount = +Math.min(args.amount, due).toFixed(2);
    if (!(amount > 0)) { toastRef.current({ title: tr('कुछ बकाया नहीं', 'Nothing outstanding'), variant: 'destructive' }); return sentinel; }
    const rcv = resolveUnionReceivableAccountId(accounts);
    if (!rcv) { toastRef.current({ title: tr('देनदार खाता नहीं मिला', 'Debtor account not found'), variant: 'destructive' }); return sentinel; }
    const debitAcc = args.mode === 'bank' ? (args.bankAccountId || storage.defaultBankAccountId(accounts)) : '3301';
    if (!inFlight.begin(`dairy-dispatch:${cur.id}`)) return sentinel;   // X-1: one save at a time for this record
    const voucher = addVoucher({
      type: 'receipt', date: args.date,
      debitAccountId: debitAcc, creditAccountId: rcv, amount,
      lines: [{ id: crypto.randomUUID(), accountId: debitAcc, type: 'Dr', amount }, { id: crypto.randomUUID(), accountId: rcv, type: 'Cr', amount }],
      narration: `यूनियन भुगतान प्राप्त — ${cur.unionName} (${cur.date})`,
      refType: 'dairy.dispatch.receipt', refId: cur.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0], {
      // X-1: the received amount moves only once the server has the receipt — from the CURRENT row.
      onSaved: (sv) => {
        inFlight.end(`dairy-dispatch:${cur.id}`);
        const now = dispatchesLatest.current.find(d => d.id === cur.id) ?? cur;
        const next: DairyDispatch = { ...now, amountReceived: +(now.amountReceived + amount).toFixed(2) };
        commitDispatch(next, now, () => cancelVoucher(sv.id, 'Union payment rolled back (cloud save failed)', user?.name || 'System', { viaParent: true, rollback: true }));
        toastRef.current({ title: tr('✅ भुगतान प्राप्त', '✅ Payment received'), description: tr(`₹${amount.toLocaleString('en-IN')} — बकाया ₹${(now.amount - next.amountReceived).toLocaleString('en-IN')}`, `₹${amount.toLocaleString('en-IN')} — outstanding ₹${(now.amount - next.amountReceived).toLocaleString('en-IN')}`) });
      },
      onFailed: () => { inFlight.end(`dairy-dispatch:${cur.id}`); voucherRefused(tr('यूनियन भुगतान दर्ज नहीं हुआ', 'Union payment not recorded')); },
    });
    if (!voucher?.id) { inFlight.end(`dairy-dispatch:${cur.id}`); return sentinel; }
    return voucher;
  }, [dispatches, accounts, addVoucher, cancelVoucher, commitDispatch, user]);

  const deleteDairyDispatch = useCallback((dispatchId: string) => {
    if (guardFYLocked()) return;
    const cur = dispatches.find(d => d.id === dispatchId);
    if (!cur) return;
    if (cur.amountReceived > 0.005) { toastRef.current({ title: tr('भुगतान मौजूद', 'Payment exists'), description: tr('पहले प्राप्ति reverse करें, फिर हटाएँ।', 'Reverse the receipt first, then delete.'), variant: 'destructive' }); return; }
    // X-3: marked deleted only once the cloud has CONFIRMED the cancel (not when it was merely started).
    const markDeleted = () => commitDispatch({ ...cur, isDeleted: true }, cur);
    if (cur.voucherId) cancelVoucher(cur.voucherId, 'Dispatch deleted', user?.name || 'System', { viaParent: true, onCancelled: markDeleted });   // H / RULE 3
    else markDeleted();
  }, [dispatches, cancelVoucher, commitDispatch, user]);

  // ── Member input issue: feed / medicine / AI on credit (D4b) ──
  const commitInputIssue = useCallback((next: DairyInputIssue, revertTo: DairyInputIssue | null, onFail?: () => void) => {
    setInputIssuesState(prev => { const u = prev.some(i => i.id === next.id) ? prev.map(i => i.id === next.id ? next : i) : [...prev, next]; storage.setDairyInputIssues(u); return u; });
    supabase.from('dairy_input_issues').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('Input issue save error:', error.message); reportError('dairy-save', error.message);
        setInputIssuesState(prev => { const u = revertTo ? prev.map(i => i.id === next.id ? revertTo : i) : prev.filter(i => i.id !== next.id); storage.setDairyInputIssues(u); return u; });
        onFail?.();
        toastRef.current({ title: tr('आदान सेव नहीं हुआ', 'Input issue not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा। (पहली बार: dairy_input_issues block चलाएँ।)`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back. (First time: run the dairy_input_issues block.)`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [societyId]);

  const recordDairyInputIssue = useCallback((data: Omit<DairyInputIssue, 'id' | 'createdAt' | 'voucherId'>): DairyInputIssue => {
    const sentinel = { id: '' } as DairyInputIssue;
    if (guardFYLocked()) return sentinel;
    const amount = +(data.amount || 0).toFixed(2);
    if (amount <= 0 || !data.memberId || !data.incomeAccountId) { toastRef.current({ title: tr('अधूरी जानकारी', 'Incomplete details'), description: tr('सदस्य, राशि और आय-खाता ज़रूरी हैं।', 'Member, amount and income account are required.'), variant: 'destructive' }); return sentinel; }
    const rcv = resolveMemberInputReceivableAccountId(accounts);
    if (!rcv || !accounts.some(a => a.id === data.incomeAccountId)) { toastRef.current({ title: tr('खाता नहीं मिला', 'Account not found'), description: tr('Member input receivable / income ledger missing — Ledger Hygiene पर "डोमेन खाते बनाएँ" चलाएँ; फिर भी न मिले तो Ledger Heads पर खाता जोड़ें (admin).', 'Member input receivable / income ledger missing — run "Create domain accounts" on Ledger Hygiene; if it is still missing, add the account in Ledger Heads (admin).'), variant: 'destructive', duration: 12000 }); return sentinel; }
    const issue: DairyInputIssue = { ...data, id: crypto.randomUUID(), amount, voucherId: '', createdAt: new Date().toISOString() };
    if (!inFlight.begin('dairy-input:new')) return sentinel;   // X-1: one save at a time for this record
    const voucher = addVoucher({
      type: 'journal', date: data.date,
      debitAccountId: rcv, creditAccountId: data.incomeAccountId, amount,
      lines: [{ id: crypto.randomUUID(), accountId: rcv, type: 'Dr', amount }, { id: crypto.randomUUID(), accountId: data.incomeAccountId, type: 'Cr', amount }],
      narration: `आदान (उधार) — ${data.memberName} — ${data.inputType}${data.itemName ? ` ${data.itemName}` : ''}`,
      refType: 'dairy.input.issue',
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0], {
      // X-1: the issue row is written only once the server has the voucher.
      onSaved: (sv) => {
        inFlight.end('dairy-input:new');
        commitInputIssue({ ...issue, voucherId: sv.id }, null, () => cancelVoucher(sv.id, 'Input issue rolled back (cloud save failed)', user?.name || 'System', { viaParent: true, rollback: true }));
        toastRef.current({ title: tr('✅ आदान दर्ज', '✅ Input issue recorded'), description: tr(`${data.memberName} — ₹${amount.toLocaleString('en-IN')} (उधार)`, `${data.memberName} — ₹${amount.toLocaleString('en-IN')} (on credit)`) });
      },
      onFailed: () => { inFlight.end('dairy-input:new'); voucherRefused(tr('आदान दर्ज नहीं हुआ', 'Input issue not recorded')); },
    });
    if (!voucher?.id) { inFlight.end('dairy-input:new'); return sentinel; }
    return { ...issue, voucherId: voucher.id };
  }, [accounts, addVoucher, cancelVoucher, commitInputIssue, user]);

  const deleteDairyInputIssue = useCallback((id: string) => {
    if (guardFYLocked()) return;
    const cur = inputIssues.find(i => i.id === id);
    if (!cur) return;
    // A7 fix: don't orphan a recovery — if removing this issue would leave the member's
    // recovered amount exceeding what remains issued, the 3305 receivable would go negative.
    const inputAcct = resolveMemberInputReceivableAccountId(accounts);
    if (inputAcct) {
      const bal = memberInputOutstanding(inputIssues, settlements, cur.memberId, inputAcct);
      if (bal.recovered > bal.issued - cur.amount + 0.005) { toastRef.current({ title: tr('वसूली मौजूद', 'Recovery exists'), description: tr('इस आदान की वसूली सेटलमेंट में हो चुकी है — पहले वह सेटलमेंट/कटौती reverse करें।', 'This input has already been recovered in a settlement — reverse that settlement/deduction first.'), variant: 'destructive', duration: 10000 }); return; }
    }
    // X-3: marked deleted only once the cloud has CONFIRMED the cancel (not when it was merely started).
    const markDeleted = () => commitInputIssue({ ...cur, isDeleted: true }, cur);
    if (cur.voucherId) cancelVoucher(cur.voucherId, 'Input issue deleted', user?.name || 'System', { viaParent: true, onCancelled: markDeleted });   // H / RULE 3
    else markDeleted();
  }, [inputIssues, settlements, accounts, cancelVoucher, commitInputIssue, user]);

  const getMemberInputBalance = useCallback(
    (memberId: string) => memberInputOutstanding(inputIssues, settlements, memberId, resolveMemberInputReceivableAccountId(accounts) || ''),
    [inputIssues, settlements, accounts],
  );

  // ── Year-end distribution: patronage bonus / dividend (D6, governance-gated) ──
  const commitDistribution = useCallback((next: DairyDistribution, revertTo: DairyDistribution | null, onFail?: () => void) => {
    setDistributionsState(prev => { const u = prev.some(d => d.id === next.id) ? prev.map(d => d.id === next.id ? next : d) : [...prev, next]; storage.setDairyDistributions(u); return u; });
    supabase.from('dairy_distributions').upsert(withSoc(next)).then(({ error }) => {
      if (error) {
        console.error('Distribution save error:', error.message); reportError('dairy-save', error.message);
        setDistributionsState(prev => { const u = revertTo ? prev.map(d => d.id === next.id ? revertTo : d) : prev.filter(d => d.id !== next.id); storage.setDairyDistributions(u); return u; });
        onFail?.();
        toastRef.current({ title: tr('वितरण सेव नहीं हुआ', 'Distribution not saved'), description: tr(`क्लाउड में सेव नहीं हुआ — ${error.message}. Refresh करने पर पुराना data वापस आ जाएगा। (पहली बार: dairy_distributions block चलाएँ।)`, `Not saved to the cloud — ${error.message}. On Refresh, the old data will come back. (First time: run the dairy_distributions block.)`), variant: 'destructive', duration: 12000 });
      }
    });
  }, [societyId]);

  const createDairyDistribution = useCallback((args: { kind: 'bonus'; from: string; to: string; basis: DairyBonusBasis; rate: number } | { kind: 'dividend'; rate: number; fyLabel?: string }): DairyDistribution => {
    const sentinel = { id: '' } as DairyDistribution;
    if (guardFYLocked()) return sentinel;
    if (!(args.rate > 0)) { toastRef.current({ title: tr('दर ज़रूरी', 'Rate required'), description: tr('एक धनात्मक दर डालें।', 'Enter a positive rate.'), variant: 'destructive' }); return sentinel; }
    const lines = args.kind === 'bonus'
      ? computeBonusLines(milkEntries, args.from, args.to, args.basis, args.rate)
      // A3 fix: dividend only to ACTIVE members (computeDividendLines excludes inactive/exited).
      : computeDividendLines(members.map(m => ({ id: m.id, name: m.name, shareCapital: m.shareCapital, status: m.status })), args.rate);
    if (lines.length === 0) { toastRef.current({ title: tr('कोई राशि नहीं', 'No amount'), description: args.kind === 'bonus' ? tr('इस अवधि में कोई स्वीकृत दूध नहीं।', 'No accepted milk in this period.') : tr('किसी सदस्य की शेयर पूंजी नहीं।', 'No member has share capital.'), variant: 'destructive' }); return sentinel; }
    const total = distributionTotal(lines);
    const d: DairyDistribution = {
      id: crypto.randomUUID(), kind: args.kind, rate: args.rate,
      from: args.kind === 'bonus' ? args.from : undefined, to: args.kind === 'bonus' ? args.to : undefined,
      basis: args.kind === 'bonus' ? args.basis : undefined, fyLabel: args.kind === 'dividend' ? args.fyLabel : undefined,
      resolutionNo: '', lines, total, status: 'draft', amountPaid: 0, createdAt: new Date().toISOString(),
    };
    commitDistribution(d, null);
    toastRef.current({ title: tr('वितरण बनाया (draft)', 'Distribution created (draft)'), description: tr(`${lines.length} सदस्य · कुल ₹${total.toLocaleString('en-IN')}`, `${lines.length} members · total ₹${total.toLocaleString('en-IN')}`) });
    return d;
  }, [milkEntries, members, commitDistribution]);

  const approveDairyDistribution = useCallback((args: { distributionId: string; resolutionNo: string; resolutionDate?: string }): DairyDistribution => {
    const sentinel = { id: '' } as DairyDistribution;
    if (guardFYLocked()) return sentinel;
    const cur = distributions.find(d => d.id === args.distributionId);
    if (!cur || cur.status !== 'draft') { toastRef.current({ title: tr('पहले से approved', 'Already approved'), variant: 'destructive' }); return sentinel; }
    if (!args.resolutionNo || !args.resolutionNo.trim()) { toastRef.current({ title: tr('प्रस्ताव संख्या आवश्यक', 'Resolution number required'), description: tr('बोनस/लाभांश वितरण के लिए सभा/बोर्ड प्रस्ताव संख्या ज़रूरी है।', 'A general body/board resolution number is required for a bonus/dividend distribution.'), variant: 'destructive', duration: 10000 }); return sentinel; }
    const distAcc = cur.kind === 'bonus' ? resolveBonusDistributionAccountId(accounts) : resolveDividendDistributionAccountId(accounts);
    const payAcc = cur.kind === 'bonus' ? resolveBonusPayableAccountId(accounts) : resolveDividendPayableAccountId(accounts);
    if (!distAcc || !payAcc) { toastRef.current({ title: tr('खाते नहीं मिले', 'Accounts not found'), description: tr('Distribution / payable ledger missing — Ledger Hygiene पर "डोमेन खाते बनाएँ" चलाएँ; फिर भी न मिले तो Ledger Heads पर खाता जोड़ें (admin).', 'Distribution / payable ledger missing — run "Create domain accounts" on Ledger Hygiene; if it is still missing, add the account in Ledger Heads (admin).'), variant: 'destructive', duration: 12000 }); return sentinel; }
    const legs = distributionLegs(cur.total, distAcc, payAcc);
    if (legs.length === 0) { toastRef.current({ title: tr('पोस्ट नहीं हुआ', 'Not posted'), description: tr('एंट्री के दोनों पक्ष बराबर नहीं।', 'The two sides of the entry are not equal.'), variant: 'destructive' }); return sentinel; }
    const kindHi = cur.kind === 'bonus' ? 'बोनस' : 'लाभांश';
    if (!inFlight.begin(`dairy-distribution:${cur.id}`)) return sentinel;   // X-1: one save at a time for this record
    const voucher = addVoucher({
      type: 'journal', date: args.resolutionDate || new Date().toISOString().slice(0, 10),
      debitAccountId: distAcc, creditAccountId: payAcc, amount: cur.total,
      lines: legs.map(l => ({ id: crypto.randomUUID(), accountId: l.accountId, type: l.type, amount: l.amount })),
      narration: `${kindHi} वितरण — प्रस्ताव ${args.resolutionNo} — कुल ₹${cur.total} (${cur.lines.length} सदस्य)`,
      refType: 'dairy.distribution', refId: cur.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0], {
      // X-1: approved only once the server has the voucher; a late refusal leaves the draft as it was.
      onSaved: (sv) => {
        inFlight.end(`dairy-distribution:${cur.id}`);
        const now = distributionsLatest.current.find(d => d.id === cur.id) ?? cur;
        const next: DairyDistribution = { ...now, status: 'approved', resolutionNo: args.resolutionNo.trim(), resolutionDate: args.resolutionDate, voucherId: sv.id, approvedAt: new Date().toISOString(), approvedBy: user?.name || 'admin' };
        commitDistribution(next, now, () => cancelVoucher(sv.id, 'Distribution approval rolled back (cloud save failed)', user?.name || 'System', { viaParent: true, rollback: true }));
        toastRef.current({ title: `✅ ${kindHi} approved`, description: tr(`प्रस्ताव ${args.resolutionNo} — कुल ₹${cur.total.toLocaleString('en-IN')}`, `Resolution ${args.resolutionNo} — total ₹${cur.total.toLocaleString('en-IN')}`) });
      },
      onFailed: () => { inFlight.end(`dairy-distribution:${cur.id}`); voucherRefused(tr(`${kindHi} approve नहीं हुआ`, 'Distribution not approved')); },
    });
    if (!voucher?.id) { inFlight.end(`dairy-distribution:${cur.id}`); return sentinel; }
    return { ...cur, status: 'approved', resolutionNo: args.resolutionNo.trim(), resolutionDate: args.resolutionDate, voucherId: voucher.id };
  }, [distributions, accounts, addVoucher, cancelVoucher, commitDistribution, user]);

  const recordDistributionPayment = useCallback((args: { distributionId: string; amount: number; mode: 'cash' | 'bank'; bankAccountId?: string; date: string }): Voucher => {
    const sentinel = { id: '' } as Voucher;
    if (guardFYLocked()) return sentinel;
    const cur = distributions.find(d => d.id === args.distributionId);
    if (!cur || cur.status !== 'approved') { toastRef.current({ title: tr('पहले approve करें', 'Approve it first'), variant: 'destructive' }); return sentinel; }
    const outstandingAmt = +(cur.total - cur.amountPaid).toFixed(2);
    const amount = +Math.min(args.amount, outstandingAmt).toFixed(2);
    if (!(amount > 0)) { toastRef.current({ title: tr('कुछ बकाया नहीं', 'Nothing outstanding'), variant: 'destructive' }); return sentinel; }
    const payAcc = cur.kind === 'bonus' ? resolveBonusPayableAccountId(accounts) : resolveDividendPayableAccountId(accounts);
    if (!payAcc) { toastRef.current({ title: tr('देय खाता नहीं मिला', 'Payable account not found'), description: tr('Ledger Hygiene पर "डोमेन खाते बनाएँ" चलाएँ; फिर भी न मिले तो Ledger Heads पर खाता जोड़ें (admin).', 'Run "Create domain accounts" on Ledger Hygiene; if it is still missing, add the account in Ledger Heads (admin).'), variant: 'destructive', duration: 12000 }); return sentinel; }
    const creditAcc = args.mode === 'bank' ? (args.bankAccountId || storage.defaultBankAccountId(accounts)) : '3301';
    const kindHi = cur.kind === 'bonus' ? 'बोनस' : 'लाभांश';
    if (!inFlight.begin(`dairy-distribution:${cur.id}`)) return sentinel;   // X-1: one save at a time for this record
    const voucher = addVoucher({
      type: 'payment', date: args.date,
      debitAccountId: payAcc, creditAccountId: creditAcc, amount,
      lines: [{ id: crypto.randomUUID(), accountId: payAcc, type: 'Dr', amount }, { id: crypto.randomUUID(), accountId: creditAcc, type: 'Cr', amount }],
      narration: `${kindHi} भुगतान — प्रस्ताव ${cur.resolutionNo}`,
      refType: 'dairy.distribution.payment', refId: cur.id,
      createdBy: user?.name || 'admin',
    } as Parameters<typeof addVoucher>[0], {
      // X-1: the paid amount moves only once the server has the payment — from the CURRENT row.
      onSaved: (sv) => {
        inFlight.end(`dairy-distribution:${cur.id}`);
        const now = distributionsLatest.current.find(d => d.id === cur.id) ?? cur;
        const next: DairyDistribution = { ...now, amountPaid: +(now.amountPaid + amount).toFixed(2) };
        commitDistribution(next, now, () => cancelVoucher(sv.id, 'Distribution payment rolled back (cloud save failed)', user?.name || 'System', { viaParent: true, rollback: true }));
        toastRef.current({ title: tr('✅ भुगतान दर्ज', '✅ Payment recorded'), description: tr(`₹${amount.toLocaleString('en-IN')} — बकाया ₹${(now.total - next.amountPaid).toLocaleString('en-IN')}`, `₹${amount.toLocaleString('en-IN')} — outstanding ₹${(now.total - next.amountPaid).toLocaleString('en-IN')}`) });
      },
      onFailed: () => { inFlight.end(`dairy-distribution:${cur.id}`); voucherRefused(tr('भुगतान दर्ज नहीं हुआ', 'Payment not recorded')); },
    });
    if (!voucher?.id) { inFlight.end(`dairy-distribution:${cur.id}`); return sentinel; }
    return voucher;
  }, [distributions, accounts, addVoucher, cancelVoucher, commitDistribution, user]);

  const deleteDairyDistribution = useCallback((distributionId: string) => {
    if (guardFYLocked()) return;
    const cur = distributions.find(d => d.id === distributionId);
    if (!cur) return;
    if (cur.status === 'approved' && cur.amountPaid > 0.005) { toastRef.current({ title: tr('भुगतान मौजूद', 'Payment exists'), description: tr('पहले भुगतान reverse करें, फिर हटाएँ।', 'Reverse the payment first, then delete.'), variant: 'destructive' }); return; }
    // X-3: marked deleted only once the cloud has CONFIRMED the cancel (not when it was merely started).
    const markDeleted = () => commitDistribution({ ...cur, isDeleted: true }, cur);
    if (cur.status === 'approved' && cur.voucherId) cancelVoucher(cur.voucherId, 'Distribution deleted', user?.name || 'System', { viaParent: true, onCancelled: markDeleted });   // H / RULE 3
    else markDeleted();
  }, [distributions, cancelVoucher, commitDistribution, user]);

  const resolveMilkRate = useCallback(
    (args: { fat: number; snf: number; qty: number; date?: string; season?: string }) =>
      priceMilk(rateCharts, { fat: args.fat, snf: args.snf, qty: args.qty, date: args.date || new Date().toISOString().slice(0, 10), season: args.season }),
    [rateCharts],
  );

  // X-5 (audit 2026-11-17): a payment / collection voucher cancelled from the Vouchers page takes its amount back off
  // its document here (DataContext calls this only after the cloud CONFIRMED the cancel, and only for a direct cancel).
  const followFailedD = (what: string, msg: string) => {
    reportError('voucher-cancel-follow', msg, { at: what });
    toastRef.current({ title: tr('⚠ document ठीक नहीं हुआ', '⚠ Document not updated'), description: tr(`वाउचर रद्द हुआ, पर ${what} की राशि क्लाउड पर नहीं घटी — ${msg}. Refresh करके देखें।`, `The voucher was cancelled, but ${what}'s figure did not go down on the cloud — ${msg}. Refresh and check.`), variant: 'destructive', duration: 15000 });
  };
  const followedToastD = (what: string, due: number) => toastRef.current({ title: tr('document भी ठीक किया गया', 'Document updated too'), description: tr(`भुगतान रद्द हुआ — ${what} पर ₹${due.toLocaleString('en-IN')} फिर से बकाया है।`, `The payment was cancelled — ₹${due.toLocaleString('en-IN')} is due again on ${what}.`), duration: 10000 });
  useEffect(() => registerVoucherCancelFollower('dairy', {
    refTypes: ['dairy.settlement.payment', 'dairy.dispatch.receipt', 'dairy.distribution.payment'], label: tr('दूध भुगतान / डिस्पैच / वितरण (Dairy)', 'Dairy settlement / dispatch / distribution'),
    follow: (v) => {
      if (v.refType === 'dairy.settlement.payment') {
        const cur = settlementsLatest.current.find(x => x.id === v.refId);
        if (!cur) return;
        const next: DairySettlement = { ...cur, amountPaid: figureAfterCancel(cur.amountPaid, v.amount) };
        commitSettlement(next, cur);
        followedToastD(tr('दूध भुगतान (settlement)', 'the milk settlement'), +(cur.netPayable - next.amountPaid).toFixed(2));
      } else if (v.refType === 'dairy.dispatch.receipt') {
        const cur = dispatchesLatest.current.find(x => x.id === v.refId);
        if (!cur) return;
        const next: DairyDispatch = { ...cur, amountReceived: figureAfterCancel(cur.amountReceived, v.amount) };
        commitDispatch(next, cur);
        followedToastD(tr('डिस्पैच', 'the dispatch'), +(cur.amount - next.amountReceived).toFixed(2));
      } else {
        const cur = distributionsLatest.current.find(x => x.id === v.refId);
        if (!cur) return;
        const next: DairyDistribution = { ...cur, amountPaid: figureAfterCancel(cur.amountPaid, v.amount) };
        commitDistribution(next, cur);
        followedToastD(tr('वितरण', 'the distribution'), +(cur.total - next.amountPaid).toFixed(2));
      }
    },
  }), [registerVoucherCancelFollower, commitSettlement, commitDispatch, commitDistribution]);
  void followFailedD;   // the commit helpers above report their own cloud failures

  return (
    <DairyDataContext.Provider value={{
      dairyReady: true,
      guardFYLocked,
      rateCharts,
      addRateChart,
      updateRateChart,
      deleteRateChart,
      resolveMilkRate,
      milkProcurementAccountId: resolveMilkProcurementAccountId(accounts),
      milkBulkSalesAccountId: resolveMilkBulkSalesAccountId(accounts),
      milkPayableAccountId: resolveMilkPayableAccountId(accounts),
      milkEntries,
      addMilkEntry,
      deleteMilkEntry,
      settlements,
      createDairySettlement,
      addDairyDeduction,
      removeDairyDeduction,
      approveDairySettlement,
      recordDairySettlementPayment,
      deleteDairySettlement,
      dispatches,
      recordDairyDispatch,
      receiveUnionPayment,
      deleteDairyDispatch,
      inputIssues,
      recordDairyInputIssue,
      deleteDairyInputIssue,
      memberInputReceivableAccountId: resolveMemberInputReceivableAccountId(accounts),
      getMemberInputBalance,
      distributions,
      createDairyDistribution,
      approveDairyDistribution,
      recordDistributionPayment,
      deleteDairyDistribution,
    }}>
      {children}
    </DairyDataContext.Provider>
  );
}

export function useDairyData(): DairyDataContextValue {
  const ctx = useContext(DairyDataContext);
  if (!ctx) throw new Error('useDairyData must be used within a DairyProvider');
  return ctx;
}
