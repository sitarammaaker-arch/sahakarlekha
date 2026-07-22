# ADR-0011 — Payroll Schema Migration Lineage

- **Status:** Accepted — interim (Sprint-1); final consolidation pending
- **Date:** 2026-07-21
- **Traceability:** Sprint-1 Execution Spec T1.9 · Phase-2/4 "3-source drift" · Cross-Phase Blueprint §8
- **Code:** [supabase/migrations/payroll/](../../supabase/migrations/payroll/)

## Decision

The payroll physical schema (Phase 4) is delivered as a **self-contained set of numbered files**
under `supabase/migrations/payroll/` (`100`–`113` + `999` rollback + `VERIFICATION.sql`), applied in
numeric order. This folder is the **interim** home. The **single canonical migration lineage** for the
whole product is the numbered `supabase/migrations/NNN_*.sql` sequence; `supabase-tables.sql`
(flattened snapshot) and `MIGRATIONS.sql` (a feature batch) are **not** authoritative and are to be
retired/regenerated, not hand-edited. Final consolidation — renumbering the payroll files into the
main lineage (e.g. `054`+) once their live order is proven — is deferred to a dedicated task and must
**not** be done speculatively.

## Context

Phase-0/2 flagged a "3-source drift": the schema exists in `supabase-tables.sql`, `MIGRATIONS.sql`,
and `supabase/migrations/*`. Sprint-1 hit the concrete failure while bootstrapping a fresh staging DB:

- `supabase-tables.sql` policies **use** `public.current_user_society_ids()`.
- That function is defined **only** in `supabase-security.sql`, and its body **reads `society_users`**.
- The numbered migrations (`001`, `006`, …) **assume** the base tables already exist.

→ A genuine **circular / incomplete dependency**: no single source bootstraps a fresh database
(`function public.current_user_society_ids() does not exist`, evidenced on first apply). There is no
documented fresh-DB setup order.

For Sprint-1's goal (prove the *payroll* schema in isolation, without touching production data) the
full base bootstrap is unnecessary and risky. A **minimal correct base** — the verbatim
`societies` / `society_users` / `branches` / `vouchers` `create table` blocks + the helper functions
from migrations `007` / `029` / `039` — was established on staging, and the payroll schema applied and
verified cleanly on top (see the folder README).

## Consequences

- Payroll files keep `1xx` numbering so they are unambiguous and independently applyable now.
- Consuming the payroll schema requires the base app schema (societies/branches/vouchers + RLS
  helpers) to be present — true in production; established via the minimal base for isolated staging.
- The **fresh-DB bootstrap-order defect is a separate, tracked debt**. Resolving it (a single ordered,
  idempotent bootstrap — the standard fix being `set check_function_bodies = off`, then
  functions → tables → policies → migrations) is the proper follow-up before the payroll files are
  renumbered into the main lineage. Until then this folder stays as-is.

## Non-goals

- Not editing `supabase-tables.sql` / `MIGRATIONS.sql` in this sprint.
- Not renumbering payroll into the main lineage yet.
- Not redesigning any Phase 0–18 architecture — this is a repo-organization/lineage decision only.
