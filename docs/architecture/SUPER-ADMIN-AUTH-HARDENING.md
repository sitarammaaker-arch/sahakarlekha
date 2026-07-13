# Super-Admin Auth Hardening — Design (audit P0-1 + P0-3)

- **Status:** Design / plan only. No code. Awaiting prod verification + approval before any slice.
- **Date:** 2026-07-13
- **Fixes:** production-audit **P0-1** (unauthenticated cross-tenant super-admin RPCs) and **P0-3** (localStorage-trusted `isSuperAdmin`/role). They are the same root cause and must be fixed together.

## 1. The problem (confirmed from the repo)

The three platform RPCs are `security definer` (bypass RLS), have **no internal authorization check**, and carry **no `REVOKE … FROM PUBLIC`** in the repo (Postgres defaults new functions to `EXECUTE` for `PUBLIC`):

- `get_all_societies()` — `select … from society_settings` across **every tenant** (`supabase-tables.sql:1001`).
- `get_society_user_counts()` — user counts per society (`:1029`).
- `update_society_subscription(p_society_id, …)` — **writes** any society's plan / `is_locked` / notes (`:1042`).

They are called **bare** from the client — `supabase.rpc('get_all_societies')` (`SuperAdminDashboard.tsx:108`, `MultiSocietyConsolidation.tsx:372`) — with no token.

**Why the obvious fix doesn't work.** The audit's "add a `platform_admins` gate + REVOKE FROM PUBLIC" assumes the caller has an identity to check. But the platform admin **has no Supabase Auth session**: `login()` calls `verify_platform_admin(email, password)` (`AuthContext.tsx:330`), and on success only writes `societyId:'PLATFORM'` to **localStorage** and flips `isSuperAdmin` in React state (`:342-344`). No `supabase.auth.signInWithPassword`. So:

- The dashboard's RPC calls very likely go out as **`anon`** (or whatever stale society session exists) — so a blunt `REVOKE … FROM anon` **breaks the dashboard**.
- The RPC **cannot** gate on `auth.uid()` — it's null for anon.
- `isSuperAdmin` is a client-editable localStorage flag (P0-3): a viewer can set `societyId:'PLATFORM'` and the UI unlocks the SuperAdmin dashboard, whose RPCs then run unguarded (P0-1). **P0-1 and P0-3 chain.**

> Tenant DATA is still protected by JWT-keyed RLS (`get_current_society_id()` reads `society_users`, ignoring localStorage). The exposure is specifically these three PUBLIC definer RPCs.

## 2. Prod verification (run these first — the RPC grants + `verify_platform_admin` body live only in prod)

```sql
-- (a) Who can EXECUTE the three RPCs? proacl = NULL means default PUBLIC EXECUTE (the exploit).
select proname, proacl
from pg_proc
where proname in ('get_all_societies','get_society_user_counts','update_society_subscription');

-- (b) The verify_platform_admin body (not in the repo) — does it check a password, and where do
--     platform-admin credentials live (platform_admins table? auth.users?).
select prosrc from pg_proc where proname = 'verify_platform_admin';

-- (c) platform_admins shape + whether admins already exist in auth.users.
select column_name, data_type from information_schema.columns where table_name = 'platform_admins';
select email from platform_admins;                         -- the admin emails
select email from auth.users where email in (select email from platform_admins);  -- already Auth users?
```

Paste the results back; they decide the exact migration (esp. whether platform admins are already `auth.users`).

### 2.1 Confirmed prod results (2026-07-13)

- **(a) Grants — EXPLOIT CONFIRMED.** All three RPCs have `proacl = {=X/postgres, postgres=X/…, anon=X/…, authenticated=X/…, service_role=X/…}`. The leading `=X/postgres` is a grant to **PUBLIC** — i.e. anon **and** authenticated can `EXECUTE` all three. Any unauthenticated caller can read every tenant's `society_settings` and write any society's plan / `is_locked`.
- **(b) `verify_platform_admin` — plaintext password (NEW, worse finding).** Body is:
  ```sql
  select email, name from platform_admins
  where email = p_email and password = p_password and is_active = true;
  ```
  Credentials are compared as **plaintext** (`password = p_password`) — no bcrypt, and `platform_admins.password` stores the password in clear. It returns only `email, name`; it does **not** mint a JWT → confirms the client runs as **anon**.
- **(c) Admin already in Auth.** `sitaram.maaker@gmail.com` **exists in `auth.users`** → S1 (enrol admins in Auth) is effectively already done; only the login path and RPC gate remain.

### 2.2 What the results change

