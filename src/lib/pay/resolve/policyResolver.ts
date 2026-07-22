/**
 * Payroll policy resolver (Phase-7 §4). PURE. Unlike a rule (which picks ONE winning value), a
 * policy is a typed config that is COMPOSED along the scope chain: a narrower scope inherits the
 * broader one and overrides only the keys it declares (set-valued keys union). The result is the
 * policyView the calculation reads to derive facts (attendance gating, OT multiplier, eligibility);
 * fact DERIVATION is the calc engine's job — this resolves the config only.
 *
 * Within one scope level the most-recent effective version wins (a tie is PAY-CMP-CONFLICT); the
 * per-level winners are then merged broad → narrow so the narrowest declaration takes precedence.
 *
 * Reuse: scopeApplies/scopeSpecificity from scope.ts.
 */

import { scopeApplies, scopeSpecificity, type ScopeDescriptor, type PlacementChain } from './scope.ts';

export type PolicyConfig = Record<string, unknown>;

export interface PolicyCandidate<C extends PolicyConfig = PolicyConfig> {
  scope: ScopeDescriptor;
  effectiveFrom: string;
  version?: number;
  config: C;
}

export interface PolicyLayer {
  scope: ScopeDescriptor;
  effectiveFrom: string;
  version: number;
}
export interface ResolvedPolicy<C extends PolicyConfig = PolicyConfig> {
  /** The composed config (narrower scope overrides; array keys union). */
  config: C;
  /** The per-level winners that were composed, broad → narrow (provenance). */
  layers: PolicyLayer[];
}

/** PURE — compose configs in order (broad → narrow). Scalars override; array keys union (dedup). */
function composeConfigs(ordered: readonly PolicyConfig[]): PolicyConfig {
  const out: PolicyConfig = {};
  for (const config of ordered) {
    for (const [k, v] of Object.entries(config)) {
      const prev = out[k];
      if (Array.isArray(prev) && Array.isArray(v)) {
        out[k] = [...new Set([...prev, ...v])];
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}

/**
 * PURE — resolve the composed policyView for an employee at a date. Returns an empty config +
 * empty layers when no policy applies (the caller uses defaults). Throws PAY-CMP-CONFLICT when two
 * distinct candidates tie at the top of a scope level.
 */
export function resolvePolicy<C extends PolicyConfig = PolicyConfig>(
  candidates: readonly PolicyCandidate<C>[],
  ctx: { chain: PlacementChain; asOf: string },
): ResolvedPolicy<C> {
  const asOfMs = Date.parse(ctx.asOf);
  if (Number.isNaN(asOfMs)) throw new RangeError('policy resolver: asOf is not a valid ISO date');

  const applicable = candidates
    .map((c) => ({ c, ms: Date.parse(c.effectiveFrom), spec: scopeSpecificity(c.scope.level), ver: c.version ?? 0 }))
    .filter((s) => scopeApplies(s.c.scope, ctx.chain) && !Number.isNaN(s.ms) && s.ms <= asOfMs);

  // per scope level, pick the most-recent effective version (tie = defect)
  const byLevel = new Map<number, typeof applicable>();
  for (const s of applicable) {
    const arr = byLevel.get(s.spec) ?? [];
    arr.push(s);
    byLevel.set(s.spec, arr);
  }

  const winners: { spec: number; layer: PolicyLayer; config: C }[] = [];
  for (const [spec, group] of byLevel) {
    group.sort((a, b) => b.ms - a.ms || b.ver - a.ver);
    const top = group[0];
    const ties = group.filter((s) => s.ms === top.ms && s.ver === top.ver);
    if (ties.length > 1) {
      throw new RangeError(`PAY-CMP-CONFLICT: ${ties.length} policy candidates tie at scope=${top.c.scope.level} effectiveFrom=${top.c.effectiveFrom} version=${top.ver} — catalog defect`);
    }
    winners.push({
      spec,
      layer: { scope: top.c.scope, effectiveFrom: top.c.effectiveFrom, version: top.ver },
      config: top.c.config,
    });
  }

  // compose broad → narrow
  winners.sort((a, b) => a.spec - b.spec);
  return {
    config: composeConfigs(winners.map((w) => w.config)) as C,
    layers: winners.map((w) => w.layer),
  };
}
