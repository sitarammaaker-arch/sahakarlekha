/**
 * resend-webhook — Resend delivery events → outbox delivery status + suppression (email slice 3, migration 144).
 *
 * Resend calls this with no Authorization header, so it is deployed with --no-verify-jwt and trusts ONLY a
 * valid Svix signature (RESEND_WEBHOOK_SECRET, the "whsec_…" value Resend shows for the endpoint). Unset secret →
 * every call is refused (fail-closed). All logic is in ../_shared/resend-webhook.mjs (tested by
 * scripts/test-email-outbox.mjs).
 *
 * Subscribe the endpoint to: email.delivered, email.delivery_delayed, email.bounced, email.complained.
 * A 2xx tells Resend to stop retrying; a 5xx (database error) makes it retry later.
 * Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Deno runtime — not the app's TypeScript. Deploy: npx supabase functions deploy resend-webhook --no-verify-jwt
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifySvix, handleResendEvent } from '../_shared/resend-webhook.mjs';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);
  const raw = await req.text();
  const v = await verifySvix(Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '', {
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
  }, raw);
  if (!v.ok) return json({ ok: false, error: v.reason }, v.reason === 'secret_not_configured' ? 500 : 401);

  let event: unknown;
  try { event = JSON.parse(raw); } catch { return json({ ok: false, error: 'bad json' }, 400); }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return json({ ok: false, error: 'missing service-role env' }, 500);

  const result = await handleResendEvent(createClient(url, serviceKey), event);
  if (result.status === 'error') {
    console.error(`resend-webhook: ${result.error}`);
    return json({ ok: false, ...result }, 500);
  }
  return json({ ok: true, ...result });
});
