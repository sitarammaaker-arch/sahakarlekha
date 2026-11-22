# Disaster recovery — restoring a society into another (or a new) Supabase project

**Status:** proven by the DB-10 restore drill on 2026-11-22 (staging project, practice society). This is the
procedure that worked, with every trap the drill hit. Read it before you need it.

## What a backup is, and what it is not

- Every society is backed up by `scheduled-backup` (hourly job `society-backup-due`, each society when its newest
  archive is older than ~6 days): one `.slbak` file per run, **encrypted** with `BACKUP_ENCRYPTION_PASSPHRASE`
  (AES-256-GCM, PBKDF2-SHA256 600k), stored in Supabase Storage (`backups/<societyId>/<file>`) **and** copied to
  Backblaze B2 (EU Central, `BACKUP_S3_*`). The audit row (`audit_log`, actor `scheduled-backup`) records
  `encrypted` and `offVendor: "landed"`.
- `scheduled-rehearsal` (weekly) opens the newest archive **on the server** and checks it reproduces the books.
  A passing rehearsal proves the file and the SERVER's key — **not** the copy of the key you hold. (The drill found
  exactly that: rehearsals passed while the founder's offline copy was a different key.)
- **Not in a backup** (`backupPolicy: 'exclude'` in `src/lib/export/entities/platform.ts`): the `societies` row,
  `society_users`, Supabase Auth users, subscriptions / orders / invoices, partner tables. A recovery recreates the
  society and its admin first (step 3), then restores the books into it.

## 0. Check your key BEFORE you need it (do this now, and after every key change)

The server key cannot be read back — Supabase shows only its SHA-256 fingerprint.

1. Fingerprint of the server's key: `npx supabase secrets list` → the `BACKUP_ENCRYPTION_PASSPHRASE` value is a
   SHA-256 hex digest.
2. Fingerprint of YOUR copy (PowerShell, the key is typed hidden and never printed):

   ```powershell
   $s = Read-Host "Backup key" -AsSecureString; $p = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)); (([System.Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($p))) | ForEach-Object { $_.ToString("x2") }) -join ''
   ```
3. They must be identical. If not, your copy is not the key: set a new one (dashboard → Edge Functions →
   Secrets → `BACKUP_ENCRYPTION_PASSPHRASE`; paste, no quotes) **after** saving it in two places, and take a fresh
   backup. Archives sealed with the old key cannot be opened by anyone once it is replaced.

## 1. Get the file (off-site copy)

Backblaze B2 → the backup bucket → **Browse Files** → folder `<societyId>` → newest `…<YYYYMMDD>T<HHMMSS>Z.slbak`.
The audit row's `byteSize` is the expected file size. The newest *landed* file per society:

```sql
select created_at, after->>'filename', after->>'byteSize', after->>'offVendor'
  from public.audit_log where actor_name = 'scheduled-backup' and society_id = '<id>' order by created_at desc limit 3;
```

To take a backup of one society right now (production SQL Editor; reuses the job's own command, so its secret is
never typed): `docs/ops/backup-one-society.sql` with `<SOCIETY_ID>` filled in.

## 2. A database at production's schema

- **The target must carry every migration production has applied.** Compare with the snapshot:
  `supabase/schema/production-schema.txt` lists `applied_migration NNN` lines and every table / function.
- The drill's staging project was at 153 with gaps; it was brought to 201 by running the missing migrations in
  order (150, 154 → 201), in three guarded parts, through the SQL Editor. After that the schema diff was empty
  (0 tables, columns, functions, constraints, indexes, triggers, policies missing).
- A brand-new empty project: run `supabase-tables.sql` (the bootstrap; it refuses on a non-empty database), then
  every numbered migration in order (no `_down` files). `pg_cron` / `pg_net` are optional for a restore — the
  cron blocks in 159 / 174 skip themselves when the extension is absent.
- Edge functions and secrets are NOT needed to restore books; they are needed to run the product afterwards
  (deploy `supabase/functions/*`, set the secrets listed by `npx supabase secrets list` in the old project).

## 3. Recreate the society and its admin

Register the society in the app on the target project (`/register`) with the admin's e-mail. Registration seeds a
`society_settings` row and the standard chart — that is expected (see the Replace note below).

## 4. Restore

App → **Restore Center** (admin):

1. Choose the `.slbak` → enter the key → **Unlock** → "Verified — N collections, M rows, no tampering".
2. Cross-society confirmation: type the archive's society name exactly (allowed only while the target society's
   books are empty — no voucher, no member).
3. Dry run: choose **Replace — the archive wins** → *Show what would change*. It deletes the seeded chart accounts
   the archive does not have; that is correct. (**Fresh** currently refuses here because registration already
   created `society_settings` and the chart — see "Known gaps".)
4. **1. Create safety backup** → type the target society's name → **Run REPLACE restore**.
   Expect: "Restore complete — N collections, M rows, K ledger entries regenerated."

## 5. Prove it

Compare the restored society with the source (or the archive's manifest). The drill compared, read-only on both
sides: vouchers (all / live), members, accounts, voucher_entries (count, Σdr = Σcr), posted voucher_lines, stock
items / movements, and an md5 of every account's trial-balance balance. **All matched.**

## What the drill found (2026-11-22)

| Finding | Effect | Fixed |
|---|---|---|
| The founder's saved key was not the server's key | Every encrypted backup unopenable by the owner | Key replaced, fingerprints matched, fresh backup |
| Restore replay compared entry **IDs**: a voucher with no `lines` replays as `<id>-<id>-dr/-cr`, the server writes `<id>-1/-2` | No restore of a society with such vouchers could complete (10 receipts, identical amounts) | `compareReplay` pairs unmatched entries by content within the same voucher (fix/restore-replay-id-agnostic) |
| Staging was 48 migrations behind production | A restore there failed before it started | Staging brought to 201; diff now empty |
| `societies` / `society_users` / auth are not in a backup | A recovery must recreate the society + admin by hand | Documented (step 3) |

## Known gaps (open)

- **Fresh mode into a newly registered society** refuses (`society_settings` 1 row, chart already seeded). Replace
  works and is the documented path; Fresh should accept the registration seed when the society has no voucher and
  no member.
- Platform data (subscriptions, invoices, partners) has no recovery path from society archives.
- Restore Center lists the server's own audit row as "written on the server (no app record)".
