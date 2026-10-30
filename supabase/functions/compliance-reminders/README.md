# compliance-reminders — statutory due-date emails (email slice 4)

Once a day this function works out which compliance items are due **in 7 days, in 2 days, or today** and
queues one `compliance_due` email per item for every active **admin** of the society. `send-worker` sends
them — only to addresses the admin has verified. The email carries the item, period, due date, days left
and a count. **Never an amount.**

Only items whose date is fixed by a text we have read are emailed (`COMPLIANCE_SOURCES` in
`src/lib/complianceReminders.ts`):

| item | source | who |
|---|---|---|
| TDS deposit (7th; March → 30 April) | Income-tax Rules 2026, r.218(2) | societies with a TAN |
| Form 138 (old 24Q) quarterly statement | Income-tax Rules 2026, r.219(1), r.219(4) | societies with a TAN |
| Co-operative statutory audit (30 Sep) | Haryana Act 1984 s.95 (2013 amendment) + Rules 1989 r.2(c) | Haryana societies only |

Not emailed yet (no source text read): EPF, ESI, GSTR-1, GSTR-3B, Income-tax return. The in-app calendar
still shows them.

Marking an item **फाइल हुआ** on the Compliance Calendar (`compliance_filings`) stops its reminders.

## Order of steps (founder)

Needs migrations 142–144 and a working `send-worker` first.

1. **Migration** — SQL Editor → new query → paste `supabase/migrations/145_compliance_reminders.sql` →
   plain **Run**, then its VERIFY query (expect `2 | 0 | 1`).
2. **Deploy** (from a checkout at `origin/main`; it reuses `OUTBOX_CRON_SECRET`, no new secret):
   ```bash
   npx supabase functions deploy compliance-reminders --no-verify-jwt
   ```
   Smoke test: a call with no header must return `{"ok":false,"error":"unauthorized"}`.
3. **Cron** — once a day at 01:30 UTC = 07:00 IST. Same secret as the send-worker cron:
   ```sql
   select cron.schedule(
     'compliance-reminders-daily',
     '30 1 * * *',
     $$
     select net.http_post(
       url     := 'https://<project-ref>.functions.supabase.co/compliance-reminders',
       headers := jsonb_build_object('content-type', 'application/json', 'x-outbox-secret', '<same-secret>'),
       body    := '{}'::jsonb
     );
     $$
   );
   ```

## Check it works

```sql
select template_key, status, last_error, payload->>'item_id' as item, payload->>'due_date' as due, created_at
from notification_outbox where template_key = 'compliance_due' order by created_at desc limit 20;
```

The function's own answer (`net._http_response`) has `{ day, societies, items, enqueued }`. A missed day can be
re-run by POSTing `{"today":"YYYY-MM-DD"}` with the secret header.

## Rollback

`select cron.unschedule('compliance-reminders-daily');` stops new reminders.
`145_compliance_reminders_down.sql` removes the two functions.
