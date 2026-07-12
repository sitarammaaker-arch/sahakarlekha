# scheduled-rehearsal — T-35 server half (deploy & schedule)

Automated restore rehearsal. Proves, on a schedule, that each society's latest `.slbak`
backup restores to the same **books** — writing an append-only `rehearse` evidence row to
`audit_log` that `backupHealth` projects into the green/amber verdict the UI reads. See the
function header for the read-only / privacy (CL-6) guarantees.

## Prerequisites

- `scheduled-backup` is already deployed and producing archives in the private `backups`
  bucket (this function rehearses whatever that produced).
- The bundle is current: `npm run build:rehearsal-core` (regenerate after any change to the
  backup/restore libs or the registry; `npm run test:rehearsal-core-bundle` guards drift).

## Deploy

```bash
# from repo root, with the Supabase CLI linked to the project
supabase functions deploy scheduled-rehearsal
```

## Secrets (fail-closed)

The function REFUSES every call unless `BACKUP_CRON_SECRET` is set (unlike the older
scheduled-backup, which was briefly open until its secret was configured). Reuse the SAME
secret the backup cron uses:

```bash
supabase secrets set BACKUP_CRON_SECRET=<same-value-as-scheduled-backup>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge Functions automatically.

## Schedule (pg_cron + pg_net)

Run it **after** the weekly backup so the archive being rehearsed is fresh. Example: backup
Sunday 02:00 UTC, rehearsal Sunday 03:00 UTC.

```sql
select cron.schedule(
  'weekly-restore-rehearsal',
  '0 3 * * 0',
  $$
  select net.http_post(
    url     := 'https://<project-ref>.functions.supabase.co/scheduled-rehearsal',
    headers := jsonb_build_object(
      'content-type',   'application/json',
      'x-backup-secret', '<same-value-as-scheduled-backup>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

## Manual test (one society)

```bash
curl -s -X POST 'https://<project-ref>.functions.supabase.co/scheduled-rehearsal' \
  -H 'content-type: application/json' \
  -H 'x-backup-secret: <secret>' \
  -d '{ "societyId": "<id>" }'
```

Expected: `{ ok, results: [{ societyId, ok, passed, backup, mismatchAccounts, mismatchItems,
recorded }] }`. After a successful run the society's Backup card health goes (and stays)
green across reloads, because fresh `rehearse` evidence now exists.
