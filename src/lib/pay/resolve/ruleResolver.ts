/**
 * Payroll rule resolver (Phase-7 §3/§8/§10). PURE. Resolves one rule key to the value that applies
 * to an employee at a date, combining the two specificity dimensions:
 *   · ORG SCOPE      (scope.ts) — global → … → employee;
 *   · JURISDICTION + WHEN + effective-dating — the platform rules engine's model (mirrored here for a
 *     flat candidate list; rules/engine.ts operates on its own byJurisdiction Rule shape).
 *
 * Ranking (Phase-7 §8): scope specificity → jurisdiction specificity (state over national) → when
 * specificity → effectiveFrom → version. A genuine tie is a CATALOG DEFECT (PAY-CMP-CONFLICT).
 *
 * INTEGRITY GATES (Phase-7 §10):
 *   · SOURCED-ONLY — a winning `verified` value with zero sources is refused (PAY-CMP-501): a value
 *     is verified only against the Act/circular TEXT, never a statement.
 *   · REFUSE-OVER-GUESS — resolveRequiredPayRule throws (PAY-CMP-510) when nothing resolves; a missing
 *     mandatory rule halts, it never guesses. (resolvePayRule returns null so optional keys can default.)
 *
 * Floor/ceiling clamps are applied AFTER this (a later brick), so most-specific-wins and the
 * inviolable statutory minimum coexist.
 */

import { scopeApplies, scopeSpecificity, type ScopeDescriptor, type PlacementChain } from './scope.ts';

export interface PayRuleCandidate<T = unknown> {
  value: T;
  scope: ScopeDescriptor;
  /** '' = national default; 'IN-KA' etc. override it. */
  jurisdiction?: string;
  /** Attribute predicate — all keys must equal the context attrs. Absent = the default (matches all). */
  when?: Record<string, string>;
  effectiveFrom: string;
  version?: number;
  /** verified = a named human owns this figure against the Act text. */
  verified?: boolean;
  /** number of sourced citations (Act/circular URLs). */
  sourceCount?: number;
}

export interface PayResolveContext {
  chain: PlacementChain;
  /** the employee's jurisdiction (e.g. 'IN-KA'); falls back to national (''). */
  jurisdiction?: string;
  asOf: string;
  attrs?: Record<string, string>;
}

export interface RuleProvenance {
  scope: ScopeDescriptor;
  jurisdiction: string;
  effectiveFrom: string;
  version: number;
  verified: boolean;
}
export interface ResolvedRule<T> {
  value: T;
  provenance: RuleProvenance;
}

/** PURE — does a candidate's `when` hold for the context attrs? An absent `when` matches anything. */
function whenMatches(c: PayRuleCandidate, attrs: Record<string, string> | undefined): boolean {
  if (!c.when) return true;
  for (const k of Object.keys(c.when)) {
    if (!attrs || attrs[k] !== c.when[k]) return false;
  }
  return true;
}

/**
 * PURE — resolve one rule key to its value + provenance, or null when nothing applies. Applies the
 * sourced-only gate to the winner. Throws PAY-CMP-CONFLICT on a genuine tie.
 */
export function resolvePayRule<T>(candidates: readonly PayRuleCandidate<T>[], ctx: PayResolveContext): ResolvedRule<T> | null {
  const asOfMs = Date.parse(ctx.asOf);
  if (Number.isNaN(asOfMs)) throw new RangeError('rule resolver: asOf is not a valid ISO date');
  const jur = (ctx.jurisdiction ?? '').trim();
  const jchain = jur ? [jur, ''] : [''];

  const scored = candidates
    .map((c) => {
      const jIdx = jchain.indexOf(c.jurisdiction ?? '');
      return {
        c,
        ms: Date.parse(c.effectiveFrom),
        spec: scopeSpecificity(c.scope.level),
        jrank: jIdx < 0 ? -1 : jchain.length - jIdx, // more specific jurisdiction ⇒ higher
        ws: c.when ? Object.keys(c.when).length : 0,
        ver: c.version ?? 0,
      };
    })
    .filter((s) => scopeApplies(s.c.scope, ctx.chain) && s.jrank > 0 && whenMatches(s.c, ctx.attrs) && !Number.isNaN(s.ms) && s.ms <= asOfMs);

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.spec - a.spec || b.jrank - a.jrank || b.ws - a.ws || b.ms - a.ms || b.ver - a.ver);
  const top = scored[0];
  const ties = scored.filter((s) => s.spec === top.spec && s.jrank === top.jrank && s.ws === top.ws && s.ms === top.ms && s.ver === top.ver);
  if (ties.length > 1) {
    throw new RangeError(`PAY-CMP-CONFLICT: ${ties.length} rule candidates tie (scope=${top.c.scope.level}, jur=${top.c.jurisdiction ?? ''}, effectiveFrom=${top.c.effectiveFrom}, version=${top.ver}) — catalog defect`);
  }

  // SOURCED-ONLY gate
  if (top.c.verified && (top.c.sourceCount ?? 0) === 0) {
    throw new RangeError('PAY-CMP-501: a verified rule value has no source — refusing (verified requires an Act/circular citation)');
  }

  return {
    value: top.c.value,
    provenance: {
      scope: top.c.scope,
      jurisdiction: top.c.jurisdiction ?? '',
      effectiveFrom: top.c.effectiveFrom,
      version: top.ver,
      verified: !!top.c.verified,
    },
  };
}

/**
 * PURE — resolve a MANDATORY rule; refuses (throws PAY-CMP-510) when nothing resolves. Use for
 * statutory values the calculation cannot proceed without — a missing rule halts, never guesses.
 */
export function resolveRequiredPayRule<T>(candidates: readonly PayRuleCandidate<T>[], ctx: PayResolveContext, key?: string): ResolvedRule<T> {
  const r = resolvePayRule(candidates, ctx);
  if (!r) {
    throw new RangeError(`PAY-CMP-510: no rule value resolves${key ? ` for "${key}"` : ''} at ${ctx.asOf} — refusing (no guess)`);
  }
  return r;
}
