# weekly-digest — Monday summary email for admins (email slice 5)

Every Monday at 07:00 IST this function queues one `weekly_digest` email for every active **admin** of each
society. `send-worker` sends them — only to addresses the admin has verified. **Counts only, never an amount:**

| line | how it is counted (migration 146, `weekly_digest_counts`) |
|---|---|
| vouchers entered this week | vouchers whose `createdAt` falls in the 7 IST days before the run day |
| days since the last voucher | IST days since the newest voucher's `createdAt` (none ever → "no voucher yet") |
| vouchers waiting for approval | `approvalStatus = 'pending'` |
| compliance items due in 14 days | sourced, unfiled items only (`dueWithinCount`, same engine and sources as slice 4) |
| users not verified | active staff logins whose address is not verified (shown only when > 0) |

Soft-deleted vouchers (`isDeleted`) are never counted. A society with **no voucher this week, nothing pending
and nothing due gets no email** (checked in the function and again in SQL). The template refuses any payload
field outside its fixed list, so an amount cannot reach the email.

Idempotency key: `weekly_digest:<society>:<email>:<ISO week>` — a re-run in the same week sends nothing new.

## Order of steps (founder)

Needs migrations 142–145 and a working `send-worker` first.

1. **Migration** — SQL Editor → new query → paste `supabase/migrations/146_weekly_digest.sql` → plain **Run**,
   then its VERIFY query (expect `3 | 0 | 1`).
2. **Deploy** (from a checkout at `origin/main`; it reuses `OUTBOX_CRON_SECRET`, no new secret):
   ```bash
   npx supabase functions deploy weekly-digest --no-verify-jwt
   ```
   Smoke test: a call with no header must return `{"ok":false,"error":"unauthorized"}`.
3. **Cron** — Monday 07:00 IST = Monday 01:30 UTC (`30 1 * * 1`). Copy the send-worker job's command (job 10),
   so nobody handles the secret:
   ```sql
   select cron.schedule(
     'weekly-digest-monday',
     '30 1 * * 1',
     replace((select command from cron.job where jobid = 10), '/send-worker', '/weekly-digest')
   );
   ```

## Check it works

```sql
select status, last_error, recipient, payload->>'week' as week, payload->>'vouchers_week' as vouchers,
       payload->>'pending_approval' as pending, created_at
from notification_outbox where template_key = 'weekly_digest' order by created_at desc limit 20;
```

The function's own answer (`net._http_response`) has `{ day, week, societies, quiet, enqueued }`. A missed
Monday can be re-run by POSTing `{"today":"YYYY-MM-DD"}` with the secret header.

## Rollback

`select cron.unschedule('weekly-digest-monday');` stops new digests.
`146_weekly_digest_down.sql` removes the three functions.
