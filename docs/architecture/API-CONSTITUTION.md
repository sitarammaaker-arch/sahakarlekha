# SahakarLekha — API Constitution

- **Status:** Accepted — supreme law for every interface across which SahakarLekha exchanges data or effects with the outside world (public API, events, government, banking, import/export).
- **Date:** 2026-07-11
- **Sits on:** [ADR-0004 Export Contract](../adr/0004-export-contract.md) · [ADR-0001 Event Ledger](../adr/0001-event-ledger-system-of-record.md) · [ADR-0007 Identity](../adr/0007-identity-and-consent-model.md) · [ADR-0009 Federation & Residency](../adr/0009-federation-graph.md) · [ADR-0002 Capabilities](../adr/0002-capability-driven-architecture.md) · [ADR-0008 Rules Engine](../adr/0008-rules-engine.md) · [AI Constitution](AI-CONSTITUTION.md) · [Canonical Financial Data Model](CANONICAL-FINANCIAL-DATA-MODEL.md) · 2040-Vision INV-7 (DPI node behind an anti-corruption ring) · Project RULES 1 & 6.
- **Scope:** documentation only. No code, no endpoint specs, no schema. Defines the **contracts, semantics, and boundaries** of every interface — not their implementation.

> Every dependency points **inward**. The core knows nothing about GSTN, NPCI, NABARD, or any partner. Adapters know the core. When 2040's protocols are unrecognizable, the core is untouched. That single rule (INV-7) is the spine of this Constitution.

---

## Article 0 — Foundational principles

- **API-P1 · The API is a contract, not a window into the database.** What we expose is a **stable, versioned, domain-oriented contract**, deliberately **distinct from internal storage** (ADR-0004). No caller ever sees the internal camelCase/JSONB table shape; the internal schema stays free to change.
- **API-P2 · Protocol-agnostic core, adapter-mediated edge.** All external protocols (government, banking, commerce) live in an **anti-corruption ring** of adapters that translate external ⇆ canonical. The core speaks only canonical (INV-7). Protocol churn is absorbed at the edge as data/adapters, never in the core.
- **API-P3 · Every caller is a principal on the single trust plane.** An API client, an integration, and an AI agent are the **same kind of thing**: an authenticated principal with a role and **capability entitlements it can never exceed** (ADR-0002, ADR-0010). Least privilege; tenant- and jurisdiction-scoped; fully audited.
- **API-P4 · Mutations obey the same laws as internal writes.** A write over the API is not a shortcut around the constitution: double-entry (CL-1), immutability with reversing-corrections (CL-2), exact money (ADR-0006), FY/period lock (RULE 6), cascade completeness (CL-9), and attribution (CL-7) all apply identically. The API cannot do what the app is forbidden to do.
- **API-P5 · Events over polling; the ledger is the backbone.** Outbound integration is **event-native**, projected from the immutable event log (ADR-0001) — durable, ordered, replayable — not screen-scraping or polling snapshots.
- **API-P6 · Consent- and residency-first.** Data crosses a boundary **only** with consent (ADR-0007/DPDP) and **only within its lawful jurisdiction** (ADR-0009). **No PII in URLs, query strings, or logs.** Portability is a member/society **right**, not a favor.
- **API-P7 · External input is data, never instructions or truth.** Anything arriving over the API — a bank statement, a subsidy file, a partner payload — is **untrusted data**: validated, authorized, and reconciled before any effect; never obeyed as a command (mirrors AI-P7), never trusted as correct because it came from "the government/bank."
- **API-P8 · Money is never moved autonomously.** The API may **prepare** a payment/filing instruction; execution of money movement or statutory finalization requires **explicit human authority** through regulated rails (mirrors AI-N1/AI-N2, platform prohibited-actions). SahakarLekha is a system of record, **not** a payment processor or money custodian.
- **API-P9 · Idempotent by construction.** Every mutating call carries an **idempotency key**; retries, replays, and network failures never double-post. Financial operations are effectively exactly-once.
- **API-P10 · Backward compatibility is sacred.** External consumers (government, banks, archives) **freeze** contracts (Class-C irreversibility, IRR-6). Change is additive and versioned with long deprecation windows; nothing already published is ever silently broken.

