# SahakarLekha as the National Cooperative ERP — The Architecture That Survives to 2040

**Companions:** [DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md](DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md) · [DOMAIN-DATABASE-DESIGN-2026-07.md](DOMAIN-DATABASE-DESIGN-2026-07.md) · [DOMAIN-GAP-ANALYSIS-2026-07.md](DOMAIN-GAP-ANALYSIS-2026-07.md)
**Date:** 2026-07-11
**Status:** Architecture vision. No code. No schema changes. Design only.
**Question:** If SahakarLekha becomes *the* national cooperative ERP, what architecture is still valid in **2040**?

---

## 0. How to answer a 15-year question

You cannot design *features* for 2040 — you don't know 2040's bye-laws, tax formats, sectors, or even whether "cooperative" is still the only organizational noun (SHGs, FPOs, producer companies, joint-liability groups, platform collectives are already blurring the edges). So the only honest answer is to separate two things:

- **The invariant core** — decisions that stay true no matter how the domain, policy, or technology churns. This must be *small, principled, and boring.* You bet the next 15 years on it.
- **The volatile edge** — everything that will be rewritten several times: report formats, tax rules, sector taxonomies, integration protocols, UI paradigms, even the current React/Supabase stack. This must be *pushed as far from the core as possible* so its churn never reaches the ledger.

**The durability test** applied to every decision in this doc: *"When the Ministry issues a new bye-law / a new DPI rail launches / the tax regime changes / an AI agent starts doing the bookkeeping — does this decision need to change?"* If yes, it belongs in the edge, not the core.

Today's biggest recurring bug (RULE 1: local state silently diverging from Supabase) is not a bug — it is a **symptom of having no invariant core**. State is treated as the source of truth, so every save is a risk. The 2040 architecture removes that entire class of failure by construction.

---

## 1. The concentric reference architecture

The whole thesis in one picture: an immutable core, wrapped in adapter rings that each churn on a different clock.

```
                    ╭──────────────────────────────────────────────╮
                    │   RING 4 · EXPERIENCE (churns yearly)         │
                    │   web · mobile · voice · conversational · AI  │
                    │   agents — all just principals on the plane   │
                    │  ╭────────────────────────────────────────╮   │
                    │  │  RING 3 · INTEROP (churns per protocol) │   │
                    │  │  DPI adapters: NCD · GSTN · DBT/subsidy  │   │
                    │  │  · Account Aggregator · OCEN · ONDC ·    │   │
                    │  │  DigiLocker — anti-corruption layer      │   │
                    │  │  ╭──────────────────────────────────╮    │   │
                    │  │  │ RING 2 · POLICY (churns per bye-  │    │   │
                    │  │  │ law) capabilities · activities ·   │    │   │
                    │  │  │ jurisdiction · compliance rules —  │    │   │
                    │  │  │ ALL DATA, versioned, effective-    │    │   │
                    │  │  │ dated                              │    │   │
                    │  │  │  ╭────────────────────────────╮    │    │   │
                    │  │  │  │  RING 0 · INVARIANT CORE    │    │    │   │
                    │  │  │  │  (changes on decade scale)  │    │    │   │
                    │  │  │  │  • immutable event ledger   │    │    │   │
                    │  │  │  │  • identity & consent       │    │    │   │
                    │  │  │  │  • the trust plane (RBAC +  │    │    │   │
                    │  │  │  │    entitlement + audit +SoD)│    │    │   │
                    │  │  │  │  • the federation graph     │    │    │   │
                    │  │  │  ╰────────────────────────────╯    │    │   │
                    │  │  │        RING 1 · PROJECTIONS         │    │   │
                    │  │  │   balances, reports, dashboards —  │    │   │
                    │  │  │   derived, disposable, rebuildable │    │   │
                    │  │  ╰──────────────────────────────────╯    │   │
                    │  ╰────────────────────────────────────────╯   │
                    ╰──────────────────────────────────────────────╯
        Clock speed:  Ring 0 ≈ decades · Ring 1 rebuildable anytime · Ring 2 yearly
                      · Ring 3 per-protocol · Ring 4 continuous
```

