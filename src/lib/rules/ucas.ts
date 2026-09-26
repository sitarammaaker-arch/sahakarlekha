/**
 * UCAS statutory rules — the appropriation numbers as DATA (T-16 / ADR-0008; UCAS CM-1).
 *
 * The cooperative appropriation of net surplus is governed by statutory rates: the Reserve
 * Fund minimum, the Education Fund contribution, the dividend cap, the charitable ceiling.
 * These become effective-dated, jurisdiction-scoped rule DATA resolved by the engine (T-15),
 * NOT hard-coded constants — so a state's variation and a future revision are a data change,
 * and a historical period reproduces its era's rate.
 *
 * SCOPE OF THE VALUES. These are the widely-common defaults (the Maharashtra / Kerala Coop Act
 * pattern), seeded at the NATIONAL level ('') and marked [NV per state]. State overrides are
 * added per jurisdiction only once confirmed against that State Act — deliberately NOT
 * fabricated here. Every accessor falls back to the same safe default, so a missing or broken
 * rule can never yield a wrong figure (the per-rule rollback).
 *
 * The rates drive an EXACT appropriation via the money primitive (T-02) — 25% of a net surplus
 * in minor units is computed with applyPercent, never a float. The appropriation POSTING that
 * consumes these (in the CM-1 order below) is T-20.
 */
import { resolveValue, resolveRule, type Rule, type RuleValue, type RuleCatalog, type ResolveOptions } from './engine';

const START = '2000-04-01'; // the common-Act baseline these defaults are taken to apply from

/** A UCAS value that may carry the statutory text it was checked against (catalogVersion reads it). */
interface UcasRuleValue extends RuleValue<number> {
  /** true ONLY when checked against the Act / Rules TEXT (never a statement) — see `cite`. */
  verified?: boolean;
  /** The exact provision + the copy of the text it was read from. */
  cite?: string;
}

function nationalRule(key: string, value: number, note: string, overrides: Record<string, UcasRuleValue[]> = {}): Rule<number> {
  return { key, byJurisdiction: { '': [{ value, effectiveFrom: START, version: 1, note: `${note} [NV per state]` }], ...overrides } };
}

/**
 * HARYANA — checked against the TEXT (2026-09-26), from the founder-provided copies:
 *   "The Haryana State Cooperative Act 1984.pdf" (s.87) and
 *   "The Haryana Co-operative Societies Rules, 1989.pdf" (rr.72-74, printed pp.218; amendments shown up to 2007).
 * A later notification amending these provisions supersedes them — add a new effective-dated value then.
 * effectiveFrom = the catalog baseline (START): no society data predates it, and the exact
 * notification date is not in the copy — deliberately not invented.
 */
const HR_ACT = 'Haryana Co-operative Societies Act 1984';
const HR_RULES = 'Haryana Co-operative Societies Rules 1989';
function hr(value: number, cite: string): UcasRuleValue {
  return { value, effectiveFrom: START, version: 1, verified: true, cite, note: cite };
}

