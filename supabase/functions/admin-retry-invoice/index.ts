/**
 * admin-retry-invoice — SuperAdmin "retry" for an order that is paid but has no invoice yet.
 *
 * The caller must be a verified platform admin: their JWT is checked with getUser(), must have passed 2FA
 * (SEC-03), and is_platform_admin() (019/085) is evaluated AS THEM. Only then does the service-role client
 * run the same issuer the webhook uses (_shared/issue-invoice.mjs → issue_invoice, migration 130), which is
 * idempotent per order — a double click never issues two invoices or burns a number.
 *
 * Slice 4 (migration 134): an invoiced order is also emailed if it has not been yet (same claim as the webhook);
 * resend_email: true sends it again even if it was sent ("Email फिर भेजें").
 *
 * Body: { order_id, resend_email? }  →  { status, invoice_no?, error?, email?: { status, to?, error? } }
 * Secrets for the email: RESEND_API_KEY, RESEND_FROM (optional APP_URL). Unset → email status not_configured.
 * Auto-injected: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 * Deno runtime — not the app's TypeScript. Deploy (JWT verification ON): npx supabase functions deploy admin-retry-invoice
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { issueInvoiceForOrder } from '../_shared/issue-invoice.mjs';

// SEC-03 (migration 085): a token that still owes a 2FA code gets nothing (unreadable → pending).
const mfaPending = (t: string): boolean => {
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).mfa_pending === true; } catch { return true; }
};

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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { order_id, resend_email } = await req.json().catch(() => ({}));
    if (!order_id || typeof order_id !== 'string') return json({ error: 'order_id required' }, 400);

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!bearer || bearer === anonKey) return json({ error: 'Please sign in again' }, 401);
    if (mfaPending(bearer)) return json({ error: '2FA required — finish the 2FA step and sign in again' }, 403);

    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authErr } = await asCaller.auth.getUser(bearer);
    if (authErr || !authData?.user) return json({ error: 'Please sign in again' }, 401);
    const { data: isAdmin, error: adminErr } = await asCaller.rpc('is_platform_admin');
    if (adminErr || isAdmin !== true) return json({ error: 'Platform admin only' }, 403);

    const supa = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    return json(await issueInvoiceForOrder(supa, order_id, {
      email: {
        apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
        from:   Deno.env.get('RESEND_FROM') ?? '',
        appUrl: Deno.env.get('APP_URL') ?? 'https://sahakarlekha.com',
        force:  resend_email === true,
      },
    }));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
