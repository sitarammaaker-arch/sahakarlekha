/**
 * send-worker — drains the notification outbox (email slice 1, migration 142).
 *
 * Called by pg_cron every minute with only `x-outbox-secret` (no Authorization), so it is deployed with
 * --no-verify-jwt and gates itself FAIL-CLOSED on OUTBOX_CRON_SECRET (same pattern as scheduled-backup).
 * All the logic is in ../_shared/email-outbox.mjs (runOutbox), tested by scripts/test-email-outbox.mjs.
 *
 * Secrets: OUTBOX_CRON_SECRET, RESEND_API_KEY, RESEND_FROM (RESEND_FROM_NOTIFY overrides it for notifications),
 *   optional APP_URL, OUTBOX_BATCH (default 20), OUTBOX_DAILY_CAP (default 90 — the Resend free tier is 100/day
 *   across every email, invoices included). No Resend key → nothing is claimed; the queue waits.
 * Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Deno runtime — not the app's TypeScript. Deploy: npx supabase functions deploy send-worker --no-verify-jwt
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runOutbox } from '../_shared/email-outbox.mjs';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  const secret = Deno.env.get('OUTBOX_CRON_SECRET') ?? '';
  if (!secret) return json({ ok: false, error: 'OUTBOX_CRON_SECRET not configured' }, 500);
  if (req.headers.get('x-outbox-secret') !== secret) return json({ ok: false, error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return json({ ok: false, error: 'missing service-role env' }, 500);

  const result = await runOutbox(createClient(url, serviceKey), {
    apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
    from: Deno.env.get('RESEND_FROM_NOTIFY') || Deno.env.get('RESEND_FROM') || '',
    appUrl: Deno.env.get('APP_URL') ?? 'https://sahakarlekha.com',
    batch: Number(Deno.env.get('OUTBOX_BATCH')) || 20,
    dailyCap: Number(Deno.env.get('OUTBOX_DAILY_CAP')) || 90,
  });
  if (result.status === 'error') console.error(`send-worker: ${result.error}`);
  return json({ ok: result.status !== 'error', ...result }, result.status === 'error' ? 500 : 200);
});
