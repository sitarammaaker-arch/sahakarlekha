/**
 * Why a login did not complete, and the idle sign-out bookkeeping. PURE (no imports, no I/O) so
 * scripts/test-login-failure.mjs can run it directly.
 *
 * Before this module every failure — no network, Supabase down, too many attempts, a deactivated login —
 * came back as the same "failed" and the page said "Invalid email or password". A user on a weak
 * connection was told a correct password was wrong (audit 2026-11-16, J-1 / J-8).
 */

/** `credentials` is deliberately the default: an unknown email and a wrong password stay one message. */
export type LoginFailureReason = 'credentials' | 'network' | 'rate_limited' | 'service' | 'inactive';

/** The parts of a supabase-js AuthError / PostgrestError this needs. */
export interface AuthErrorLike {
  status?: number | null;
  name?: string | null;
  code?: string | null;
  message?: string | null;
}

/**
 * Classify a failed call. `online` is navigator.onLine at the time of the call.
 *
 * supabase-js does not throw on a dropped connection: it RESOLVES with an AuthRetryableFetchError
 * (status 0), so the caller must pass the error here rather than rely on try/catch.
 */
export function classifyAuthError(err: AuthErrorLike | null | undefined, online = true): LoginFailureReason {
  if (!online) return 'network';
  if (!err) return 'credentials';
  const status = typeof err.status === 'number' ? err.status : null;
  const name = err.name ?? '';
  const code = err.code ?? '';
  const message = (err.message ?? '').toLowerCase();
  if (name === 'AuthRetryableFetchError' || status === 0
    || /failed to fetch|networkerror|network request failed|load failed/.test(message)) return 'network';
  if (status === 429 || /rate_limit/.test(code)) return 'rate_limited';
  if (status !== null && status >= 500) return 'service';
  return 'credentials';
}

/** Idle sign-out: milliseconds still to wait, given the newest activity seen in ANY tab. ≤ 0 → sign out. */
export function idleRemainingMs(lastActivityMs: number | null, nowMs: number, timeoutMs: number): number {
  if (lastActivityMs == null || !Number.isFinite(lastActivityMs)) return 0;
  return timeoutMs - (nowMs - lastActivityMs);
}

/** localStorage: the last activity in any tab of this browser (they share one Supabase session). */
export const LAST_ACTIVITY_KEY = 'sl.lastActivity';
/** sessionStorage: why this tab was sent to /login, read once by the login page. */
export const LOGOUT_REASON_KEY = 'sl.logoutReason';
export type LogoutReason = 'idle' | 'inactive';

export function parseLogoutReason(raw: string | null | undefined): LogoutReason | null {
  return raw === 'idle' || raw === 'inactive' ? raw : null;
}
