/**
 * Society appropriation adapter (T-20 wiring, slice 1) — the bridge from the app's context to the
 * PURE statutory appropriation engine (computeAppropriation / appropriationToLines).
 *
 * The engine works in exact minor units at effective-dated, jurisdiction-scoped rates and knows
 * nothing about the app. This adapter supplies what the app has — the net surplus and paid-up share
 * capital (rupees, from getProfitLoss / the share-capital reconciliation), the society's state (→
 * jurisdiction, resolved in the ONE place, T-01) and the close date (→ the as-of for the rate), and
 * the chart heads each step posts to — and returns the plan plus the BALANCED posting legs a
 * year-end appropriation voucher/event will carry.
 *
 * PURE + dormant. Not wired into any posting path yet — the app still appropriates through the legacy
 * float waterfall (src/lib/appropriation.ts, ReserveFund / ProfitDistribution). Wiring this behind a
 * flag (a single balanced appropriation voucher through the ledger, replacing the ad-hoc path) is the
 * next slice; it is Med-breaking (money) and gated by the additive-then-flip rule (R2). This slice
 * only makes the correct posting COMPUTABLE from real society data, so it can be validated first.
 */
import { toMinor, toRupees } from '../money';
import { resolveJurisdiction } from '../jurisdiction';
import type { VoucherLine } from '@/types';
import {
  computeAppropriation,
  appropriationToLines,
  type AppropriationPlan,
  type AppropriationAccounts,
  type PostingLeg,
} from './appropriation';

/**
 * The default chart heads the appropriation posts to (the SahakarLekha cooperative chart). The two
 * STATUTORY steps (reserve 1201, education 1203) and the two common discretionary payables (dividend
 * 1211, patronage/staff-bonus payable 2103) have dedicated heads; `bye_law_reserves` and `charitable`
 * have no standard head, so they default to '' and a caller that appropriates them MUST supply one
 * (a non-zero step with no account is refused, never mis-posted).
 */
export const DEFAULT_APPROPRIATION_ACCOUNTS: AppropriationAccounts = {
  appropriation: '1208',    // Net Surplus (P&L Appropriation A/c) — debited for the total appropriated
  reserve_fund: '1201',     // Statutory Reserve Fund
  education_fund: '1203',   // Education Fund
  bye_law_reserves: '',     // no standard head — caller supplies per bye-laws
  dividend: '1211',         // Dividend Distribution
  patronage_bonus: '2103',  // Staff/Patronage Payable (liability)
  charitable: '',           // no standard head — caller supplies with sanction
};

export interface SocietyAppropriationInput {
  /** Net surplus (net profit) for the year, in RUPEES (e.g. getProfitLoss().netProfit). */
  netSurplus: number;
  /** Paid-up share capital, in RUPEES — the base for the dividend cap. */
  shareCapital: number;
  /** The society's state (any of 'HR' / 'Haryana' / 'हरियाणा' — normalized in one place). */
  state?: string | null;
  /** The close / appropriation date (YYYY-MM-DD) — the as-of for the effective-dated rate. */
  asOf: string;
  /** Discretionary proposals, in RUPEES (per board resolution / bye-laws); each defaults to 0. */
  discretionary?: {
    byeLawReserves?: number;
    dividend?: number;
    patronage?: number;
    charitable?: number;
  };
  /** Chart-head overrides, merged over DEFAULT_APPROPRIATION_ACCOUNTS. */
  accounts?: Partial<AppropriationAccounts>;
}

export interface SocietyAppropriation {
  /** The engine plan (amounts in minor units, in UCAS order). */
  plan: AppropriationPlan;
  /** The balanced posting legs (Dr Net Surplus / Cr each fund head), in minor units. Empty when
   *  the surplus is ≤ 0 or nothing is appropriated. */
  legs: PostingLeg[];
  /** The resolved chart heads used. */
  accounts: AppropriationAccounts;
  /** The jurisdiction the rates were resolved for. */
  jurisdiction: string;
  /** true when the plan is valid AND every non-zero step maps to a real account. */
  ok: boolean;
  /** Plan problems (over-appropriation / cap breaches) plus any missing-account problems. */
  problems: string[];
}

