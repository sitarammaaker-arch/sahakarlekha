/**
 * Integration registry — registered, scoped principals (T-26 / API Constitution INT-2, INT-3,
 * INT-6, INT-7; ADR-0002, ADR-0007).
 *
 * PURE. Every integration behaves exactly like any principal on the trust plane: it is REGISTERED
 * with an owner, a tenant scope, a capability scope, a consent basis, and a rate limit, and it is
 * fully audited. It lights up ONLY through the entitlement system — a society opts in per
 * integration, and can opt out; none is ever silently active (INT-3). This module is the SSOT for:
 *
 *   INT-2  a valid registration — owner + tenant + jurisdiction + capability scope, entitled by a
 *          server-controlled source (plugin/plan), never a client-writable one.
 *   INT-3  activation — active iff opted-in AND every scope is within the tenant's entitlement (a
 *          plugin can never exceed the tenant, AUTH-3) AND the source is server-controlled.
 *   INT-7  egress discipline — an adapter may send outward ONLY data the tenant consented to, for
 *          the stated purpose, within capability scope, within jurisdiction (API-P6).
 *   INT-6  abuse control — a call must be within the integration's rate limit.
 *
 * No I/O; deterministic. The registration store and live counters are the wire layer's job.
 */
import type { Capability } from '@/lib/navigation/capabilities';
import type { AuthzDecision } from './principal';

/** INT-4 partner classes. Each has a standard adapter contract; none reaches the core directly. */
export type PartnerClass = 'government' | 'banking' | 'commerce' | 'credit' | 'migration' | 'society_app';
export type IntegrationDirection = 'inbound' | 'outbound' | 'bidirectional';

/** How the integration is entitled — must be a SERVER-CONTROLLED source (INT-3). A client-writable
 *  source can never light up an integration. */
export type EntitlementSource = 'plugin' | 'plan';
const SERVER_ENTITLEMENT: ReadonlySet<string> = new Set(['plugin', 'plan']);

export interface IntegrationRegistration {
  id: string;
  /** Who registered it — audit/attribution (CL-7). */
  owner: string;
  partnerClass: PartnerClass;
  direction: IntegrationDirection;
  /** Tenant scope — no cross-tenant reach (INT-2 / AUTH-2). */
  tenantId: string;
  /** Residency scope (API-P6 / ADR-0009). */
  jurisdiction: string;
  /** Capability scope — least privilege (AUTH-3). */
  scopes: readonly Capability[];
  /** Purposes the tenant consented to exchange data for (INT-7 / ADR-0007). */
  consentedPurposes: readonly string[];
  entitlement: EntitlementSource;
  /** Society opt-in; opt-out (false) disables the integration (INT-3). */
  enabled: boolean;
  /** Max calls per window — abuse control (INT-6). */
  rateLimitPerWindow: number;
}

export interface RegistrationResult {
  ok: boolean;
  registration?: IntegrationRegistration;
  problems: string[];
}

/**
 * PURE — validate & normalize an integration registration (INT-2). Rejects one missing an id,
 * owner, tenant, jurisdiction, or any capability scope; entitled by a non-server source; or with a
 * non-positive rate limit. A registration is an auditable principal, not a free-for-all.
 */
export function registerIntegration(input: Partial<IntegrationRegistration>): RegistrationResult {
  const problems: string[] = [];
  const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  if (!nonEmpty(input.id)) problems.push('id is required');
  if (!nonEmpty(input.owner)) problems.push('owner is required (audit/attribution)');
  if (!nonEmpty(input.tenantId)) problems.push('tenantId is required (tenant scope)');
  if (!nonEmpty(input.jurisdiction)) problems.push('jurisdiction is required (residency scope)');
  if (!input.scopes || input.scopes.length === 0) problems.push('at least one capability scope is required (least privilege)');
  if (!input.entitlement || !SERVER_ENTITLEMENT.has(input.entitlement)) {
    problems.push('entitlement must be a server-controlled source (plugin/plan) — an integration cannot be self-granted (INT-3)');
  }
  if (typeof input.rateLimitPerWindow !== 'number' || input.rateLimitPerWindow <= 0) {
    problems.push('rateLimitPerWindow must be a positive number (INT-6)');
  }
  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    problems: [],
    registration: {
      id: input.id!.trim(),
      owner: input.owner!.trim(),
      partnerClass: input.partnerClass ?? 'society_app',
      direction: input.direction ?? 'outbound',
      tenantId: input.tenantId!.trim(),
      jurisdiction: input.jurisdiction!.trim(),
      scopes: [...new Set(input.scopes!)],
      consentedPurposes: [...new Set(input.consentedPurposes ?? [])],
      entitlement: input.entitlement!,
      enabled: input.enabled ?? false,
      rateLimitPerWindow: input.rateLimitPerWindow!,
    },
  };
}

/**
 * PURE — is the integration ACTIVE (INT-3)? Only if the society opted in (enabled), its entitlement
 * source is server-controlled, AND every capability scope is within the tenant's entitlement — a
 * plugin can never exceed the tenant that authorized it (AUTH-3). None is silently active.
 */
export function isIntegrationActive(reg: IntegrationRegistration, tenantEntitlement: readonly Capability[]): boolean {
  if (!reg.enabled) return false;
  if (!SERVER_ENTITLEMENT.has(reg.entitlement)) return false;
  const entitled = new Set(tenantEntitlement);
  return reg.scopes.every((c) => entitled.has(c));
}

/** What an outbound egress attempt declares (INT-7). */
export interface EgressRequest {
  purpose: string;
  /** The capability class of the data being sent (null = no capability gate). */
  requiredCapability: Capability | null;
  destinationJurisdiction: string;
}

/**
 * PURE — INT-7 egress discipline: may this integration send data outward? Refused unless it is
 * enabled, the purpose is one the tenant consented to (ADR-0007), the data's capability class is
 * within the integration's scope (AUTH-3), and the destination is within jurisdiction (API-P6). No
 * compiling or forwarding of member data to a destination the society didn't authorize.
 */
export function authorizeEgress(reg: IntegrationRegistration, req: EgressRequest): AuthzDecision {
  if (!reg.enabled) return { ok: false, reason: 'integration is disabled (opted out)' };
  if (!reg.consentedPurposes.includes(req.purpose)) {
    return { ok: false, reason: `no consent to send data for purpose "${req.purpose}" (INT-7/ADR-0007)` };
  }
  if (req.requiredCapability != null && !reg.scopes.includes(req.requiredCapability)) {
    return { ok: false, reason: `data class "${req.requiredCapability}" is outside the integration's scope (AUTH-3)` };
  }
  if (req.destinationJurisdiction !== reg.jurisdiction) {
    return { ok: false, reason: 'cross-jurisdiction egress refused (API-P6)' };
  }
  return { ok: true };
}

/**
 * PURE — INT-6 abuse control: is a call within the integration's rate limit, given how many it has
 * already used in the current window? (The window bookkeeping is the wire layer's job.)
 */
export function withinRateLimit(reg: IntegrationRegistration, usedInWindow: number): boolean {
  return usedInWindow < reg.rateLimitPerWindow;
}
