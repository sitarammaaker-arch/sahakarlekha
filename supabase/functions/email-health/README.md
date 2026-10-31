# email-health — the email system watches itself (migration 148)

Every 30 minutes this function asks `claim_email_health_alert()` whether the email system is healthy. On a
problem it emails the active **platform admins** directly through Resend (not through the outbox it watches);
it repeats at most every 6 hours while the problem lasts, and sends one "ठीक हो गया" email when it clears.
SuperAdmin → **Emails** shows the same health as a card, read live from the database.

What counts as a problem (`email_health()`):

| signal | alert / warn |
|---|---|
| a `pending` email due more than 15 min ago (worker not draining) | alert |
| a `sending` email whose lease expired more than 10 min ago | alert |
| any pg_net (cron → Edge Function) response in the last 6 h that is not 2xx | alert |
| a failed pg_cron run in the last 24 h | alert |
| `outbox-send-worker`, `compliance-reminders-daily` or `weekly-digest-monday` missing / inactive | alert |
| a spam complaint in the last 24 h | alert |
| a failed or bounced email in the last 24 h | warn (card only, no email) |

If you deliberately unschedule one of the three cron jobs, the card will keep showing it as missing.

## Setup (founder, after migration 148)

Run from the repo root (`D:\Website\sahakarlekha`).

1. Deploy:
   ```bash
   npx supabase functions deploy email-health --no-verify-jwt
   ```
2. Cron (SQL Editor). It copies send-worker's job command, so the secret is never pasted by hand:
   ```sql
   select cron.schedule(
     'email-health-check',
     '*/30 * * * *',
     replace((select command from cron.job where jobname = 'outbox-send-worker'), '/send-worker', '/email-health')
   );
   ```
3. Check once by hand, then read the reply:
   ```sql
   do $$ begin
     execute replace((select command from cron.job where jobname = 'outbox-send-worker'), '/send-worker', '/email-health');
   end $$;
   ```
   ```sql
   select status_code, content from net._http_response order by id desc limit 1;
   ```
   Expect `200` and `{"ok":true,"status":"ok","action":"none" | "alert",...}`.

Limit: if `OUTBOX_CRON_SECRET` itself is wrong, this function is refused too (same header). The SuperAdmin card
still shows the problem, because it reads the database directly.