**The rule that makes it survive:** dependencies point *inward only*. The core knows nothing about GSTN, about "PACS", about React, or about the AI agent. Those know about the core. When 2040's edge is unrecognizable, the core is untouched.

---

## 2. The eight durable invariants (Ring 0)

Each is stated as a principle, why it survives to 2040, what today's design it replaces, and the existing SahakarLekha asset it builds on.

### INV-1 — The system of record is an immutable event log; all state is a projection
Financial and membership truth is an **append-only stream of events** (postings, member joins/exits, approvals, activity toggles). Balances, trial balance, DCB, stock — every number — is a **derived projection** that can be dropped and rebuilt from events. Corrections are **reversing events**, never mutations or deletes.
- **Why it survives:** decades-later audit reconstruction, any future report format, and any regulator's retention rule are all just re-projections of the same immutable history. This is the one decision that is *more* valuable in 2040 than today.
- **Replaces today:** React-state-as-truth + optimistic Supabase upsert with manual rollback (**RULE 1**). The event log makes silent divergence *structurally impossible* — you can't lose a write that was never a mutable overwrite.
- **Builds on:** your existing `voucher_entries`, `isDeleted` soft-cancel, and `editHistory` are already event-shaped; this formalizes them into the authoritative spine. Ties to [[farmer-payment-traceability]] (Payment→Voucher→PostingRuleResult is already an event-trace instinct).

### INV-2 — The domain entity is an *Organization with a capability profile*, not a *Society with a type*
By 2040 "cooperative" is one form among many (FPO, producer company, SHG federation, platform collective). Model the actor as a generic **Organization** whose behavior is defined by its **capability set** (resolved from activities + entitlement + jurisdiction), never by a hardcoded type enum.
- **Why it survives:** organizational forms we cannot yet name are onboarded by giving them a capability profile — zero core change.
- **Replaces today:** `SocietyType` union as an identity ([types/index.ts:984](../../src/types/index.ts)). Type demotes to a *legal-anchor attribute*, not the entity's nature.
- **Builds on:** the capabilities layer already shipped ([capabilityResolver.ts](../../src/lib/navigation/capabilityResolver.ts)) — the hardest part exists. See [[domain-architecture-capabilities]].

### INV-3 — Policy, jurisdiction, and compliance are versioned data + rule engines, never code
Statutory formats, tax rules, subsidy formulas, audit checklists, capability grants — all are **effective-dated, jurisdiction-scoped, versioned rule rows**. A 2040 bye-law is an `INSERT`. Behavior reads the rule engine at a point in time.
- **Why it survives:** the Ministry's roughly-annual bye-law churn, GST reforms, and 28 states' divergent Acts are absorbed as data. Historical behavior stays reproducible because rules are effective-dated.
- **Replaces today:** capabilities-as-data (already the thesis) — generalized from navigation to the *entire compliance surface*.
- **Builds on:** `society_type_capabilities`, jurisdiction packs (Haryana/HAFED), and the entitlement/licensing rows already in `society_capabilities`.

### INV-4 — Every actor — human, integration, or AI — is one principal on a single trust plane
There is exactly one authorization model: **identity → role → capability entitlement → audit trail → segregation-of-duties**. A user, a government integration, and an AI bookkeeping agent are all *principals* subject to the same plane. There is no "AI backdoor" and no "integration bypass."
- **Why it survives:** by 2040 much data entry, reconciliation, and first-pass audit is AI-driven. If AI is governed by the same plane as humans, automation needs **no** governance rewrite — an agent is just a scoped principal whose every action is in the audit log.
- **Replaces today:** RBAC scattered across route guards. Unify into one plane that non-human actors also pass through.
- **Builds on:** [[ecr-06-rbac-state]] (route-scoping + SoD self-approval already shipped) and the existing audit trail / approval-status machinery.

