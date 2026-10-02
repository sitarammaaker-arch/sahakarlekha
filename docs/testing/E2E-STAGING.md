# E2E tests against staging (Phase-2 I6/I7)

End-to-end tests drive the real app (Vite dev server) in a browser against the **staging** Supabase
project `sahakarlekha-staging` (ref `ivmrlhjrqtwftdlxajxk`, Singapore). Production
(`rwffxupenwdtrmyabytk`) is never reachable: `playwright.config.ts` refuses the prod ref, and
`e2e/smoke.spec.ts` asserts that no request ever goes to it.

## What staging contains
- **The production schema, with no data.** It comes from `pg_restore -s -n public` of a prod backup and is applied by the founder through `apply-sql-staging.ps1`. The file stays outside the repo, in `D:\SahakarLekha-Backups\staging\`.
- **One synthetic demo society:** `5eed0000-0000-4000-8000-000000000001`, "Demo Seva Sahkari Samiti (STAGING)".
  - It has 177 COA accounts from the app template.
  - Triggers create its open FY 2026-27, a trial subscription and `posting_service = on`.
  - It has one admin, `e2e-admin@sahakarlekha.test`.
- **The access-token hook is enabled** (`public.custom_access_token_hook`), as in prod.

Every staging SQL file is guarded: it refuses any database holding a real society's vouchers.

## Running
```
npm run e2e            # Playwright; serves the app on :5179 pointed at staging
```
Configuration comes from the environment or from the git-ignored `.env.e2e.local`:

| var | value |
|---|---|
| `E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY` | staging project URL and anon (public) key |
| `E2E_EMAIL` / `E2E_PASSWORD` | the staging test login; specs that log in skip without these |
| `E2E_BROWSER_CHANNEL` | optional, e.g. `msedge`, to use an installed browser locally |

**CI:** the `e2e` job in `.github/workflows/ci.yml` runs once the four `E2E_*` repository secrets are set. Until then it prints a skip note.

## Specs
- **`smoke.spec.ts`:**
  - the login page renders against staging with no page errors;
  - no request reaches production.
- **`voucher-persist.spec.ts`** checks RULE 1 end to end:
  1. log in;
  2. save a voucher through the UI;
  3. **reload**;
  4. the voucher is still listed, which proves it reached the cloud.

  Each run leaves one tagged voucher (`E2E-<timestamp>`) in the staging demo society.
