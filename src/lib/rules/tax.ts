/**
 * TDS rules as DATA — the F-lane's source of truth (ADR-0008; CAIOS blueprint §4.4).
 *
 * WHY THIS FILE EXISTS. Today TDS sections are a TypeScript union (`types/index.ts`),
 * rates are UI label strings ("1%/2%" — a string cannot be arithmetic), thresholds are
 * not enforced anywhere, and `validateTds` takes a threshold as a caller-supplied
 * parameter that no production caller supplies. So a Finance Act change is a code
 * deploy, a historical year cannot be reproduced, and the assistant has nothing
 * citable to answer from. The rules ENGINE that fixes all of this already exists and
 * works (rules/engine.ts) — it just had one consumer (UCAS). This gives it a second.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 *  ⚠️  EVERY VALUE HERE IS `verified: false` AND MUST BE CONFIRMED BY A HUMAN.
 *
 *  I am a language model. I am NOT a source of statutory truth, and a TDS threshold
 *  stated from my memory is exactly the failure this entire architecture was built to
 *  prevent (AI-N3: the LLM is never the source of a figure of record; AI-N8: never
 *  fabricate). Thresholds and rates change with every Finance Act. The values below
 *  are STRUCTURE with a plausible seed and an explicit citation to check — they are a
 *  form to fill in, not an answer.
 *
 *  The F-lane will NOT state an unverified value as fact (see verifiedValue()). It
 *  keeps hedging until a human sets `verified: true`. Flipping that flag is a
 *  deliberate act by someone who checked the section — which is the whole point: this
 *  file is where the founder's own hard-won expertise (the 194Q dispute, the
 *  procurement TDS work) stops living in one person's head and becomes versioned,
 *  cited, reproducible data that an auditor can read.
 * ─────────────────────────────────────────────────────────────────────────────────
 *
 * TDS is CENTRAL law, so everything is seeded at the national ('') jurisdiction. A
 * state override would be wrong here — unlike the Cooperative Societies Acts, the
 * Income-tax Act does not vary by state.
 */
import { resolveRule, type Rule, type RuleCatalog, type RuleValue } from './engine';

/** A statutory value that knows whether a human has actually checked it. */
export interface TaxRuleValue extends RuleValue<number> {
  /** false = seeded structure, never to be stated as fact. Set true only after checking. */
  verified: boolean;
  /** The exact thing to read to verify it — a section, not a vague gesture at "the Act". */
  cite: string;
}

/** ISO date the Finance Act 2021 provisions took effect — the seed's baseline. */
const FA21 = '2021-07-01';

function tds(key: string, value: number, cite: string, effectiveFrom: string): Rule<number> {
  const v: TaxRuleValue = { value, effectiveFrom, version: 1, verified: false, cite, note: `UNVERIFIED — check ${cite}` };
  return { key, byJurisdiction: { '': [v] } };
}

/**
 * TDS rules. Keys are `tds.<section>.<aspect>` so the F-lane can look one up directly
 * from a parsed question ("194Q की सीमा" → `tds.194q.threshold`) with no search.
 *
 * DELIBERATELY SPARSE. Only 194Q is seeded, because it is the section the founder has
 * actually litigated and can therefore verify from knowledge rather than from me.
 * Adding 194C/194J/194I is a data change — copy a line, cite the section, verify it.
 * Seeding sections nobody has checked would just be fabrication at scale.
 */
export const TDS_RULES: RuleCatalog = {
  // Purchase of goods above the threshold — the section behind the procurement dispute.
  'tds.194q.threshold': tds('tds.194q.threshold', 5000000, 'Income-tax Act s.194Q (Finance Act 2021) — aggregate purchase value in a FY', FA21),
  'tds.194q.rate_pct': tds('tds.194q.rate_pct', 0.1, 'Income-tax Act s.194Q — rate on value exceeding the threshold', FA21),
};

export interface TaxContext {
  /** The date whose rule applies. A FY-2024 bill must resolve FY-2024's rule, not today's. */
  asOf: string;
  /** Central law — present for symmetry with the engine, effectively always national. */
  jurisdiction?: string;
}

export interface ResolvedTaxRule {
  value: number;
  effectiveFrom: string;
  version: number;
  cite: string;
  verified: boolean;
}

/**
 * PURE — resolve a tax rule, WITH its verification status.
 *
 * Returns null when the rule does not exist or no value is effective at `asOf`. Never
 * throws and never guesses: an absent rule means the caller must hedge, and hedging is
 * the correct behaviour, not a gap (blueprint §4.5).
 */
export function resolveTaxRule(key: string, ctx: TaxContext): ResolvedTaxRule | null {
  const rule = TDS_RULES[key] as Rule<number> | undefined;
  if (!rule) return null;
  const rv = resolveRule(rule, { asOf: ctx.asOf, jurisdiction: ctx.jurisdiction }) as TaxRuleValue | null;
  if (!rv) return null;
  return {
    value: rv.value,
    effectiveFrom: rv.effectiveFrom,
    version: rv.version ?? 1,
    cite: rv.cite,
    verified: rv.verified === true,
  };
}

/**
 * PURE — resolve ONLY if a human has verified it. This is the gate the F-lane uses.
 *
 * The asymmetry is deliberate and load-bearing: `resolveTaxRule` returns unverified
 * values so the UI can show "needs checking" and so tests can assert on the structure,
 * but nothing that states a figure AS FACT may use anything but this. An unverified
 * rule is indistinguishable from a guess, and a guess with a section number attached
 * is more dangerous than no answer at all — it looks checked.
 */
export function verifiedValue(key: string, ctx: TaxContext): ResolvedTaxRule | null {
  const r = resolveTaxRule(key, ctx);
  return r && r.verified ? r : null;
}
