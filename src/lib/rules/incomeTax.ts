/**
 * Income-tax slabs (s.192 salary TDS) as effective-dated DATA — ADR-0008.
 *
 * THE DEFECT THIS ADDRESSES. `tdsProjection.ts` hardcoded FY 2024-25 slabs with no date
 * parameter at all, so in FY 2026-27 it still computed on FY 2024-25 law — silently.
 * A clerk processing salary sees the projection auto-filled and, reasonably, leaves it.
 * That is how a wrong figure enters the books: not by being argued for, but by being
 * the default nobody was told to question.
 *
 * WHAT IS FIXED HERE AND WHAT IS NOT.
 *   FIXED    — the slabs are data, dated, versioned, and the projection now knows WHICH
 *              year's law it used and whether that law covers the date asked about.
 *   NOT FIXED — the VALUES. They are still FY 2024-25's, and they are marked
 *              `verified: false` for FY 2026-27.
 *
 * I did not update the numbers because I am a language model and not a source of
 * statutory truth (AI-N3/AI-N8); slabs change with every Finance Act, and a slab table
 * confidently written from model memory is worse than the stale one it replaced — the
 * stale one at least has a known provenance. So the wrongness is now VISIBLE instead of
 * silent, and correcting it is a data edit by someone who checked (see rules/tax.ts for
 * the same discipline).
 *
 * Adding FY 2025-26 / 2026-27: append a SlabSet with its effectiveFrom, cite the
 * Finance Act, verify it, done. No code change — that is the entire point of ADR-0008.
 */

export type TaxRegime = 'new' | 'old';

/** Slabs are [upperLimit, rate], each rate applying to the band above the previous limit. */
export type Slabs = [number, number][];

export interface SlabSet {
  /** Display label — "FY 2024-25". Shown to the user, so it must be honest. */
  fy: string;
  /** ISO date this law applies FROM (the FY start). */
  effectiveFrom: string;
  /** ISO date it stops applying (exclusive) — the next FY start. */
  effectiveTo: string;
  new: Slabs;
  old: Slabs;
  /** Standard deduction per regime. */
  stdDeduction: { new: number; old: number };
  /** s.87A — taxable income at or below this ⇒ nil tax. */
  rebateLimit: { new: number; old: number };
  /** Health & education cess multiplier (1.04 = 4%). */
  cess: number;
  /** false ⇒ never present a figure from this as settled. */
  verified: boolean;
  cite: string;
}

/**
 * The only slab set in the catalog. It is the one that was already hardcoded — moved
 * here unchanged, so this refactor cannot alter a single existing figure (the existing
 * test-tds-projection.mjs assertions prove that).
 */
const FY_2024_25: SlabSet = {
  fy: 'FY 2024-25',
  effectiveFrom: '2024-04-01',
  effectiveTo: '2025-04-01',
  new: [[300000, 0], [700000, 0.05], [1000000, 0.10], [1200000, 0.15], [1500000, 0.20], [Infinity, 0.30]],
  old: [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]],
  stdDeduction: { new: 75000, old: 50000 },
  rebateLimit: { new: 700000, old: 500000 },
  cess: 1.04,
  verified: false,
  cite: 'Income-tax Act s.115BAC / Finance Act 2024 — VERIFY against the current Finance Act',
};

/**
 * FY 2025-26 (AY 2026-27) — new-regime slabs read from the Income Tax Department's own
 * portal, not from a summary and not from model memory:
 *   https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1
 *
 * The table SELF-CHECKS, which is why it is trusted enough to record. The portal states
 * each band cumulatively ("₹60,000 + 15% above ₹12,00,000"), and every cumulative figure
 * reconciles exactly against the bands below it: 4–8L@5% = 20,000 → matches its "₹20,000";
 * +8–12L@10% = 60,000 → matches "₹60,000"; +12–16L@15% = 1,20,000 → matches; +16–20L@20%
 * = 2,00,000 → matches; +20–24L@25% = 3,00,000 → matches. A garbled table does not
 * reconcile — an earlier search returned one with overlapping bands and a missing 10–12L
 * slab, which is exactly what this arithmetic check catches.
 *
 * STILL `verified: false`, for three separate reasons, each sufficient on its own:
 *   1. STANDARD DEDUCTION IS NOT SOURCED. The ITD page does not state it ("not stated"),
 *      and two searches disagreed (₹75,000 vs ₹50,000). The values below are CARRIED
 *      OVER from FY 2024-25 unchanged — they are not research, and they may be wrong.
 *   2. OLD-REGIME SLABS ARE ALSO CARRIED OVER, not sourced. Only the new regime was on
 *      the page read.
 *   3. Accountability is not a knowledge problem (AI-G1). "Claude read it on a website"
 *      is not a defence before an auditor or the Registrar. `verified: true` means a
 *      named human owns the figure — and that can never be me.
 */
