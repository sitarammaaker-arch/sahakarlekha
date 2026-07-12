/**
 * AI as a scoped principal on the trust plane (T-29 / AI Constitution AI-P2; ADR-0010; RULE 6).
 *
 * PURE. On the single trust plane (the same one API integrations use, T-24), an AI agent is a
 * PRINCIPAL — never an authority. It acts ON BEHALF OF a named human and inherits AT MOST that
 * human's permissions (least privilege). It cannot self-elevate, self-entitle, bypass a capability
 * gate, or touch FY-locked data (AI-P2 / AI-N4 / RULE 6). This module is the SSOT for that scoping:
 *
 *   resolveAgentScope    — the agent's usable capabilities = agent grants ∩ the human's scopes ∩
 *                          the tenant entitlement. A scope the human lacks is DROPPED even if the
 *                          agent was configured with it — self-elevation is impossible by
 *                          construction, not by a check that could be forgotten.
 *   attribution          — the on-behalf-of record for the audit envelope (AI-A2 / CL-7).
 *   authorizeAgentAction — the on-behalf-of binding must be present & consistent; NO action on a
 *                          locked period; then the capability/tenant/jurisdiction/finalization
 *                          checks are delegated to the shared trust-plane rule (T-24) with the
 *                          agent's BOUNDED scope — so an AI action can never finalize autonomously.
 *
 * Whether an action is a proposal vs a commit (AI-P4/AI-N1) and the audit envelope's persistence
 * are T-30's concern; this module fixes WHO the agent is and WHAT it may reach. No I/O; deterministic.
 */
import type { Capability } from '@/lib/navigation/capabilities';
import { authorizeRequest, type AuthzDecision, type Principal, type ResourceContract } from '../api/principal';

/** The human the agent acts for — the source of non-delegable accountability (AI-P1) and the
 *  ceiling of the agent's permissions (AI-P2). */
export interface ActingHuman {
  id: string;
  scopes: readonly Capability[];
  tenantId: string;
  jurisdiction: string;
}

/** An AI agent principal — always bound to a human it acts on behalf of (AI-A2). */
export interface AgentPrincipal {
  id: string;
  /** The scopes the agent was configured with — a subset it MAY use, never beyond the human. */
  grantedScopes: readonly Capability[];
  /** The id of the human this agent acts for. Required — an unbound agent may do nothing. */
  onBehalfOf: string;
}

/**
 * PURE — AI-P2 least privilege: the capabilities the agent may ACTUALLY use = its granted scopes ∩
 * the acting human's scopes ∩ the tenant entitlement. The agent inherits at most the human's
 * permissions and can never exceed the tenant; a capability the human lacks is dropped even if the
 * agent was granted it (no self-elevation). Order-stable, deduplicated.
 */
export function resolveAgentScope(
  agent: AgentPrincipal,
  human: ActingHuman,
  tenantEntitlement: readonly Capability[],
): Capability[] {
  const humanScopes = new Set(human.scopes);
  const entitled = new Set(tenantEntitlement);
  const seen = new Set<Capability>();
  const out: Capability[] = [];
  for (const c of agent.grantedScopes) {
    if (humanScopes.has(c) && entitled.has(c) && !seen.has(c)) { seen.add(c); out.push(c); }
  }
  return out;
}

/** An attribution record for the audit envelope — every AI action names the agent AND the human it
 *  served (AI-A2 / CL-7). */
export interface Attribution {
  actor: 'agent';
  agentId: string;
  onBehalfOf: string;
}

/** PURE — the attribution stamped on an agent's action; null if the agent is not validly bound to
 *  this human (an unbound or mismatched agent has no authority to act). */
export function attribution(agent: AgentPrincipal, human: ActingHuman): Attribution | null {
  if (!agent.onBehalfOf || agent.onBehalfOf !== human.id) return null;
  return { actor: 'agent', agentId: agent.id, onBehalfOf: human.id };
}

export interface AgentActionRequest {
  contract: ResourceContract;
  tenantId: string;
  jurisdiction: string;
  /** True if the action would mutate FY/period-locked data — an AI agent may NEVER do this
   *  (AI-N4 / RULE 6), just as the app forbids it. */
  touchesLockedPeriod?: boolean;
  /** For a finalization write: the independent human authorizer (passed through to the trust
   *  plane). An AI agent alone can never finalize (AI-N1). */
  authorizerId?: string;
  authorizerIsHuman?: boolean;
}

/**
 * PURE — authorize an AI agent action on the trust plane. In order: the agent must be validly bound
 * to the acting human (on-behalf-of recorded, AI-A2); it may not act on a locked period (AI-N4);
 * then capability, tenant, jurisdiction, and finalization/SoD are decided by the SAME rule every
 * principal obeys (T-24 authorizeRequest), using the agent's scope BOUNDED by the human. The agent
 * can neither self-elevate (its scope is an intersection) nor finalize autonomously (finalization
 * still needs an independent human authorizer).
 */
export function authorizeAgentAction(
  agent: AgentPrincipal,
  human: ActingHuman,
  tenantEntitlement: readonly Capability[],
  req: AgentActionRequest,
): AuthzDecision {
  if (attribution(agent, human) == null) {
    return { ok: false, reason: 'the agent is not bound to the acting human (on-behalf-of missing/mismatched) — AI-A2' };
  }
  if (req.touchesLockedPeriod) {
    return { ok: false, reason: 'an AI agent can never act on FY/period-locked data (AI-N4/RULE 6)' };
  }
  const agentPrincipal: Principal = {
    id: agent.id,
    kind: 'agent',
    scopes: resolveAgentScope(agent, human, tenantEntitlement),
    tenantId: human.tenantId,
    jurisdiction: human.jurisdiction,
  };
  return authorizeRequest(agentPrincipal, {
    contract: req.contract,
    tenantId: req.tenantId,
    jurisdiction: req.jurisdiction,
    authorizerId: req.authorizerId,
    authorizerIsHuman: req.authorizerIsHuman,
  }, tenantEntitlement);
}
