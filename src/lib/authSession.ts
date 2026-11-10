/**
 * The signed-in session kept in localStorage (who is logged in, which society, which branch).
 *
 * Its own small module on purpose: AuthContext and error reporting need only these two functions, and
 * they are in every page's entry chunk. They used to import them from lib/storage, which dragged the
 * whole of that file — every chart-of-accounts template, about 240 KB of source — into the entry chunk
 * of the landing page and every blog article. lib/storage re-exports both, so nothing else changes.
 */
export type AuthSession = { email: string; name: string; role: string; societyId: string; branchId?: string };

/** Same key lib/storage has always used (KEYS.auth). */
export const AUTH_SESSION_KEY = 'sahayata_auth';

export const getAuthSession = (): AuthSession | null => {
  try {
    const stored = localStorage.getItem(AUTH_SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const setAuthSession = (session: AuthSession | null): void => {
  if (session) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(AUTH_SESSION_KEY);
};
