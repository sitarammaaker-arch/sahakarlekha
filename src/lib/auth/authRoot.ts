/**
 * Delegated authentication root & dual-auth window (T-18 / ADR-0007; IRR-5 Class D; API-P8 SoD).
 *
 * PURE. SahakarLekha's own `society_users.password` table must NOT be the national identity root —
 * that is an irreversible, unrecallable liability at scale (IRR-5). The credential root is
 * DELEGATED to an external identity provider (Supabase Auth / DPI-aligned identity), and every
 * legacy account is migrated off the self-managed store behind a DUAL-AUTH WINDOW that preserves
 * access continuity: while the window is open both roots authenticate, but the delegated root is
 * authoritative and a successful legacy login UPGRADES the account (provisions the delegated root)
 * so the next login no longer needs the legacy secret. Once cut over, the legacy root is refused.
 *
 * This module is the SSOT for that policy. It holds NO credentials and does NO I/O: it decides
 * over an OPAQUE verification OUTCOME (`verifiedBy`), never a password/token — which is precisely
 * ADR-0007's "no plaintext credentials" guarantee expressed at the policy layer. The live login
 * wiring, the account migration, and the eventual deprecation of the `password` column are the
 * deferred half; the ordering, upgrade, continuity, and SoD rules they must obey live here.
 */

/** Where an account's credential is rooted. `delegated` = external IdP (authoritative);
 *  `legacy` = the deprecated self-managed password store, honoured only during the window. */
export type AuthRoot = 'delegated' | 'legacy';

/** The rollout phase of the dual-auth window. `dual_auth` = window open (both roots accepted);
 *  `delegated_only` = window closed / cut over (legacy is refused). One-way. */
export type RolloutPhase = 'dual_auth' | 'delegated_only';

/** An account's auth-root state — the migration status, not any credential. */
export interface AccountAuthRoot {
  identityRef: string;
  /** The account is provisioned in the external identity provider. */
  hasDelegated: boolean;
  /** A legacy self-managed secret still exists for this account. */
  hasLegacy: boolean;
  /** The legacy secret has been retired (post-migration) — never honoured again. */
  legacyRetired: boolean;
}

/**
 * PURE — the roots whose verification is HONOURED for this account, in the order they should be
 * tried. The delegated root is authoritative and always tried first; the legacy root is honoured
 * only while the window is open AND a legacy secret still exists AND it has not been retired.
 */
export function acceptedRoots(account: AccountAuthRoot, phase: RolloutPhase): AuthRoot[] {
  const roots: AuthRoot[] = [];
  if (account.hasDelegated) roots.push('delegated');
  if (phase === 'dual_auth' && account.hasLegacy && !account.legacyRetired) roots.push('legacy');
  return roots;
}

export interface AuthDecision {
  authenticated: boolean;
  /** The root that authenticated the account (present iff authenticated). */
  via?: AuthRoot;
  /** True when a legacy-verified login must provision the delegated root (access continuity
   *  moves the root forward) — the caller migrates the account, then the legacy secret can be
   *  retired via planRetireLegacy. Never true for a delegated login. */
  upgrade: boolean;
  /** Why authentication was refused (empty when authenticated). */
  reason?: string;
}

/**
 * PURE — decide a login, given which root an OUT-OF-BAND credential check succeeded on
 * (`verifiedBy`), or null if none did. A root's verification only counts if that root is
 * currently accepted (`acceptedRoots`): a legacy verification is REFUSED once the account is
 * migrated/retired or after cutover, so a deprecated root can never re-authenticate. A legacy
 * login that IS accepted authenticates AND flags an upgrade to the delegated root.
 */
export function authenticate(
  account: AccountAuthRoot,
  phase: RolloutPhase,
  verifiedBy: AuthRoot | null,
): AuthDecision {
  if (verifiedBy == null) return { authenticated: false, upgrade: false, reason: 'no credential verified' };
  if (!acceptedRoots(account, phase).includes(verifiedBy)) {
    return {
      authenticated: false,
      upgrade: false,
      reason:
        verifiedBy === 'legacy'
          ? 'the legacy credential root is no longer accepted for this account'
          : 'the delegated root is not provisioned for this account',
    };
  }
  return { authenticated: true, via: verifiedBy, upgrade: verifiedBy === 'legacy' };
}

/**
 * PURE — access-continuity invariant: can this account still authenticate at all in this phase?
 * The migration must never leave an account with no accepted root (IRR-5 continuity). Equivalent
 * to `acceptedRoots(...).length > 0`.
 */
export function hasAccess(account: AccountAuthRoot, phase: RolloutPhase): boolean {
  return acceptedRoots(account, phase).length > 0;
}

export interface RetireLegacyPlan {
  ok: boolean;
  next?: AccountAuthRoot;
  problem?: string;
}

/**
 * PURE — plan the retirement of an account's legacy secret. REFUSED unless the delegated root is
 * provisioned first: retiring legacy for an account with no delegated root would strand it (no
 * accepted root left). On success returns the next state with the legacy secret retired — the
 * live path then drops the stored secret. Idempotent for an already-retired account.
 */
export function planRetireLegacy(account: AccountAuthRoot): RetireLegacyPlan {
  if (!account.hasDelegated) {
    return { ok: false, problem: 'cannot retire the legacy root before the delegated root is provisioned — the account would be stranded' };
  }
  return { ok: true, next: { ...account, hasLegacy: false, legacyRetired: true } };
}

/**
 * PURE — separation of duties for an auth-root change (migration, credential reset, root
 * retirement): the actor who authorizes it MUST NOT be the account holder. A member cannot
 * migrate or reset their own root unilaterally (API-P8; mirrors T-23 authorizer≠preparer).
 */
export function authorizeRootChange(actorRef: string, subjectRef: string): boolean {
  return actorRef.length > 0 && actorRef !== subjectRef;
}
