# ADR-0008 — Policy & Compliance Rules Engine

- **Status:** Accepted — in principle (capabilities/jurisdiction packs exist; generalization is future work)
- **Date:** 2026-07-11
- **Traceability:** INV-3, IRR-9 · [2040 Vision INV-3](../research/DOMAIN-ARCHITECTURE-2040-VISION.md), [Architecture Research Q8](../research/DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md) · Code: [societyTypeCapabilities.ts](../../src/lib/navigation/societyTypeCapabilities.ts), jurisdiction packs in [capabilityResolver.ts:34](../../src/lib/navigation/capabilityResolver.ts)

## Decision

Policy, jurisdiction, and compliance logic — statutory report formats, tax rules, subsidy formulas, audit checklists, capability grants, activity mappings — are expressed as **effective-dated, jurisdiction-scoped, versioned rule data**, evaluated by rule engines. They are **never hard-coded**. Behavior reads the rule set **as of a point in time**, so historical behavior is reproducible. External-facing codes (society category, report codes) use **stable external vocabularies** (e.g. National Cooperative Database codes), never internal enums (IRR-9).

## Context

India's cooperative compliance surface changes roughly annually (bye-laws, GST, subsidy schemes) and diverges across 28 states' Cooperative Acts. Hard-coding any of it guarantees recurring migrations and makes historical behavior irreproducible. SahakarLekha already treats *navigation capability* as data (society-type templates, state jurisdiction packs) — this ADR generalizes that proven pattern to the **entire** policy/compliance surface.

## Alternatives Considered

1. **Hard-code rules per release (status quo for most compliance logic).** Every policy change is a code deploy; history not effective-dated.
2. **Config flags without effective-dating or jurisdiction scope.** Absorbs some change but cannot reproduce past behavior or hold 28 state variants cleanly.
3. **Effective-dated, jurisdiction-scoped, versioned rule engine (chosen).**

## Why this decision was selected

- It absorbs the Ministry's annual churn and state divergence as **data**, with **effective-dating** guaranteeing that a 2027 report reproduces 2027's rules even when evaluated in 2035.
- It is a **proven pattern** already live in the capability/jurisdiction layer — a generalization, not an invention.
- Alternatives 1–2 reintroduce the exact "policy change = migration" trap the whole architecture rejects.

## Trade-offs

- **Rule-authoring and governance burden:** rules need catalogs, versioning, testing, and a change-audit trail (`catalog_versions`).
- **Engine complexity:** a mis-modeled rule can mis-drive many societies at once — blast radius requires strong validation.
- **Performance:** point-in-time rule resolution must be cached to stay cheap at national volume.

## Long-term consequences

- New bye-laws, tax regimes, and subsidy schemes ship as rule rows — no code deploy, no historical-data touch.
- Statutory reproducibility becomes a property of the system, defensible in audit.
- Cross-jurisdiction (multi-state) operation is native rather than special-cased.

## When it may be revisited

- If a domain proves too dynamic for declarative rules and needs sanctioned computed extensions (would define a controlled extension mechanism, not abandon the engine).
- If the government publishes machine-readable rule feeds SahakarLekha can ingest directly (would make the engine a *consumer* of official rules — strengthening, not replacing, this decision).