---

## Article I — API philosophy

- **Contract-first & domain-oriented.** Resources are **domain nouns** from the Canonical Model (societies, members, vouchers, entries, loans, procurement receipts, statements) — never table dumps. The vocabulary is the domain, stable across storage refactors.
- **Read-broad, write-narrow.** Read access is generous within a principal's entitlement and tenant scope; write access is guarded, capability-gated, and law-bound (API-P4). Reporting/statement reads are **projections** (CL-4), reproducible as-of any date.
- **Predictable, explicit, boring.** Uniform resource semantics, explicit error contracts (machine-readable reason + human Hindi-first message per RULE 7), no hidden side effects, no surprise mutations. Surprising APIs are defects.
- **Capability-scoped surface.** What an API principal can see or do is exactly its resolved capabilities (ADR-0002) ∩ the acting tenant's entitlement — the same resolution the UI and AI use. There is no privileged "API backdoor."
- **Self-describing & discoverable.** The contract is documented, versioned, and machine-discoverable; every field maps to a canonical meaning and, where it crosses a boundary, to a **stable external code** (ADR-0008), never a raw internal enum (IRR-9).

---

## Article II — Versioning

- **VER-1 · Explicit, major-versioned contracts.** Every public contract (REST resource, event type, export format) carries a **major version**. Breaking changes require a **new major version**; the old one keeps working through a published deprecation window.
- **VER-2 · Additive within a version.** Within a major version, only **backward-compatible additions** are allowed (new optional fields, new event types, new endpoints). Consumers must **ignore unknown fields** — tolerant reading is required of both sides.
- **VER-3 · The wire contract is versioned independently of storage.** Storage may evolve (JSONB→typed columns, re-partitioning, even a different database) with **zero** impact on the API version (ADR-0004). Versioning tracks the **contract**, not the implementation.
- **VER-4 · Event & export payloads are versioned in-band.** Each event and each export record declares its `schemaVersion`; consumers negotiate by version. Historical archives remain readable forever by their stated version.
- **VER-5 · Deprecation is announced, dated, and monitored.** Deprecations are communicated with a firm sunset date and usage telemetry; a version is retired only after consumers have migrated. Government/bank/archive consumers get the **longest** windows (Class-C).
- **VER-6 · No silent semantics changes.** The meaning of an existing field/code never changes within a version; a changed meaning is a new field or a new version (Canonical immutability doctrine applied to contracts).

---

## Article III — Authentication & authorization

- **AUTH-1 · Delegated identity, not a bespoke key zoo.** API identity aligns with the platform identity model (ADR-0007): federated/DPI-aligned identity for humans; scoped machine credentials for integrations. SahakarLekha's own credential table is **not** the identity root (IRR-5).
- **AUTH-2 · Principal + tenant + jurisdiction on every call.** Every request resolves to a **principal**, an **acting tenant** (society/federation node), and a **jurisdiction** — the authorization and residency scope (ADR-0009). No cross-tenant reach; no cross-jurisdiction data egress.
- **AUTH-3 · Least privilege & capability scope.** A credential grants the **minimum** capabilities for its purpose (a bank-reconciliation integration cannot read the member register). Scopes are capabilities (ADR-0002); an integration can never exceed the entitlement of the tenant or the human that authorized it.
- **AUTH-4 · On-behalf-of is explicit and audited.** When an integration or agent acts for a human, both principals are recorded (CL-7, AI-A2). Consent for the specific data/purpose is captured and revocable (ADR-0007).
- **AUTH-5 · Secrets are never exposed.** Credentials/keys/tokens never appear in URLs, query strings, logs, events, or prompts (API-P6, AI-S3). Secrets are vaulted; rotation and revocation are first-class.
- **AUTH-6 · Strong controls on write & money paths.** Mutating and payment-preparation calls require stronger authentication and, for money/statutory effects, **human authorization** (API-P8) and SoD (independent approver) — an integration cannot both propose and finalize a financial effect.
- **AUTH-7 · Sandbox ≠ production.** Test credentials operate only against isolated sandbox data; production access is separately provisioned and governed (Article V).

