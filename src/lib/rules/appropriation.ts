/**
 * Statutory appropriation of net surplus (T-20 / UCAS CM-1, FS-5; ADR-0008, ADR-0006).
 *
 * PURE. A cooperative's net surplus is appropriated in a LEGALLY-MANDATED ORDER, at STATUTORY
 * RATES — not a spreadsheet exercise. This engine walks UCAS_APPROPRIATION_ORDER (T-16),
 * computes each step at the rate resolved from the rules engine (effective-dated, jurisdiction-
 * scoped) in EXACT minor units (T-02), enforces the statutory minimum (Reserve) and caps
 * (Dividend ≤ % of share capital; Charitable ≤ % of surplus), and turns the result into a
 * BALANCED posting (the P&L Appropriation A/c) — the ledger legs a voucher event carries.
 *
 * The seven lines always sum to the net surplus (appropriations + carry-forward). If the
 * discretionary inputs would over-appropriate, or the proposed dividend exceeds its cap, it is
 * reported — a bad appropriation is refused, never silently truncated.
 */
import { applyPercent } from '../money';
import { ucasReserveMinPct, ucasEducationFundPct, ucasDividendCapPct, ucasCharitableMaxPct, UCAS_APPROPRIATION_ORDER, type AppropriationStep } from './ucas';
import type { ResolveOptions } from './engine';

export interface AppropriationInput {
  /** Net surplus (net profit) to appropriate, in minor units. */
  netSurplusMinor: number;
  /** Paid-up share capital, in minor units — the base for the dividend cap. */
  shareCapitalMinor: number;
  /** Discretionary, per bye-laws / board resolution (minor units; default 0). */
  byeLawReservesMinor?: number;
  /** Proposed dividend (minor units) — capped at the statutory % of share capital. */
  dividendMinor?: number;
  /** Proposed patronage bonus (minor units). */
  patronageMinor?: number;
  /** Proposed charitable / public-purpose (minor units) — capped at the statutory % of surplus. */
  charitableMinor?: number;
}

export interface AppropriationLine {
  step: AppropriationStep;
  amountMinor: number;
  /** The statutory rate applied (%), when the step is rate-driven. */
  ratePct?: number;
  /** The base the rate applied to (minor units). */
  basisMinor?: number;
}

export interface AppropriationPlan {
  netSurplusMinor: number;
  /** In UCAS_APPROPRIATION_ORDER. The amounts (incl. carry_forward) sum to netSurplusMinor. */
  lines: AppropriationLine[];
  totalAppropriatedMinor: number;
  carryForwardMinor: number;
  ok: boolean;
  problems: string[];
}

const clampMin = (v: number | undefined) => Math.max(0, v ?? 0);

/**
 * PURE — compute the appropriation plan for a net surplus, in the mandatory order, at the rates
 * resolved for the jurisdiction/date. Reserve and Education are statutory %-of-surplus; Dividend
 * is the proposal capped at % of share capital; Charitable is the proposal capped at % of
 * surplus; the balance carries forward.
 */
export function computeAppropriation(input: AppropriationInput, opts: ResolveOptions): AppropriationPlan {
  const net = clampMin(input.netSurplusMinor);
  const share = clampMin(input.shareCapitalMinor);

  const reservePct = ucasReserveMinPct(opts);
  const educationPct = ucasEducationFundPct(opts);
  const dividendCapPct = ucasDividendCapPct(opts);
  const charitablePct = ucasCharitableMaxPct(opts);

  const reserve = applyPercent(net, reservePct).minor;
  const education = applyPercent(net, educationPct).minor;
  const byeLaw = clampMin(input.byeLawReservesMinor);

  const dividendCap = applyPercent(share, dividendCapPct).minor;
  const dividendProposed = clampMin(input.dividendMinor);
  const dividend = Math.min(dividendProposed, dividendCap);

  const patronage = clampMin(input.patronageMinor);

  const charitableCap = applyPercent(net, charitablePct).minor;
  const charitableProposed = clampMin(input.charitableMinor);
  const charitable = Math.min(charitableProposed, charitableCap);

  const totalAppropriated = reserve + education + byeLaw + dividend + patronage + charitable;
  const carryForward = net - totalAppropriated;

  const problems: string[] = [];
  if (carryForward < 0) problems.push('appropriations exceed the net surplus');
  if (dividendProposed > dividendCap) problems.push(`proposed dividend exceeds the ${dividendCapPct}% cap on share capital`);
  if (charitableProposed > charitableCap) problems.push(`proposed charitable appropriation exceeds the ${charitablePct}% ceiling`);

  const byStep: Record<AppropriationStep, AppropriationLine> = {
    reserve_fund:     { step: 'reserve_fund',     amountMinor: reserve,   ratePct: reservePct,     basisMinor: net },
    education_fund:   { step: 'education_fund',   amountMinor: education, ratePct: educationPct,   basisMinor: net },
    bye_law_reserves: { step: 'bye_law_reserves', amountMinor: byeLaw },
    dividend:         { step: 'dividend',         amountMinor: dividend,  ratePct: dividendCapPct, basisMinor: share },
    patronage_bonus:  { step: 'patronage_bonus',  amountMinor: patronage },
    charitable:       { step: 'charitable',       amountMinor: charitable, ratePct: charitablePct, basisMinor: net },
    carry_forward:    { step: 'carry_forward',    amountMinor: Math.max(0, carryForward) },
  };

  return {
    netSurplusMinor: net,
    lines: UCAS_APPROPRIATION_ORDER.map((s) => byStep[s]),
    totalAppropriatedMinor: totalAppropriated,
    carryForwardMinor: carryForward,
    ok: problems.length === 0,
    problems,
  };
}

export interface AppropriationAccounts {
  /** The account debited — the P&L Appropriation A/c (or Net Surplus). */
  appropriation: string;
  /** The credited fund/payable head per step (carry_forward is NOT posted — it is the residual). */
  reserve_fund: string;
  education_fund: string;
  bye_law_reserves: string;
  dividend: string;
  patronage_bonus: string;
  charitable: string;
}

export interface PostingLeg {
  accountId: string;
  drCr: 'Dr' | 'Cr';
  amountMinor: number;
}

/**
 * PURE — the BALANCED appropriation posting (FS-5, CL-1): Dr the P&L Appropriation A/c for the
 * total appropriated, Cr each fund/payable head for its amount. Carry-forward is the residual
 * balance, not a posted leg. Zero-amount steps are omitted. Σ Dr === Σ Cr by construction.
 */
export function appropriationToLines(plan: AppropriationPlan, accounts: AppropriationAccounts): PostingLeg[] {
  const legs: PostingLeg[] = [];
  for (const line of plan.lines) {
    if (line.step === 'carry_forward' || line.amountMinor <= 0) continue;
    const accountId = accounts[line.step as keyof Omit<AppropriationAccounts, 'appropriation'>];
    legs.push({ accountId, drCr: 'Cr', amountMinor: line.amountMinor });
  }
  if (plan.totalAppropriatedMinor > 0) {
    legs.unshift({ accountId: accounts.appropriation, drCr: 'Dr', amountMinor: plan.totalAppropriatedMinor });
  }
  return legs;
}
