# send-worker — the notification outbox sender (email slice 1)

Migration 142 adds the queue (`notification_outbox`), the suppression list and the verified-email gate. This
function sends what is queued. **Nothing is sent to an address until its owner verifies it** — the
verification email itself is the only exception.

## Order of steps (founder)

Run every command from the repo root (`D:\Website\sahakarlekha`).

1. **Migrations** — paste `supabase/migrations/142_notification_outbox.sql` into the SQL Editor → plain **Run**,
   then its VERIFY query (expect `3 | 3 | 0 | 6 | 1`). Then a NEW query with
   `143_notification_triggers.sql` → **Run**, then its VERIFY (expect `3 | 3 | 1`).
   From 143 on, adding a user / changing a role / requesting or doing an FY unlock queues an email
   (the invite goes out even unverified — it carries the verification link; the rest only to verified addresses).
2. **Resend** — domain `notify.sahakarlekha.com` verified, and `RESEND_API_KEY` + `RESEND_FROM` set
   (see the email plan). Optional: a separate sender for notifications:
   ```bash
   npx supabase secrets set "RESEND_FROM_NOTIFY=सहकार लेखा <no-reply@notify.sahakarlekha.com>"
   ```
3. **Cron secret** — any long random string (e.g. from a password manager):
   ```bash
   npx supabase secrets set OUTBOX_CRON_SECRET=<long-random-string>
   ```
4. **Deploy** (from a checkout at `origin/main`):
   ```bash
   npx supabase functions deploy send-worker --no-verify-jwt
   ```
   > `--no-verify-jwt` is required: the cron sends only `x-outbox-secret`. Without it the gateway 401s
   > every run silently. Smoke test: a call with no header must return `{"ok":false,"error":"unauthorized"}`
   > (the function's own answer), not "Missing authorization header".
5. **Cron** — SQL Editor, replace both placeholders:
   ```sql
   select cron.schedule(
     'outbox-send-worker',
     '* * * * *',
     $$
     select net.http_post(
       url     := 'https://<project-ref>.functions.supabase.co/send-worker',
       headers := jsonb_build_object('content-type', 'application/json', 'x-outbox-secret', '<same-secret>'),
       body    := '{}'::jsonb
     );
     $$
   );
   ```

## Check it works

In the app: user menu → **ईमेल सत्यापन** → **लिंक भेजें**. Within a minute:

```sql
select template_key, recipient, status, attempts, last_error, sent_at
from notification_outbox order by created_at desc limit 10;
```

`status = 'sent'` and the email arrives → click the link → the app shows "ईमेल सत्यापित".

| status | meaning |
|---|---|
| `pending` | waiting (or waiting for a retry: 1m → 5m → 30m → 2h) |
| `sending` | leased by a run; an expired lease is picked up again (Idempotency-Key stops a double send) |
| `sent` | accepted by Resend |
| `failed` | permanent error, or 5 attempts used |
| `skipped` | recipient never verified their address |
| `suppressed` | address is in `email_suppression` (bounce / complaint / manual) |

## Rollback

`select cron.unschedule('outbox-send-worker');` stops sending; queued rows just wait.
`142_notification_outbox_down.sql` removes the tables and functions.
