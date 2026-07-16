/**
 * compute_tds() — the deterministic TDS calculator (AI-P3 / AI-N3; ADR-0008; ADR-0006).
 *
 * The AI Constitution has always named this function: "An LLM should never compute a
 * TDS liability — it should call a function that computes it and explain the result."
 * The function did not exist. TDS was bare multiplication at the entry screen against
 * a rate the operator typed, with the threshold unenforced. This is that function.
 *
 * PURE. Exact money only — paise integers via applyPercent, never a float (ADR-0006,
 * the CA-02 float-snapping class). Every result carries the rule version and citation
 * that produced it, so a figure can be re-derived years later and an auditor can see
 * WHICH rule applied (ADR-0008's whole reason for existing).
 *
 * REFUSES RATHER THAN GUESSES. If no verified rule exists at `asOf`, this returns a
 * refusal — it does not fall back to a default rate. A silent default is how a wrong
 * figure enters the books wearing a confident face, and in this domain a wrong figure
 * is a legal event, not a UX bug.
 */
import { applyPercent, isValidMinor, type Minor } from '../money';
import { verifiedValue, type TaxContext } from '../rules/tax';

export interface TdsInput {
  /** The section, e.g. '194q'. Lower-case; it is a rule-key fragment, not a display string. */
  section: string;
  /** Aggregate value in the FY, in paise (ADR-0006). Not rupees — never rupees. */
  aggregateMinor: Minor;
  ctx: TaxContext;
}

export interface TdsResult {
  applicable: boolean;
  /** TDS payable, in paise. 0 when below the threshold. */
  tdsMinor: Minor;
  /** The portion the rate applied to — value in excess of the threshold. */
  taxableMinor: Minor;
  thresholdMinor: Minor;
  ratePct: number;
  /** Why — in the user's Hindi, for a human to read (RULE 7). */
  explain: string;
  /** Reproducibility: which rule versions produced this figure (ADR-0008, AI-A2). */
  basis: { key: string; version: number; effectiveFrom: string; cite: string }[];
}

export interface TdsRefusal {
  applicable: false;
  refused: true;
  /** What is missing, precisely — so it is actionable, not a shrug. */
  reason: string;
  missing: string[];
}

export type TdsOutcome = TdsResult | TdsRefusal;

export const isRefusal = (o: TdsOutcome): o is TdsRefusal => (o as TdsRefusal).refused === true;

const inr = (minor: Minor) => '₹' + (minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * PURE — compute TDS for a section at a point in time.
 *
 * `asOf` is not decoration: a FY-2024 bill reopened in 2035 must resolve FY-2024's
 * threshold. That is the difference between an accounting system and a spreadsheet
 * that happens to be right today.
 */
export function computeTds(input: TdsInput): TdsOutcome {
  const s = input.section.toLowerCase().replace(/^section\s*/, '').trim();
  const missing: string[] = [];

  if (!isValidMinor(input.aggregateMinor)) {
    return { applicable: false, refused: true, reason: 'राशि पैसे (integer) में चाहिए', missing: ['aggregateMinor'] };
  }

  const thr = verifiedValue(`tds.${s}.threshold`, input.ctx);
  const rate = verifiedValue(`tds.${s}.rate_pct`, input.ctx);
  if (!thr) missing.push(`tds.${s}.threshold`);
  if (!rate) missing.push(`tds.${s}.rate_pct`);

  // No verified rule ⇒ no figure. Not a default, not a best guess, not "probably 0.1%".
  if (!thr || !rate) {
    return {
      applicable: false,
      refused: true,
      reason:
        `धारा ${s.toUpperCase()} के लिए मेरे पास प्रमाणित, तिथि-सहित नियम नहीं है — इसलिए मैं गणना नहीं करूँगा। ` +
        `नियम जोड़ें/सत्यापित करें: src/lib/rules/tax.ts`,
      missing,
    };
  }

  const basis = [
    { key: `tds.${s}.threshold`, version: thr.version, effectiveFrom: thr.effectiveFrom, cite: thr.cite },
    { key: `tds.${s}.rate_pct`, version: rate.version, effectiveFrom: rate.effectiveFrom, cite: rate.cite },
  ];
  const thresholdMinor = Math.round(thr.value * 100) as Minor;

  if (input.aggregateMinor <= thresholdMinor) {
    return {
      applicable: false,
      tdsMinor: 0 as Minor,
      taxableMinor: 0 as Minor,
      thresholdMinor,
      ratePct: rate.value,
      explain: `कुल ${inr(input.aggregateMinor)} — धारा ${s.toUpperCase()} की सीमा ${inr(thresholdMinor)} से अधिक नहीं, इसलिए TDS नहीं कटेगा।`,
      basis,
    };
  }

  // 194Q taxes only the EXCESS over the threshold, not the whole value — the single
  // most commonly mis-applied part of this section, and the reason a deterministic
  // function must own it rather than whoever is typing the voucher.
  const taxableMinor = (input.aggregateMinor - thresholdMinor) as Minor;
  const { minor: tdsMinor } = applyPercent(taxableMinor, rate.value);

  return {
    applicable: true,
    tdsMinor,
    taxableMinor,
    thresholdMinor,
    ratePct: rate.value,
    explain:
      `कुल ${inr(input.aggregateMinor)} में से सीमा ${inr(thresholdMinor)} घटाकर ${inr(taxableMinor)} पर ` +
      `${rate.value}% TDS = ${inr(tdsMinor)}। (नियम ${thr.effectiveFrom} से प्रभावी)`,
    basis,
  };
}