export const UCAS_RULES: RuleCatalog = {
  // Reserve Fund — at least this % of net profit, before any distribution; indivisible (UCAS-P4).
  reserve_fund_min_pct: nationalRule('reserve_fund_min_pct', 25, 'Statutory Reserve Fund — min % of net profit (MCS Act s.66 pattern)', {
    // "at least 10% of the profits of any year are carried each to the reserve fund and the bad and
    // doubtful debt fund"; the Registrar may raise the reserve share up to one-fourth (r.74(1)).
    hr: [hr(10, `${HR_ACT} s.87(1)(a); Registrar may raise to 25% — ${HR_RULES} r.74(1)`)],
  }),
  // Bad & Doubtful Debt Fund — min % of net profit. No national default (not a common-Act figure).
  bad_debt_fund_min_pct: { key: 'bad_debt_fund_min_pct', byJurisdiction: {
    hr: [hr(10, `${HR_ACT} s.87(1)(a)`)],
  } },
  // Education Fund — contribution to the State federal society (commonly capped ~5%).
  education_fund_pct: nationalRule('education_fund_pct', 5, 'Education Fund — contribution to the State federation', {
    // Act s.87(1)(b) allows up to 5%; the Rules narrow it: "not exceeding two per cent as may be
    // directed by the Registrar".
    hr: [hr(2, `${HR_RULES} r.73 (not exceeding 2%, as directed by the Registrar); ${HR_ACT} s.87(1)(b) ≤5%`)],
  }),
  // Dividend on share capital — limited without Registrar sanction (UCAS-P2).
  dividend_cap_pct: nationalRule('dividend_cap_pct', 15, 'Max dividend on shares without Registrar sanction', {
    // "In no co-operative society shall dividend exceed 10 per cent per annum of the paid up share capital."
    hr: [hr(10, `${HR_RULES} r.72(1)`)],
  }),
  // Charitable / public-purpose appropriations — ceiling, with sanction.
  charitable_max_pct: nationalRule('charitable_max_pct', 10, 'Charitable / public-purpose appropriation ceiling (with sanction)'),
};

/**
 * The MANDATORY appropriation order of net surplus (UCAS CM-1). Data, not code — the posting
 * engine (T-20) walks this sequence. Reserve first (indivisible), balance carried forward.
 */
export const UCAS_APPROPRIATION_ORDER = [
  'reserve_fund',       // ≥ reserve_fund_min_pct — statutory, indivisible (UCAS-P4)
  'education_fund',     // education_fund_pct — to the State federation
  'bye_law_reserves',   // bad & doubtful debt, building/sinking, provident, per bye-laws
  'dividend',           // ≤ dividend_cap_pct on share capital (UCAS-P2)
  'patronage_bonus',    // to members in proportion to patronage (UCAS-P1)
  'charitable',         // ≤ charitable_max_pct, with sanction
  'carry_forward',      // the balance
] as const;

export type AppropriationStep = (typeof UCAS_APPROPRIATION_ORDER)[number];

/** PURE — a numeric UCAS rule as-of a date/jurisdiction, with a safe fallback if it does not
 *  resolve (the per-rule rollback: a broken/absent rule can never yield a wrong figure). */
function num(key: string, opts: ResolveOptions, fallback: number): number {
  const v = resolveValue<number>(UCAS_RULES, key, opts);
  return typeof v === 'number' ? v : fallback;
}

export const ucasReserveMinPct = (opts: ResolveOptions): number => num('reserve_fund_min_pct', opts, 25);
export const ucasEducationFundPct = (opts: ResolveOptions): number => num('education_fund_pct', opts, 5);
export const ucasDividendCapPct = (opts: ResolveOptions): number => num('dividend_cap_pct', opts, 15);
export const ucasCharitableMaxPct = (opts: ResolveOptions): number => num('charitable_max_pct', opts, 10);
/** Bad & Doubtful Debt Fund minimum — 0 where no statute sets one (only Haryana, so far). */
export const ucasBadDebtFundMinPct = (opts: ResolveOptions): number => num('bad_debt_fund_min_pct', opts, 0);

/** A resolved statutory figure + whether it was checked against the text (and where). */
export interface UcasFigure { pct: number; verified: boolean; cite: string | null }

/**
 * PURE — a UCAS figure WITH its provenance. Pages ENFORCE a limit only when `verified` (checked
 * against the Act/Rules text); an unverified common-Act default is shown as guidance, never as law.
 */
export function ucasFigure(key: string, opts: ResolveOptions, fallback: number): UcasFigure {
  const rule = UCAS_RULES[key] as Rule<number> | undefined;
  const v = rule ? (resolveRule(rule, opts) as UcasRuleValue | null) : null;
  if (!v || typeof v.value !== 'number') return { pct: fallback, verified: false, cite: null };
  return { pct: v.value, verified: v.verified === true, cite: v.cite ?? null };
}