### INV-5 — Identity and consent are a bounded context, separate from financial data
Member identity, KYC, and **consent artifacts (DPDP Act 2023)** live apart from the financial ledger, joined by a stable pseudonymous key. Right-to-erasure vs. statutory-retention is reconciled by **cryptographic tombstoning**: erase the PII, keep the immutable financial event under its pseudonymous key.
- **Why it survives:** data-protection law, localization/residency mandates, and consent-based data sharing only tighten by 2040. Separating identity from ledger lets you honor erasure *without* breaking the append-only financial history (INV-1).
- **Replaces today:** member PII inline in operational tables.
- **Builds on:** existing member registers; this re-homes PII, not the accounting.

### INV-6 — Federation is a first-class graph, not a list of tenants
The cooperative pyramid — primary ↔ district (DCCB) ↔ state (StCB/apex) ↔ national federation — is modeled as **typed relationships with consolidation and jurisdiction-scoped governance**, not as isolated silos. Consolidation rolls up the graph; data-governance scopes down it.
- **Why it survives:** a *national* ERP is inherently a network of networks; NCP 2025's model-village and federation push makes tiering structural, not optional.
- **Replaces today:** effectively single-tenant defaults (`society_id = 'SOC001'`) — the antithesis of national scale.
- **Builds on:** the existing `societies` table and `MultiSocietyConsolidation` page — the seed of the graph exists.

### INV-7 — The ERP is a node in Digital Public Infrastructure, not a silo
Interoperate through **open, versioned, government-grade protocols** behind an **anti-corruption adapter ring**: NCD data exchange, GSTN/e-invoice, DBT & subsidy rails, **Account Aggregator** (consented financial data), **OCEN** (credit), **ONDC** (commerce), DigiLocker/consented-KYC. The core speaks its own language; adapters translate. **Data portability is a right, not a feature.**
- **Why it survives:** NCP 2025 explicitly names a "cooperative stack" and DPI integration. Protocols will version and be replaced; the adapter ring absorbs that so the core never learns a protocol's name.
- **Replaces today:** point integrations (GST, e-way) wired near the domain. Move them to Ring 3.
- **Builds on:** your live data-portability/backup/restore workstream ([[data-portability-restore-workstream]]) — portability discipline already exists; this elevates it to a first-class DPI posture.

### INV-8 — Multi-tenancy and data-residency are in the substrate, not bolted on
Tenant isolation, per-jurisdiction data residency, and horizontal scale are **architectural givens** — partition/shard by jurisdiction, isolate by tenant, from day one of the national build. At 8-lakh-society, 50-crore-member scale (NCP target), this is non-negotiable.
- **Why it survives:** scale and sovereignty requirements only grow; retrofitting tenancy onto a single-DB design is the classic ERP death.
- **Replaces today:** `society_id` defaults and an `id='main'` settings singleton.
- **Builds on:** nothing yet — this is the largest genuinely-new substrate investment.

---

## 3. What is deliberately NOT in the durable core

Naming what stays *out* is as important as what stays in. None of these belong in Ring 0 — all will be rewritten and must live at the edge:

- **Specific society types / sector taxonomies** — Ring 2 data (INV-2/INV-3).
- **Report and statutory formats, tax rates, subsidy formulas** — Ring 2 rules.
- **Integration protocols** (GSTN, AA, ONDC, whatever replaces them) — Ring 3 adapters.
- **The current tech stack** (React, Supabase, the specific DB) — Ring 1/Ring 4 implementation detail. The core is defined by *contracts* (event log, trust plane, capability resolution), not by today's vendors.
- **The word "cooperative" as a hardcoded noun** — INV-2 makes the entity generic.
- **UI paradigm** — by 2040 much interaction may be conversational/agentic; that's Ring 4 and must not leak into the core.
- **AI/ML models** — models churn monthly; they are principals (INV-4) and adapters (Ring 3), never core logic.

If any of these ends up encoded in Ring 0, the architecture has failed the durability test.

---

## 4. The one change that matters most: make the ledger event-sourced

Of the eight invariants, **INV-1 is the keystone** and the biggest departure from today's code — so be concrete about it.