---

## Article IV — Event model

- **EVT-1 · Events are immutable facts, projected from the ledger.** Outbound events are past-tense facts (`voucher.posted`, `member.admitted`, `loan.disbursed`, `procurement.received`, `voucher.reversed`) projected from the immutable event log (ADR-0001) via a **transactional outbox** — so an emitted event always corresponds to a durably-committed fact, and vice versa.
- **EVT-2 · Canonical event envelope.** Every event carries: `eventId`, `eventType`+`schemaVersion`, `tenantId`, `jurisdiction`, aggregate reference, `occurredAt`, a per-aggregate ordering **sequence**, `producer`, and a **versioned payload** (contract shape, not storage shape). PII is minimized/pseudonymous (Canonical `identityRef`).
- **EVT-3 · Delivery semantics: at-least-once + consumer idempotency.** Delivery is at-least-once; consumers **deduplicate by `eventId`** (API-P9). **Ordering is guaranteed per aggregate/tenant**, not globally.
- **EVT-4 · Replayable from a cursor.** Because events derive from the immutable log, a consumer can **replay** from any cursor to rebuild its state — the basis for reliable, recoverable integration (no lost-webhook data loss).
- **EVT-5 · Corrections are new events, never edits.** A mistaken fact is corrected by a **reversing/compensating event** (`*.reversed`) that references the original (CL-2). Events are never mutated or withdrawn.
- **EVT-6 · Push and pull, both signed & authorized.** Webhooks are **signed and verifiable**; a pull event-stream is offered for consumers that prefer to poll a durable cursor. Both require the consumer to hold the capability for the data class; no event carries data the consumer isn't entitled to.
- **EVT-7 · Events are a contract.** Event types/payloads are versioned (VER-4) and additively evolved; retiring an event type follows the deprecation discipline (VER-5).

---

## Article V — Integration model

- **INT-1 · Anti-corruption ring.** Every integration is an **adapter**: an **inbound** adapter translates external → canonical (validating per API-P7); an **outbound** adapter translates canonical → external. The core is never coupled to a partner's schema, auth, or quirks (INT-P2/INV-7).
- **INT-2 · Integrations are registered, scoped principals.** Each integration is registered with an owner, a tenant scope, a capability scope (AUTH-3), consent basis, rate limits, and a full audit trail. It behaves exactly like any principal on the trust plane.
- **INT-3 · Entitlement-gated (marketplace).** Integrations light up via the entitlement system (capability sources `plugin`/`plan`, ADR-0002) — a society **opts in**, and can **opt out**, per integration. No integration is silently active.
- **INT-4 · Partner classes.** (a) **Government** (Article VI); (b) **Banking/Payments** (Article VII); (c) **Commerce** (e.g. ONDC) and **Credit** (e.g. OCEN) rails; (d) **Accounting/Migration** (e.g. Tally import); (e) the **society's own** apps/portals. Each class has a standard adapter contract; none reaches the core directly.
- **INT-5 · Resilience & isolation.** Adapters fail **closed and isolated** — a down or misbehaving partner degrades that integration only, never core accounting (parallels AI kill-switch AI-G4). Retries are idempotent (API-P9); back-pressure and circuit-breaking are expected.
- **INT-6 · Observability & abuse control.** All integration traffic is rate-limited, monitored, and anomaly-flagged (parallels AI-S5). Unusual volume or scraping is throttled and surfaced to humans.
- **INT-7 · Data-egress discipline.** An adapter may send outward **only** the data the tenant consented to, for the stated purpose, within jurisdiction (API-P6). No compiling or forwarding of member data to destinations the society didn't authorize.

