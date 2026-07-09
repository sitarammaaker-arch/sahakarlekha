/**
 * Auth session serialization (ECR-30) — the single source of truth for how a logged-in
 * user is persisted to / restored from localStorage. Previously three places built the
 * user differently (buildUser vs restoreSession vs five setAuthSession call-sites), so a
 * page refresh silently dropped `mfaEnabled` and replaced the real `id` with the email.
 * Consolidating here makes the round-trip lossless. PURE — no React/Supabase/storage.
 * Mirrors scripts/test-auth-session.mjs.
 */
export type AuthRole = 'admin' | 'accountant' | 'viewer' | 'auditor';

/** The in-memory logged-in user. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  societyId: string;
  mfaEnabled?: boolean;
  branchId?: string;
}

/** The persisted session (localStorage `sahayata_auth`). Carries every identity field. */
export interface AuthSession {
  id: string;
  email: string;
  name: string;
  role: string;
  societyId: string;
  branchId?: string;
  mfaEnabled?: boolean;
}

/** The super-admin sentinel: platform admins carry societyId 'PLATFORM'. */
export const PLATFORM_SOCIETY_ID = 'PLATFORM';

export function isPlatformSession(s: Pick<AuthSession, 'societyId'> | null | undefined): boolean {
  return !!s && s.societyId === PLATFORM_SOCIETY_ID;
}

/** Serialize a user for persistence — carries id + mfaEnabled + branchId (no field dropped). */
export function toSession(u: AuthUser): AuthSession {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    societyId: u.societyId,
    branchId: u.branchId || undefined,
    mfaEnabled: !!u.mfaEnabled,
  };
}

/** Restore a user from a persisted session. Returns null for an incomplete session.
 *  Legacy sessions (pre-ECR-30) had no `id` → fall back to the email as a stable key. */
export function sessionToUser(s: AuthSession | null | undefined): AuthUser | null {
  if (!s || !s.email || !s.name || !s.role || !s.societyId) return null;
  return {
    id: s.id || s.email,
    name: s.name,
    email: s.email,
    role: s.role as AuthRole,
    societyId: s.societyId,
    branchId: s.branchId || undefined,
    mfaEnabled: !!s.mfaEnabled,
  };
}
