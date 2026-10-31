/**
 * email-health — checks the email system and alerts the platform admins (migration 148).
 *
 * Called by pg_cron every 30 minutes with `x-outbox-secret` (same secret as send-worker), so it is deployed with
 * --no-verify-jwt and fails closed on OUTBOX_CRON_SECRET. The alert goes straight through Resend, never through
 * the outbox it is watching. Logic: ../_shared/email-health.mjs (tested by scripts/test-email-outbox.mjs).
 *
 * Secrets: OUTBOX_CRON_SECRET, RESEND_API_KEY, RESEND_FROM (RESEND_FROM_NOTIFY overrides), optional APP_URL.
 * Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Deno runtime — not the app's TypeScript. Deploy: npx supabase functions deploy email-health --no-verify-jwt
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runHealthCheck } from '../_shared/email-health.mjs';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  const secret = Deno.env.get('OUTBOX_CRON_SECRET') ?? '';
  if (!secret) return json({ ok: false, error: 'OUTBOX_CRON_SECRET not configured' }, 500);
  if (req.headers.get('x-outbox-secret') !== secret) return json({ ok: false, error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return json({ ok: false, error: 'missing service-role env' }, 500);

  const result = await runHealthCheck(createClient(url, serviceKey), {
    apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
    from: Deno.env.get('RESEND_FROM_NOTIFY') || Deno.env.get('RESEND_FROM') || '',
    appUrl: Deno.env.get('APP_URL') ?? 'https://sahakarlekha.com',
  });
  if (result.status === 'error') console.error(`email-health: ${result.error}`);
  return json({ ok: result.status !== 'error', ...result }, result.status === 'error' ? 500 : 200);
});
