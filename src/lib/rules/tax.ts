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
/* The CA-confirmed values (2026-07-16) used to cite only the chain "AI draft → CA review → founder".
   On 2026-10-03 every one of them still on this list was matched against the Act's text (S393/S402
   below) and now cites the words; 194A did not survive that check (see its row). */

/** The department's own pages for the 2025 Act — the TEXT, read on 2026-10-03 (s.393 table + s.402
 *  definitions). A cite that names one of these was checked against the words, not a summary. */
const S393 = 'incometaxindia.gov.in/w/section-393-5 (read 2026-10-03)';
const S402 = 'incometaxindia.gov.in/w/section-402-5 (read 2026-10-03)';
/** s.393(1)(a): "on the entire amount of such income or sum, where the amount or aggregate of amounts
 *  exceeds the threshold limit specified in column D, or on sum as per Note 1 for serial number 8(ii)". */
const WHOLE_SUM = `Income-tax Act 2025 s.393(1)(a) — "on the entire amount of such income or sum, where the amount or ` +
  `aggregate of amounts exceeds the threshold limit specified in column D" (the only exception named is 8(ii), Note 1). SOURCE: ${S393}.`;

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
  isVerified = true,
): Rule<number> {
  return {
    key,
    byJurisdiction: {
      '': rows.map((r) => ({
        value: r.value,
        when: r.when,
        effectiveFrom,
        version: 2,
        verified: isVerified,
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

  /* HOW the rate applies once the threshold is crossed — on the EXCESS only, or on the WHOLE
     sum — is itself a statutory rule, and it differs by section. 194Q's is in its own text
     (Note 1(b)). computeTds used to apply "excess only" to EVERY section; for a section
     whose text says the whole sum (commonly assumed for 194C / 194H) that understates the
     TDS. Now it is data with a source: 1 = on the excess only. A section WITHOUT this rule
     refuses above its threshold rather than pick a basis nobody verified (AI-N8). */
  'tds.194q.charge_on_excess_only': verified(
    'tds.194q.charge_on_excess_only', 1,
    'Income-tax Act 2025 s.393(1) Table Sl. No. 8(ii), Note 1(b) — "The tax shall be deducted on the sum ' +
      'exceeding fifty lakh rupees." SOURCE: incometaxindia.gov.in/w/section-393-5.',
    TY2627,
  ),

  /* THE BUYER GATE — FOUND (2026-10-03), not in s.393 but in the DEFINITION of "buyer", s.402(6),
     Table Sl. No. 1, for "Purchase of goods referred to in section 393(1) [Table: Sl. No. 8(ii)]":
       "A person whose total sales, gross receipts or turnover from the business carried on by him
        exceed ten crore rupees during the tax year immediately preceding the tax year in which the
        purchase of goods is carried out."   (excluded: "Any person, as the Central Government may
        notify for this purpose")
     History: founder's statement (2026-07-16) → Note 1 read, gate absent → CA pointed at s.393 "6(i)"
     (that is the CONTRACTOR row — wrong cite, right figure) → the s.402 text settles it.
     A society whose preceding-year turnover is ₹10 crore or less is NOT a "buyer": it owes no 194Q.
     Verified, and still NOT ENFORCED by computeTds — it needs the society's preceding-year turnover,
     a fact the books do not hold as one figure. purchaseTdsAdvice states the condition instead. */
  'tds.194q.applies_if.buyer_turnover_min': verified(
    'tds.194q.applies_if.buyer_turnover_min', 100000000,
    'Income-tax Act 2025 s.402(6) Table Sl. No. 1 ("buyer" for s.393(1) Table Sl. No. 8(ii)) — "A person whose total ' +
      'sales, gross receipts or turnover from the business carried on by him exceed ten crore rupees during the tax year ' +
      `immediately preceding the tax year in which the purchase of goods is carried out." SOURCE: ${S402}. ` +
      'RECORDED BUT NOT ENFORCED by computeTds (needs the society\'s preceding-year turnover).',
    TY2627,
  ),

  /* GST in the 194Q base — a CBDT circular under the 1961 Act, read 2026-10-03 (Circular 20/2021 para 5.2.1,
     restating Circular 13/2021 para 4.3.2): where GST is shown SEPARATELY in the invoice AND tax is deducted at
     the time of CREDIT, deduct on the amount credited WITHOUT GST; if deducted on PAYMENT (payment before credit),
     on the whole amount. The CA's answer ("GST is excluded") left out the payment-basis half.
     UNVERIFIED as a 2025-Act rule: whether 1961-Act circulars continue under the 2025 Act (its savings
     provision) has not been read. Nothing computes with this key; it documents what the advice says. */
  'tds.194q.base_excludes_gst_when_separate_and_on_credit': tds(
    'tds.194q.base_excludes_gst_when_separate_and_on_credit', 1,
    'CBDT Circular 20/2021 (25-11-2021) para 5.2.1, restating Circular 13/2021 (30-06-2021) para 4.3.2 — GST shown ' +
      'separately + TDS at credit ⇒ deduct on the amount credited without GST; TDS on payment basis ⇒ whole amount. ' +
      'Issued under the 1961 Act; continuity under the 2025 Act NOT verified.',
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

  /* Commission / brokerage. Values were CA-confirmed (2026-07-16); on 2026-10-03 each was matched against the
     text of s.393(1) Table Sl. No. 1(ii) — payer "Specified person" (s.402: any person not an individual/HUF,
     so every society), "Rate: 2%", "Threshold limit: ₹ 20,000". */
  'tds.194h.threshold': verified(
    'tds.194h.threshold', 20000,
    `Income-tax Act 2025 s.393(1) Table Sl. No. 1(ii) [1961: s.194H] — "Threshold limit: ₹ 20,000". SOURCE: ${S393}.`,
    TY2627,
  ),
  'tds.194h.rate_pct': verified(
    'tds.194h.rate_pct', 2,
    `Income-tax Act 2025 s.393(1) Table Sl. No. 1(ii) [1961: s.194H] — "Rate: 2%". SOURCE: ${S393}.`,
    TY2627,
  ),
  'tds.194h.charge_on_excess_only': verified('tds.194h.charge_on_excess_only', 0, WHOLE_SUM, TY2627),

  /* Contractor. TWO thresholds of different KINDS — either breach attracts TDS, so they are separate keys.
     Read 2026-10-03: it is Sl. No. 6(i) only — payer "Any designated person" (s.402: includes "any
     co-operative society"); 6(ii) is a different row (individual/HUF payers, ₹50 lakh). "Rate: (a) 1%, if
     contractor is individual or Hindu undivided family; (b) 2%" · "Threshold limit: (a) ₹ 30,000; for any
     such sum; and (b) ₹ 1,00,000 in case of aggregate of such sums." */
  'tds.194c.threshold.per_payment': verified(
    'tds.194c.threshold.per_payment', 30000,
    `Income-tax Act 2025 s.393(1) Table Sl. No. 6(i) [1961: s.194C] — "₹ 30,000; for any such sum". SOURCE: ${S393}.`,
    TY2627,
  ),
  'tds.194c.threshold.annual': verified(
    'tds.194c.threshold.annual', 100000,
    `Income-tax Act 2025 s.393(1) Table Sl. No. 6(i) [1961: s.194C] — "₹ 1,00,000 in case of aggregate of such sums". SOURCE: ${S393}.`,
    TY2627,
  ),
  'tds.194c.charge_on_excess_only': verified('tds.194c.charge_on_excess_only', 0, WHOLE_SUM, TY2627),
  'tds.194c.rate_pct': conditioned(
    'tds.194c.rate_pct',
    [
      { value: 1, when: { payeeType: 'individual' } },   // Individual / HUF
      { value: 2 },                                       // everyone else — the default
    ],
    `Income-tax Act 2025 s.393(1) Table Sl. No. 6(i) [1961: s.194C] — "(a) 1%, if contractor is individual or Hindu undivided family; (b) 2%". SOURCE: ${S393}.`,
    TY2627,
  ),

  /* Professional / technical. NO DEFAULT, deliberately: statute gives no "other" rate
     here, so an unstated serviceType must REFUSE. 10% vs 2% is a 5× difference — exactly
     the kind of gap where guessing is worst. */
  'tds.194j.threshold': verified(
    'tds.194j.threshold', 50000,
    `Income-tax Act 2025 s.393(1) Table Sl. No. 6(iii) [1961: s.194J] — "Threshold limit: (i) for (a), (b), (d) and (e) of Col. B: ₹ 50,000" (director's fees (c): Nil). SOURCE: ${S393}.`,
    TY2627,
  ),
  'tds.194j.charge_on_excess_only': verified('tds.194j.charge_on_excess_only', 0, WHOLE_SUM, TY2627),
  'tds.194j.rate_pct': conditioned(
    'tds.194j.rate_pct',
    [
      { value: 10, when: { serviceType: 'professional' } },
      { value: 2, when: { serviceType: 'technical' } },
      // no default — see above
    ],
    `Income-tax Act 2025 s.393(1) Table Sl. No. 6(iii) [1961: s.194J] — "(a) 2% … fees for technical services (not being a professional services) …; (b) 10% … in cases other than (a)". SOURCE: ${S393}.`,
    TY2627,
  ),

  /* Interest — DOWNGRADED to unverified on 2026-10-03, because the text does not support what was asserted
     for THIS product's users:
       • ₹50,000 / ₹1,00,000 (senior) is Sl. No. 5(ii), whose payer is a BANKING company, a co-operative society
         carrying on the business of BANKING, or a post office. A non-banking society is Sl. No. 5(iii)
         ("Specified person [other than person in Sl. No. 5 (ii). C]"): "Threshold limit: ₹ 10,000".
       • s.393(4) Table Sl. No. 7(b): NO deduction on interest paid "by a co-operative society other than a
         co-operative bank, to a member thereof" or "to any other co-operative society", except where its
         turnover exceeds fifty crore rupees in the preceding tax year AND the 5(ii) threshold is crossed.
       • The rate is "Rates in force", not a figure in s.393 — 10% was never read from the text.
     So the answer depends on who pays and to whom; one number would mislead a PACS. Unverified ⇒ the F-lane
     and computeTds refuse rather than state ₹50,000 to a society that owes no TDS on members' interest. */
  'tds.194a.threshold': conditioned(
    'tds.194a.threshold',
    [
      { value: 100000, when: { payeeAge: 'senior' } },
      { value: 50000 },
    ],
    `Income-tax Act 2025 s.393(1) Table Sl. No. 5(ii) — BANKING payers only; a non-banking society is 5(iii) (₹ 10,000) and ` +
      `s.393(4) Sl. No. 7(b) exempts interest a non-bank co-operative pays its members / other co-operatives. SOURCE: ${S393}. ` +
      'UNVERIFIED for this product: payer-dependent, not modelled.',
    TY2627,
    false,
  ),
  'tds.194a.rate_pct': tds(
    'tds.194a.rate_pct', 10,
    `Income-tax Act 2025 s.393(1) Table Sl. No. 5 — "Rate: Rates in force" (the Finance Act's rate, not stated in s.393). ` +
      `UNVERIFIED: 10% was never read from a text. SOURCE checked: ${S393}.`,
    TY2627,
  ),

  /* Rent. Threshold is PER MONTH — a different kind again, hence its own key name; a
     caller must not compare an annual figure to it. NO DEFAULT rate: the asset decides.
     The CA's answer carried the caveat "(नए reporting framework में)"; on 2026-10-03 both
     figures were matched against s.393(1) Table Sl. No. 2 itself. */
  'tds.194i.threshold.per_month': verified(
    'tds.194i.threshold.per_month', 50000,
    `Income-tax Act 2025 s.393(1) Table Sl. No. 2(i)/(ii) [1961: s.194I] — "Threshold limit: ₹ 50,000 for a month or part of a month". SOURCE: ${S393}.`,
    TY2627,
  ),
  'tds.194i.rate_pct': conditioned(
    'tds.194i.rate_pct',
    [
      { value: 2, when: { assetType: 'plant_machinery' } },
      { value: 10, when: { assetType: 'land_building' } },  // incl. furniture
      // no default — rent of what?
    ],
    `Income-tax Act 2025 s.393(1) Table Sl. No. 2(ii) (payer: specified person — every society) [1961: s.194I] — "(a) 2%, for the use of any machinery or plant or equipment; and (b) 10%, for the use of any land, or building … or furniture, or fittings". SOURCE: ${S393}.`,
    TY2627,
  ),
  'tds.194i.charge_on_excess_only': verified('tds.194i.charge_on_excess_only', 0, WHOLE_SUM, TY2627),

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
