# scheduled-backup — the off-vendor copy (T-36 / DP-P4)

Every society's backup currently lives in **one bucket at one vendor** (Supabase Storage).
That is one outage — or one ransomware event, or one account closure — from total loss. The
code to fix it is already deployed; it is **dormant until the env below is set**.

This runbook is the whole job. It takes ~10 minutes and, at this data's scale, **costs ₹0**.

## Why R2 (and why it's free here)

Cloudflare R2 / AWS S3 / Backblaze B2 all speak the S3 API, so **the code does not care** —
the vendor is configuration. R2 is the pragmatic pick: **free egress** (so a restore never
costs) and a **10 GB free tier**.

Scale check: retention keeps ~24 files per society (12 recent + 12 monthly anchors); the
largest society's archive is ~325 KB. So ≈ **130 MB total** — comfortably inside the free
tier, with ~75× headroom.

## 1. Create the bucket + token (Cloudflare dashboard)

1. **R2 → Create bucket** — e.g. `sahakarlekha-backups`. Keep it **private**.
2. **R2 → Manage R2 API Tokens → Create API token**
   - Permission: **Object Read & Write**
   - Scope it to **that bucket only** (not "all buckets").
3. Copy the three values it shows **once**:
   - `Access Key ID`
   - `Secret Access Key`
   - the **S3 endpoint**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
     (the account-id form — *not* the `*.r2.dev` public URL)

> **Gotcha:** R2's region is literally the string `auto`. Any other value fails SigV4.

## 2. Declare where the copies physically live

The code **never guesses** a region or jurisdiction — an invented one would silently suppress
a real residency deficiency (ADR-0009) and turn Backup Health green on nothing. So you must
declare both copies. Find the primary's region in **Supabase → Project Settings → General →
Region**.

## 3. Set the secrets

Run from the repo root (`D:\Website\sahakarlekha`) — a home-dir run has picked a stray
inactive project before. Use `npx supabase` (a global install is dead on this machine).

```bash
npx supabase secrets set \
  BACKUP_S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com" \
  BACKUP_S3_BUCKET="sahakarlekha-backups" \
  BACKUP_S3_REGION="auto" \
  BACKUP_S3_ACCESS_KEY_ID="<key-id>" \
  BACKUP_S3_SECRET_ACCESS_KEY="<secret>" \
  BACKUP_S3_PROVIDER="cloudflare-r2" \
  BACKUP_S3_JURISDICTION="in" \
  BACKUP_PRIMARY_PROVIDER="supabase-storage" \
  BACKUP_PRIMARY_REGION="<your Supabase region, e.g. ap-south-1>" \
  BACKUP_PRIMARY_JURISDICTION="in"
```

Set `*_JURISDICTION` to where the bucket **actually is**. If R2's location is not in the
society's jurisdiction, say so — the verdict is then *supposed* to flag it.

## 4. Deploy

```bash
npm run build:backup-core          # only if src/lib backup code changed
npx supabase functions deploy scheduled-backup --no-verify-jwt
```

> **`--no-verify-jwt` is critical.** The cron calls with only `x-backup-secret` and no
> `Authorization` header; without the flag the gateway 401s the cron silently.
>
> **Stale-upload tell:** the CLI prints the files it uploads. If `_shared/*.mjs` is missing
> from that list, it shipped a stale tree — regenerate the bundle and redeploy.

## 5. Trigger a run and verify

The weekly cron (`weekly-society-backup`, Sun 02:00 UTC) will pick it up, but to test now, run
the live job's own command from the SQL editor:

```sql
do $$ begin execute (select command from cron.job where jobname = 'weekly-society-backup'); end $$;
```

Then check what the run recorded — this is the proof:

```sql
select created_at,
       after->>'offVendor'      as off_vendor,     -- 'landed' | 'failed: …' | 'not configured'
       after->'placement'       as placement,      -- the 3-2-1 verdict
       after->'placementUnevaluated' as why_not    -- null once fully declared
from audit_log
where action = 'export' and actor_name = 'scheduled-backup'
order by created_at desc limit 5;
```

**Success looks like:** `off_vendor = 'landed'`, and `placement` present with
`providers: 2`. Then open **Backup Health** in the app — it reads that verdict and will stop
saying *"the copy placement has never been evaluated"*.

## What the verdict will still say (and why that's correct)

With two copies you will see a remaining deficiency: **`needs ≥3 copies, has 2`**. That is the
3-2-1 rule being honest — 3 copies, 2 providers, 1 off-site. Two providers already removes the
single-vendor total-loss risk, which is the whole point of this step; the third copy (e.g. an
offline/air-gapped vault, BK-4) is a later, smaller improvement.

Backup Health therefore stays **amber**, not green. That is by design: it never claims safety
it cannot prove.

## Rollback

Unset any one of the four `BACKUP_S3_*` credentials and redeploy — replication silently stops,
the primary backup is unaffected, and the card returns to reporting the single-vendor placement.
A replication failure **never** fails a backup: the primary bytes are already safe, so the loss
shows up in the verdict instead.

## Still open (not this runbook)

- **WORM / object-lock** on the copies (BK-4). Note it **conflicts with `applyRetention`**,
  which hard-deletes objects when `BACKUP_RETENTION=delete` — a hard delete and a write-once
  guarantee cannot both be true. Retention must respect the lock window.
- **Key escrow** — scheduled backups are unencrypted by decision D3; client backups have no
  escrow by design (`BackupRestore.tsx`). That is the BK-5 "lost key = lost data" trade-off,
  deliberately taken.
