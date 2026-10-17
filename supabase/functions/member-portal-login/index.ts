/**
 * member-portal-login — the ONLY way a member signs in to the सदस्य portal (member-area re-audit 2026-10-17, H-6).
 *   POST { society_id, member_no, pin }  →  { ok: true, access_token, refresh_token }
 *                                        |  { ok: false, reason: 'invalid' | 'locked' | 'rate_limited' | 'server_error' }
 *
 * WHY a server hop: the browser used to compute the login email itself (sha256 of society + member number) and call
 * Supabase Auth directly, so anyone could do the same and guess 6-digit PINs, limited only per IP. Now:
 *   - the login email is a keyed HMAC (secret MEMBER_LOGIN_PEPPER, never in the browser) — it cannot be worked out,
 *     so Supabase Auth cannot be attacked directly for a keyed login;
 *   - every attempt first TAKES a slot from member_portal_login_begin (migration 123): 5 per 15 minutes per login,
 *     then a 15-minute lock — atomically, so parallel guesses cannot slip past;
 *   - legacy (unkeyed) logins still work here until their PIN is reset (reset_pin moves them to the keyed email);
 *   - every refusal is the same generic answer, so nothing reveals which member numbers exist.
 *
 * Called with the anon key (the member has no session yet). Secrets: SUPABASE_URL, SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY (auto-injected) + MEMBER_LOGIN_PEPPER (set once: npx supabase secrets set ...).
 * Deno runtime — not the app's TypeScript. Deploy: npx supabase functions deploy member-portal-login
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { memberLoginEmail, memberLoginEmailV2, loginAttemptKey, parseLoginRequest } from '../_shared/member-portal-core.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'invalid' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const pepper = Deno.env.get('MEMBER_LOGIN_PEPPER') ?? '';
  if (!url || !anonKey || !svcKey || pepper.length < 32) return json({ ok: false, reason: 'server_error' }, 500);

  const parsed = parseLoginRequest(await req.json().catch(() => null));
  if (!parsed.ok) return json({ ok: false, reason: 'invalid' }, 400);

  try {
    const keyedEmail = await memberLoginEmailV2(parsed.societyId, parsed.memberNo, pepper);
    const legacyEmail = await memberLoginEmail(parsed.societyId, parsed.memberNo);
    const svc = createClient(url, svcKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // One attempt counter per (society, member no) — the keyed email identifies it for both address schemes.
    const key = await loginAttemptKey(keyedEmail);
    const { data: gate, error: gateErr } = await svc.rpc('member_portal_login_begin', { p_key: key });
    if (gateErr) { console.error('login gate', gateErr.message); return json({ ok: false, reason: 'server_error' }, 500); }
    if (!gate?.allowed) return json({ ok: false, reason: 'locked', locked_until: gate?.locked_until ?? null }, 429);

    const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    let rateLimited = false;
    for (const email of [keyedEmail, legacyEmail]) {
      const { data, error } = await anon.auth.signInWithPassword({ email, password: parsed.pin });
      if (!error && data.session) {
        await svc.rpc('member_portal_login_success', { p_key: key });
        return json({ ok: true, access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      }
      if (error?.status === 429) rateLimited = true;
    }
    return rateLimited ? json({ ok: false, reason: 'rate_limited' }, 429) : json({ ok: false, reason: 'invalid' }, 401);
  } catch (e) {
    console.error('member-portal-login', e instanceof Error ? e.message : String(e));
    return json({ ok: false, reason: 'server_error' }, 500);
  }
});
