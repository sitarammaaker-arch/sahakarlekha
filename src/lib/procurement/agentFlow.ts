/**
 * MSP agent flow — the PURE business rules behind the lot → J-Form → post → settle → pay →
 * commission → agency-receipt workflow (DataContext / MarketingDataContext / ProcurementLots call
 * these). No React, no Supabase, no toasts. Tested by scripts/test-procurement-agent-flow.mjs.
 *
 * The agency (HAFED, FCI, NAFED …) is always a ROW of the Agency master, never a type: every rule
 * here takes agency ids as data.
 */
import type { LedgerAccount, Voucher } from '@/types';
import { getVoucherLines } from '@/lib/voucherUtils';
import { toMinor, toRupees, addMinor } from '@/lib/money';

// ── 1. Business date ────────────────────────────────────────────────────────────────────────────
// Procurement-side vouchers (the posting, the settlement deductions, the commission) belong to the
// day the produce was bought — the J-Form — not the day someone clicked a button. Posting a March
// J-Form in April must not move it into the next period / financial year.

/** YYYY-MM-DD in LOCAL time for an ISO timestamp (a J-Form made at 01:00 IST is that IST day). */
export function localDateOf(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The lot's business date (batch B, migration 135) when set, else the J-Form date, else the lot's entry day, else `today`. */
export function procurementBusinessDate(jformCreatedAt: string | null | undefined, lotCreatedAt: string | null | undefined, today: string, lotDate?: string | null): string {
  return (lotDate && /^\d{4}-\d{2}-\d{2}$/.test(lotDate) ? lotDate : null) || localDateOf(jformCreatedAt) || localDateOf(lotCreatedAt) || today;
}

// ── 2. Quality gate ─────────────────────────────────────────────────────────────────────────────
/** A lot whose quality test was "rejected" may not get a J-Form, be posted, settled, paid or earn commission. */
export const isRejectedQuality = (result?: string | null): boolean => result === 'rejected';

// ── 3. Lot stage (what the badge shows instead of the raw "created" status) ────────────────────────
export type LotStage = 'new' | 'rejected' | 'inspected' | 'jform' | 'posted' | 'settlementDraft' | 'approved' | 'paid' | 'cancelled';

export function deriveLotStage(x: {
  cancelled?: boolean;
  qualityResult?: string | null;
  hasJForm: boolean;
  hasPosting: boolean;
  settlementStatus?: 'draft' | 'approved' | null;
  outstanding?: number | null;
}): LotStage {
  if (x.cancelled) return 'cancelled';
  if (isRejectedQuality(x.qualityResult)) return 'rejected';
  if (x.settlementStatus === 'approved') return (x.outstanding ?? 0) <= 0 ? 'paid' : 'approved';
  if (x.settlementStatus === 'draft') return 'settlementDraft';
  if (x.hasPosting) return 'posted';
  if (x.hasJForm) return 'jform';
  if (x.qualityResult) return 'inspected';
  return 'new';
}

export const LOT_STAGE_LABEL: Record<LotStage, { hi: string; en: string }> = {
  new: { hi: 'नया', en: 'New' },
  rejected: { hi: 'अस्वीकृत', en: 'Rejected' },
  inspected: { hi: 'क्वालिटी जाँची', en: 'Inspected' },
  jform: { hi: 'J-Form जारी', en: 'J-Form issued' },
  posted: { hi: 'बहीखाते में', en: 'Posted' },
  settlementDraft: { hi: 'निपटान ड्राफ्ट', en: 'Settlement draft' },
  approved: { hi: 'भुगतान बाकी', en: 'Payment due' },
  paid: { hi: 'भुगतान पूरा', en: 'Paid' },
  cancelled: { hi: 'रद्द', en: 'Cancelled' },
};

// ── 4. Deduction accounts ───────────────────────────────────────────────────────────────────────
// Money withheld from the farmer FOR SOMEONE ELSE (market committee, HRDF, labour, income-tax) is
// owed onward — a LIABILITY until paid over. Crediting an income account (4202 मंडी शुल्क आय /
// 4203 श्रम प्रभार आय) books it as the society's own income and overstates surplus.
// Commission (आढ़त) is different: when the society itself is the arhtiya it IS income, so it is
// not flagged.
type DedAcc = Pick<LedgerAccount, 'id' | 'name' | 'nameHi' | 'type'> & { isGroup?: boolean };

export const THIRD_PARTY_DEDUCTION_BASES: ReadonlySet<string> = new Set(['tds', 'market_fee', 'hrdf', 'labour']);

const PAYABLE_HINTS: Record<string, readonly string[]> = {
  tds: ['देय TDS', 'TDS Payable'],
  market_fee: ['देय मंडी शुल्क', 'मंडी शुल्क देय', 'Market Fee Payable'],
  hrdf: ['देय HRDF', 'HRDF Payable'],
  labour: ['देय हमाली', 'हमाली देय', 'Labour Payable', 'Hamali Payable'],
};
// Generic fallback for market fee / hamali when no dedicated payable exists.
const EXPENSES_PAYABLE = { id: '2102', hints: ['देय व्यय', 'Expenses Payable'] as const };

const hit = (a: DedAcc, hints: readonly string[]) =>
  hints.some(h => (a.nameHi || '').includes(h) || (a.name || '').toLowerCase().includes(h.toLowerCase()));

/**
 * The liability account to PRE-SELECT for a deduction basis, or null (the operator then chooses).
 * Only a suggestion: nothing is remapped, and an existing rule keeps whatever account it has.
 * HRDF is matched by NAME only — template id 2205 is HRDF Payable in the marketing chart but Cane
 * Development Cess in the sugar chart.
 */
export function suggestDeductionAccountId(basis: string, accounts: ReadonlyArray<DedAcc>): string | null {
  const liab = accounts.filter(a => !a.isGroup && a.type === 'liability');
  const hints = PAYABLE_HINTS[basis];
  if (hints) {
    const byName = liab.find(a => hit(a, hints));
    if (byName) return byName.id;
  }
  if (basis === 'tds') return liab.find(a => a.id === '2202')?.id ?? null;
  if (basis === 'market_fee' || basis === 'labour') {
    return (liab.find(a => a.id === EXPENSES_PAYABLE.id) || liab.find(a => hit(a, EXPENSES_PAYABLE.hints)))?.id ?? null;
  }
  return null;
}

export type DeductionAccountWarning = 'income_for_third_party' | 'not_liability';

/** Why this account is a poor home for a third-party deduction (null = fine / not applicable). */
export function deductionAccountWarning(basis: string | undefined, account: Pick<LedgerAccount, 'type'> | undefined | null): DeductionAccountWarning | null {
  if (!basis || !account || !THIRD_PARTY_DEDUCTION_BASES.has(basis)) return null;
  if (account.type === 'income') return 'income_for_third_party';
  if (account.type !== 'liability') return 'not_liability';
  return null;
}

export const DEDUCTION_WARNING_TEXT: Record<DeductionAccountWarning, { hi: string; en: string }> = {
  income_for_third_party: {
    hi: 'यह आय खाता है। किसान से किसी और (मंडी समिति / HRDF / मज़दूर / आयकर) के लिए काटी गई राशि समिति की आय नहीं, देनदारी है — कोई "देय" (liability) खाता चुनें।',
    en: 'This is an income account. Money withheld from the farmer for someone else is a liability, not the society\'s income — choose a "payable" account.',
  },
  not_liability: {
    hi: 'किसान से किसी और के लिए काटी गई राशि के लिए आम तौर पर "देय" (liability) खाता होना चाहिए।',
    en: 'A deduction withheld for a third party normally goes to a "payable" (liability) account.',
  },
};

// ── 5. Agency balances (MSP receivable / commission receivable, per agency) ───────────────────────
// Attribution needs no new column: every voucher that touches the receivable already points at its
// lot through the existing trace (engine voucher → PostingRuleResult → lot; payment → engine voucher;
// commission → lot), the lot points at its centre and the centre at its agency. A receipt names the
// agency it came from in its refId. Anything that cannot be traced is "unallocated".
export const AGENCY_RECEIPT_REF_TYPE = 'procurement.agency.receipt';
export const COMMISSION_RECEIPT_REF_TYPE = 'procurement.commission.receipt';
export const COMMISSION_ACCRUAL_REF_TYPE = 'procurement.commission';
/** Batch B: the engine reversal of a lot's posting voucher (refId = the same PostingRuleResult). */
export const ENGINE_REVERSAL_REF_TYPE = 'posting.rule.result.reversal';

type BalVoucher = Pick<Voucher, 'id' | 'isDeleted' | 'refType' | 'refId' | 'lines' | 'debitAccountId' | 'creditAccountId' | 'amount' | 'approvalStatus'>;

export interface AgencyBalanceInput {
  vouchers: ReadonlyArray<BalVoucher>;
  accountId: string;
  postingRuleResults: ReadonlyArray<{ id: string; lotId: string }>;
  settlements?: ReadonlyArray<{ id: string; engineVoucherId: string }>;
  lots: ReadonlyArray<{ id: string; centreId: string }>;
  centres: ReadonlyArray<{ id: string; agencyId: string }>;
  agencyIds: ReadonlySet<string>;
}

export interface AgencyBalances {
  /** Net Dr − Cr on the account across all live vouchers (rupees). */
  total: number;
  byAgency: Record<string, number>;
  unallocated: number;
}

export function agencyBalances(input: AgencyBalanceInput): AgencyBalances {
  const live = input.vouchers.filter(v => !v.isDeleted && v.approvalStatus !== 'rejected');
  const byId = new Map(live.map(v => [v.id, v]));
  const resultLot = new Map(input.postingRuleResults.map(r => [r.id, r.lotId]));
  const settlementEv = new Map((input.settlements || []).map(s => [s.id, s.engineVoucherId]));
  const lotCentre = new Map(input.lots.map(l => [l.id, l.centreId]));
  const centreAgency = new Map(input.centres.map(c => [c.id, c.agencyId]));

  const lotOfEngineVoucher = (evId?: string): string | undefined => {
    const ev = evId ? byId.get(evId) : undefined;
    return ev && ev.refType === 'posting.rule.result' && ev.refId ? resultLot.get(ev.refId) : undefined;
  };
  const agencyOf = (v: BalVoucher): string | undefined => {
    // D3: shortage and agency-bill vouchers name their agency in refId, like receipts.
    if ((v.refType === AGENCY_RECEIPT_REF_TYPE || v.refType === COMMISSION_RECEIPT_REF_TYPE || v.refType === 'procurement.dispatch.shortage' || v.refType === 'procurement.agency.bill') && v.refId && input.agencyIds.has(v.refId)) return v.refId;
    let lotId: string | undefined;
    if ((v.refType === 'posting.rule.result' || v.refType === ENGINE_REVERSAL_REF_TYPE) && v.refId) lotId = resultLot.get(v.refId);
    else if (v.refType === 'farmer.payment') lotId = lotOfEngineVoucher(v.refId);
    else if (v.refType === 'farmer.settlement' && v.refId) lotId = lotOfEngineVoucher(settlementEv.get(v.refId));
    else if (v.refType === COMMISSION_ACCRUAL_REF_TYPE) lotId = v.refId;
    const centreId = lotId ? lotCentre.get(lotId) : undefined;
    const agencyId = centreId ? centreAgency.get(centreId) : undefined;
    return agencyId && input.agencyIds.has(agencyId) ? agencyId : undefined;
  };

  let totalMinor = 0;
  let unallocMinor = 0;
  const per = new Map<string, number>();
  for (const v of live) {
    let net = 0;
    for (const l of getVoucherLines(v as Voucher)) {
      if (l.accountId !== input.accountId) continue;
      const m = toMinor(Number(l.amount) || 0);
      net = addMinor(net, l.type === 'Dr' ? m : -m);
    }
    if (net === 0) continue;
    totalMinor = addMinor(totalMinor, net);
    const ag = agencyOf(v);
    if (ag) per.set(ag, addMinor(per.get(ag) ?? 0, net));
    else unallocMinor = addMinor(unallocMinor, net);
  }
  const byAgency: Record<string, number> = {};
  for (const [k, m] of per) byAgency[k] = toRupees(m);
  return { total: toRupees(totalMinor), byAgency, unallocated: toRupees(unallocMinor) };
}

/**
 * The most that may be received now. Never more than the society-wide balance; when an agency is
 * named, never more than what that agency owes either. Receipts recorded before receipts carried an
 * agency are unallocated, so the per-agency figure can only overstate — the total caps it.
 */
export function receiptCap(b: AgencyBalances, agencyId?: string): number {
  const total = Math.max(0, b.total);
  if (!agencyId) return total;
  return Math.max(0, Math.min(total, b.byAgency[agencyId] ?? 0));
}

// ── 6. Farmer code ──────────────────────────────────────────────────────────────────────────────
// The code used to be "F" + (local farmer count + 1): two devices — or one device with a stale list —
// minted the same code. It now comes from the server's atomic per-society counter
// (next_document_number), skipping any code an older client already handed out.
export const formatFarmerCode = (n: number): string => `F${String(n).padStart(4, '0')}`;

export async function allocateFarmerCode(
  next: () => Promise<number | null>,
  taken: ReadonlySet<string>,
  maxTries = taken.size + 1,
): Promise<string | null> {
  for (let i = 0; i < Math.max(1, maxTries); i++) {
    const n = await next();
    if (n == null || !Number.isFinite(n) || n <= 0) return null;
    const code = formatFarmerCode(n);
    if (!taken.has(code)) return code;
  }
  return null;
}

// ── 7. Farmer amount paid — DERIVED from the payment vouchers ───────────────────────────────────
// The settlement row also stores amountPaid, but that is a second write after the payment voucher
// and could fail on its own: the outstanding then reverted on F5 and "Pay Farmer" paid the farmer
// AGAIN (2105 went debit). The payment vouchers are the record; amountPaid is only a cache of them.
// A held (pending) payment counts — it is already committed money, so it must block a second payment.
export const FARMER_PAYMENT_REF_TYPE = 'farmer.payment';

type PayVoucher = Pick<Voucher, 'isDeleted' | 'refType' | 'refId' | 'amount' | 'approvalStatus'>;

/** Engine-voucher id → total paid (rupees) across live farmer.payment vouchers. */
export function farmerPaidByEngineVoucher(vouchers: ReadonlyArray<PayVoucher>): Map<string, number> {
  const minor = new Map<string, number>();
  for (const v of vouchers) {
    if (v.isDeleted || v.approvalStatus === 'rejected' || v.refType !== FARMER_PAYMENT_REF_TYPE || !v.refId) continue;
    minor.set(v.refId, addMinor(minor.get(v.refId) ?? 0, toMinor(Number(v.amount) || 0)));
  }
  const out = new Map<string, number>();
  for (const [k, m] of minor) out.set(k, toRupees(m));
  return out;
}

/** The settlements with amountPaid replaced by the voucher-derived figure (same object when it already matches). */
export function withDerivedAmountPaid<S extends { engineVoucherId: string; amountPaid: { amount: number; currency: string } }>(
  settlements: ReadonlyArray<S>,
  paid: ReadonlyMap<string, number>,
): S[] {
  return settlements.map(s => {
    const p = paid.get(s.engineVoucherId) ?? 0;
    return (s.amountPaid?.amount ?? 0) === p ? s : { ...s, amountPaid: { amount: p, currency: s.amountPaid?.currency || 'INR' } };
  });
}

// ── 8. Quality after the J-Form ──────────────────────────────────────────────────────────────────
// Quality is the gate BEFORE the J-Form. Recording (or rejecting) it after the J-Form stranded the
// lot: a rejected posted lot could not be settled or paid, while its 3308/2105 entry stayed booked.
export const canRecordQuality = (x: { hasQualityTest: boolean; hasJForm: boolean }): boolean => !x.hasQualityTest && !x.hasJForm;

// ── 9. "Agency paid the farmer directly" — which account is credited ────────────────────────────────
// Only the agency receivable belongs here. Offering every asset (cash, stock, fixed assets) let a
// payment bypass the receivable and broke the per-agency balance. Ledgers opened UNDER the receivable
// (one per agency) are receivables too.
// D1: an agency's OWN receivable ledger (e.g. "HSWC Sirsa") counts too — pass those ids as extra.
export function agencyDirectAccounts<A extends Pick<LedgerAccount, 'id'> & { parentId?: string; isGroup?: boolean }>(
  accounts: ReadonlyArray<A>,
  agencyReceivableId: string | null | undefined,
  agencyLedgerIds: ReadonlyArray<string | null | undefined> = [],
): A[] {
  const own = new Set(agencyLedgerIds.filter((x): x is string => !!x));
  if (!agencyReceivableId && own.size === 0) return [];
  return accounts.filter(a => !a.isGroup && ((!!agencyReceivableId && (a.id === agencyReceivableId || a.parentId === agencyReceivableId)) || own.has(a.id)));
}

// ── 10. Lot cancellation (batch B) ───────────────────────────────────────────────────────────────
// A posted lot can be cancelled: its posting (engine) voucher is reversed by an engine reversal, its
// settlement (draft or approved, with the deduction voucher) and its commission accrual are cancelled.
// Money that has actually MOVED is never reversed silently — the operator cancels it first:
//  • a farmer payment (cash / bank / agency-direct) on the lot,
//  • agency receipts that would leave the MSP receivable below zero once this lot's amount leaves it,
//  • commission already received (the commission receivable would go below zero).
export const isLotCancelled = (lot?: { cancelledAt?: string | null } | null): boolean => !!lot?.cancelledAt;

export type LotCancelBlocker = 'already_cancelled' | 'farmer_paid' | 'agency_receipts' | 'commission_received' | 'no_reason';

export function lotCancelBlockers(x: {
  cancelled: boolean;
  reason: string;
  /** Σ live farmer.payment vouchers on the lot's engine voucher (rupees). */
  farmerPaid: number;
  /** The lot's engine-voucher amount that will leave the MSP receivable (0 when not posted). */
  postedAmount: number;
  /** Current MSP receivable balance (society-wide, Dr − Cr). */
  mspReceivable: number;
  /** The lot's live commission accrual (0 when none). */
  commissionAccrued: number;
  /** Current commission receivable balance (Dr − Cr). */
  commissionReceivable: number;
}): LotCancelBlocker[] {
  const out: LotCancelBlocker[] = [];
  if (x.cancelled) return ['already_cancelled'];
  if (!x.reason.trim()) out.push('no_reason');
  if (x.farmerPaid > 0.005) out.push('farmer_paid');
  if (x.postedAmount > 0.005 && x.mspReceivable - x.postedAmount < -0.005) out.push('agency_receipts');
  if (x.commissionAccrued > 0.005 && x.commissionReceivable - x.commissionAccrued < -0.005) out.push('commission_received');
  return out;
}

export const LOT_CANCEL_BLOCKER_TEXT: Record<LotCancelBlocker, string> = {
  already_cancelled: 'यह लॉट पहले ही रद्द है।',
  no_reason: 'रद्द करने का कारण लिखें।',
  farmer_paid: 'इस लॉट पर किसान को भुगतान हो चुका है — पहले वह भुगतान वाउचर (Vouchers पेज से) रद्द करें, फिर लॉट रद्द करें।',
  agency_receipts: 'एजेंसी से इतनी रसीद आ चुकी है कि यह लॉट हटाने पर MSP प्राप्य शून्य से नीचे जाएगा — पहले "एजेंसी रसीद" पेज पर संबंधित रसीद रद्द करें।',
  commission_received: 'इस लॉट का कमीशन एजेंसी से मिल चुका है — पहले "एजेंसी रसीद" पेज पर कमीशन रसीद रद्द करें।',
};

// ── 11. Posting legs by NET per account (D1) ─────────────────────────────────────────────────────
// With the 5116 route a lot's posting voucher carries four legs — Dr 5116 / Cr 2105 / Dr agency /
// Cr 5116 — so its total is TWICE the procurement value and "the first Cr line" is no longer a safe
// way to find the payable. Netting per account removes the pass-through (5116 nets to nil) and
// leaves exactly: the receivable (net Dr), the farmer payable (net Cr), and the value.
export function procurementLegsOf(v: Pick<Voucher, 'lines' | 'debitAccountId' | 'creditAccountId' | 'amount'>): { value: number; receivableAccountId?: string; payableAccountId?: string } {
  const net = new Map<string, number>();
  for (const l of getVoucherLines(v as Voucher)) {
    net.set(l.accountId, addMinor(net.get(l.accountId) ?? 0, l.type === 'Dr' ? toMinor(Number(l.amount) || 0) : -toMinor(Number(l.amount) || 0)));
  }
  let value = 0, receivableAccountId: string | undefined, payableAccountId: string | undefined;
  for (const [acc, m] of net) {
    if (m > 0) { value = addMinor(value, m); receivableAccountId ??= acc; }
    else if (m < 0) payableAccountId ??= acc;
  }
  return { value: toRupees(value), receivableAccountId, payableAccountId };
}

// ── 12. Agency commission (D1) ───────────────────────────────────────────────────────────────────
/** Commission on one lot: rate % of the procurement value, or ₹ rate per quintal (dami). Paise-exact. */
export function commissionAmount(agency: { commissionRate?: number; commissionBasis?: 'percent' | 'perQtl' }, lot: { quantity?: { value?: number } }, procurementValue: number): number {
  const rate = Number(agency.commissionRate) || 0;
  if (rate <= 0) return 0;
  const raw = agency.commissionBasis === 'perQtl' ? rate * (Number(lot.quantity?.value) || 0) : (rate / 100) * procurementValue;
  return toRupees(toMinor(raw));
}

// ── 13. Quality spec — moisture limit (D1) ─────────────────────────────────────────────────────────
// The Quality Spec master (crop × season × parameter × max) is the society's own config — no state's
// limit is hard-coded. A moisture reading above the limit cannot be plainly "accepted".
const MOISTURE_PARAM = /moist|नमी/i;
export function moistureLimitFor(specs: ReadonlyArray<{ cropId: string; seasonId: string; parameter: string; maxLimit: number }>, cropId: string, seasonId: string): number | null {
  const s = specs.find(x => x.cropId === cropId && x.seasonId === seasonId && MOISTURE_PARAM.test(x.parameter || ''))
    ?? specs.find(x => x.cropId === cropId && MOISTURE_PARAM.test(x.parameter || ''));
  return s && Number.isFinite(Number(s.maxLimit)) ? Number(s.maxLimit) : null;
}
/** A moisture above the limit may be "accepted with cut" or "rejected" — never plainly "accepted". */
export const qualityResultAllowed = (result: string, moisture: number, limit: number | null): boolean =>
  !(limit != null && moisture > limit && result === 'accepted');

// ── 14. Deduction rule amount by unit (D2a) ─────────────────────────────────────────────────────────
// Labour, weighment and bardana are charged per quintal or per bag in practice, not as % of gross.
// The rate and unit are the society's own master values — none hard-coded.
export function deductionRuleAmount(rule: { rate: { value: number }; basisUnit?: 'percent' | 'perQtl' | 'perBag' }, x: { gross: number; qty?: number; bags?: number }): number {
  const r = Number(rule.rate?.value) || 0;
  if (r <= 0) return 0;
  const raw = rule.basisUnit === 'perQtl' ? r * (Number(x.qty) || 0)
    : rule.basisUnit === 'perBag' ? r * (Number(x.bags) || 0)
      : (r / 100) * (Number(x.gross) || 0);
  return toRupees(toMinor(raw));
}
export const deductionRuleLabel = (rule: { rate: { value: number }; basisUnit?: string }): string =>
  rule.basisUnit === 'perQtl' ? `₹${rule.rate.value}/qtl` : rule.basisUnit === 'perBag' ? `₹${rule.rate.value}/bag` : `${rule.rate.value}%`;

// ── 15. Weighment slip (D2a) ────────────────────────────────────────────────────────────────────────
/** Net = gross − tare (quintals, 3-decimals). null when either is missing or tare ≥ gross. */
export function netWeight(gross?: number | null, tare?: number | null): number | null {
  const g = Number(gross), t = Number(tare);
  if (!Number.isFinite(g) || !Number.isFinite(t) || g <= 0 || t < 0 || t >= g) return null;
  return Math.round((g - t) * 1000) / 1000;
}

// ── 16. Farmer bank details + bulk payment (D2b) ────────────────────────────────────────────────────
export type FarmerInput = { farmerName: string; fatherName?: string; mobile?: string; village?: string; bankName?: string; bankAccountNo?: string; ifsc?: string; portalId?: string };
/** IFSC = 4 letters, a zero, 6 letters/digits (RBI format). Empty is allowed (no bank details yet). */
export const isValidIfsc = (s?: string | null): boolean => !s || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(s.trim().toUpperCase());
/** Bank account: 6–18 digits. Empty is allowed. */
export const isValidBankAccount = (s?: string | null): boolean => !s || /^\d{6,18}$/.test(s.trim());
/** Show only the last 4 digits on screens / slips. */
export const maskAccount = (s?: string | null): string => (s && s.length > 4 ? `XXXX${s.slice(-4)}` : (s || ''));

export interface BulkPayRow { engineVoucherId: string; outstanding: number }
/**
 * Founder D2b: a bulk (batch RTGS / NEFT) payment books ONE payment voucher PER farmer, all carrying
 * the same batch reference — each farmer's outstanding and slip stay his own; the bank line is matched
 * through the batch reference. Rows with nothing outstanding are skipped. Paise-exact total.
 */
export function planBulkPayment(rows: ReadonlyArray<BulkPayRow>): { pay: BulkPayRow[]; total: number } {
  const pay = rows.filter(r => Number(r.outstanding) > 0.005);
  return { pay, total: toRupees(pay.reduce((m, r) => addMinor(m, toMinor(r.outstanding)), 0)) };
}
export const bulkBatchRef = (d: Date = new Date()): string =>
  `BULK-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
