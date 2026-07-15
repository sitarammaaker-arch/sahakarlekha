# ADR-0005 — Voucher & Document Numbering Authority

- **Status:** Accepted — planned (current numbering is client-side; server authority is the commitment)
- **Date:** 2026-07-11
- **Traceability:** IRR-2 (Class A+C) · [Irreversible Decisions IRR-2](../research/DOMAIN-IRREVERSIBLE-DECISIONS-2026-07.md) · Code: [DataContext.tsx:1336](../../src/contexts/DataContext.tsx), collision-retry [:1211](../../src/contexts/DataContext.tsx) · Pairs with ADR-0001

## Decision

Official document numbers (voucher, receipt, and other statutory sequences) are issued by a **server-authoritative, monotonic sequence per `(society, book/type, financial-year)`**, assigned at the moment of **durable append** to the event log (ADR-0001). Numbers are **never** derived from client-side in-memory state. Sequences are **gapless and non-duplicated** by construction. Entity primary keys remain `crypto.randomUUID()` (this is orthogonal and correct — see Trade-offs).

## Context

Voucher numbers are currently generated on the client from in-memory state — `storage.getNextVoucherNo(type, fy, vouchersRef.current)` — and the code already contains **collision-retry** logic, direct evidence that duplicate numbers occur. Cooperative statutory audit requires **gapless, non-duplicated** sequential numbering; these numbers are printed on receipts, cited in audit reports, and filed with the registrar. Once issued, they become an **external contract** (Class C) that cannot be renumbered without invalidating every document already issued.

## Alternatives Considered

1. **Keep client-side numbering, improve collision-retry (status quo).** Reduces but cannot eliminate gaps/dupes across concurrent devices; unfixable historically.
2. **Client-side numbering with a post-hoc reconciliation sweep.** Renumbers history → breaks already-issued documents.
3. **Server-authoritative sequence issued at durable append (chosen).**

## Why this decision was selected

- Only a **single authority** issuing at durable append guarantees gapless, collision-free numbering across unlimited concurrent writers — the statutory requirement.
- It composes naturally with ADR-0001: the number *is* an attribute of the appended event.
- Alternatives 1 and 2 either can't guarantee conformance or corrupt already-filed records — the definition of an irreversible mistake.

## Trade-offs

- **Requires connectivity / a coordination point** at issue time; pure-offline entry must reserve or defer numbers (offline drafts get their official number on sync).
- **Slightly higher write latency** for the coordination round-trip.
- **Migration:** historical client-generated numbers already in the field cannot be retroactively made conformant — this ADR stops the bleeding forward, and any historical remediation is a documented, one-time exception.

## Long-term consequences

- The official record becomes audit-conformant from cut-over onward; registrar filings are defensible.
- Removes a whole class of "two vouchers with the same number" support incidents.
- Establishes the numbering authority as a reusable primitive for any future statutory sequence.

## When it may be revisited

- If a fully offline-first operating mode becomes a hard product requirement for disconnected PACS — would prompt a **reservation-block** scheme (pre-allocated ranges per device), still server-governed, not a return to local-state derivation.
