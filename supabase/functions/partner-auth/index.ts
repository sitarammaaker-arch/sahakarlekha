/**
 * partner-auth — sends the partner portal emails (migration 168).
 *   POST { action: 'start', email }        → always { ok: true } (no account enumeration). If the email belongs to a
 *                                            non-rejected partner and the rate limit allows, a 6-digit code is issued
 *                                            by partner_login_issue (service role) and emailed. The browser then calls
 *                                            the anon RPC partner_login_verify(email, code) itself.
 *   POST { action: 'welcome', partner_id } → platform admin only (their JWT in Authorization): emails the approved
 *                                            partner their referral code, link and the portal address.
 *                                            → { ok, sent } | { ok:false, reason }
 *
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (auto-injected) + RESEND_API_KEY, RESEND_FROM
 * (already set for send-worker). Deno runtime — not the app's TypeScript.
 * Deploy: npx supabase functions deploy partner-auth --no-verify-jwt --project-ref rwffxupenwdtrmyabytk
 *   (--no-verify-jwt: 'start' comes from a signed-out browser; 'welcome' checks the admin JWT itself.)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { parsePartnerAuthRequest, buildOtpEmail, buildWelcomeEmail, sendViaResend } from '../_shared/partner-email.mjs';

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
  const resend = { apiKey: Deno.env.get('RESEND_API_KEY') ?? '', from: Deno.env.get('RESEND_FROM') ?? '' };
  if (!url || !anonKey || !svcKey) return json({ ok: false, reason: 'server_error' }, 500);

  const parsed = parsePartnerAuthRequest(await req.json().catch(() => null));
  if (!parsed.ok) return json({ ok: false, reason: 'invalid' }, 400);

  try {
    if (parsed.action === 'start') {
      const svc = createClient(url, svcKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await svc.rpc('partner_login_issue', { p_email: parsed.email });
      if (error) { console.error('partner_login_issue', error.message); return json({ ok: true }); }
      if (data?.ok) {
        const sent = await sendViaResend(data.email, buildOtpEmail({ name: data.name, code: data.code }), resend);
        if (!sent.ok) console.error('partner otp email', sent.error);
      }
      // Same answer whether or not the email is a partner, rate-limited, or the mail failed.
      return json({ ok: true });
    }

    // welcome — the caller must be a platform admin; the RPC itself checks is_platform_admin().
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!bearer) return json({ ok: false, reason: 'unauthorized' }, 401);
    const asCaller = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data, error } = await asCaller.rpc('admin_partner_welcome_info', { p_id: parsed.partnerId });
    if (error) return json({ ok: false, reason: /not authorized/i.test(error.message) ? 'unauthorized' : 'server_error' }, /not authorized/i.test(error.message) ? 403 : 500);
    if (!data?.ok) return json({ ok: false, reason: data?.error_code ?? 'not_found' });
    const sent = await sendViaResend(data.email, buildWelcomeEmail({ name: data.name, code: data.code }), resend);
    return sent.ok ? json({ ok: true, sent: true }) : json({ ok: false, reason: sent.error === 'not_configured' ? 'email_not_configured' : 'email_failed' });
  } catch (e) {
    console.error('partner-auth', e instanceof Error ? e.message : String(e));
    return parsed.action === 'start' ? json({ ok: true }) : json({ ok: false, reason: 'server_error' }, 500);
  }
});
