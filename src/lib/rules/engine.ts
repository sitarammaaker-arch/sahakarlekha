/**
 * Rules engine — effective-dated, jurisdiction-scoped, point-in-time (T-15 / ADR-0008, INV-3).
 *
 * PURE. Compliance and policy values — the statutory reserve %, the dividend cap, interest and
 * tax rates, subsidy formulas — are DATA, not hard-coded constants. Each rule holds a series of
 * effective-dated values per jurisdiction; the resolver returns the value that applied AT a
 * point in time FOR a jurisdiction, falling back to the national default. So:
 *
 *   • a 2027 statement reproduces 2027's rule even when reopened in 2035 (effective-dating);
 *   • 28 states' divergent Acts coexist in one engine (jurisdiction scoping);
 *   • the resolved value carries its effectiveFrom + version, so the caller can RECORD which
 *     rule produced a figure (auditability — the point of "policy is data").
 *
 * This file is the ENGINE. The actual UCAS rule values (reserve ≥25%, dividend cap 15%, …) are
 * seeded as data in T-16. Jurisdiction codes come from resolveJurisdiction (T-01): the caller
 * normalizes a society's state, then asks the engine.
 */

export interface RuleValue<T = unknown> {
  value: T;
  /** ISO date the value applies FROM (until the next value's effectiveFrom, or forever). */
  effectiveFrom: string;
  /** Bumped when the value changes — recorded alongside a figure for reproducibility. */
  version?: number;
  /** Human note / statutory citation (display/audit only). */
  note?: string;
  /**
   * Attributes this value applies to. ABSENT = the unconditioned default: applies to all.
   *
   * Statute routinely varies a figure by something other than place and date — TDS is
   * 1% for an Individual/HUF payee and 2% for others (1961 s.194C), 10% for professional
   * services but 2% for technical (s.194J), and an interest threshold doubles for a
   * senior citizen (s.194A). Without this the catalog could hold only one number per
   * section, so those sections had to be left out entirely rather than encoded as half
   * the law (see rules/tax.ts) — a wrong answer wearing a citation is worse than none.
   *
   *     { value: 1, when: { payeeType: 'individual' } }
   *     { value: 2 }                       // ← the default: everyone else
   *
   * Most-specific-wins, exactly as the jurisdiction chain already prefers `hr` over `''`
   * regardless of date. This is a generalisation of a proven pattern, not an invention.
   */
  when?: Record<string, string>;
}

export interface Rule<T = unknown> {
  key: string;
  /** jurisdiction code → effective-dated values. '' is the national default; 'hr' etc. override it. */
  byJurisdiction: Record<string, RuleValue<T>[]>;
}

export type RuleCatalog = Record<string, Rule>;

export interface ResolveOptions {
  /** The jurisdiction code to resolve for (from resolveJurisdiction). Falls back to national (''). */
  jurisdiction?: string;
  /** The point in time (ISO). The rule as it stood on this date is returned. */
  asOf: string;
  /**
   * Facts about the case, matched against each value's `when` (e.g. `{ payeeType: 'company' }`).
   *
   * Omitting an attribute is NOT the same as it being irrelevant: a rule that only has
   * conditioned values and no unconditioned default resolves to **null** when nothing
   * matches. The caller must then refuse rather than proceed — an unknown payee type has
   * to produce "I can't say", never a silently-chosen first row.
   */
  attrs?: Record<string, string>;
}

/** PURE — does this value's `when` hold for `attrs`? An absent `when` matches anything. */
function matches<T>(v: RuleValue<T>, attrs: Record<string, string> | undefined): boolean {
  if (!v.when) return true;
  for (const k of Object.keys(v.when)) {
    if (!attrs || attrs[k] !== v.when[k]) return false;
  }
  return true;
}

/** PURE — how specific is this value? More matched attributes ⇒ wins over a broader one. */
const specificity = <T,>(v: RuleValue<T>): number => (v.when ? Object.keys(v.when).length : 0);

/**
 * PURE — the value that applies at `asOfMs` for `attrs`, or null.
 *
 * Ordering is deliberate and mirrors the jurisdiction chain: **specificity first, then
 * recency.** A provision written for Individual/HUF beats the general one even if the
 * general one was amended later — that is how statute reads, and how `hr` already beats
 * `''` here regardless of date. When a specific value is genuinely superseded, a newer
 * specific value is added; recency then settles it within that group.
 */
function bestFor<T>(
  values: readonly RuleValue<T>[],
  asOfMs: number,
  attrs: Record<string, string> | undefined,
): RuleValue<T> | null {
  let best: RuleValue<T> | null = null;
  let bestScore = -Infinity;
  let bestMs = -Infinity;
  for (const v of values) {
    const t = Date.parse(v.effectiveFrom);
    if (Number.isNaN(t) || t > asOfMs) continue;
    if (!matches(v, attrs)) continue;
    const s = specificity(v);
    if (s > bestScore || (s === bestScore && t > bestMs)) { bestScore = s; bestMs = t; best = v; }
  }
  return best;
}

/**
 * PURE — resolve a rule to the value effective at `asOf` for `jurisdiction`, with fallback to
 * the national default. A jurisdiction whose override is not yet effective at `asOf` correctly
 * falls through to national. Returns the full RuleValue (value + effectiveFrom + version) so a
 * caller can record which rule version applied. Null when no value applies (e.g. before the
 * earliest effectiveFrom).
 */
export function resolveRule<T>(rule: Rule<T>, opts: ResolveOptions): RuleValue<T> | null {
  const asOfMs = Date.parse(opts.asOf);
  if (Number.isNaN(asOfMs)) return null;
  const jur = (opts.jurisdiction ?? '').trim();
  const chain = jur ? [jur, ''] : [''];
  for (const j of chain) {
    const values = rule.byJurisdiction[j];
    if (values && values.length) {
      const v = bestFor(values, asOfMs, opts.attrs);
      if (v) return v;
    }
  }
  return null;
}

/** PURE — convenience: the resolved VALUE for a catalog key (null if the rule or a value is
 *  absent). Use resolveRule when you need to record the effectiveFrom/version too. */
export function resolveValue<T>(catalog: RuleCatalog, key: string, opts: ResolveOptions): T | null {
  const rule = catalog[key] as Rule<T> | undefined;
  if (!rule) return null;
  const rv = resolveRule(rule, opts);
  return rv ? rv.value : null;
}