---

## Article VI — Government integrations

Each is an **adapter** in the anti-corruption ring; external codes are mapped at the boundary (ADR-0008); statutory **filings require human/authorized-officer authority** (API-P8, RULE 6), never autonomous submission.

| Integration | Direction | Constitution notes |
|---|---|---|
| **National Cooperative Database (NCD)** | Outbound (report/exchange) | Canonical heads mapped to NCD category/sector codes; a **projection** of the ledger (CL-4); consent/residency-scoped. |
| **GSTN / e-invoice / e-way bill** | Bidirectional | Tax data via adapter; returns **prepared** by the system, **filed under human authority**; idempotent submissions. |
| **Income Tax / TDS / TRACES** | Outbound | TDS statements, Form-16A, §80P-aware computations from the Rules Engine (never the LLM, AI-P3); member/non-member classification carried (UCAS-P5). |
| **PFMS / DBT & subsidy rails** | Bidirectional | Subsidy claims & reconciliation (VP-FAIR-PRICE); inbound subsidy files are **untrusted data**, validated & reconciled (API-P7). |
| **Registrar of Cooperative Societies (RCS) returns** | Outbound | State-Act statutory formats as projections; jurisdiction-scoped rules (ADR-0008); filed under authority. |
| **DigiLocker / Aadhaar (consented KYC)** | Inbound | Consent-first identity/KYC (ADR-0007); **no Aadhaar/PII in URLs or logs** (API-P6); minimal, purpose-limited. |
| **Account Aggregator (RBI framework)** | Inbound | Consented financial-data sharing; consent artifact recorded; residency-respecting; read-only financial data, validated before use. |

**Cross-cutting:** government payloads are versioned contracts (VER-4); a format change is a new adapter/contract version, never a core change; all submissions are logged for regulator-grade audit (CL-7, AI-A5 parallel).

---

## Article VII — Banking integrations

The governing sentence: **SahakarLekha reconciles and prepares; regulated rails and humans move money.**

| Capability | Direction | Constitution notes |
|---|---|---|
| **Bank statement ingestion** | Inbound | Via Account Aggregator or authorized bank feed, **consent-based**; statements are **untrusted data** reconciled against the ledger (API-P7); read-only. |
| **Reconciliation** | Internal (fed by inbound) | Auto-match candidates are **proposals**; a human confirms postings (parallels AI Tier-D); corrections are reversing entries (CL-2). |
| **Payment initiation (UPI/NEFT/RTGS/IMPS/BBPS)** | Outbound (prepare-only) | The API **prepares** a payment instruction; **execution requires explicit human authorization** and goes through the **regulated rail**, not SahakarLekha (API-P8, AI-N2). **Never autonomous.** SoD: preparer ≠ authorizer. |
| **Balance / transaction fetch** | Inbound | Consented, read-only, residency-scoped; feeds reconciliation and cash projections. |
| **Cooperative banking linkage (DCCB / StCB / NABARD / apex)** | Bidirectional | Borrowings, deposits, and federation flows modeled through the federation graph (ADR-0009); statutory to the cooperative tier structure. |

- **BANK-1 · Not a money custodian / not a PSP.** SahakarLekha never holds member funds or acts as a payment service provider. It records and reconciles money that moves through banks and rails.
- **BANK-2 · Exact money end-to-end.** Amounts exchanged with banks are exact minor units with explicit currency (ADR-0006); reconciliation tolerances are explicit, recorded rules, never silent rounding.
- **BANK-3 · Regulated-rail conformance.** Payment adapters conform to the rail's mandates (NPCI/RBI); credentials vaulted (AUTH-5); every prepared/authorized/settled step audited.

---

## Article VIII — Import/Export contracts

