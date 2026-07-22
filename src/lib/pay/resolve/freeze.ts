/**
 * Freeze resolved views (Phase-7 §7). PURE. Composes the resolver bricks into the three frozen
 * slices the runtime's ExecutionContext carries:
 *   · ruleView   — each rule key resolved to { value, provenance } (ruleResolver);
 *   · policyView — each policy type resolved to its composed config (policyResolver);
 *   · configView — each config setting resolved most-specific-wins (scope.selectMostSpecific;
 *                  config resolution IS most-specific selection, so no separate resolver module).
 *
 * This is the seam between resolution (Phase-7) and calculation (Phase-8): the server freezes these
 * views into run_snapshot ONCE, and every employee's ExecutionContext reads the frozen slice — so a
 * later catalog change never mutates a posted run (reproducibility). This module is PURE over the
 * injected catalogs; fetching them is the server's I/O job. Clamps (clamps.ts) are applied by the
 * calc engine at value-use, where a figure meets its floor/ceiling.
 */

import { resolvePayRule, resolveRequiredPayRule, type PayRuleCandidate, type ResolvedRule } from './ruleResolver.ts';
import { resolvePolicy, type PolicyCandidate, type PolicyConfig } from './policyResolver.ts';
import { selectMostSpecific, type ScopedCandidate, type PlacementChain } from './scope.ts';

export interface FreezeContext {
  chain: PlacementChain;
  jurisdiction?: string;
  asOf: string;
  attrs?: Record<string, string>;
}

export interface RuleSpec {
  candidates: PayRuleCandidate[];
  /** A mandatory rule refuses (PAY-CMP-510) when it does not resolve; an optional one → null. */
  required?: boolean;
}
export interface ConfigCandidate extends ScopedCandidate {
  value: unknown;
}

export interface FreezeCatalogs {
  rules: Record<string, RuleSpec>;
  policies: Record<string, PolicyCandidate[]>;
  config: Record<string, ConfigCandidate[]>;
}

export interface FrozenViews {
  ruleView: Record<string, ResolvedRule<unknown> | null>;
  policyView: Record<string, PolicyConfig>;
  configView: Record<string, unknown>;
}

/** PURE — resolve all catalogs into the three frozen views. Throws on a required-rule gap
 *  (PAY-CMP-510), an unsourced verified value (PAY-CMP-501), or a catalog tie (PAY-CMP-CONFLICT). */
export function freezeViews(catalogs: FreezeCatalogs, ctx: FreezeContext): FrozenViews {
  const ruleView: Record<string, ResolvedRule<unknown> | null> = {};
  for (const [key, spec] of Object.entries(catalogs.rules)) {
    ruleView[key] = spec.required
      ? resolveRequiredPayRule(spec.candidates, ctx, key)
      : resolvePayRule(spec.candidates, ctx);
  }

  const policyView: Record<string, PolicyConfig> = {};
  for (const [type, candidates] of Object.entries(catalogs.policies)) {
    policyView[type] = resolvePolicy(candidates, { chain: ctx.chain, asOf: ctx.asOf }).config;
  }

  const configView: Record<string, unknown> = {};
  for (const [key, candidates] of Object.entries(catalogs.config)) {
    const win = selectMostSpecific(candidates, ctx.chain, ctx.asOf);
    configView[key] = win ? win.value : null;
  }

  return { ruleView, policyView, configView };
}