const FY_2025_26: SlabSet = {
  fy: 'FY 2025-26',
  effectiveFrom: '2025-04-01',
  effectiveTo: '2026-04-01',
  // SOURCED — incometax.gov.in, arithmetic reconciled (see above).
  new: [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]],
  // CARRIED OVER from FY 2024-25 — NOT sourced. Verify before relying on it.
  old: [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]],
  // CARRIED OVER — the ITD page does not state the standard deduction. Sources conflict.
  stdDeduction: { new: 75000, old: 50000 },
  // SOURCED — "Rebate Limit: ₹60,000 … Taxable income shall not exceed 12,00,000".
  rebateLimit: { new: 1200000, old: 500000 },
  // SOURCED — "4% to be paid on the amount of income tax plus Surcharge (if any)".
  cess: 1.04,
  verified: false,
  cite: 'incometax.gov.in AY 2026-27 (new regime slabs + 87A + cess SOURCED; standard deduction & old-regime slabs CARRIED OVER, unsourced) — VERIFY',
};

/**
 * FY 2026-27 (Tax Year 2026-27) — the CURRENT year. THE FIRST VERIFIED SET IN THIS FILE.
 *
 * PROVENANCE — recorded precisely, because `verified: true` is a claim about a HUMAN,
 * not about a source:
 *   • Verified by: the founder, on his CA's confirmation, 2026-07-16.
 *   • What the CA reviewed: docs/CA-VERIFICATION-2026-07.md — a 15-question list.
 *   • Honest caveat: the founder's draft answers to that list were AI-generated (every
 *     cited URL carried utm_source=chatgpt.com, and one cited s.202 — an unrelated
 *     section — for the slabs). They were then put to a CA, who confirmed them. So the
 *     chain is: AI draft → human expert review → founder's accountability. NOT: AI said so.
 *   • Independent corroboration for the slabs specifically: these bands, the ₹60,000/₹12L
 *     87A rebate and the 4% cess were read directly off the ITD portal by this codebase's
 *     author (incometax.gov.in .../return-applicable-1) for AY 2026-27, and the portal's
 *     cumulative figures reconcile exactly. The CA's answer says these carry forward
 *     unchanged into FY 2026-27. Two independent paths agreeing is why this one is trusted.
 *
 * If this later proves wrong, that chain is what an auditor reads — which is the entire
 * reason the field exists. `verified: true` never meant "correct"; it meant "owned".
 */
const FY_2026_27: SlabSet = {
  fy: 'FY 2026-27',
  effectiveFrom: '2026-04-01',
  effectiveTo: '2027-04-01',
  new: [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]],
  old: [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]],
  stdDeduction: { new: 75000, old: 50000 },
  rebateLimit: { new: 1200000, old: 500000 },
  cess: 1.04,
  verified: true,
  cite: 'Income-tax Act 2025 (in force 1-4-2026) — new-regime slabs, std deduction ₹75,000, s.87A rebate ₹60,000 up to ₹12,00,000 taxable, cess 4%. Confirmed by the society\'s CA against docs/CA-VERIFICATION-2026-07.md on 2026-07-16; slabs independently corroborated against incometax.gov.in (AY 2026-27), which the CA states carry forward unchanged.',
};

/**
 * Newest first — the stale fallback picks the closest law. Append future years here: a
 * data change, never a code change. NEVER delete an old set; a 2024 report must still
 * reproduce 2024's law, and the Income-tax Act 2025's own transitional provisions keep
 * the 1961 Act alive for earlier tax years.
 */
export const SLAB_SETS: SlabSet[] = [FY_2026_27, FY_2025_26, FY_2024_25];

export interface TaxBasis {
  set: SlabSet;
  /**
   * TRUE = no slab set covers `asOf`, so we fell back to the newest one we have.
   * The figure is computed on the WRONG year's law and must be labelled as such.
   * This flag is the whole point of the file: the error is now reportable.
   */
  stale: boolean;
  /** The date asked about — echoed so a caller can say "asked X, answered on Y's law". */
  asOf: string;
}

/**
 * PURE — which law applies on `asOf`?
 *
 * Falls back to the newest set rather than returning null, deliberately: refusing
 * outright would break salary processing for every society today, and a payroll run
 * that cannot proceed is a worse failure than one that proceeds with a labelled
 * caveat. But it NEVER falls back silently — `stale: true` travels with the result and
 * the UI must show it. Degrade loudly; never quietly.
 */
export function resolveTaxBasis(asOf: string): TaxBasis {
  const t = Date.parse(asOf);
  if (!Number.isNaN(t)) {
    for (const s of SLAB_SETS) {
      if (t >= Date.parse(s.effectiveFrom) && t < Date.parse(s.effectiveTo)) {
        return { set: s, stale: false, asOf };
      }
    }
  }
  return { set: SLAB_SETS[0], stale: true, asOf };
}

/** PURE — one honest line for the UI (RULE 7: Hindi-first). */
export function describeBasis(b: TaxBasis): string {
  if (b.stale) return `⚠️ गणना ${b.set.fy} के slab से — यह अवधि उस वर्ष की नहीं है। आँकड़ा सही न हो सकता है।`;
  if (!b.set.verified) return `${b.set.fy} के slab से — अभी सत्यापित नहीं।`;
  return `${b.set.fy} के slab से।`;
}
