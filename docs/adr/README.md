# SahakarLekha — Architecture Decision Records (ADR)

These ADRs record the **final architectural decisions** for SahakarLekha as it moves toward being the operating system for cooperative societies in India. They do **not** introduce new architecture — each ADR ratifies a decision already reached in the approved research series and records its context, trade-offs, and revisit conditions.

## Source research (context for every ADR)

- [DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md](../research/DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md) — Type / Activities / Capabilities; final recommendation (Option C).
- [DOMAIN-DATABASE-DESIGN-2026-07.md](../research/DOMAIN-DATABASE-DESIGN-2026-07.md) — capabilities-driven table design.
- [DOMAIN-GAP-ANALYSIS-2026-07.md](../research/DOMAIN-GAP-ANALYSIS-2026-07.md) — proposed vs. current, P0/P1/P2 gaps.
- [DOMAIN-ARCHITECTURE-2040-VISION.md](../research/DOMAIN-ARCHITECTURE-2040-VISION.md) — durable invariants INV-1…INV-8.
- [DOMAIN-IRREVERSIBLE-DECISIONS-2026-07.md](../research/DOMAIN-IRREVERSIBLE-DECISIONS-2026-07.md) — irreversible traps IRR-1…IRR-9.
- Governing law: [CONSTITUTION.md](../../CONSTITUTION.md), project [CLAUDE.md](../../CLAUDE.md) RULES 1–8.

## Status vocabulary

- **Accepted — in force** : decision is ratified and already realized in code.
- **Accepted — planned** : decision is ratified; implementation is future work.
- **Accepted — in principle** : direction is ratified; sequencing/detail deferred.

## Index

| # | ADR | Status | Primary source |
|---|---|---|---|
| [0001](0001-event-ledger-system-of-record.md) | Event Ledger as System of Record | Accepted — planned | INV-1 / IRR-1 |
| [0002](0002-capability-driven-architecture.md) | Capability-Driven Architecture | Accepted — in force | Option C / INV-2 |
| [0003](0003-activities-layer.md) | Activities Layer | Accepted — planned | BA-1 (P0) |
| [0004](0004-export-contract.md) | Data-Portability Export Contract | Accepted — planned | IRR-6 / INV-7 |
| [0005](0005-voucher-numbering-authority.md) | Voucher & Document Numbering Authority | Accepted — planned | IRR-2 |
| [0006](0006-money-precision.md) | Money Representation & Precision | Accepted — planned | IRR-8 |
| [0007](0007-identity-and-consent-model.md) | Identity, PII & Consent Model | Accepted — planned | IRR-3 / IRR-5 / INV-5 |
| [0008](0008-rules-engine.md) | Policy & Compliance Rules Engine | Accepted — in principle | INV-3 |
| [0009](0009-federation-graph.md) | Federation Graph | Accepted — in principle | INV-6 |
| [0010](0010-ai-actor-architecture.md) | AI & Autonomous-Actor Architecture | Accepted — in principle | INV-4 |

## Format

Every ADR carries: **Decision · Context · Alternatives Considered · Why this decision was selected · Trade-offs · Long-term consequences · When it may be revisited.**
ADRs are immutable once Accepted; a changed decision is a *new* ADR that supersedes the old one (never an in-place edit).
