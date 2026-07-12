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
import { resolveValue, type Rule, type RuleCatalog, type ResolveOptions } from './engine';

const START = '2000-04-01'; // the common-Act baseline these defaults are taken to apply from

function nationalRule(key: string, value: number, note: string): Rule<number> {
  return { key, byJurisdiction: { '': [{ value, effectiveFrom: START, version: 1, note: `${note} [NV per state]` }] } };
}

export const UCAS_RULES: RuleCatalog = {
  // Reserve Fund — at least this % of net profit, before any distribution; indivisible (UCAS-P4).
  reserve_fund_min_pct: nationalRule('reserve_fund_min_pct', 25, 'Statutory Reserve Fund — min % of net profit (MCS Act s.66 pattern)'),
  // Education Fund — contribution to the State federal society (commonly capped ~5%).
  education_fund_pct: nationalRule('education_fund_pct', 5, 'Education Fund — contribution to the State federation'),
  // Dividend on share capital — limited without Registrar sanction (UCAS-P2).
  dividend_cap_pct: nationalRule('dividend_cap_pct', 15, 'Max dividend on shares without Registrar sanction'),
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
