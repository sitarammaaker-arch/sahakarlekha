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

/** Newest first. Append future years here — a data change, never a code change. */
export const SLAB_SETS: SlabSet[] = [FY_2024_25];

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
