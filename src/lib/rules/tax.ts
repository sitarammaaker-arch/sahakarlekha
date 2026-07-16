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
 *  ⚠️  NO VALUE HERE MAY BE WRITTEN FROM A MODEL'S MEMORY.
 *
 *  I am a language model. I am NOT a source of statutory truth, and a TDS threshold
 *  stated from my memory is exactly the failure this architecture was built to prevent
 *  (AI-N3: the LLM is never the source of a figure of record; AI-N8: never fabricate).
 *  Thresholds and rates change with every Finance Act — and, as it turned out, the whole
 *  Act changed underneath them.
 *
 *  THE REFUSAL EARNED ITS KEEP. This file shipped with ₹50,00,000 seeded for 194Q,
 *  marked unverified, precisely because I would not assert it. The CA then said
 *  ₹10,00,000 — under a section that no longer exists. The seed was not merely
 *  unconfirmed; it was contradicted, 5×. Had it been flipped to `verified: true` on a
 *  guess, every procurement voucher would have been wrong and would have LOOKED checked.
 *
 *  `verified: true` therefore means one thing only: **a named human owns this figure**
 *  (AI-G1) — never "Claude read it somewhere". Each verified value carries the chain
 *  that made it assertable, so an auditor can follow it back. This file is where the
 *  founder's hard-won expertise (the 194Q dispute, the procurement work) stops living in
 *  one head and becomes versioned, cited, reproducible data.
 *
 *  The F-lane will NOT state an unverified value as fact (see verifiedValue()); it keeps
 *  hedging until a human flips the flag. Adding a section = ask the CA, record the
 *  answer, record the chain. Never = ask the model.
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
/** CA-confirmed values (2026-07-16) carry the chain that made them assertable. */
const CA_CHAIN =
  'Confirmed by the society\'s CA against docs/CA-VERIFICATION-2026-07.md on 2026-07-16. ' +
  'Chain: AI draft → CA review → founder\'s accountability. NOT independently corroborated.';

function verified(key: string, value: number, cite: string, effectiveFrom: string): Rule<number> {
  const v: TaxRuleValue = { value, effectiveFrom, version: 2, verified: true, cite, note: cite };
  return { key, byJurisdiction: { '': [v] } };
}

/** Tax Year 2026-27 — the Income-tax Act 2025 came into force 1-4-2026 (1961 Act repealed). */
const TY2627 = '2026-04-01';

export const TDS_RULES: RuleCatalog = {
  /* Purchase of goods — the section behind the founder's own procurement dispute, and
     the reason this file exists. The CA moved BOTH the threshold and the Act:
       old seed:  ₹50,00,000 under 1961 s.194Q (Finance Act 2021)
       confirmed: ₹10,00,000 under 2025 Act s.393(1) Table 8 Sl.(ii)
     A 5× drop — far more purchases now attract TDS. That is exactly the figure I refused
     to write from my own memory, and exactly why the refusal mattered: the seed was not
     merely unverified, it was contradicted. The rule KEY stays '194q' — it is an
     identifier, not a label; lib/rules/tdsSections.ts resolves what to PRINT by date,
     the same way TdsEntry.section does. */
  'tds.194q.threshold': verified(
    'tds.194q.threshold', 1000000,
    `Income-tax Act 2025 s.393(1) Table 8 Sl.(ii) [1961: s.194Q] — aggregate purchase value in a tax year. ${CA_CHAIN}`,
    TY2627,
  ),
  'tds.194q.rate_pct': verified(
    'tds.194q.rate_pct', 0.1,
    `Income-tax Act 2025 s.393(1) Table 8 Sl.(ii) [1961: s.194Q] — rate on value EXCEEDING the threshold. ${CA_CHAIN}`,
    TY2627,
  ),

  /* Commission / brokerage — the only other section on the CA's list whose shape this
     catalog can hold honestly (one threshold, one rate). */
  'tds.194h.threshold': verified(
    'tds.194h.threshold', 20000,
    `Income-tax Act 2025 s.393(1) Table 1 Sl.(ii) [1961: s.194H] — commission/brokerage in a tax year. ${CA_CHAIN}`,
    TY2627,
  ),
  'tds.194h.rate_pct': verified(
    'tds.194h.rate_pct', 2,
    `Income-tax Act 2025 s.393(1) Table 1 Sl.(ii) [1961: s.194H] — rate. ${CA_CHAIN}`,
    TY2627,
  ),

  /* Historical: the pre-2026 194Q figure, kept so a FY 2024-25 or 2025-26 purchase still
     resolves ITS OWN law. Never delete an old value — the 2025 Act's transitional
     provisions require exactly this, and it is what `asOf` is for. Still unverified: the
     CA was asked about the current year, not this one. */
  'tds.194q.threshold.legacy': tds(
    'tds.194q.threshold.legacy', 5000000,
    'Income-tax Act 1961 s.194Q (Finance Act 2021) — applies to tax years before 2026-27',
    FA21,
  ),
};

/* ─────────────────────────────────────────────────────────────────────────────────
 * WHY 194A / 194C / 194I / 194J ARE ABSENT — a limit of this catalog, not an oversight.
 *
 * The CA confirmed them, but this shape (`<section>.threshold` = one number,
 * `.rate_pct` = one number) cannot hold what they actually say:
 *
 *   194A  ₹50,000 — but ₹1,00,000 for senior citizens      → TWO thresholds (payee age)
 *   194C  ₹30,000 per payment OR ₹1,00,000 in the year,
 *         1% for Individual/HUF, 2% for others             → TWO thresholds AND TWO rates
 *   194J  ₹50,000, 10% professional but 2% technical       → TWO rates (service type)
 *   194I  the CA's rate column came through garbled         → ambiguous; do not guess
 *
 * Encoding 194C as "₹30,000, 1%" would silently drop the annual limit and the company
 * rate — a wrong answer wearing a citation, which is worse than no answer (AI-N8). The
 * fix is a richer rule shape (conditions on payee type / service type / periodicity),
 * not a flatter truth. Until then the F-lane correctly says it has no rule for them.
 * ───────────────────────────────────────────────────────────────────────────────── */

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
