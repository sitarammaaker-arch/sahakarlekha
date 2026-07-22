# ADR-0012 — Binding MFA to the Session Token (the payroll go-live hard blocker)

- **Status:** Proposed — design only (implementation is a later, gated story; NOT started)
- **Date:** 2026-07-21
- **Traceability:** Sprint-1 T1.12 · Phase-3 §K / Phase-18 §12 hard blocker · Discovery "MFA fail-closed + open JWT gap"
- **Scope:** design + task breakdown. This ADR writes **no code**. It is a prerequisite for any
  financial/consequential payroll path (posting, disbursement, PII reads).

## Problem (evidence)

`supabase.auth.signInWithPassword` mints a **fully valid JWT before any TOTP check**. The hand-rolled
MFA is then verified only **client-side** (`AuthContext.verifyMfaCode` → server RPCs whose boolean
result gates React state). **RLS never checks MFA.** So a password-holder can skip the client gate
entirely and use the minted access token directly against PostgREST/RPCs — the account's data is
reachable **without the second factor**. For a system that will move money and hold salary/PII, this
is the top go-live blocker (Phase-18 §12, non-waivable for financial paths).

## Decision

**Adopt Supabase-native MFA (AAL2) so the assurance level is carried in the session/JWT, and gate
consequential payroll surfaces on it in RLS (fail-closed).** After a successful second factor the
session is `aal2`; policies on gated objects require `auth.jwt() ->> 'aal' = 'aal2'` (or the
equivalent AAL check). A password-only session is `aal1` and is denied on those surfaces at the
database, not just in the UI.

### Why native AAL2 over a hand-rolled claim

A custom `mfa` JWT claim (via the access-token hook, like the existing `user_role`/`user_branch_id`
claims in migrations 028/038) was considered and **rejected as the primary mechanism**: the
access-token hook runs at token issuance and **cannot reliably know that *this* session completed a
second factor** — that is exactly the session-assurance state Supabase's native MFA/AAL tracks
(`aal2` only after a factor challenge). Bolting a hand-set flag onto the hook re-creates the same
fail-open surface. Native AAL is the correct, token-bound source of truth. (The existing custom TOTP
in `user_mfa` becomes a migration source, not the runtime gate.)

## Surfaces to gate (RESTRICTIVE, fail-closed)

- **Payroll financial writes** — posting, statutory-liability, payment/disbursement.
- **PII reads** — `pay_core.statutory_identity`, `pay_core.bank_mandate` (already role-narrowed;
  add the AAL requirement).
- **High-privilege admin / governance actions** (Phase-12 consequential transitions).
- Missing/indeterminate AAL on a gated surface → **deny** (the platform's fail-open rollout stance is
  reversed here, per Phase-18).

## Task breakdown (implementation — a later, gated story; not this sprint)

1. Enable Supabase MFA (TOTP factors) on the project; confirm the JWT carries the AAL claim.
2. Migrate enrolled users from the custom `user_mfa` table to native factors (one-time, reversible,
   with a fallback enrolment path); keep the platform-admin MFA path consistent.
3. Add `AS RESTRICTIVE` policies requiring `aal2` on the gated surfaces above (payroll financial + PII).
4. Client: perform the native MFA challenge and require step-up before consequential actions; drop the
   session if AAL is indeterminate (fail-closed) — reuse the existing "refuse rather than fail-open"
   posture already proven for the platform-admin path.
5. Tests (blocking): a password-only (`aal1`) session is **denied** on every gated surface;
   indeterminate AAL → denied; a completed factor (`aal2`) → allowed. Cross-tenant + role checks unchanged.

## Consequences

- Financial/PII surfaces become reachable **only** with a real second factor, enforced at the DB.
- One-time user migration from custom TOTP to native factors is the main cost; it is reversible and
  gated.
- This ADR unblocks the Phase-18 §12 hard blocker for payroll financial paths once implemented.
  Until implemented, **no payroll financial/disbursement path may go to production.**

## Non-goals

- No implementation in this sprint (design only).
- No change to the tenant/role/branch RLS model (this is an additive assurance gate).
- No architecture redesign — this realizes an already-identified Phase-3/18 requirement.