/**
 * PURE — compute the statutory appropriation for a society: resolve its jurisdiction + rates, run the
 * engine in exact minor units, and return the balanced posting legs (plus any reason the posting must
 * be refused). Never throws; a bad appropriation is reported via `ok:false` + `problems`, not posted.
 */
export function planSocietyAppropriation(input: SocietyAppropriationInput): SocietyAppropriation {
  const jurisdiction = resolveJurisdiction(input.state);
  const d = input.discretionary ?? {};
  const plan = computeAppropriation(
    {
      netSurplusMinor: toMinor(input.netSurplus || 0),
      shareCapitalMinor: toMinor(input.shareCapital || 0),
      byeLawReservesMinor: toMinor(d.byeLawReserves || 0),
      dividendMinor: toMinor(d.dividend || 0),
      patronageMinor: toMinor(d.patronage || 0),
      charitableMinor: toMinor(d.charitable || 0),
    },
    { jurisdiction, asOf: input.asOf },
  );

  const accounts: AppropriationAccounts = { ...DEFAULT_APPROPRIATION_ACCOUNTS, ...(input.accounts ?? {}) };

  // A non-zero step with no account would post to a phantom head — refuse it (never mis-post).
  const missing: string[] = [];
  for (const line of plan.lines) {
    if (line.step === 'carry_forward' || line.amountMinor <= 0) continue;
    const head = accounts[line.step as keyof Omit<AppropriationAccounts, 'appropriation'>];
    if (!head) missing.push(`${line.step} has no chart account to post to`);
  }
  if (plan.totalAppropriatedMinor > 0 && !accounts.appropriation) missing.push('no P&L Appropriation (Net Surplus) account to debit');

  const problems = [...plan.problems, ...missing];
  const ok = problems.length === 0;
  // Only emit legs when the posting is valid — a refused appropriation carries no legs.
  const legs = ok ? appropriationToLines(plan, accounts) : [];

  return { plan, legs, accounts, jurisdiction, ok, problems };
}

/** The accounting content of an appropriation voucher — the fields addVoucher needs that are pure
 *  functions of the plan. The runtime caller (DataContext) adds `date`, `createdBy`, etc. */
export interface AppropriationVoucherContent {
  type: 'journal';
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  lines: VoucherLine[];
  narration: string;
}

/** The default appropriation narration (RULE 7 — Hindi first). */
export const DEFAULT_APPROPRIATION_NARRATION = 'वर्षांत लाभ-विनियोजन / Statutory appropriation of net surplus';

/**
 * PURE — the appropriation as a balanced journal voucher's ACCOUNTING content (rupees): Dr the P&L
 * Appropriation (Net Surplus) head, Cr each fund. Line amounts are `toRupees` of the exact-paise legs,
 * so ΣDr === ΣCr in rupees. Line ids are deterministic (`appr-L<i>`) — the persist layer may reissue
 * them. Returns null when there is nothing to post (a refused or empty appropriation) — the caller then
 * posts nothing rather than an unbalanced/empty voucher.
 */
export function appropriationVoucherContent(appr: SocietyAppropriation, narration?: string): AppropriationVoucherContent | null {
  if (!appr.ok || appr.legs.length === 0) return null;
  const lines: VoucherLine[] = appr.legs.map((l, i) => ({
    id: `appr-L${i}`,
    accountId: l.accountId,
    type: l.drCr,
    amount: toRupees(l.amountMinor),
  }));
  const firstCr = appr.legs.find((l) => l.drCr === 'Cr');
  return {
    type: 'journal',
    debitAccountId: appr.accounts.appropriation,   // the Dr leg's head (Net Surplus)
    creditAccountId: firstCr?.accountId ?? '',      // legacy single-field: the first fund credited
    amount: toRupees(appr.plan.totalAppropriatedMinor),
    lines,
    narration: narration ?? DEFAULT_APPROPRIATION_NARRATION,
  };
}