- **IE-1 · The export IS the contract.** `.slbak`, bulk exports, statutory submissions, and portability dumps serialize the **versioned domain contract** (ADR-0004), never the internal storage shape. The instant an external system parses an export, that contract is frozen (IRR-6) — so it must be deliberate and versioned from v1.
- **IE-2 · Import is validated, idempotent, and law-abiding.** Bulk imports (accounts, members, opening balances, vouchers, migrations) are **validated against the Canonical Model** (double-entry, referential integrity), **respect the FY/period lock** (RULE 6), and are **idempotent** (re-running an import never duplicates — API-P9). Imported records carry `source = import` provenance (CL-7).
- **IE-3 · Preview / dry-run before commit.** Every import supports a **dry-run** that reports what would change and what would be rejected, before any state change — a human commits (parallels AI Tier-D / RULE 1 two-step safety).
- **IE-4 · Explicit partial-failure semantics.** Import outcomes are explicit per record (accepted/rejected/why); there is **no silent partial success** and **no silent truncation** — a rejected financial row is reported, never dropped quietly (RULE 1 discipline extended to bulk).
- **IE-5 · Export completeness & honesty.** Exports state their scope, version, and any applied filter; a bounded export declares what it omitted (no "looks complete but isn't"). Statutory exports are **projections** reproducible as-of a date (CL-4).
- **IE-6 · Portability is a right.** A society (and, via consent, a member) can export **their** data in the versioned contract to take elsewhere — a first-class DPDP/INV-7 obligation, not a retention lever. Restore re-imports the same versioned contract.
- **IE-7 · Migration adapters are inbound anti-corruption.** Importers for external software (e.g. Tally) are adapters that translate foreign shapes → canonical, validating like any untrusted input (API-P7); they never bypass Canonical laws.
- **IE-8 · No PII leakage in transit or naming.** Export files, filenames, and transfer channels carry no PII in the clear beyond purpose; residency and consent govern where an export may go (API-P6).

---

## Article IX — Precedence, amendment & revisit

- **Precedence.** Subordinate to the platform's own safety rules and Indian law; supreme over any integration requirement or partner demand *within* SahakarLekha. A partner's convenience never overrides API-P4 (mutation laws), API-P6 (consent/residency), API-P8 (no autonomous money movement), or API-P10 (backward compatibility).
- **Immutability of the load-bearing walls.** These change only by a superseding, ratified amendment (recorded as an ADR), never by expedience:
  - **API-P2** — protocol-agnostic core / anti-corruption ring.
  - **API-P4** — API mutations obey all Canonical laws.
  - **API-P6** — consent- and residency-first; no PII in URLs.
  - **API-P8** — money/statutory finalization is human-authorized, never autonomous.
  - **API-P10 / VER-*** — published contracts are never silently broken.
- **When it may be revisited.**
  - When a new government/DPI rail launches (NCD v2, a national cooperative interchange, a new subsidy or credit rail) — add an **adapter + contract version**, never a core change.
  - When India mandates a specific interchange or open-API standard — adopt it as a **contract version** behind the ring (INV-7).
  - When event/integration volume at national scale demands new delivery guarantees — strengthen EVT-* semantics; never weaken idempotency or ordering.

---

## One-paragraph statement

SahakarLekha's API is a **deliberate, versioned, domain contract** — never a window into its database — behind which a **protocol-agnostic core** is insulated by an **anti-corruption ring of adapters** that speak to government, banks, and commerce so the core never learns their names. Every caller is a **least-privilege principal on the same trust plane** as humans and AI, scoped to a tenant and jurisdiction; every write obeys the same double-entry, immutability, FY-lock, and exact-money laws as an internal write; every outbound integration is **event-native and replayable** from the immutable ledger; and **no money moves and no statutory return is filed without explicit human authority**. Data crosses a boundary only with consent, only within its jurisdiction, and never with PII in a URL — because at national scale the contracts SahakarLekha publishes today are the contracts it must honor in 2040.
