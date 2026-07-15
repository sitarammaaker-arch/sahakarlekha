# ADR-0002 — Capability-Driven Architecture (with a thin Legal-Type anchor)

- **Status:** Accepted — in force (already realized; being extended)
- **Date:** 2026-07-11
- **Traceability:** Architecture Research "Option C", INV-2 · [Research §3–5](../research/DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md), [Gap Analysis §0](../research/DOMAIN-GAP-ANALYSIS-2026-07.md) · Code: [capabilityResolver.ts](../../src/lib/navigation/capabilityResolver.ts), [capabilities.ts](../../src/lib/navigation/capabilities.ts)

## Decision

Application behavior binds to **capabilities** — fine-grained runtime feature switches — and **never** to a society's type. A society's legal **Base Type** is retained only as a *thin legal/statutory anchor* (compliance reports, audit classification). Capabilities are **resolved** (Base-Type defaults ∪ entitlements ∪ — later — activities) by a pure, deterministic resolver, and consumed uniformly by modules, reports, chart-of-accounts, and RBAC. This is **Option C: Capabilities-driven with a legal-identity anchor**.

## Context

Indian cooperative policy has decoupled *what a society is called* from *what it does*: Multipurpose PACS run 25+ activities; NCP 2025 pushes every society toward multi-service. A `societyType`-gated architecture is obsolete on arrival. SahakarLekha **already implements** the capability layer — a 15-value `Capability` union, a two-step entitlement→visibility resolver, module gating via `CapabilityGuard`/`navVisibility`, jurisdiction packs, and a server-controlled entitlement/licensing model with RLS. This ADR ratifies that as the standing architecture and forbids regressing to type-branching.

## Alternatives Considered

1. **Society Type only (Option A).** One type ⇒ fixed behavior.
2. **Type + Activities, with modules still branching on type (Option B).** Two behavioral axes.
3. **Capabilities-driven + legal-type anchor (Option C, chosen).** One behavioral axis (capability); type is compliance-only.

## Why this decision was selected

- **A is dead on arrival** against Multipurpose PACS; every new government sector becomes a migration.
- **B carries growing type-branch debt** and re-duplicates modules per domain — a slow-motion A.
- **C is already built and proven** in the codebase, and gives a single behavioral axis: `has_capability(...)`. Statutory reports (the one legitimate type gate) remain served by the thin anchor.
- C also unifies the in-flight domain silos (Housing/Dairy/Consumer/Marketing) into one spine — e.g. one procurement capability serves dairy, foodgrain, and marketing.

## Trade-offs

- **Indirection**: understanding "why does this module show?" requires reading the resolver, not a single type field.
- **Capability catalog governance** becomes a first-class responsibility (naming, versioning, entitlement mapping).
- **Two grant sources today (type template + license)** and a third arriving (activities, ADR-0003) require a clear precedence rule (resolve within entitlement).

## Long-term consequences

- New sectors/bye-laws land as **capability + mapping data**, not code — the core never learns their names (INV-2/INV-3).
- Behavior is portable across organizational forms beyond "cooperative" (FPO, SHG, producer company) by assigning a capability profile.
- Locks in the discipline that **modules/reports must never read `societyType`** except for Tier-3 statutory output.

## When it may be revisited

- If capability granularity proves too coarse or too fine in practice (tune the catalog, not the architecture).
- If a future entity model makes even the thin legal-type anchor unnecessary (e.g. legal identity fully externalized to a government registry) — would refine, not replace, the anchor.
