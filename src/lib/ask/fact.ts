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
 * It answers ONLY from verified rules (rules/tax.ts). No verified rule ⇒ null, and the
 * caller hedges. That is the guarantee, not a gap.
 *
 * WHY THIS STATES VARIANTS RATHER THAN ASKING BACK. Half of TDS law is conditional: 194J
 * is 10% for professional services and 2% for technical. The tempting design is to ask
 * "which service?" — but for a KNOWLEDGE question, "10% professional, 2% technical" is
 * strictly better: complete, honest, and no round trip. That is what a good reference
 * book does. Asking is only right where ONE number is required — i.e. computeTds, which
 * already refuses without the attribute. Route the question by what the caller needs.
 */
import { verifiedValue, resolveTaxRule, TDS_RULES, type TaxContext } from '../rules/tax';
import { resolveSectionRef } from '../rules/tdsSections';

export interface FactAnswer {
  text: string;
  /** The exact statutory reference to check — displayed, not hidden. */
  cite: string;
  effectiveFrom: string;
  version: number;
  ruleKey: string;
}

/** Sections this lane knows, matched on the 1961 numbers users actually type. */
const SECTIONS: [RegExp, string][] = [
  [/194\s*-?\s*q|393.*table\s*8|माल.*खरीद.*tds/i, '194q'],
  [/194\s*-?\s*h|393.*table\s*1|कमीशन.*tds|दलाली/i, '194h'],
  [/194\s*-?\s*c|393.*table\s*6.*\(i\)|ठेकेदार|ठेका/i, '194c'],
  [/194\s*-?\s*j|393.*table\s*6.*iii|पेशेवर|व्यावसायिक.*सेवा|professional.*tds/i, '194j'],
  [/194\s*-?\s*a|393.*table\s*5|ब्याज.*tds|interest.*tds/i, '194a'],
  [/194\s*-?\s*i\b|393.*table\s*2|किराय[ाे].*tds|rent.*tds/i, '194i'],
];

const ASPECTS: [string[], 'threshold' | 'rate_pct'][] = [
  [['सीमा', 'limit', 'threshold', 'seema', 'कब काटना', 'कब कटेगा', 'कितने से'], 'threshold'],
  [['दर', 'रेट', 'rate', 'प्रतिशत', 'कितना कटेगा', 'कितना काटें', 'percent'], 'rate_pct'],
];

/**
 * Attribute stated IN the question, if any. Absent ⇒ we state every variant instead of
 * guessing one — see the module note.
 */
const ATTR_HINTS: [RegExp, string, string][] = [
  [/व्यक्ति|individual|huf|एचयूएफ|हिंदू अविभाजित/i, 'payeeType', 'individual'],
  [/कंपनी|company|firm|फर्म|संस्था/i, 'payeeType', 'company'],
  [/professional|पेशेवर|व्यावसायिक/i, 'serviceType', 'professional'],
  [/technical|तकनीकी/i, 'serviceType', 'technical'],
  [/वरिष्ठ|senior/i, 'payeeAge', 'senior'],
  [/मशीन|machinery|plant|संयंत्र|उपकरण/i, 'assetType', 'plant_machinery'],
  [/भूमि|भवन|land|building|फर्नीचर|furniture/i, 'assetType', 'land_building'],
];

/** Human labels for a variant, so an answer reads like a sentence and not a config dump. */
const ATTR_LABEL: Record<string, string> = {
  individual: 'व्यक्ति / HUF को भुगतान पर',
  company: 'अन्य (कंपनी आदि) को भुगतान पर',
  professional: 'पेशेवर (professional) सेवा पर',
  technical: 'तकनीकी (technical) सेवा पर',
  senior: 'वरिष्ठ नागरिक के लिए',
  plant_machinery: 'संयंत्र व मशीनरी पर',
  land_building: 'भूमि / भवन / फर्नीचर पर',
};

/** The variants a rule is written for, in the order a human would want to hear them. */
const VARIANTS: Record<string, { attr: string; values: string[] }> = {
  'tds.194c.rate_pct': { attr: 'payeeType', values: ['individual', 'company'] },
  'tds.194j.rate_pct': { attr: 'serviceType', values: ['professional', 'technical'] },
  'tds.194i.rate_pct': { attr: 'assetType', values: ['plant_machinery', 'land_building'] },
  'tds.194a.threshold': { attr: 'payeeAge', values: ['senior', 'other'] },
};

/** Thresholds of different KINDS — a section can have more than one, and both bind. */
const THRESHOLD_KINDS: Record<string, { key: string; label: string }[]> = {
  '194c': [
    { key: 'tds.194c.threshold.per_payment', label: 'एक भुगतान पर' },
    { key: 'tds.194c.threshold.annual', label: 'पूरे वर्ष में कुल' },
  ],
  '194i': [{ key: 'tds.194i.threshold.per_month', label: 'प्रति माह' }],
};

const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
const pct = (n: number) => `${n}%`;

