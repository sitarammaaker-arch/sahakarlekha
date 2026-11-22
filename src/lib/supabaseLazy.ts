/**
 * SEO-13 part 2 (product audit 2026-11-17): the Supabase client, loaded on first use.
 *
 * `@/lib/supabase` pulls in supabase-js (51 KB gzip). AuthProvider wraps every route and error reporting starts in
 * main.tsx, so a static import put supabase-js on EVERY public page's entry path — the landing page, the blog, the
 * guide — which never talk to the database unless someone is signed in. Code on the entry path asks for the client
 * through getSupabase(); the chunk is fetched once, the first time it is needed (on an app page it is already there).
 * Everything that is not on the entry path keeps importing `@/lib/supabase` directly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

let pending: Promise<SupabaseClient> | null = null;
let markLoaded: (c: SupabaseClient) => void = () => {};
const loaded = new Promise<SupabaseClient>((r) => { markLoaded = r; });

/** The client — loads it on the first call. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!pending) {
    pending = import('@/lib/supabase').then((m) => { markLoaded(m.supabase); return m.supabase; }).catch((e) => {
      pending = null;   // a failed load (offline, stale chunk) may be retried by the next caller
      throw e;
    });
  }
  return pending;
}

/** Resolves when SOMEONE has loaded the client (login, a widget, an app page) — never triggers the load itself. */
export function whenSupabaseLoaded(): Promise<SupabaseClient> {
  return loaded;
}

/** Does this browser hold a Supabase Auth session (supabase-js keeps it under `sb-<project>-auth-token`)? A visitor
 *  who never signed in has none, so there is nothing to restore and the client need not load on their first view. */
export function hasStoredAuthSession(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && /^sb-.+-auth-token$/.test(k)) return true;
    }
  } catch { /* storage blocked: assume there may be one */ return true; }
  return false;
}
