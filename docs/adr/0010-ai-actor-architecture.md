# ADR-0010 — AI & Autonomous-Actor Architecture

- **Status:** Accepted — in principle
- **Date:** 2026-07-11
- **Traceability:** INV-4 · [2040 Vision INV-4](../research/DOMAIN-ARCHITECTURE-2040-VISION.md) · [[ecr-06-rbac-state]] · RULE 6 (FY-lock), audit trail / approval machinery

## Decision

Every actor — human user, external integration, or AI/autonomous agent — is a **principal on a single trust plane**: identity → role → capability entitlement → **full audit trail** → segregation-of-duties (SoD). An AI agent is **not** a privileged backdoor; it is a scoped principal whose every action is recorded as events (ADR-0001) and constrained by the same RBAC/entitlement (ADR-0002) as a human. AI participates in **experience and adapter layers** (Ring 3/4), never in the invariant core; models are swappable and hold **no** core business logic. Where AI proposes financial mutations, SoD requires **human or independent-principal review** per policy.

## Context

By 2040, much data entry, reconciliation, and first-pass audit will be AI-assisted or AI-driven. If AI were governed by a separate, weaker path than humans, automation would demand a governance rewrite and open an unauditable hole in a system of statutory record. SahakarLekha already has the primitives — RBAC/route-scoping, SoD self-approval prevention, approval status, and an audit trail — so unifying AI onto that plane is an extension, not new governance.

## Alternatives Considered

1. **Special AI service account with broad privileges.** Fast, but creates an unauditable, over-privileged actor — unacceptable in a statutory-record system.
2. **Prohibit AI write actions entirely.** Forgoes the dominant 2040 productivity model and is unenforceable long-term.
3. **AI as a scoped principal on the same trust plane, with SoD on financial mutations (chosen).**

## Why this decision was selected

- A single trust plane means automation scales **without** a governance rewrite — an agent is just a principal with scoped capabilities and a complete audit trail.
- It preserves auditability and SoD, which statutory records require, regardless of whether the actor is human or machine.
- Keeping models out of the core (Ring 3/4) means monthly model churn never touches the invariant core (INV-4).
- Alternative 1 is an irreversible-exposure trap (cf. IRR-5 reasoning); Alternative 2 is neither future-proof nor enforceable.

## Trade-offs

- **Constrained AI autonomy:** agents cannot exceed a human role's capabilities, and financial mutations may require review — deliberately slower than an unfettered agent.
- **Audit volume grows** with AI activity (bounded by ADR-0001's append-only model, which expects this).
- **Attribution machinery:** every event must record whether a human or a specific agent (and on whose behalf) acted.

## Long-term consequences

- AI adoption requires no re-architecture of authorization or audit — only new scoped principals.
- Regulators can audit AI actions exactly as human actions; accountability is preserved.
- The core remains model-agnostic; today's model choices never become tomorrow's irreversible dependency.

## When it may be revisited

- If regulation defines a specific accountability/attribution standard for AI in financial systems (tighten the plane's requirements, don't replace it).
- If autonomous agents become the *primary* authors of entries — SoD and attribution requirements get **heavier**, re-ratified here, but the single-plane principle holds.