- **Today:** entity state in React is the working truth; Supabase is a best-effort mirror; a failed upsert must be manually rolled back or the user loses work (**RULE 1**). This is fragile *by design*.
- **2040:** an **append-only posting journal** is the system of record. The UI writes an *intent event*; the event is durably appended *before* any projection updates; balances/reports are projections rebuilt from the journal. A failed write is a non-event — there is nothing to diverge. Cancellations and edits are new reversing events (`editHistory` becomes a real event stream, not a JSON afterthought).
- **Migration posture (you do NOT rewrite overnight):** introduce the append-only journal *behind* the current projection as the new system-of-record, dual-write, then cut projections over to read from it. The existing `voucher_entries` + `isDeleted` + `editHistory` are already 60% of an event model — this is a promotion, not a greenfield. This single move **retires the entire RULE 1 failure class** and unlocks INV-5 (tombstoning), INV-6 (consolidation = re-projection up the graph), and decades-later audit.

---

## 5. What of today's design is already 2040-valid (keep, don't touch)

Be clear about what *not* to redo — several current decisions already pass the durability test:

| Already durable | Invariant it serves |
|---|---|
| Capability gate + pure resolver ([capabilityResolver.ts](../../src/lib/navigation/capabilityResolver.ts)) | INV-2, INV-3 |
| Entitlement/licensing with server-controlled sources + RLS trust model | INV-3, INV-4 |
| Jurisdiction packs (state → capability) | INV-3 |
| Audit trail, approval status, SoD ([[ecr-06-rbac-state]]) | INV-4 |
| `voucher_entries` / `isDeleted` / `editHistory` shapes | INV-1 (event seed) |
| Data-portability / backup / restore discipline ([[data-portability-restore-workstream]]) | INV-7 |
| FY-lock (RULE 6), soft-cancel cascades (RULE 3) | INV-1 correctness |

The 2040 architecture is **~50% latent in the current codebase**. The work is promoting these from conventions to a formal invariant core, and building the three genuinely-new pieces: the **event journal (INV-1)**, the **federation graph (INV-6)**, and **substrate multi-tenancy (INV-8)**.

---

## 6. Honest uncertainties (the bets, stated plainly)

- **"Immutable/verifiable ledger" — yes; "blockchain" — undecided.** The *property* (append-only, tamper-evident, independently auditable) is a safe 2040 bet. The *implementation* (distributed ledger vs. a signed append-only log) is a Ring-1 choice, not a core commitment. NCP 2025 name-checks blockchain; don't marry it in the core.
- **AI as author vs. AI as assistant.** INV-4 holds either way — but if AI becomes the *primary* author of entries by 2040, the trust plane's SoD and audit requirements get *heavier*, not lighter. Design the plane assuming autonomous principals.
- **Sovereignty could fragment the graph.** If data-residency law forces per-state data boundaries, INV-6's consolidation must work over *federated* (not co-located) data. Design consolidation as re-projection over a boundary, not a join.
- **The entity might not be an "organization" either.** Individual-member-centric models (a member's data portable across societies via Account Aggregator) could rival the org-centric model. INV-2 + INV-5 (identity separated) hedge this — a member is a first-class identity, not just a row inside a society.

---

## 7. Conclusion — the answer in three sentences

The architecture still valid in 2040 is **not a set of features — it is a small invariant core (an immutable event ledger, a generic organization-with-capabilities entity, a single trust plane for humans and AI, and a federation graph) wrapped in adapter rings that absorb all policy, protocol, and UI churn as data at the edge.** SahakarLekha already has ~half of this latent in its capabilities layer, entitlement model, audit trail, and event-shaped vouchers; the three genuinely new investments are the **event-sourced ledger** (which also retires today's worst bug class, RULE 1), the **federation graph**, and **substrate-level multi-tenancy**. Everything the Ministry can invent between now and 2040 — new sectors, bye-laws, tax regimes, DPI rails, AI actors — was designed to land in Ring 2/3/4 as data or adapters, so the core you build now is the core you still run in 2040.
