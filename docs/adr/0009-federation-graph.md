# ADR-0009 — Federation Graph

- **Status:** Accepted — in principle (seed exists; national model is future work)
- **Date:** 2026-07-11
- **Traceability:** INV-6, IRR-4 (Class B) · [2040 Vision INV-6](../research/DOMAIN-ARCHITECTURE-2040-VISION.md), [Irreversible Decisions IRR-4](../research/DOMAIN-IRREVERSIBLE-DECISIONS-2026-07.md) · Code: `societies` table, [MultiSocietyConsolidation.tsx](../../src/pages/MultiSocietyConsolidation.tsx)

## Decision

The cooperative structure is modeled as a **first-class graph** of organizations with typed relationships (primary ↔ district/DCCB ↔ state/apex ↔ national federation). **Consolidation rolls up** the graph (as re-projection over the event log, ADR-0001); **data governance and residency scope down** it. Every financial row is stamped at write time with a **`(tenant_id, jurisdiction)`** key so data can be partitioned, sharded, and residency-placed. Global uniqueness is preserved by the existing `crypto.randomUUID()` primary keys.

## Context

A *national* ERP is inherently a network of networks; NCP 2025's federation and model-village push makes tiering structural. Today, tenancy is effectively a **default** (`society_id text default 'SOC001'`, an `id='main'` settings singleton) rather than a partition dimension, and there is no jurisdiction key. Without `(tenant, jurisdiction)` stamped on rows **at write time**, later sharding for scale or complying with **data-residency law** would require re-placing billions of already-written rows — the classic ERP death (IRR-4, Class B). The `societies` table and consolidation page are the seed of the graph.

## Alternatives Considered

1. **Flat multi-tenant list, add hierarchy later (status quo trajectory).** Re-partitioning history later is infeasible at scale.
2. **Separate database per society.** Isolates well but makes federation/consolidation and cross-tier reporting extremely hard.
3. **First-class federation graph + tenant/jurisdiction partition key from now (chosen).**

## Why this decision was selected

- Stamping `(tenant, jurisdiction)` **now** is cheap; backfilling it onto billions of historical rows later is not — this is a closing-window decision.
- A graph models the real cooperative pyramid and makes consolidation a **re-projection** (leveraging ADR-0001) rather than fragile cross-silo joins.
- UUID keys (already in place) mean tenant merge/federation never collides — the hard part is already correct.
- Alternative 1 traps history un-partitioned; Alternative 2 forfeits federation, the whole point of a national OS.

## Trade-offs

- **Every write path** must supply the tenant/jurisdiction key — pervasive but mechanical.
- **Graph governance:** relationship types, consolidation rules, and scope-down data rules are new modeling surface.
- **Residency operations:** honoring per-jurisdiction placement adds infrastructure complexity.

## Long-term consequences

- Horizontal scale and data-residency compliance become achievable without re-homing history.
- Tier consolidation (primary→district→state→national) is a native capability.
- Federated (non-co-located) consolidation stays possible if residency law fragments storage — consolidation is designed as re-projection across a boundary, not a co-located join.

## When it may be revisited

- If data-residency law forces hard per-state boundaries earlier than expected (accelerates, not reverses, this decision).
- If a government-run federation registry becomes the authority for the graph structure (SahakarLekha would sync to it via an adapter).
