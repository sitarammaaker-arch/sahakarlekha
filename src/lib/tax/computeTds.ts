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
import { verifiedValue, resolveTaxRule, TDS_RULES, type TaxContext } from '../rules/tax';

export interface TdsInput {
  /** The section, e.g. '194q'. Lower-case; it is a rule-key fragment, not a display string. */
  section: string;
  /** Aggregate value in the FY, in paise (ADR-0006). Not rupees — never rupees. */
  aggregateMinor: Minor;
  /** THIS payment, in paise — needed only where a section also has a single-payment limit (194C: ₹30,000
   *  "for any such sum"). Without it such a section refuses below its annual limit rather than guess. */
  paymentMinor?: Minor;
  ctx: TaxContext;
}

export interface TdsResult {
  applicable: boolean;
  /** TDS payable, in paise. 0 when below the threshold. */
  tdsMinor: Minor;
  /** The portion the rate applied to — the excess over the threshold (194Q) or the entire sum (s.393(1)(a)). */
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

  // Thresholds come in KINDS. Most sections have one aggregate figure; 194C has a
  // per-payment AND an annual limit (either breach attracts TDS), 194I is per month.
  // Try the plain key first, then the kinds — never compare an aggregate to a per-month.
  const thr =
    verifiedValue(`tds.${s}.threshold`, input.ctx) ??
    verifiedValue(`tds.${s}.threshold.annual`, input.ctx) ??
    verifiedValue(`tds.${s}.threshold.per_month`, input.ctx);
  const rate = verifiedValue(`tds.${s}.rate_pct`, input.ctx);
  if (!thr) missing.push(`tds.${s}.threshold`);
  // A rate can be missing because the RULE is absent, or because the caller did not say
  // which rate applies (194J without serviceType). The second is far more common and the
  // message must not blame the catalog for the caller's silence.
  if (!rate) missing.push(`tds.${s}.rate_pct`);

  // No verified rule ⇒ no figure. Not a default, not a best guess, not "probably 0.1%".
  if (!thr || !rate) {
    // Distinguish "we have no rule" from "you didn't tell us which one applies" — the
    // second is actionable by the caller, and telling them the catalog is empty when it
    // is actually waiting on THEM sends them to fix the wrong thing.
    const unconditioned = resolveTaxRule(`tds.${s}.rate_pct`, { ...input.ctx, attrs: undefined });
    const needsAttr = !rate && !!TDS_RULES[`tds.${s}.rate_pct`] && !unconditioned;
    return {
      applicable: false,
      refused: true,
      reason: needsAttr
        ? `धारा ${s.toUpperCase()} की दर इस पर निर्भर करती है कि भुगतान किस प्रकार का है — ` +
          `बिना यह जाने मैं गणना नहीं करूँगा। (जैसे 194J: professional या technical?)`
        : `धारा ${s.toUpperCase()} के लिए मेरे पास प्रमाणित, तिथि-सहित नियम नहीं है — इसलिए मैं गणना नहीं करूँगा। ` +
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
    // A single-payment limit (194C) can be crossed while the year's aggregate is still under its own.
    // s.393(1)(a): then tax is due on the entire amount of THAT sum. No payment given ⇒ cannot tell ⇒ refuse.
    const perPayment = verifiedValue(`tds.${s}.threshold.per_payment`, input.ctx);
    if (perPayment) {
      const perMinor = Math.round(perPayment.value * 100) as Minor;
      if (input.paymentMinor === undefined || !isValidMinor(input.paymentMinor)) {
        return {
          applicable: false, refused: true,
          reason: `धारा ${s.toUpperCase()} में एक भुगतान की सीमा (${inr(perMinor)}) भी है — इस भुगतान की राशि बताए बिना मैं नहीं कह सकता कि TDS बनता है या नहीं।`,
          missing: ['paymentMinor'],
        };
      }
      if (input.paymentMinor > perMinor) {
        const { minor: tdsMinor } = applyPercent(input.paymentMinor, rate.value);
        basis.push({ key: `tds.${s}.threshold.per_payment`, version: perPayment.version, effectiveFrom: perPayment.effectiveFrom, cite: perPayment.cite });
        return {
          applicable: true, tdsMinor, taxableMinor: input.paymentMinor, thresholdMinor: perMinor, ratePct: rate.value,
          explain: `यह भुगतान ${inr(input.paymentMinor)} एक भुगतान की सीमा ${inr(perMinor)} से अधिक है — पूरी राशि पर ` +
            `${rate.value}% TDS = ${inr(tdsMinor)}। (s.393(1)(a), नियम ${perPayment.effectiveFrom} से प्रभावी)`,
          basis,
        };
      }
    }
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

  // Above the threshold: on the EXCESS only, or on the WHOLE sum? That is per-section statute
  // (194Q: excess only — its Note 1(b)). It used to be "excess" for every section, which
  // understates TDS wherever the text charges the whole sum. Now it must be a verified rule;
  // without one this REFUSES rather than pick a basis (AI-N8).
  // 1 = on the excess only (194Q, Note 1(b)) · 0 = on the entire sum (s.393(1)(a), the general rule).
  const excessOnly = verifiedValue(`tds.${s}.charge_on_excess_only`, input.ctx);
  if (!excessOnly || (excessOnly.value !== 1 && excessOnly.value !== 0)) {
    return {
      applicable: false,
      refused: true,
      reason: `कुल ${inr(input.aggregateMinor)} धारा ${s.toUpperCase()} की सीमा ${inr(thresholdMinor)} से अधिक है, ` +
        `पर इस धारा में TDS पूरी राशि पर लगता है या केवल सीमा से ऊपर की राशि पर — इसका प्रमाणित नियम मेरे पास नहीं है, ` +
        `इसलिए मैं राशि नहीं बताऊँगा। नियम जोड़ें: tds.${s}.charge_on_excess_only (src/lib/rules/tax.ts)`,
      missing: [`tds.${s}.charge_on_excess_only`],
    };
  }
  basis.push({ key: `tds.${s}.charge_on_excess_only`, version: excessOnly.version, effectiveFrom: excessOnly.effectiveFrom, cite: excessOnly.cite });
  const onExcess = excessOnly.value === 1;
  const taxableMinor = (onExcess ? input.aggregateMinor - thresholdMinor : input.aggregateMinor) as Minor;
  const { minor: tdsMinor } = applyPercent(taxableMinor, rate.value);

  return {
    applicable: true,
    tdsMinor,
    taxableMinor,
    thresholdMinor,
    ratePct: rate.value,
    explain: onExcess
      ? `कुल ${inr(input.aggregateMinor)} में से सीमा ${inr(thresholdMinor)} घटाकर ${inr(taxableMinor)} पर ` +
        `${rate.value}% TDS = ${inr(tdsMinor)}। (नियम ${thr.effectiveFrom} से प्रभावी)`
      : `कुल ${inr(input.aggregateMinor)} सीमा ${inr(thresholdMinor)} से अधिक है — पूरी राशि पर ` +
        `${rate.value}% TDS = ${inr(tdsMinor)}। (s.393(1)(a), नियम ${thr.effectiveFrom} से प्रभावी)`,
    basis,
  };
}
