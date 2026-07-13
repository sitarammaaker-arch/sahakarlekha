# localStorage-Trusted Role — Hardening Design (audit P0-3, general-user part)

- **Status:** Design / plan only. No code. The super-admin part of P0-3 is already fixed (see
  `SUPER-ADMIN-AUTH-HARDENING.md`); this covers the **regular society-user role**.
- **Date:** 2026-07-13

## 1. The problem (confirmed from the code)

A logged-in user's `role` and `societyId` are read from **client-editable localStorage**:

- `restoreSession()` (`AuthContext.tsx:102-120`) builds the initial `user` from the stored session —
  including `role` — so on first paint the app trusts whatever localStorage says.
- The mount effect (`:165-208`) *does* re-derive from the **verified JWT session** (`getSession()` →
  `society_users` lookup → `buildUser(data)` with the DB role), which corrects a forged role once it
  runs. **But** two gaps remain:
  1. a brief window between first paint and that async correction, and
  2. the **offline fallback** — if the `society_users` read fails (network), the catch keeps the
     localStorage session (`:205-207`), so a forged role persists.

Deeper, and more important than localStorage itself: **role enforcement is client-side.**
`guardPermission(permission, action)` (`DataContext.tsx:567`) checks `userRef.current?.role`. And the
tenant RLS is **not role-scoped** — ~35 of the schema's policies are `using (true)` + a `society_id`
filter (P1-SEC-1), which bound the *tenant* but not the *role*. So even with the localStorage vector
closed, a determined user can bypass `guardPermission` entirely (edit the bundle, or call
`supabase.from(...).delete()` directly with their real JWT) and RLS will **not** stop a role-violating
write — only a cross-tenant one.

## 2. Threat model — what is / isn't exposed

- **Cross-tenant read/write: NOT possible.** RLS keys on the JWT → `society_users` (P1-SEC-1, live),
  independent of localStorage. A user can never touch another society's data. This is the important
  boundary and it holds.
- **Privilege escalation WITHIN a tenant: possible.** A `viewer`/`accountant` can (a) trivially, by
  editing localStorage `role` → `admin`, get the admin UI and — because mutations are only
  client-role-gated — perform admin-only actions (e.g. delete vouchers) on **their own** society; or
  (b) even without the UI, call Supabase directly, since RLS doesn't check role. Severity: medium
  (in-tenant integrity, not a data-confidentiality breach).

## 3. Target design — make the role tamper-proof and enforce it server-side

Two layers; ship A first (safe), then B (the real fix).

### Layer A — client: never trust the localStorage role for a security decision
- Derive `role`/`societyId` **only** from the verified session. Keep localStorage as an optimistic
  *paint* value, but treat the DB-derived value (from the mount effect) as authoritative, and when
  the `society_users` read is unavailable (offline), **fail safe**: drop to a read-only/`viewer`
  posture rather than trusting the stored role. (Mirrors the super-admin `checkSuperAdmin` hardening.)
- Low-risk, no server change; closes the trivial devtools-edit vector. **Does NOT** stop a determined
  user who bypasses the client — that needs Layer B.

### Layer B — server: a tamper-proof role + role-scoped RLS (the real fix)
1. **Put the role in the JWT** via a Supabase **Custom Access Token auth hook**: on token issuance,
   add `society_users.role` (+ `society_id`) as signed claims. The client then reads the role from
   the *signed* token (unspoofable), and the server can read `auth.jwt() ->> 'user_role'`.
2. **Role-scope the mutation RLS.** For tables where role matters, add the role predicate to the
   INSERT/UPDATE/DELETE policies (e.g. `… and auth.jwt() ->> 'user_role' in ('admin','accountant')`),
   keeping SELECT tenant-only. Now a role-violating write is refused by Postgres, not just the UI.
3. `guardPermission` keeps working as the UX layer, now reading the signed claim.

**Why B2 (JWT claim) over alternatives:** routing every mutation through SECURITY DEFINER RPCs is a
huge rewrite; a bare RLS `join society_users` on every policy is slow and repeats the lookup. A signed
claim is read once at token time and is free + tamper-proof at query time.

## 4. Prod verification (run before Layer B)

```sql
-- (a) Is there already a custom access-token / auth hook configured?
select * from auth.hooks;                      -- or Dashboard → Authentication → Hooks
-- (b) How many mutation policies are role-blind (using(true) / no role predicate)?
select tablename, policyname, cmd, qual, with_check from pg_policies
where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE')
order by tablename;                            -- confirm the "role not checked" surface
-- (c) Sanity: society_users has the role we'd hoist into the JWT.
select distinct role from society_users;
```

