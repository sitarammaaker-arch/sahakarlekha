/**
 * Public domain API — the single trust plane (T-24 / API Constitution Art. I–III; ADR-0004, ADR-0002).
 *
 * PURE. Every caller of the API — a REST client, an integration, an AI agent — is the SAME kind of
 * thing: an authenticated PRINCIPAL with capability entitlements it can never exceed (API-P3). This
 * module is the SSOT for the authorization decision every endpoint, event delivery, and integration
 * must pass, expressed over a CONTRACT-FIRST descriptor — the endpoint declares the capability it
 * needs and, for a write, its effect class; nothing is inferred from internal storage (API-P1).
 *
 * The decision, in order (Art. III):
 *   AUTH-2   principal + tenant + jurisdiction on every call — no cross-tenant reach, no
 *            cross-jurisdiction data egress (API-P6 residency).
 *   AUTH-3   capability-scoped surface — the required capability must be in the principal's
 *            EFFECTIVE scope = its granted scopes ∩ the acting tenant's entitlement (least
 *            privilege; a principal can never exceed its tenant, the same resolution the UI/AI use).
 *   AUTH-6   money movement & statutory finalization require explicit HUMAN authority and SoD — an
 *            integration/agent may PREPARE, but can never both propose and finalize (API-P8).
 *
 * The write LAWS themselves (double-entry CL-1, immutability CL-2, FY/period lock RULE 6, exact
 * money) are enforced on the SAME internal write paths the app uses (API-P4) — the API is not a
 * shortcut around them; this module authorizes the caller, it does not re-implement those laws.
 * No I/O, no credentials, deterministic.
 */
import type { Capability } from '@/lib/navigation/capabilities';

/** An API client, an integration, and an AI agent are all principals on one trust plane (API-P3). */
export type PrincipalKind = 'human' | 'integration' | 'agent';

export interface Principal {
  id: string;
  kind: PrincipalKind;
  /** The capability scopes this credential was granted — a least-privilege subset (AUTH-3). */
  scopes: readonly Capability[];
  /** The single tenant this principal acts within — no cross-tenant reach (AUTH-2). */
  tenantId: string;
  /** The jurisdiction (state) the principal is residency-scoped to (ADR-0009, API-P6). */
  jurisdiction: string;
}

export type ApiAction = 'read' | 'write';

/** The effect class of a write. `finalization` = money-movement authorization OR statutory
 *  finalization (close/appropriation/adoption) — the effects that require human authority + SoD
 *  (API-P8/AUTH-6). Preparing an instruction is an `ordinary` write (a proposal, parallels AI Tier-D). */
export type WriteEffect = 'ordinary' | 'finalization';

/**
 * A contract-first endpoint descriptor: the resource is a domain noun from the Canonical Model and
 * DECLARES the capability it requires (and, for a write, its effect) — never a table dump, never
 * inferred from storage (API-P1, Art. I).
 */
export interface ResourceContract {
  resource: string;
  action: ApiAction;
  requiredCapability: Capability;
  /** For writes; defaults to 'ordinary'. */
  effect?: WriteEffect;
}

export interface ApiRequest {
  contract: ResourceContract;
  tenantId: string;
  jurisdiction: string;
  /** For a finalization write: the human who authorizes it (must be human and independent of the
   *  acting principal for SoD). On-behalf-of is explicit and audited (AUTH-4, CL-7). */
  authorizerId?: string;
  authorizerIsHuman?: boolean;
}

export interface AuthzDecision {
  ok: boolean;
  reason?: string;
}

/**
 * PURE — least privilege (AUTH-3): the capabilities a principal can ACTUALLY use are its granted
 * scopes ∩ the acting tenant's entitlement. A principal (integration/agent/human) can never exceed
 * the tenant that authorized it. Deduplicated, order-stable.
 */
export function resolveEffectiveScope(
  principal: Principal,
  tenantEntitlement: readonly Capability[],
): Capability[] {
  const entitled = new Set(tenantEntitlement);
  const seen = new Set<Capability>();
  const out: Capability[] = [];
  for (const c of principal.scopes) {
    if (entitled.has(c) && !seen.has(c)) { seen.add(c); out.push(c); }
  }
  return out;
}

/**
 * PURE — authorize a request on the single trust plane (Art. III). There is no privileged "API
 * backdoor": the surface is exactly the principal's resolved capabilities ∩ the tenant entitlement,
 * the same resolution the UI and AI use. Money/finalization effects additionally require explicit
 * human authority and separation of duties (API-P8/AUTH-6).
 */
export function authorizeRequest(
  principal: Principal,
  req: ApiRequest,
  tenantEntitlement: readonly Capability[],
): AuthzDecision {
  // AUTH-2 — no cross-tenant reach.
  if (req.tenantId !== principal.tenantId) {
    return { ok: false, reason: 'cross-tenant access refused (AUTH-2)' };
  }
  // API-P6 / AUTH-2 — no cross-jurisdiction data egress.
  if (req.jurisdiction !== principal.jurisdiction) {
    return { ok: false, reason: 'cross-jurisdiction access refused (API-P6)' };
  }

  // AUTH-3 / Art. I — capability-scoped surface.
  const effective = resolveEffectiveScope(principal, tenantEntitlement);
  if (!effective.includes(req.contract.requiredCapability)) {
    return { ok: false, reason: `capability "${req.contract.requiredCapability}" is outside the principal's scope (AUTH-3)` };
  }

  // API-P8 / AUTH-6 — money & statutory finalization are human-authorized, never autonomous.
  if (req.contract.action === 'write' && (req.contract.effect ?? 'ordinary') === 'finalization') {
    if (!req.authorizerIsHuman || !req.authorizerId) {
      return { ok: false, reason: 'a finalization effect requires explicit human authorization (API-P8/AUTH-6)' };
    }
    // SoD — the authorizer must be independent of the acting principal (preparer ≠ authorizer).
    if (req.authorizerId === principal.id) {
      return { ok: false, reason: 'separation of duties: the preparer cannot authorize their own finalization (AUTH-6)' };
    }
  }

  return { ok: true };
}
