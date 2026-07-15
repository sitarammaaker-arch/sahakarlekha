# ADR-0001 — Event Ledger as the System of Record

- **Status:** Accepted — planned (keystone; not yet implemented)
- **Date:** 2026-07-11
- **Traceability:** INV-1, IRR-1 · RULE 1, RULE 3, RULE 6 · [2040 Vision §4](../research/DOMAIN-ARCHITECTURE-2040-VISION.md), [Irreversible Decisions IRR-1](../research/DOMAIN-IRREVERSIBLE-DECISIONS-2026-07.md)

## Decision

The **authoritative source of financial and membership truth is an append-only event log** (a durable posting/mutation journal). All balances, registers, and reports are **projections** derived from that log and are disposable/rebuildable. Corrections are **reversing events**, never in-place mutations or hard deletes. Application state (React/Supabase rows) is demoted to a **cached projection**, not the source of truth.

## Context

Today entities live in React state; Supabase is an optimistic mirror; a failed write must be manually rolled back or the user loses work — codified defensively as **RULE 1** (local state must never silently diverge from cloud). There is no record of *what happened*, only current mutable state plus a JSONB `editHistory` afterthought. This produces recurring "saved locally, lost on refresh" incidents and leaves historical financial facts with **no reconstructable provenance**. At national-OS scale, audit reconstruction, dispute resolution, and multi-decade retention make this untenable — and the loss is irreversible (history not recorded can never be recovered).

## Alternatives Considered

1. **Keep state-as-truth, harden rollback (status quo + RULE 1 discipline).** Continue optimistic writes with two-step upsert and destructive-toast rollback.
2. **Full CQRS/event-sourcing from a rewrite.** Replace the current data layer with a greenfield event-sourced core.
3. **Append-only journal behind the existing projection (chosen).** Introduce the log as the new system-of-record *beneath* current tables via dual-write, then cut projections over to read from it.

## Why this decision was selected

- It **eliminates the RULE 1 failure class by construction**: a failed write is a non-event — there is nothing to diverge.
- It is the **keystone invariant** (INV-1): it underwrites erasure-vs-retention (ADR-0007), consolidation-as-re-projection (ADR-0009), and auditability of AI actions (ADR-0010).
- The codebase is **already ~60% event-shaped** — `voucher_entries`, `isDeleted` soft-cancel (RULE 3/RULE 5), and `editHistory` — so this is a *promotion*, not the greenfield rewrite of Alternative 2.
- Alternative 1 leaves provenance permanently unrecordable; Alternative 2 is too risky to sequence against a live product.

## Trade-offs

- **Write path complexity rises**: every mutation becomes an event append plus a projection update; developers must think in events, not row edits.
- **Read models must be rebuilt** if a projection bug is found — operationally powerful but requires rebuild tooling.
- **Storage grows** (history is never deleted); mitigated by the fact that events are cheap and compressible.
- **Dual-write transition window** requires care to keep log and projection consistent until cut-over.

## Long-term consequences

- Any future report format, regulator query, or dispute is answerable by re-projecting immutable history.
- Enables cryptographic tombstoning of PII without breaking financial history (ADR-0007) and up-the-graph consolidation (ADR-0009).
- Every day *without* this widens a permanently un-reconstructable gap in historical provenance — the cost of delay is irreversible, not merely deferred.

## When it may be revisited

- If a regulator mandates a specific ledger technology (e.g. a government-run distributed ledger) that changes the *implementation* — note the **event-log property** is durable even if the storage mechanism changes (2040 Vision §6 "immutable ledger yes, blockchain undecided").
- If, after implementation, projection-rebuild cost proves operationally unacceptable at national volume (unlikely; would prompt tuning, not reversal).
