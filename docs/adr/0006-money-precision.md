# ADR-0006 — Money Representation & Precision

- **Status:** Accepted — planned (storage is exact today; the compute-layer discipline is the commitment)
- **Date:** 2026-07-11
- **Traceability:** IRR-8 (Class A) · [Irreversible Decisions IRR-8](../research/DOMAIN-IRREVERSIBLE-DECISIONS-2026-07.md) · Code: PG `numeric` columns, ~53 JS-float arithmetic sites in [DataContext.tsx](../../src/contexts/DataContext.tsx)

## Decision

Monetary values are represented **exactly** end-to-end. At rest they remain PostgreSQL `numeric` (exact). In the computation layer they are handled with a **fixed minor-unit (paise) integer or decimal discipline** — never raw IEEE-754 floats — and every rounding step applies an **explicit, recorded rounding policy**. Amounts persisted into postings are exact and reproducible.

## Context

Storage is already exact (`numeric` — a correct choice). However, arithmetic runs in JavaScript floating point across ~53 sites in `DataContext` alone (`Number(...)`, `toFixed`, `parseFloat`), and **computed results (tax, allocations, rounding) are persisted** into postings. Source figures can be recomputed, but rounding already **written into historical postings** is frozen; across billions of transactions this compounds into a permanent, un-auditable discrepancy (Class A). RULE 2's phantom-balance bug is a live symptom of formula/precision drift.

## Alternatives Considered

1. **Keep JS-float arithmetic (status quo).** Accumulates persisted rounding drift irreversibly.
2. **Float compute + round only at display.** Doesn't help — persisted postings still carry float-derived values.
3. **Fixed minor-unit integer / decimal discipline in the compute layer with recorded rounding policy (chosen).**

## Why this decision was selected

- Only exact computation prevents **persisted** rounding error; since postings are the historical record (ADR-0001), their precision is irreversible and must be exact.
- A recorded rounding policy makes every rounding step auditable and reproducible — a statutory expectation.
- Storage is already correct, so this is a bounded compute-layer discipline, not a data migration.

## Trade-offs

- **Developer ergonomics:** money can no longer be manipulated as plain JS numbers; requires a money type/util and code review vigilance.
- **Refactor surface:** ~53 existing sites (and their kin across the app) must migrate to the discipline.
- **Interoperability:** external inputs (imports, integrations) must be normalized into the exact representation at the boundary.

## Long-term consequences

- Aggregates tie out exactly at national volume; trial balance and statutory totals are defensible to the paisa.
- Rounding disputes become resolvable by replaying the recorded policy.
- Removes a latent, ever-growing source of report discrepancy that would otherwise be unfixable in history.

## When it may be revisited

- If a shared, well-tested money primitive is later standardized across the platform (would refine the *how*, not the decision).
- If statutory rounding rules change — the **policy is data** and updates without changing this ADR's principle.
