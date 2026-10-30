/**
 * weekly-digest — queues the Monday summary email for every society's admins (email slice 5, migration 146).
 *
 * Called by pg_cron once a week with only `x-outbox-secret` (no Authorization), so it is deployed with
 * --no-verify-jwt and gates itself FAIL-CLOSED on OUTBOX_CRON_SECRET (same secret and header as send-worker).
 * It only QUEUES rows; send-worker sends them (verified addresses only). Counts only — never an amount. All
 * the logic is in ../_shared/weekly-digest.mjs (runWeeklyDigest) + the bundled engine compliance-core.mjs,
 * tested by scripts/test-weekly-digest.mjs.
 *
 * Optional body {"today":"YYYY-MM-DD"} overrides the date (for a manual re-run of a missed Monday).
 * Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Deno runtime — not the app's TypeScript. Deploy: npx supabase functions deploy weekly-digest --no-verify-jwt
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { runWeeklyDigest } from '../_shared/weekly-digest.mjs';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  const secret = Deno.env.get('OUTBOX_CRON_SECRET') ?? '';
  if (!secret) return json({ ok: false, error: 'OUTBOX_CRON_SECRET not configured' }, 500);
  if (req.headers.get('x-outbox-secret') !== secret) return json({ ok: false, error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return json({ ok: false, error: 'missing service-role env' }, 500);

  let today: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today)) today = body.today;
  } catch { /* no body → today in India */ }

  const result = await runWeeklyDigest(createClient(url, serviceKey), { today });
  if (result.status === 'error') console.error(`weekly-digest: ${result.errors.join(' | ')}`);
  return json({ ok: result.status !== 'error', ...result }, result.status === 'error' ? 500 : 200);
});
