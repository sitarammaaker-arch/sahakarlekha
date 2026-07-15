# ADR-0007 — Identity, PII & Consent Model

- **Status:** Accepted — planned (not yet implemented)
- **Date:** 2026-07-11
- **Traceability:** IRR-3, IRR-5 (Class B+D), INV-5 · [Irreversible Decisions IRR-3/IRR-5](../research/DOMAIN-IRREVERSIBLE-DECISIONS-2026-07.md), [2040 Vision INV-5](../research/DOMAIN-ARCHITECTURE-2040-VISION.md) · Code: `society_users.password` [supabase-tables.sql:66](../../supabase-tables.sql)

## Decision

**Identity, KYC, and consent form a bounded context, separated from the financial ledger** and joined to it only by a stable **pseudonymous key**. The ledger stores the key, never the person. **Right-to-erasure (DPDP Act 2023) is reconciled with statutory retention by cryptographic tombstoning**: erase/anonymize the identity record, retain the (now-pseudonymous) financial events (ADR-0001). The **credential/identity root is delegated** to a proper identity provider / DPI-aligned identity (consented Aadhaar/DigiLocker where lawful) behind an auth adapter — SahakarLekha's own `password` table is not the national identity root.

## Context

Member and counterparty PII currently sits **inline** in operational/financial tables, and authentication uses a self-managed `society_users.password` store (platform-admin is JWT-less). As the national OS: (a) DPDP grants erasure while cooperative law demands ~8-year retention — inline PII in immutable rows satisfies neither (IRR-3, Class B); (b) a self-rolled credential store becomes the identity root for millions of accounts, a permanent liability whose historical compromise is unrecallable (IRR-5, Class D); (c) data-residency law may require a state's members' PII to reside in-region.

## Alternatives Considered

1. **Keep PII inline + self-managed credentials (status quo).** Cannot satisfy erasure-vs-retention; concentrates identity liability.
2. **Encrypt inline PII in place.** Helps confidentiality but not erasure-vs-retention (encrypted PII is still PII entangled with the ledger) nor the identity-root problem.
3. **Separate identity/consent context + pseudonymous ledger key + delegated identity root (chosen).**

## Why this decision was selected

- Only separation lets erasure and retention **both** be honored — tombstone identity, keep pseudonymous financial history intact (depends on ADR-0001's reversing-events model).
- Delegating the credential root removes an irreversible national-scale liability surface and aligns with consented DPI identity.
- Separation is the enabler for **data-residency** placement of PII independently of ledger data (ADR-0009 jurisdiction key).
- Alternatives 1–2 leave a legally unsatisfiable and irreversible entanglement.

## Trade-offs

- **Join complexity:** every member-facing view now resolves identity via the pseudonymous key across two contexts.
- **Consent lifecycle machinery** (capture, versioning, revocation) is new surface to build and audit.
- **Auth migration risk:** moving the credential root for existing users is delicate and must preserve access continuity.

## Long-term consequences

- Erasure requests become executable without corrupting audited financials — a hard legal requirement met by design.
- PII can be placed/residency-scoped independently of the financial ledger.
- Identity compromise blast-radius is bounded by the external provider's posture, not SahakarLekha's own table.

## When it may be revisited

- If a national cooperative identity scheme (member-centric, portable via Account Aggregator) emerges — the pseudonymous-key seam already anticipates a member as a first-class, cross-society identity.
- If DPDP implementation rules materially change retention/erasure balance (the *policy* is data; the *separation* is the durable decision).