function parseAttrs(q: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const [rx, k, v] of ATTR_HINTS) if (!attrs[k] && rx.test(q)) attrs[k] = v;
  return attrs;
}

/** The section label to PRINT for this date — 194C before 1-4-2026, 393(1)… after. */
const label = (section: string, ctx: TaxContext) => resolveSectionRef(section.toUpperCase(), ctx.asOf).label;

/**
 * PURE — answer a regulated specific from the rule catalog, or return null.
 *
 * Returning null means: no verified rule. The caller hedges. No guessing, ever.
 */
export function answerFact(query: string, ctx: TaxContext): FactAnswer | null {
  const q = query.toLowerCase();

  let section: string | null = null;
  for (const [rx, key] of SECTIONS) if (rx.test(q)) { section = key; break; }
  if (!section) return null;

  let aspect: 'threshold' | 'rate_pct' | null = null;
  for (const [words, a] of ASPECTS) if (words.some((w) => q.includes(w))) { aspect = a; break; }
  if (!aspect) return null;

  const stated = parseAttrs(q);
  const sec = label(section, ctx);

  /* Thresholds that come in KINDS (194C per-payment AND annual; 194I per-month). Both
     bind, so stating one alone would be a half-truth — the classic 194C mistake. */
  if (aspect === 'threshold' && THRESHOLD_KINDS[section]) {
    const parts: string[] = [];
    let first: ReturnType<typeof resolveTaxRule> = null;
    for (const k of THRESHOLD_KINDS[section]) {
      const r = verifiedValue(k.key, ctx);
      if (!r) continue;
      first = first || r;
      parts.push(`${k.label} ${inr(r.value)}`);
    }
    if (!first) return null;
    const conj = section === '194c' ? ' — इनमें से कोई भी सीमा पार हो तो TDS लागू।' : '';
    return {
      text: `धारा ${sec} की सीमा: ${parts.join(', ')}${conj} (${first.effectiveFrom} से प्रभावी)`,
      cite: first.cite, effectiveFrom: first.effectiveFrom, version: first.version,
      ruleKey: THRESHOLD_KINDS[section][0].key,
    };
  }

  const key = `tds.${section}.${aspect}`;
  if (!TDS_RULES[key]) return null;
  const variants = VARIANTS[key];

  /* Conditional rule, and the user did NOT say which case. State every variant — that is
     a complete answer, not a hedge, and better than a round-trip question (module note). */
  if (variants && !stated[variants.attr]) {
    const parts: string[] = [];
    let first: ReturnType<typeof resolveTaxRule> = null;
    for (const v of variants.values) {
      const r = verifiedValue(key, { ...ctx, attrs: { [variants.attr]: v } });
      if (!r) continue;
      first = first || r;
      const l = ATTR_LABEL[v] || (v === 'other' ? 'अन्य के लिए' : v);
      parts.push(`${l} ${aspect === 'rate_pct' ? pct(r.value) : inr(r.value)}`);
    }
    if (!first || parts.length < 2) return null;
    const what = aspect === 'rate_pct' ? 'दर' : 'सीमा';
    return {
      text: `धारा ${sec} की ${what}: ${parts.join('; ')}। (${first.effectiveFrom} से प्रभावी)`,
      cite: first.cite, effectiveFrom: first.effectiveFrom, version: first.version, ruleKey: key,
    };
  }

  /* Either unconditional, or the user told us which case — answer precisely. */
  const rule = verifiedValue(key, { ...ctx, attrs: stated });
  if (!rule) return null;

  const qualifier = variants && stated[variants.attr] ? ` (${ATTR_LABEL[stated[variants.attr]] || ''})` : '';
  const text =
    aspect === 'threshold'
      ? `धारा ${sec} की सीमा ${inr(rule.value)} है${qualifier} — ${rule.effectiveFrom} से प्रभावी। इससे अधिक मूल्य पर ही TDS लागू होता है।`
      : `धारा ${sec} की दर ${pct(rule.value)} है${qualifier} — ${rule.effectiveFrom} से प्रभावी।`;

  return { text, cite: rule.cite, effectiveFrom: rule.effectiveFrom, version: rule.version, ruleKey: key };
}

/**
 * PURE — is there an UNVERIFIED rule for this query? Used only to make the hedge honest.
 *
 * "मुझे नहीं पता" and "नियम मौजूद है पर किसी ने जाँचा नहीं" are different truths, and a
 * user who hears the second knows exactly what would fix it. Never used to answer.
 */
export function unverifiedHint(query: string, ctx: TaxContext): string | null {
  const q = query.toLowerCase();
  let section: string | null = null;
  for (const [rx, key] of SECTIONS) if (rx.test(q)) { section = key; break; }
  if (!section) return null;
  for (const suffix of ['threshold', 'rate_pct', 'threshold.annual', 'threshold.per_month', 'threshold.per_payment']) {
    const r = resolveTaxRule(`tds.${section}.${suffix}`, ctx);
    if (r && !r.verified) return r.cite;
  }
  return null;
}
