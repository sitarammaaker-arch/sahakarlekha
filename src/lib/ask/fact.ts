/**
 * The F-lane — Tier 0 (blueprint §4.2/§4.4). PURE. No model, ever.
 *
 * A rate is not a document to be retrieved and paraphrased — it is a KEY to be looked
 * up: exact, effective-dated, versioned, cited. Embedding search over a rate is how you
 * get a confidently-worded 2023 rate in 2026. So this lane never touches the corpus.
 *
 * Note the symmetry that gives the whole design away: the F-lane produces the only
 * answers stated as bare fact, and it is the lane with no intelligence in it at all.
 *
 * It answers ONLY from verified rules (rules/tax.ts). No verified rule ⇒ it returns
 * null and the caller hedges. That is not a gap to be closed by trying harder; it is
 * the guarantee. Each rule a human verifies converts one hedge into a fact — which is
 * the measurable payoff of Slice 2 and the reason it precedes the model.
 */
import { verifiedValue, resolveTaxRule, type TaxContext } from '../rules/tax';

export interface FactAnswer {
  text: string;
  /** The exact statutory reference to check — displayed, not hidden. */
  cite: string;
  effectiveFrom: string;
  version: number;
  ruleKey: string;
}

/** Section mentioned in the query, in either script. Sparse on purpose — see tax.ts. */
const SECTIONS: [RegExp, string][] = [
  [/194\s*-?\s*q/i, '194q'],
];

const ASPECTS: [string[], 'threshold' | 'rate_pct'][] = [
  [['सीमा', 'limit', 'threshold', 'seema', 'कब काटना', 'कब कटेगा', 'कितने से'], 'threshold'],
  [['दर', 'रेट', 'rate', 'प्रतिशत', 'कितना कटेगा', 'कितना काटें', 'percent'], 'rate_pct'],
];

const inr = (rupees: number) => '₹' + rupees.toLocaleString('en-IN');

/**
 * PURE — answer a regulated specific from the rule catalog, or return null.
 *
 * Returning null is the common case today and it is CORRECT: only rules a human has
 * verified may be stated. `unverifiedHint` lets the caller say something more useful
 * than "मुझे नहीं पता" — it can say "the rule exists but nobody has checked it",
 * which is a true statement about our state of knowledge and points at the fix.
 */
export function answerFact(query: string, ctx: TaxContext): FactAnswer | null {
  const q = query.toLowerCase();

  let section: string | null = null;
  for (const [rx, key] of SECTIONS) if (rx.test(q)) { section = key; break; }
  if (!section) return null;

  let aspect: 'threshold' | 'rate_pct' | null = null;
  for (const [words, a] of ASPECTS) if (words.some((w) => q.includes(w))) { aspect = a; break; }
  if (!aspect) return null;

  const key = `tds.${section}.${aspect}`;
  const rule = verifiedValue(key, ctx);
  if (!rule) return null; // unverified or absent ⇒ the caller hedges. No guessing.

  const label = section.toUpperCase();
  const text =
    aspect === 'threshold'
      ? `धारा ${label} की सीमा ${inr(rule.value)} है — ${rule.effectiveFrom} से प्रभावी। इससे अधिक मूल्य पर ही TDS लागू होता है।`
      : `धारा ${label} की दर ${rule.value}% है — ${rule.effectiveFrom} से प्रभावी। यह सीमा से अधिक वाली राशि पर लगती है।`;

  return { text, cite: rule.cite, effectiveFrom: rule.effectiveFrom, version: rule.version, ruleKey: key };
}

/**
 * PURE — is there an UNVERIFIED rule for this query? Used only to make the hedge honest.
 *
 * "मुझे नहीं पता" and "नियम मौजूद है पर किसी ने जाँचा नहीं" are different truths, and a
 * user who hears the second one knows exactly what would fix it. Never used to answer.
 */
export function unverifiedHint(query: string, ctx: TaxContext): string | null {
  const q = query.toLowerCase();
  let section: string | null = null;
  for (const [rx, key] of SECTIONS) if (rx.test(q)) { section = key; break; }
  if (!section) return null;
  for (const [, aspect] of ASPECTS) {
    const r = resolveTaxRule(`tds.${section}.${aspect}`, ctx);
    if (r && !r.verified) return r.cite;
  }
  return null;
}
