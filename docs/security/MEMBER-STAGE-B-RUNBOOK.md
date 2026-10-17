# Member area — stage B rollout (re-audit 2026-10-17)

Server-side security for the Member Area. **Order matters.** Each step says what to check before the next one.
All SQL runs in the Supabase SQL Editor (plain **Run**, a new query per file). Every migration except 122 can be
undone with its `_down.sql`.

| # | What | Where | Undo |
|---|---|---|---|
| 0 | Full backup (`backup-prod.ps1`) | your terminal | — |
| 1 | `106_member_identity.sql` | SQL Editor | `106_..._down.sql` |
| 2 | `107_member_portal_identity.sql` | SQL Editor | `107_..._down.sql` |
| 3 | `120_members_write_scope.sql` | SQL Editor | `120_..._down.sql` |
| 4 | `121_audit_actor_stamp.sql` | SQL Editor | `121_..._down.sql` |
| 5 | `123_member_portal_login_lockout.sql` | SQL Editor | `123_..._down.sql` |
| 6 | secret `MEMBER_LOGIN_PEPPER` + deploy `member-portal-login` and `member-portal-admin` | your terminal | redeploy the previous admin function |
| 7 | merge the stage-B PR (the browser now signs members in through `member-portal-login`) | GitHub | revert the PR |
| 8 | reset the PIN of every existing portal login (moves it to the keyed email) | app → Members → सदस्य portal | — |
| 9 | after a reload shows SPLIT mode and a NEW backup: `122_member_pii_phase3.sql` (PREVIEW first) | SQL Editor | **none** — backup only |

## Facts this rests on (read-only prod check, 2026-10-17)
- `member_identity` / `jwt_can_read_pii` do **not** exist yet → the app runs in legacy PII mode.
- prod `member_portal_snapshot` is byte-for-byte the body in `107_..._down.sql` → 107 changes only the PII lines.
- every active `society_users` row has a role, and the access-token hook always sets `user_role` → the fail-closed
  `jwt_can_write_members()` blocks nobody who works in a society today.
- 0 duplicate `(society_id, "memberId")` rows (incl. deleted) → the unique index builds.
- `society_settings."fyLocked"` exists; 0 societies are locked today.
- 4 member-portal logins exist (all on the legacy, computable email until step 8).

## Step 6 — secret + deploy (your terminal, in a checkout of the stage-B PR branch — the functions are not on `main` yet)
Between step 6 and step 7 the old browser code still signs in legacy logins directly, so existing members keep
working; a login issued or reset in that gap works only after step 7. Do 6 and 7 back to back.
```bash
npx supabase secrets set MEMBER_LOGIN_PEPPER=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
npx supabase functions deploy member-portal-login
npx supabase functions deploy member-portal-admin
```
Never change or lose the pepper afterwards: every keyed login email is derived from it (changing it = every member
needs a new PIN). Smoke test: an OPTIONS request to `/functions/v1/member-portal-login` must not be 401.

## What was rehearsed
A throwaway local Postgres 18 with prod's helper-function bodies and members policies: cashier / employee / role-less
tokens could not write members (0 rows / RLS error), an accountant could, a duplicate live member number was refused
(23505) while a soft-deleted number could be reused, a locked year refused a signed-in user but not the service role
or SQL editor, audit actor was stamped from the JWT (forged name/email replaced), the login gate allowed 5 attempts and
locked the 6th, success cleared it, anon / authenticated could not call it, 122 blanked PII after copying the one row
that had no identity row, a later stale-tab write was redirected into member_identity, and every `_down.sql` restored
the previous policies. 107 was not rehearsed locally (it needs the full portal schema); its diff against prod is the
PII lines only.
