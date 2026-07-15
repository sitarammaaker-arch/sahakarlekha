# ADR-0003 — Activities Layer

- **Status:** Accepted — planned (P0 gap; not yet implemented)
- **Date:** 2026-07-11
- **Traceability:** BA-1 (P0), MR-1, MR-2, MR-4 · [Gap Analysis §2/§6](../research/DOMAIN-GAP-ANALYSIS-2026-07.md), [DB Design §3](../research/DOMAIN-DATABASE-DESIGN-2026-07.md) · Extends ADR-0002

## Decision

Introduce an **Activities layer** *between* Base Type and Capabilities. An Activity is a user-declared **business line** (e.g. `milk_procurement`, `fair_price_shop_pds`, `consumer_retail`); a society may declare **many** activities. Activities resolve into capabilities via an `activity_capability_map`, and — critically — **only within entitlement**: `effective = (type ∪ activities ∪ grants) ∩ entitled`. Activities are a **catalog (data), not an enum**; a new government activity is an `INSERT`.

## Context

The current model grants capabilities from a **single `societyType` template + license rows** — there is no way for one society to declare that it runs credit *and* dairy *and* a fair-price shop. This is the single structural gap between the current implementation and the approved architecture (the "70% already built, one layer missing" finding), and it is what makes the Multipurpose-PACS reality (25+ activities per society) unmodellable today.

## Alternatives Considered

1. **More society types** (e.g. add `pacs_dairy`, `pacs_dairy_fps`). Combinatorial explosion; never scales.
2. **Grant capabilities directly per society via admin toggles.** Collapses the business-intent layer into raw switches; loses the "declare what you do" semantics and risks bypassing licensing.
3. **Activities catalog resolving into capabilities within entitlement (chosen).**

## Why this decision was selected

- It is the **minimum change** that models Multipurpose PACS and every emerging NCP-2025 sector, and it slots cleanly beneath the existing resolver (ADR-0002) as an *additive* input producing the same `Set<Capability>` output (MR-2).
- Alternative 1 is the classic type-explosion anti-pattern the whole architecture rejects.
- Alternative 2 breaks the entitlement/monetization boundary (MR-4) — activities must **not** grant unpaid capabilities.
- Resolving within entitlement preserves the server-controlled licensing model already enforced by RLS.

## Trade-offs

- **New resolver input + new tables** (`society_activities`, `activity_capability_map`) and **new RLS** for admin-declared activities (MR-5).
- **Backfill risk (MR-1):** inferring each existing society's initial activities from its type + operational data must guarantee **parity** — no society may lose a visible module at cut-over (a RULE 1-class "silent loss" if botched). Requires an empty-diff check and feature-flagged rollout.
- **Precedence complexity:** three grant sources (type, activity, license) must compose predictably.

## Long-term consequences

- One society ⇒ many activities becomes native; the domain silos (Housing/Dairy/Consumer/Marketing) collapse into activity+capability sets on the shared spine.
- Future sectors onboard as catalog rows — zero schema migration, zero historical-data touch.
- Establishes "declared business intent" as a durable, reportable dimension (NCD-code mapped).

## When it may be revisited

- If activity granularity or the activity→capability mapping proves awkward for a major sector (tune the catalog).
- If entitlement policy changes such that activities *should* auto-grant capabilities (would require re-ratifying MR-4's within-entitlement rule).
