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

/** J-Form date, else the lot's date, else `today`. */
export function procurementBusinessDate(jformCreatedAt: string | null | undefined, lotCreatedAt: string | null | undefined, today: string): string {
  return localDateOf(jformCreatedAt) || localDateOf(lotCreatedAt) || today;
}

// ── 2. Quality gate ─────────────────────────────────────────────────────────────────────────────
/** A lot whose quality test was "rejected" may not get a J-Form, be posted, settled, paid or earn commission. */
export const isRejectedQuality = (result?: string | null): boolean => result === 'rejected';

// ── 3. Lot stage (what the badge shows instead of the raw "created" status) ────────────────────────
export type LotStage = 'new' | 'rejected' | 'inspected' | 'jform' | 'posted' | 'settlementDraft' | 'approved' | 'paid';

export function deriveLotStage(x: {
  qualityResult?: string | null;
  hasJForm: boolean;
  hasPosting: boolean;
  settlementStatus?: 'draft' | 'approved' | null;
  outstanding?: number | null;
}): LotStage {
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
    if ((v.refType === AGENCY_RECEIPT_REF_TYPE || v.refType === COMMISSION_RECEIPT_REF_TYPE) && v.refId && input.agencyIds.has(v.refId)) return v.refId;
    let lotId: string | undefined;
    if (v.refType === 'posting.rule.result' && v.refId) lotId = resultLot.get(v.refId);
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