## 5. Slice plan

- **S0 · Verify (no code).** Run §4 — confirm no conflicting auth hook, and the size of the
  role-blind mutation-policy surface.
- **SA · Client hardening (Layer A).** Session role authoritative-from-DB; offline → viewer/read-only.
  Additive, low-risk, no lock-out (worst case an offline user is read-only until reconnect).
- **SB1 · JWT role claim.** Add the custom-access-token hook (society_users.role → claim). ⚠️ Auth
  hooks fire on every token issue — a bug here breaks login for everyone; test on a throwaway user,
  and mirror the super-admin recovery playbook. Client switches to reading the claim.
- **SB2 · Role-scope mutation RLS**, table group by table group (start with the destructive ones:
  vouchers, accounts, members, sales, purchases), each its own migration + prod-verify that an
  authorized role still writes and a viewer is refused.

## 6. Risks

- **Lock-out (SB1):** a broken auth hook = no one can log in. Same class as the super-admin incident
  earlier; deploy behind a throwaway-user test + keep the SQL disable path ready.
- **Over-restriction (SB2):** too tight a role predicate blocks legitimate writes. Roll out per-table,
  verify each, keep the `_down` migration.
- **Scope:** SB2 is genuinely large (per-table RLS). SA + SB1 close most of the practical exposure;
  SB2 can be staged.

## 6a. S0 findings (2026-07-13, from prod)

- **No auth hook configured** (`auth.hooks` doesn't exist; Dashboard → Auth → Hooks empty) → the
  custom-access-token hook can be added cleanly, no conflict.
- **society_users.role ∈ {`accountant`, `admin`}** in prod (the type also allows viewer/auditor).
- **Role-blind mutation policies** exist on ~19 tables with explicit INSERT/UPDATE/DELETE policies
  (branches, deposit_accounts/transactions, godowns, kachi_aarat_entries, p7_entries, recoverables,
  compliance_filings, document_sequences, society_activities/capabilities, feedback, leads,
  audit_log/ledger_events [WORM, insert-only], societies, society_users). **NOTE for SB2:** the core
  financial tables (vouchers, members, accounts, sales, purchases, stock_*) did NOT appear in the
  INSERT/UPDATE/DELETE list — they likely use `FOR ALL` policies (cmd = 'ALL'); re-query
  `cmd = 'ALL'` before scoping them.

## 6b. SB1 — the fail-safe hook (READY, do NOT enable alone)

⚠️ **SB1 has no functional benefit until SB2 reads the claim, but carries the full auth-hook risk
(a broken hook fails EVERY login). So do NOT enable it on its own — apply SB1 + the first SB2 tables
together in a dedicated session, verify a login immediately, and keep the rollback (disable the hook
in the Dashboard) at hand.** The function below is written FAIL-SAFE — it never raises and returns
the claims unchanged on any miss — so the only ways it can break login are a wrong grant or the
Dashboard pointing at the wrong function.

```sql
-- Adds society_users.role to the JWT as a signed, unspoofable `user_role` claim.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer          -- read society_users regardless of RLS
set search_path = public
as $$
declare claims jsonb; em text; r text;
begin
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  begin
    em := lower(nullif(event #>> '{claims,email}', ''));
    if em is not null then
      select role into r from public.society_users
       where lower(email) = em and is_active = true
       order by (role = 'admin') desc limit 1;    -- prefer admin if multiple rows
      if r is not null then
        claims := jsonb_set(claims, '{user_role}', to_jsonb(r));
      end if;
    end if;
  exception when others then null;                -- NEVER block token issuance
  end;
  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
```

Then Dashboard → Authentication → Hooks → **Customize Access Token (JWT) Claims** → select
`custom_access_token_hook`. **Immediately** log in on a test browser and confirm login works AND the
issued JWT contains `user_role` (decode the access token). Rollback = un-select the hook.

Client (small): once the claim is live, read `user_role` from the JWT rather than the extra
society_users round-trip (optional; the mount effect already derives it).

## 7. Recommendation

Do **SA** (client hardening) as a real, low-risk win whenever this is picked up. Treat **SB1 + SB2**
as a dedicated, carefully-staged effort (its own session), not a quick slice — it touches the auth
token path and every mutation policy. The tenant boundary is already solid (RLS), so this is
in-tenant-integrity hardening, not an open-door fix.
