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
}

/** PURE — the value with the latest effectiveFrom that is ≤ asOf, or null if none applies yet. */
function latestOnOrBefore<T>(values: readonly RuleValue<T>[], asOfMs: number): RuleValue<T> | null {
  let best: RuleValue<T> | null = null;
  let bestMs = -Infinity;
  for (const v of values) {
    const t = Date.parse(v.effectiveFrom);
    if (Number.isNaN(t) || t > asOfMs) continue;
    if (t > bestMs) { bestMs = t; best = v; }
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
      const v = latestOnOrBefore(values, asOfMs);
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
