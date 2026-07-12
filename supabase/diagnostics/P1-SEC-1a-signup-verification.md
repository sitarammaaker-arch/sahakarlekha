# P1-SEC-1a — Staging Signup Verification Checklist

Run this **on a staging Supabase project** before promoting to production. The
RPC and the `Register.tsx` switch cannot be verified locally (they need the live
`app_register_admin` RPC + a real Supabase Auth signup). Local checks (tsc,
build) only prove the client compiles.

## 0. Deploy to staging
- [ ] Apply `supabase/migrations/006_register_society_rpc.sql` in the staging SQL Editor.
- [ ] Confirm it exists and is grantable:
  ```sql
  select proname, prosecdef
  from pg_proc where proname = 'register_society';           -- prosecdef = true (SECURITY DEFINER)
  select has_function_privilege('anon',
    'public.register_society(text,text,text,text,jsonb,jsonb,jsonb)', 'execute'); -- true
  ```
- [ ] Deploy the frontend build with the updated `Register.tsx`.

## 1. Happy path — a fresh society bootstraps end-to-end
- [ ] Register a brand-new society (unique registration number + unique email).
- [ ] Success screen shows, and `sign_up` analytics event fires.
- [ ] Verify all rows landed, scoped to the new `society_id`:
  ```sql
  -- replace :sid with the new society id (visible in the societies row)
  select count(*) from societies       where id = :sid;                 -- 1
  select count(*) from society_settings where society_id = :sid;        -- 1
  select count(*) from society_users    where society_id = :sid;        -- 1 (the admin)
  select count(*) from accounts         where society_id = :sid;        -- = template account count
  select count(*) from auth.users
    where lower(email) = lower('<admin email>');                        -- 1 (confirmed)
  ```
- [ ] `society_settings` carries the correct `nameHi`, `financialYear`,
      `financialYearStart` (YYYY-04-01), `societyType`, and `gstin` (if entered).
- [ ] Account count equals the template for the chosen society type
      (compare with `SOCIETY_TEMPLATES[societyType]` length).

## 2. Login continuity — the new admin gets a real JWT
- [ ] Log in as the new admin.
- [ ] In DevTools → Network, a `…/rest/v1/…` request carries an
      `Authorization: Bearer <token>` header (real JWT — required for P1-SEC-1b RLS).
- [ ] The society name shows correctly (proves `society_settings` was written).

## 3. Duplicate registration number → clean error, no rows
- [ ] Register with an already-used registration number.
- [ ] UI shows "Registration number already exists…".
- [ ] No new rows in `societies` / `society_settings` / `accounts` / `society_users`.

## 4. Duplicate email → clean error + ATOMIC rollback (no orphan society)
- [ ] Register a NEW society name/registration number but reuse an existing admin email.
- [ ] UI shows "This email is already registered…".
- [ ] Critical: the new society was **rolled back** — confirm no orphan:
  ```sql
  select count(*) from societies where registration_no = '<the reg no you just tried>'; -- 0
  ```
  (This is the improvement over the old flow, which relied on a manual delete.)

## 5. Re-registration guard
- [ ] Attempting to call `register_society` for a `p_society_id` that already
      exists returns `error_code = 'society_exists'` and writes nothing.

## 6. Rollback drill (must be rehearsed before prod)
- [ ] Revert `Register.tsx` (git revert the paired commit) and redeploy the frontend.
- [ ] Run `supabase/migrations/006_register_society_rpc_down.sql`.
- [ ] Confirm signup still works on the reverted (direct-insert) flow.
- [ ] Order matters: revert the client **first**, then drop the function.

## Go / No-Go
- Promote to production only when 1–5 pass on staging and the rollback drill (6) succeeded.
- This unblocks **P1-SEC-1b** (`007_rls_tenant_isolation.sql`): registration no
  longer relies on direct client inserts to `societies` / `society_settings` /
  `accounts`, so those tables can be tenant-scoped without breaking signup.
