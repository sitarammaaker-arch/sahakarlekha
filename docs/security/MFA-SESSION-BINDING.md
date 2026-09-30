# MFA: identity from the JWT, 2FA bound to the session

Phase-2 A1–A4 (audit findings SEC-01, SEC-02, SEC-03, plus TOTP brute-force protection).
Migrations `084_mfa_identity_from_jwt.sql` and `085_mfa_session_binding.sql`, each with a `_down.sql`.

## What was wrong (verified in the prod catalog, 2026-09-30)

| ID | Finding |
|---|---|
| SEC-01 | `app_mfa_enroll(p_email, p_secret, p_code)` was SECURITY DEFINER, EXECUTE-able by `anon`/`PUBLIC`, and wrote the secret for **whatever email the caller passed**. Anyone could overwrite any society user's authenticator. |
| SEC-02 | `app_mfa_admin_reset(p_admin_email, p_target_email)` trusted the caller-supplied admin email. Anyone could wipe a user's 2FA by naming that society's admin. The other four `app_mfa_*` / `app_verify_*` functions had the same caller-supplied-email pattern. |
| SEC-03 | `signInWithPassword` mints a fully-privileged JWT **before** the 2FA challenge. The challenge was enforced only in React, so a password holder could skip it and call PostgREST/RPCs directly. |
| A4 | No limit on wrong TOTP / recovery codes. |

## The fix

**084 (SEC-01/02).** The caller is `lower(auth.jwt() ->> 'email')`, with no other identity input. The legacy
`p_email` / `p_admin_email` arguments are kept so the deployed client keeps working, but a value that is not
the caller's own raises `42501`. EXECUTE is revoked from `anon`/`PUBLIC`. `app_totp_matches` is internal
only. Admin reset now also clears the target's recovery codes.

**085 (SEC-03 + A4).**

- The `mfa_verified_sessions(session_id)` table is written only by the verify, recovery and enrol RPCs.
- `custom_access_token_hook` stamps `mfa_pending: true` on tokens of an enrolled user whose session is not
  verified. "Enrolled" means exactly what the client challenges on: `society_users.mfa_enabled` or
  `platform_admins.mfa_enabled`. If that check errors, the hook fails **closed** (pending).
- `jwt_mfa_pending()` is a claim read with no table lookup, so it is cheap inside per-row RLS. These
  helpers now yield nothing for a pending token:
  - `current_user_society_ids`
  - `get_current_society_id`
  - `get_current_user_role`
  - `is_society_admin`
  - `is_society_user_manager`
  - `is_platform_admin`

  Every RLS policy and every SECURITY DEFINER RPC is built on these helpers, so a pending token sees no
  data and holds no privilege.
- A pending token can still do only what login needs:
  - read its own `society_users` row (new policy `society_users_self_read`)
  - call `platform_admin_identity()` (identity only, no privilege)
  - call `platform_admin_mfa_status()`
  - call the verify/recovery RPCs
- **Throttle:** after 5 wrong codes for one email within 15 minutes, every TOTP/recovery check for that
  email returns false until the window passes. A correct code clears the counter.
- **Client (`AuthContext`):**
  - After a correct code the client calls `supabase.auth.refreshSession()` and finishes login only if the
    new token is not pending. The hook re-runs on refresh and sees the verified session.
  - A restored or refreshed session whose token is still pending is signed out, so the UI never shows a
    signed-in screen over empty data.
- **Edge functions** that switch to the service role after `getUser()` refuse a pending token:
  `ai-ask`, `member-portal-admin`, and the six `pay-*` functions.

## Deploy order

1. Merge the PR. Vercel deploys the client, which is backward-compatible: it falls back to `is_platform_admin` until 085 exists.
2. Deploy the eight edge functions. This is also backward-compatible, because the claim is absent until 085.
3. Take a backup, then apply `084`.
4. Apply `085`.
5. Anyone signed in with 2FA enrolled logs out and back in once. Tokens minted before 085 carry no claim until their next refresh (≤ 1 h).

## Tests

- `scripts/db-harness/tests/a1-mfa-identity.mjs`: 34 checks. Anon denied, spoofed email denied, cross-society reset denied, case-insensitive self. Run against a pre-084 schema (the down file), it fails as expected.
- `scripts/db-harness/tests/a3-mfa-session.mjs`: 41 checks.
  - The hook's claim.
  - A pending token sees 0 vouchers, members and accounts, cannot insert, and `post_voucher` refuses.
  - Its own row is readable; re-enrol is refused.
  - Verify and recovery verify the session.
  - Throttle, including its expiry.
  - Platform-admin flow; internals denied.
- `scripts/test-mfa-pending.mjs`: 7 checks on the client claim reader.
- Both migrations were applied twice (idempotent), and their down files were applied and re-verified.
