/**
 * Member Portal S3 — the member's OWN Supabase client.
 *
 * Deliberately separate from lib/supabase: its own storageKey, and sessionStorage (founder decision
 * 2026-09-25 — the login lasts only until the browser/tab closes, safe on a shared village phone).
 * So a member logging in on the society office computer can never overwrite the staff session, and
 * AuthContext (which listens to the staff client) never sees a member.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { memberLoginEmail } from './memberPortalLogin';
import type { PortalDenied, PortalSnapshot } from './memberPortalView';

export const MEMBER_PORTAL_STORAGE_KEY = 'sl-member-portal';

/** sessionStorage, or an in-memory fallback when it is blocked (private mode / embedded views). */
function sessionStore(): Storage | { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } {
  try {
    const t = '__sl_mp_probe__';
    window.sessionStorage.setItem(t, '1');
    window.sessionStorage.removeItem(t);
    return window.sessionStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v); }, removeItem: (k) => { mem.delete(k); } };
  }
}

let client: SupabaseClient | null = null;
export function memberPortalClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co',
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-key',
      {
        auth: {
          storageKey: MEMBER_PORTAL_STORAGE_KEY,
          storage: sessionStore(),
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return client;
}

export type LoginResult = { ok: true } | { ok: false; reason: 'invalid' | 'rate_limited' | 'network' };

export async function memberSignIn(societyId: string, memberNo: string, pin: string): Promise<LoginResult> {
  let email: string;
  try { email = await memberLoginEmail(societyId, memberNo); } catch { return { ok: false, reason: 'invalid' }; }
  const { error } = await memberPortalClient().auth.signInWithPassword({ email, password: pin });
  if (!error) return { ok: true };
  if (error.status === 429) return { ok: false, reason: 'rate_limited' };
  // Wrong number, wrong PIN, revoked (banned) — one generic answer, so nothing reveals which member numbers exist.
  if (error.status && error.status < 500) return { ok: false, reason: 'invalid' };
  return { ok: false, reason: 'network' };
}

/**
 * Log out on THIS device, unconditionally. scope 'local' drops the session without a server round
 * trip — the default 'global' sign-out keeps the local session when the server is unreachable, which
 * on a shared phone with a weak network would leave the next person looking at this member's books.
 * The stored key is also removed directly, belt and braces.
 */
export async function memberSignOut(): Promise<void> {
  await memberPortalClient().auth.signOut({ scope: 'local' }).catch(() => undefined);
  try { window.sessionStorage.removeItem(MEMBER_PORTAL_STORAGE_KEY); } catch { /* storage blocked — in-memory store is dropped with the tab */ }
}

export async function hasMemberSession(): Promise<boolean> {
  const { data } = await memberPortalClient().auth.getSession();
  return !!data.session;
}

export async function fetchMemberSnapshot(): Promise<PortalSnapshot | PortalDenied | { ok: false; reason: 'network' }> {
  const { data, error } = await memberPortalClient().rpc('member_portal_snapshot');
  if (error || !data) return { ok: false, reason: 'network' };
  return data as PortalSnapshot | PortalDenied;
}
