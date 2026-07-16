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

/**
 * A rule whose value depends on an attribute of the case (engine `when`, T-15).
 *
 * Pass rows most-general-last is NOT required — the engine picks most-specific-wins. A
 * row with no `when` is the default for everyone else; OMIT it deliberately where statute
 * has no default, so an unstated attribute resolves to null and the caller refuses rather
 * than picks a rate nobody asked for (AI-N8).
 */
function conditioned(
  key: string,
  rows: { value: number; when?: Record<string, string> }[],
  cite: string,
  effectiveFrom: string,
): Rule<number> {
  return {
    key,
    byJurisdiction: {
      '': rows.map((r) => ({
        value: r.value,
        when: r.when,
        effectiveFrom,
        version: 2,
        verified: true,
        cite,
        note: cite,
      } as TaxRuleValue)),
    },
  };
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
  /* ✅ SETTLED BY THE ACT'S OWN TEXT — and the history is worth keeping, because it is
     the strongest evidence in this file for how it is meant to work.

        model memory (my seed)  : ₹50,00,000  → marked UNVERIFIED; I refused to assert it
        CA-reviewed list        : ₹10,00,000  → this got flipped to verified: true ❌
        founder, with example   : ₹50,00,000  → contradiction surfaced; back to unverified
        THE SECTION TEXT        : ₹50,00,000  ✅

     s.393(1) Table Sl. No. 8(ii): "Any sum exceeding fifty lakh rupees for purchase of
     any goods." Read from incometaxindia.gov.in/w/section-393-5 — the Act, on the
     department's own site.

     The seed was right and the human review was wrong, and NEITHER of those is the
     lesson. The lesson is that "verified" tracked whoever spoke last until a SOURCE
     settled it. A statement — mine, an AI list's, a CA's — is a claim. Only the text is
     the text. That is what the cite field is for, and why it now names the URL rather
     than a person.

     STILL MISSING: "Threshold limit: As per Note 1" — Note 1 is where the buyer's
     ₹10 crore turnover gate lives. See `applies_if.buyer_turnover_min` below: the
     threshold is settled, applicability is not. */
  'tds.194q.threshold': verified(
    'tds.194q.threshold', 5000000,
    'Income-tax Act 2025 s.393(1) Table Sl. No. 8(ii) [1961: s.194Q] — "Any sum exceeding fifty lakh ' +
      'rupees for purchase of any goods", payer "Any person, being a buyer". SOURCE: the section text ' +
      'itself, incometaxindia.gov.in/w/section-393-5. Not a summary, not a recollection.',
    TY2627,
  ),
  'tds.194q.rate_pct': verified(
    'tds.194q.rate_pct', 0.1,
    'Income-tax Act 2025 s.393(1) Table Sl. No. 8(ii) [1961: s.194Q] — "Rate: 0.1%". SOURCE: the ' +
      'section text itself, incometaxindia.gov.in/w/section-393-5.',
    TY2627,
  ),

  /* 🚨 THE GATE THAT WAS MISSING ENTIRELY, and it matters more than the threshold.
     Per the founder (2026-07-16): 194Q applies ONLY IF THE BUYER's turnover in the
     PRECEDING financial year exceeded ₹10 crore.

     Most cooperative societies are nowhere near ₹10 crore — so for most of this product's
     users **194Q does not apply at all**. Without this gate, computeTds would return a
     TDS figure for a society that owes none. That is not a wrong number; it is an
     unlawful deduction from a farmer or an arhtiya.

     It is recorded but NOT wired: it is a condition on the BUYER (a fact about the
     society), not a variant of the rate, so `when` cannot express it — computeTds would
     have to take the society's prior-year turnover as an input and gate on it. That is
     the next slice here, and until it exists computeTds's refusal is the only correct
     behaviour for this section. UNVERIFIED like everything else on this list. */
  /* NOTE 1 HAS NOW BEEN READ, and it does NOT say what we expected. Verbatim:
       "Note 1.-(a) The deduction of tax under serial number 8(ii) shall not apply to a
        transaction on which tax is deductible or collectible under any of the provisions
        of the Act.
        (b) The tax shall be deducted on the sum exceeding fifty lakh rupees."

     So Note 1 confirms ₹50,00,000 and "on the sum exceeding" — and contains **no
     ₹10-crore buyer-turnover condition at all**. That gate came from a statement, not a
     source. It may live in the definition of "buyer" elsewhere in s.393, or it may be a
     1961-Act memory that did not survive the rewrite. NOT READ ⇒ NOT KNOWN.

     It stays recorded and unverified rather than deleted, because "we looked and did not
     find it" is a different state from "it does not exist", and the difference matters:
     if the gate is real and we drop it, the software tells small societies to deduct when
     they must not. Someone must read the definition of "buyer" in s.393 and settle it. */
  'tds.194q.applies_if.buyer_turnover_min': tds(
    'tds.194q.applies_if.buyer_turnover_min', 100000000,
    'CLAIMED GATE, NOT FOUND IN THE TEXT: "194Q applies only if the buyer\'s preceding-year turnover exceeded ' +
      '₹10 crore" (founder, 2026-07-16). Note 1 to s.393(1) Table Sl. No. 8(ii) has now been read and contains ' +
      'NO such condition — only "tax shall be deducted on the sum exceeding fifty lakh rupees" plus a carve-out ' +
      'where the transaction is already taxed under another provision. The gate may sit in the definition of ' +
      '"buyer" in s.393, unread. UNVERIFIED and unenforced. If real, most cooperative societies owe NO 194Q at all.',
    TY2627,
  ),

  /* Note 1(a) — a real carve-out, from the text, that computeTds does NOT yet honour:
     8(ii) does not apply where the SAME transaction already attracts TDS/TCS under any
     other provision. Recorded as a flag rather than a number because it is a condition on
     the transaction, not a threshold; wiring it needs computeTds to know what else applies
     to the same sum. Until then computeTds can over-deduct on a doubly-covered
     transaction — named here so it is not mistaken for handled. */
  'tds.194q.excluded_if.taxed_under_other_provision': verified(
    'tds.194q.excluded_if.taxed_under_other_provision', 1,
    'Income-tax Act 2025 s.393(1) Table Sl. No. 8(ii), Note 1(a) — "shall not apply to a transaction on which ' +
      'tax is deductible or collectible under any of the provisions of the Act". SOURCE: incometaxindia.gov.in/w/section-393-5. ' +
      'RECORDED BUT NOT ENFORCED by computeTds.',
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

  /* Contractor. TWO thresholds of different KINDS — either breach attracts TDS, so they
     are separate keys, not a condition. And the RATE turns on who is paid: the 2025 Act
     splits this across Table 6 Sl.(i)/(ii), which is very likely the same distinction the
     `when` below expresses. */
  'tds.194c.threshold.per_payment': verified(
    'tds.194c.threshold.per_payment', 30000,
    `Income-tax Act 2025 s.393(1) Table 6 Sl.(i)/(ii) [1961: s.194C] — single payment. ${CA_CHAIN}`,
    TY2627,
  ),
  'tds.194c.threshold.annual': verified(
    'tds.194c.threshold.annual', 100000,
    `Income-tax Act 2025 s.393(1) Table 6 Sl.(i)/(ii) [1961: s.194C] — aggregate in a tax year. ${CA_CHAIN}`,
    TY2627,
  ),
  'tds.194c.rate_pct': conditioned(
    'tds.194c.rate_pct',
    [
      { value: 1, when: { payeeType: 'individual' } },   // Individual / HUF
      { value: 2 },                                       // everyone else — the default
    ],
    `Income-tax Act 2025 s.393(1) Table 6 Sl.(i)/(ii) [1961: s.194C] — 1% Individual/HUF, 2% others. ${CA_CHAIN}`,
    TY2627,
  ),

  /* Professional / technical. NO DEFAULT, deliberately: statute gives no "other" rate
     here, so an unstated serviceType must REFUSE. 10% vs 2% is a 5× difference — exactly
     the kind of gap where guessing is worst. */
  'tds.194j.threshold': verified(
    'tds.194j.threshold', 50000,
    `Income-tax Act 2025 s.393(1) Table 6 Sl.(iii) [1961: s.194J]. ${CA_CHAIN}`,
    TY2627,
  ),
  'tds.194j.rate_pct': conditioned(
    'tds.194j.rate_pct',
    [
      { value: 10, when: { serviceType: 'professional' } },
      { value: 2, when: { serviceType: 'technical' } },
      // no default — see above
    ],
    `Income-tax Act 2025 s.393(1) Table 6 Sl.(iii) [1961: s.194J] — 10% professional, 2% technical. ${CA_CHAIN}`,
    TY2627,
  ),

  /* Interest. The threshold doubles for a senior citizen — the 2025 Act's Table 5
     Sl.(ii)/(iii) split likely carries this same distinction. */
  'tds.194a.threshold': conditioned(
    'tds.194a.threshold',
    [
      { value: 100000, when: { payeeAge: 'senior' } },
      { value: 50000 },                                   // everyone else — the default
    ],
    `Income-tax Act 2025 s.393(1) Table 5 Sl.(ii)/(iii) [1961: s.194A] — ₹50,000; ₹1,00,000 for senior citizens (bank/post office). ${CA_CHAIN}`,
    TY2627,
  ),
  'tds.194a.rate_pct': verified(
    'tds.194a.rate_pct', 10,
    `Income-tax Act 2025 s.393(1) Table 5 Sl.(ii)/(iii) [1961: s.194A]. ${CA_CHAIN}`,
    TY2627,
  ),

  /* Rent. Threshold is PER MONTH — a different kind again, hence its own key name; a
     caller must not compare an annual figure to it. NO DEFAULT rate: the asset decides.
     ⚠️ The CA's answer arrived with this row's columns run together and carried the
     caveat "(नए reporting framework में)" on the threshold. The values are legible and
     recorded, but this row is the least certain on the list — re-confirm before it drives
     a posting. */
  'tds.194i.threshold.per_month': verified(
    'tds.194i.threshold.per_month', 50000,
    `Income-tax Act 2025 s.393(1) Table 2 [1961: s.194I] — PER MONTH. CA noted "नए reporting framework में" — least certain row; re-confirm. ${CA_CHAIN}`,
    TY2627,
  ),
  'tds.194i.rate_pct': conditioned(
    'tds.194i.rate_pct',
    [
      { value: 2, when: { assetType: 'plant_machinery' } },
      { value: 10, when: { assetType: 'land_building' } },  // incl. furniture
      // no default — rent of what?
    ],
    `Income-tax Act 2025 s.393(1) Table 2 [1961: s.194I] — 2% plant & machinery, 10% land/building/furniture. ${CA_CHAIN}`,
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
 * THE ATTRIBUTES CALLERS MUST SUPPLY — and what happens when they don't.
 *
 * Half the law here is not a number, it is a QUESTION. Passing no attribute is not the
 * same as the attribute being irrelevant:
 *
 *   payeeType    'individual' (Individual/HUF) | anything else   → 194C rate. HAS a
 *                default (2%), so an unstated payee still resolves.
 *   serviceType  'professional' | 'technical'                    → 194J rate. NO default:
 *                unstated ⇒ resolves to null ⇒ the caller MUST refuse. 10% vs 2% is 5×.
 *   payeeAge     'senior' | anything else                        → 194A threshold. Has a
 *                default (₹50,000).
 *   assetType    'plant_machinery' | 'land_building'             → 194I rate. NO default:
 *                rent of what? Unstated ⇒ refuse.
 *
 * A missing attribute on a no-default rule must produce "I can't say", never a rate
 * nobody asked for (AI-N8). That refusal is the feature; see engine.ts `when`.
 *
 * THRESHOLDS COME IN KINDS, and comparing the wrong figure to the wrong kind is silent:
 *   194C  .threshold.per_payment (₹30,000)  AND  .threshold.annual (₹1,00,000)
 *         — EITHER breach attracts TDS. Two keys, not a condition.
 *   194I  .threshold.per_month (₹50,000)    — per MONTH, not per year.
 *   194J/194A/194Q/194H  .threshold          — aggregate in the tax year.
 * ───────────────────────────────────────────────────────────────────────────────── */

export interface TaxContext {
  /** The date whose rule applies. A FY-2024 bill must resolve FY-2024's rule, not today's. */
  asOf: string;
  /** Central law — present for symmetry with the engine, effectively always national. */
  jurisdiction?: string;
  /**
   * Facts about the case — `payeeType` / `serviceType` / `payeeAge` / `assetType`.
   * See the attribute note above. Omitting one where the rule has no default is not a
   * bug: it resolves to null and the caller refuses, which is the intended behaviour.
   */
  attrs?: Record<string, string>;
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
  const rv = resolveRule(rule, { asOf: ctx.asOf, jurisdiction: ctx.jurisdiction, attrs: ctx.attrs }) as TaxRuleValue | null;
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