- The §6 anon-safe interim is **NOT viable** — calls are confirmed **anon**, so `REVOKE … FROM anon` breaks the dashboard. We must give the admin a real session first.
- But S1 is done (admin ∈ auth.users), so the plan collapses to **S2 (real login) + S3 (gate+revoke), shipped together**, then S4 cleanup.
- **New work item:** `platform_admins.password` is plaintext. Once `verify_platform_admin` is retired for login (S4), **drop that column** (or null it). Track as part of this hardening.
- **Prerequisite for S2:** the admin must be able to `signInWithPassword` as `sitaram.maaker@gmail.com` — i.e. know (or reset) that `auth.users` password. It may differ from the plaintext `platform_admins.password`.

## 3. Target design — platform admins become real Supabase Auth users

This is the codebase's own direction: the legacy JWT-less `app_login` RPC was **retired** (P1-SEC-4, `AuthContext.tsx:351`) precisely because "it established no Supabase Auth session… every active user is enrolled in Supabase Auth." Platform admins are the last JWT-less holdout. Fix by bringing them onto the same rail:

1. **Platform admins are `auth.users`** with a marker (a row in `platform_admins` keyed by the auth email/uid, or an `app_metadata.role = 'platform_admin'` claim).
2. **Login uses `supabase.auth.signInWithPassword`** → a real JWT session. `verify_platform_admin` (password-in-a-definer-RPC) is retired for login, mirroring `app_login`.
3. **`isSuperAdmin` is derived from the verified session** (the JWT marker / a `select 1 from platform_admins where email = auth.jwt()->>'email'`), **never from localStorage**. (Fixes P0-3.)
4. **The three definer RPCs gate on the authenticated identity** and are locked down:
   ```sql
   -- inside each function, first statement:
   if not exists (select 1 from platform_admins where email = auth.jwt()->>'email') then
     raise exception 'not authorized' using errcode = '42501';
   end if;
   -- and at the bottom of the migration:
   revoke execute on function get_all_societies()            from public, anon;
   revoke execute on function get_society_user_counts()      from public, anon;
   revoke execute on function update_society_subscription(text,text,timestamptz,boolean,text) from public, anon;
   grant  execute on function get_all_societies()            to authenticated;
   grant  execute on function get_society_user_counts()      to authenticated;
   grant  execute on function update_society_subscription(text,text,timestamptz,boolean,text) to authenticated;
   ```
   Now only an authenticated user **whose email is in `platform_admins`** can run them — anon can't, and an authenticated ordinary tenant user is rejected by the in-function check.

## 4. Slice plan (safe, reversible; each its own approval + deploy + prod step)

- **S0 · Verify (no code).** Run §2. Confirm the PUBLIC grants and whether admins are already `auth.users`. Gate the rest on this.
- **S1 · Enrol platform admins in Auth.** Create/confirm the `auth.users` account(s) for each platform-admin email; keep `platform_admins` as the marker table. (Mostly ops + a small migration.) No client change yet.
- **S2 · Real admin login.** Switch `login()`'s platform-admin branch to `signInWithPassword`; derive `isSuperAdmin` from the session marker, not localStorage. Keep the old localStorage path behind a flag for one release (dual-support), then remove. (Fixes P0-3.)
- **S3 · Gate + lock the RPCs.** Add the in-function `platform_admins` check to all three + `REVOKE … FROM public, anon` / `GRANT … TO authenticated` (one migration). Deploy **after** S2 is live and proven, so the dashboard calls as an authenticated admin. (Fixes P0-1.)
- **S4 · Cleanup.** Retire `verify_platform_admin` as a login path (like `app_login`); remove the localStorage `isSuperAdmin` fallback.

**Ordering is load-bearing:** S2 (admin has a real session) must ship and be proven **before** S3 (RPCs reject the old anon path), or the SuperAdmin dashboard breaks. Each S is per-tenant-irrelevant (platform-global) but should be soaked between S2 and S3.

## 5. Risks / rollback

- **Lock-out risk:** if S3 ships before every platform admin can log in via S2, admins lose the dashboard. Mitigation: strict S2-before-S3 ordering + soak; keep a break-glass (a manually-granted service-role path) during transition.
- **Rollback:** S3 is a single migration — `grant execute … to public` restores the old (insecure) behaviour if the dashboard breaks; revert S2 client change. Reversible.
- **MFA (audit H3):** platform-admin login is currently password-only; once on real Auth (S2), TOTP MFA can be layered on the same as society users — a follow-up.

## 6. Interim mitigation (optional, if prod confirms PUBLIC + calls are NOT anon)

If §2(a) shows PUBLIC grants **and** §2(b/c) shows the dashboard already calls as an authenticated session (not anon), a **one-migration interim** — add the in-function `platform_admins` check + `REVOKE FROM public, anon; GRANT TO authenticated` — closes the hole immediately without the S1/S2 auth rework. Only viable if the calls are already authenticated; §2 tells us.
