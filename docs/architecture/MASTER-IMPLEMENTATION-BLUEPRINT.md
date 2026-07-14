# SahakarLekha — Master Implementation Blueprint

- **Status:** Accepted — the master engineering roadmap. Operationalizes the **frozen** architecture corpus into implementation tasks. Creates **no new architecture**.
- **Date:** 2026-07-11
- **Inputs (all frozen, treated as law):** the full research corpus (`docs/research/*`), the 10 ADRs, the [Canonical Financial Data Model](CANONICAL-FINANCIAL-DATA-MODEL.md), [UCAS](UNIVERSAL-COOPERATIVE-ACCOUNTING-STANDARD.md), the [AI Constitution](AI-CONSTITUTION.md), the [API Constitution](API-CONSTITUTION.md), the [Digital Preservation Strategy](DIGITAL-PRESERVATION-STRATEGY.md), and the [Research Completeness Review](../research/RESEARCH-COMPLETENESS-REVIEW-2026-07.md) (research phase complete).
- **Scope:** documentation only. No code. This is *what to build and in what order to make the product conform to the approved architecture* — not how to write it.

> **Prime directive.** Every task below closes a delta between the **current implementation** and the **approved architecture**. If a task appears to require a new decision, it is out of scope — the decision already exists in a frozen document, or the task is wrong.

---

## 1. How to read this blueprint

**Each task carries all ten required attributes:**

| Attribute | Meaning |
|---|---|
| **Priority** | P0 (conformance-critical / irreversible-window) · P1 (important) · P2 (deferrable) |
| **Dependencies** | Task IDs that must land first |
| **Complexity** | S (days) · M (1–2 wks) · L (3–6 wks) · XL (quarter+) |
| **Breaking risk** | Low / Med / High — risk to *existing production data or behavior* |
| **Files/modules** | Primary code surface (indicative, from the current repo) |
| **DB impact** | Schema/data changes required |
| **Migration impact** | One-time data migration / backfill needed |
| **Testing** | Verification gates (honoring RULES 1/2/6) |
| **Rollback** | How to revert safely |
| **Acceptance** | Definition of done |

**Sequencing principle (from the corpus, not invented):** *irreversible-data foundations first* (you write history once — [IRR doc](../research/DOMAIN-IRREVERSIBLE-DECISIONS-2026-07.md)), then the *keystone event ledger* (ADR-0001), then *domain/accounting conformance*, then *external surface & AI*, then *scale & preservation*. Reversible/UI work is deliberately last.

**Already built — NOT re-tasked** (kept as-is): capability layer + pure resolver + entitlement/RLS (ADR-0002 in force); route-scoped RBAC + SoD self-approval ([[ecr-06-rbac-state]]); client + weekly-server backup/restore (live); soft-cancel cascades, FY-lock, per-item routing (RULES 3/4/5/6). Tasks *extend* these, not rebuild them.

---

## 2. Phase & dependency map

```
P0 ─ Phase 0  Irreversible-Data Foundations ──► Phase 1  EVENT LEDGER (keystone) ──► Phase 2  Activities & Capability Completion
        (stamp keys, exact money,                  (append-only journal,                 (activities layer, resolve-within-
         server numbering, export                   projections, reversing               entitlement, backfill parity,
         contract, typed financial cols)            corrections — retires RULE 1)         retire type-branching)
                                                              │
        ┌─────────────────────────────────────────────────────┼───────────────────────────────────────────┐
        ▼                         ▼                            ▼                        ▼                     ▼
P1 ─ Phase 3 Rules Engine   Phase 4 Identity/PII/Consent  Phase 5 UCAS & Statutory  Phase 6 API & Integr.  Phase 7 AI Conformance
        (effective-dated,        (pseudonymous key,           (appropriation, statement  (versioned API, event    (scoped principal,
         jurisdiction rules)      delegated auth, DPDP)        set, year-end close)       stream, adapters,        propose-not-commit,
                                                                                          govt + banking)          audited, memory, kill-switch)
        │
        ▼
P0* ─ Phase 8  Offline-First & Sync  ──►  P2 ─ Phase 9 Federation Graph  ──►  Phase 10 Preservation  ──►  Phase 11 Localization
        (*Critical-but-sequenced:            (tiers, consolidation-as-           (rehearsal, off-vendor,      (vernacular beyond
         design constrains Phase 1;           re-projection, residency)          OAIS/PDF-A, continuity)      Hindi)
         delivery needs ledger+numbering)

  ⛔ Parked (external dependency): NABARD CAS conformance — blocked awaiting authoritative spec (see [[ecr-23-nabard-cas-blocked]]).
```

**Critical path:** T-02/T-03 → T-06 → T-08/T-09 → (T-10..T-14) → everything else. The event ledger (T-06) is the single widest dependency.

---

## 3. Phase 0 — Irreversible-Data Foundations (P0)

*Cheap now, catastrophic later. Additive, low-breaking, and independent enough to start immediately. Stops writing un-fixable history while the ledger is built.*

### T-01 · Stamp `(tenant_id, jurisdiction)` on every financial row
- **Priority** P0 · **Deps** none · **Complexity** M · **Breaking risk** Low
- **Files/modules** `supabase-tables.sql`, `DataContext.tsx`, `storage.ts`, every entity in `lib/export/entities/*`
- **DB impact** Add nullable `jurisdiction` (and confirm `society_id` present) on all financial tables; index. Additive.
- **Migration impact** Backfill `jurisdiction` from society state; `society_id` already defaults `SOC001`.
- **Testing** Every write includes both keys; residency query returns correct partition; no existing read breaks.
- **Rollback** Columns are additive/nullable → leave in place; disable write-path stamping via flag.
- **Acceptance** 100% of new financial rows carry `(tenant_id, jurisdiction)`; backfill leaves zero nulls; grounded in IRR-4 / ADR-0009.

### T-02 · Exact minor-unit money discipline (compute layer)
- **Priority** P0 · **Deps** none · **Complexity** L · **Breaking risk** Med
- **Files/modules** `DataContext.tsx` (~53 float sites), report aggregators, `lib/export/*`; a money util
- **DB impact** Storage already `numeric` (exact) — no change; optionally record rounding-policy field.
- **Migration impact** None to historical rows (they stay); forward computations become exact.
- **Testing** Trial balance ties to the paisa; RULE 2 stock/Trading formula reconciles; rounding policy recorded and replayable.
- **Rollback** Feature-flag the money util; revert to prior arithmetic per module.
- **Acceptance** No IEEE-754 float in any money path; every rounding step recorded; ADR-0006 satisfied.

### T-03 · Server-authoritative gapless document numbering
- **Priority** P0 · **Deps** none (pairs with T-06) · **Complexity** L · **Breaking risk** Med
- **Files/modules** `storage.ts` (`getNextVoucherNo`), `DataContext.tsx` (numbering + collision-retry :1211), server/edge sequence authority
- **DB impact** Per-`(society, book, FY)` monotonic sequence store.
- **Migration impact** Historical client-numbers left as-is (documented exception); forward numbers server-issued.
- **Testing** Concurrent multi-device entry yields zero gaps/duplicates; offline draft gets official number on sync (reservation-block).
- **Rollback** Flag back to client numbering (degraded) if authority unavailable.
- **Acceptance** No duplicate/gapped numbers post-cutover; collision-retry code removed; ADR-0005 satisfied.

### T-04 · Versioned domain export contract v1 (decoupled from storage)
- **Priority** P0 · **Deps** none · **Complexity** L · **Breaking risk** Low
- **Files/modules** `lib/export/*`, `.slbak` serializer/deserializer, restore path
- **DB impact** None (contract sits above storage).
- **Migration impact** None. The `.slbak` format was born carrying `formatVersion = "1.0"` — no pre-version "v0" archive was ever written (see `lib/backup/manifest.ts`), so there is nothing to read as v0. Version negotiation (`classifyFormatVersion`) correctly refuses a no-/0.x-version archive. Recorded in `docs/architecture/EXPORT-CONTRACT-v1.md §5`.
- **Testing** Round-trip export→import = identical state; v0 archives still restore; no PII in filenames.
- **Rollback** Keep v0 path until v1 proven; version negotiation prevents breakage.
- **Acceptance** Export shape is a documented, versioned contract ≠ table shape; ADR-0004 / IRR-6 satisfied; underpins Phases 6 & 10.

### T-05 · Promote financially-material JSONB → typed, constrained columns
- **Priority** P1 · **Deps** T-04 · **Complexity** M · **Breaking risk** Med
- **Files/modules** `supabase-tables.sql`, voucher `lines`/`billAllocations`, sales/purchase tax fields, `DataContext.tsx`
- **DB impact** New typed columns; JSONB retained for genuinely free-form config only.
- **Migration impact** Backfill typed columns from existing JSONB; validate integrity.
- **Testing** Reports read typed fields; constraints hold; RULE 2 reconciliation unchanged.
- **Rollback** Dual-read (typed + JSONB) during transition; revert reads to JSONB.
- **Acceptance** No money-material field lives only in unconstrained JSONB; IRR-7 satisfied.

---

## 4. Phase 1 — Event Ledger (P0, keystone — ADR-0001)

*The single highest-leverage phase. Retires the RULE 1 failure class and underwrites audit, preservation, API events, and AI attribution. **Offline-readiness (Phase 8) is a design constraint on this phase** — build the journal and numbering (T-03) sync-aware.*

### T-06 · Append-only event journal as system of record (dual-write)
- **Priority** P0 · **Deps** T-02, T-03 · **Complexity** XL · **Breaking risk** High
- **Files/modules** new ledger core; `DataContext.tsx` save paths; `supabase-tables.sql`
- **DB impact** New append-only event store (immutable); existing tables become projections.
- **Migration impact** Seed the journal from current state as an opening "genesis" set; dual-write during transition.
- **Testing** Every mutation appends before projection updates; a forced write-failure loses nothing (RULE 1 gone); replay reproduces current state exactly.
- **Rollback** Dual-write means projection remains authoritative until cutover; disable journal write without data loss.
- **Acceptance** Journal is durable-first; state derivable from events; ADR-0001 / INV-1 satisfied.

### T-07 · Projection/rebuild engine (balances, ledger, reports)
- **Priority** P0 · **Deps** T-06 · **Complexity** L · **Breaking risk** Med
- **Files/modules** report aggregators, `getTrialBalance`/`getProfitLoss`/`getTradingAccount`, inventory `computedStockMap`
- **DB impact** Materialized projection caches (rebuildable).
- **Migration impact** Rebuild projections from journal; reconcile to current reports.
- **Testing** Projection == current report for all historical periods (parity); rebuild is deterministic; RULE 2 formula centralized.
- **Rollback** Fall back to direct-table reads while projections stabilize.
- **Acceptance** Every aggregate is a rebuildable projection (CL-4); as-of-date reporting works.

### T-08 · Reversing-correction model (edit = reverse + repost)
- **Priority** P0 · **Deps** T-06 · **Complexity** M · **Breaking risk** Med
- **Files/modules** voucher edit/cancel paths, `editHistory` → event stream, cascade logic (RULE 3)
- **DB impact** Corrections are new events referencing originals; no in-place mutation.
- **Migration impact** None (forward behavior).
- **Testing** No posted record is ever mutated/hard-deleted; reversals cascade to dependents (RULE 3/CL-9); audit shows full chain.
- **Rollback** Feature-flag; legacy edit path retained until proven.
- **Acceptance** CL-2 immutability enforced product-wide; `editHistory` is a real event stream.

### T-09 · Cut reads to the ledger; deprecate state-as-truth
- **Priority** P0 · **Deps** T-07, T-08 · **Complexity** M · **Breaking risk** High
- **Files/modules** `DataContext.tsx` (optimistic-state pattern), all consumers
- **DB impact** None new; flips the source of truth.
- **Migration impact** Per-tenant feature-flagged cutover with parity check.
- **Testing** Empty-diff parity per tenant before flip; RULE 1 destructive-toast path becomes unreachable (nothing to diverge).
- **Rollback** Flip flag back to projection-authoritative.
- **Acceptance** Ledger is authoritative; RULE 1 failure class retired; optimistic-rollback code removed.

---

## 5. Phase 2 — Activities Layer & Capability Completion (P0/P1 — ADR-0002/0003)

*The one structural domain gap (BA-1). Everything else in capabilities is already built.*

### T-10 · Activities catalog + `society_activities` + `activity_capability_map`
- **Priority** P0 · **Deps** T-01 · **Complexity** L · **Breaking risk** Low
- **Files/modules** new catalogs; `lib/navigation/*`; `supabase-tables.sql`; `types/index.ts`
- **DB impact** New catalog + join + map tables (data, not enums).
- **Migration impact** Seed catalogs; societies start with zero declared activities (additive).
- **Testing** Enabling an activity resolves the right capabilities; catalogs are data-extensible.
- **Rollback** Tables unused until resolver reads them (T-11); drop safely.
- **Acceptance** One society ⇒ many activities modellable; BA-1 closed.

### T-11 · Resolve capabilities within entitlement (+ effective-caps cache)
- **Priority** P0 · **Deps** T-10 · **Complexity** M · **Breaking risk** Med
- **Files/modules** `capabilityResolver.ts`, `useCapabilities.ts`, `navigationService.ts`
- **DB impact** `society_effective_capabilities` materialized cache.
- **Migration impact** Resolve/populate cache for all societies.
- **Testing** `effective = (type ∪ activities ∪ grants) ∩ entitled` — activity never grants an unpaid capability (MR-4); resolver stays pure (MR-2).
- **Rollback** Resolver falls back to current type+license path (flag).
- **Acceptance** Activities feed the same `Set<Capability>` within entitlement; monetization boundary intact.

### T-12 · Backfill parity & feature-flagged cutover (MR-1)
- **Priority** P0 · **Deps** T-11 · **Complexity** M · **Breaking risk** High
- **Files/modules** migration tooling; `useNavigation.ts`, `CapabilityGuard.tsx`
- **DB impact** Populates `society_activities` from inferred evidence.
- **Migration impact** One-time inference from type + operational data (loans→credit, stock→retail, milk→dairy…).
- **Testing** **Empty-diff per tenant** — no society loses a visible module at cutover (RULE 1-class safety).
- **Rollback** Per-tenant flag reverts to type-template visibility.
- **Acceptance** Zero module regressions post-cutover; every tenant's caps reconciled.

### T-13 · Add missing types/capabilities (deposits, FPS/subsidy, producer/multistate)
- **Priority** P1 · **Deps** T-10 · **Complexity** M · **Breaking risk** Low
- **Files/modules** `capabilities.ts`, `societyTypeCapabilities.ts`, `types/index.ts`, deposit/subsidy modules
- **DB impact** Catalog rows; deposit-ledger tables if absent.
- **Migration impact** Additive.
- **Testing** Deposit/FPS/subsidy modules gate correctly; new legal types resolve statutory reports.
- **Rollback** Additive rows; disable via entitlement.
- **Acceptance** BA-2/BA-3, CAP-1/CAP-2, SC-1/2/3 closed.

### T-14 · Retire `societyType` behavior-branching → capability reads
- **Priority** P1 · **Deps** T-12 · **Complexity** M · **Breaking risk** Med
- **Files/modules** the 23 files referencing `societyType`; reports (NabardReport/FederationReport keep type only for Tier-3 statutory)
- **DB impact** `societyType` retained as deprecated mirror of `legalTypeCode`.
- **Migration impact** None (backfill from T-01-era).
- **Testing** No operational branch on type remains; only statutory reports read legal type.
- **Rollback** Legacy branches behind flag until removed.
- **Acceptance** ADR-0002 fully realized; type is compliance-only.

---

## 6. Phase 3 — Rules Engine (P1 — ADR-0008)

### T-15 · Effective-dated, jurisdiction-scoped rule catalogs + point-in-time resolver
- **Priority** P1 · **Deps** T-01 · **Complexity** L · **Breaking risk** Low
- **Files/modules** new rules engine; jurisdiction packs (extend `capabilityResolver.ts` state logic)
- **DB impact** Versioned, effective-dated rule tables.
- **Migration impact** Seed current rules as v1 effective-from.
- **Testing** A historical period reproduces its era's rules; state variants coexist.
- **Rollback** Hard-coded fallbacks retained until rules validated.
- **Acceptance** Compliance numbers are data; INV-3 satisfied.

### T-16 · Wire UCAS numeric rules as data (reserve %, dividend cap, education, interest, depreciation, tax)
- **Priority** P1 · **Deps** T-15 · **Complexity** M · **Breaking risk** Low
- **Files/modules** appropriation logic, interest/depreciation/tax engines
- **DB impact** Rule rows per jurisdiction.
- **Migration impact** Seed common-Act defaults (25% reserve, 15% dividend cap…); flag as `[NV per state]`.
- **Testing** Appropriation order enforced; §80P member/non-member honored; reproducible.
- **Rollback** Per-rule fallback.
- **Acceptance** UCAS CM-1 driven by rules, not code.

---

## 7. Phase 4 — Identity, PII & Consent (P1 — ADR-0007)

### T-17 · Identity/consent bounded context + pseudonymous key; move PII out of ledger
- **Priority** P1 · **Deps** T-06 · **Complexity** XL · **Breaking risk** High
- **Files/modules** member/employee/party models; `DataContext.tsx`; new identity context
- **DB impact** Separate identity store; ledger holds `identityRef` only.
- **Migration impact** Extract inline PII → identity context; rewrite refs to pseudonymous keys.
- **Testing** No PII in financial tables; joins resolve; financial history intact.
- **Rollback** Dual-store during transition; revert refs.
- **Acceptance** CL-6 satisfied; IRR-3 closed.

### T-18 · Delegated authentication root (replace self-managed credential store)
- **Priority** P1 · **Deps** T-17 · **Complexity** L · **Breaking risk** High
- **Files/modules** auth (`society_users.password`), session, admin RPCs
- **DB impact** Credential root moves to provider; local table deprecated.
- **Migration impact** Migrate accounts to delegated identity with access continuity.
- **Testing** Login continuity; no plaintext credentials; SoD preserved.
- **Rollback** Dual-auth window; fall back to legacy login.
- **Acceptance** Identity root is not SahakarLekha's own table; IRR-5 closed.

### T-19 · DPDP consent lifecycle + erasure via tombstoning
- **Priority** P1 · **Deps** T-17 · **Complexity** M · **Breaking risk** Med
- **Files/modules** identity context, consent store, export/erasure paths
- **DB impact** Consent artifacts; tombstone markers.
- **Migration impact** Backfill consent basis where lawful.
- **Testing** Erasure purges PII while pseudonymous financial events remain; export honors consent.
- **Rollback** Erasure is gated/audited; reversible only pre-commit.
- **Acceptance** Erasure-vs-retention reconciled; ADR-0007 satisfied.

---

## 8. Phase 5 — UCAS & Statutory Conformance (P1)

### T-20 · Statutory appropriation posting (P&L Appropriation A/c, mandatory order)
- **Priority** P1 · **Deps** T-16, T-06 · **Complexity** M · **Breaking risk** Med
- **Files/modules** appropriation module, year-end logic, fund ledgers
- **DB impact** Fund heads (reserve/education/etc.) — capability-seeded.
- **Migration impact** Map existing funds to canonical heads.
- **Testing** Reserve ≥25% → education → funds → dividend(≤cap) → patronage → carry-forward; posted, not spreadsheet.
- **Rollback** Draft-then-post; reverse via T-08.
- **Acceptance** UCAS CM-1 / FS-5 produced as posted output.

### T-21 · Capability-selected statement set (R&P, I&E, Trading, P&L, Appropriation, BS, schedules)
- **Priority** P1 · **Deps** T-07, T-11 · **Complexity** M · **Breaking risk** Low
- **Files/modules** `Reports.tsx`, statement generators, report registry
- **DB impact** None (projections).
- **Migration impact** None.
- **Testing** Trading A/c iff `inventory`; I&E for service societies; DCB iff `loan_ledger`; multipurpose renders several concurrently.
- **Rollback** Report registry flag.
- **Acceptance** UCAS Part D statement selection is capability-driven.

### T-22 · Year-end close / opening-balance / prior-period adjustment (reconcile with ledger)
- **Priority** P1 · **Deps** T-06, T-20 · **Complexity** L · **Breaking risk** High
- **Files/modules** FY-close, opening-balance generation, period-lock (RULE 6)
- **DB impact** Closing/opening events in journal.
- **Migration impact** Reconcile existing `previousYearBalances` to opening events.
- **Testing** Opening = prior audited closing, no post-audit override (TASK4.2 §7); close → appropriation → FY-lock post-AGM (TASK4.2 §18); prior-period adjustment flows forward correctly under immutability.
- **Rollback** Close is reversible pre-lock; post-lock via authorized adjustment.
- **Acceptance** FY lifecycle conforms to TASK4.2 + CL-2 + RULE 6.

### T-23 · Governance-authority linkage (approval matrix / AGM adoption → financial finalization)
- **Priority** P1 · **Deps** T-20 · **Complexity** M · **Breaking risk** Low
- **Files/modules** approval workflow (existing), `BoardOfDirectors`/`MeetingRegister`/`ElectionModule`, appropriation/close gates
- **DB impact** Resolution/AGM-approval references on finalization events.
- **Migration impact** None.
- **Testing** Dividend/appropriation/close require the configured board/AGM authority + SoD; authority recorded on the event.
- **Rollback** Approval gates configurable/off.
- **Acceptance** "Human authority" invoked by AI/API constitutions is now *grounded* in recorded governance acts (uses existing governance research/modules — no new architecture).

---

## 9. Phase 6 — API & Integrations (P1/P2 — API Constitution, ADR-0004)

### T-24 · Public versioned domain API (contract-first, capability-scoped principals)
- **Priority** P1 · **Deps** T-04, T-11 · **Complexity** XL · **Breaking risk** Low
- **Files/modules** new API layer; auth/scopes; contract docs
- **DB impact** None new (serves the contract).
- **Migration impact** None.
- **Testing** Every caller is a least-privilege, tenant+jurisdiction-scoped principal; writes obey CL-1/CL-2/RULE 6; idempotency keys enforced.
- **Rollback** Versioned; deprecate a version, never break it.
- **Acceptance** API Constitution Art. I–III satisfied.

### T-25 · Event stream + signed webhooks (projected from ledger)
- **Priority** P1 · **Deps** T-06, T-24 · **Complexity** L · **Breaking risk** Low
- **Files/modules** outbox/event publisher, webhook signer
- **DB impact** Transactional outbox.
- **Migration impact** None.
- **Testing** At-least-once + consumer idempotency by `eventId`; per-aggregate ordering; replay from cursor.
- **Rollback** Disable publisher; consumers replay on re-enable.
- **Acceptance** EVT-1..7 satisfied.

### T-26 · Anti-corruption adapter ring framework
- **Priority** P1 · **Deps** T-24 · **Complexity** L · **Breaking risk** Low
- **Files/modules** adapter framework; integration registry (extend entitlement `plugin`/`plan`)
- **DB impact** Integration registration + scopes.
- **Migration impact** None.
- **Testing** Adapters fail closed/isolated; a down partner never touches core; egress consent-scoped.
- **Rollback** Disable per integration.
- **Acceptance** INT-1..7 satisfied; core protocol-agnostic (INV-7).

### T-27 · Government adapters (NCD, GSTN/e-invoice/e-way, TDS/TRACES, PFMS/DBT, RCS, DigiLocker, Account Aggregator)
- **Priority** P1/P2 · **Deps** T-26, T-16 · **Complexity** XL · **Breaking risk** Low
- **Files/modules** per-adapter modules; external-code mapping
- **DB impact** Mapping tables; submission logs.
- **Migration impact** None.
- **Testing** Filings **prepared** but **filed under human authority** (RULE 6); external codes mapped; inbound files validated (untrusted).
- **Rollback** Per-adapter disable; submissions idempotent.
- **Acceptance** API Constitution Art. VI; NABARD-CAS-dependent parts remain **parked** (external spec).

### T-28 · Banking adapters (statement ingest via AA, reconciliation, prepare-only payment)
- **Priority** P1/P2 · **Deps** T-26 · **Complexity** L · **Breaking risk** Low
- **Files/modules** reconciliation (existing `BankReconciliation`), AA adapter, payment-instruction prep
- **DB impact** Statement staging; reconciliation links.
- **Migration impact** None.
- **Testing** Statements are untrusted data; auto-match is a **proposal** (human confirms); **payment prepare-only** — never autonomous (API-P8); SoD preparer≠authorizer.
- **Rollback** Disable adapter; manual reconciliation remains.
- **Acceptance** API Constitution Art. VII; not a PSP/custodian.

---

## 10. Phase 7 — AI Conformance (P1/P2 — ADR-0010, AI Constitution)

### T-29 · AI as scoped principal on the trust plane
- **Priority** P1 · **Deps** T-11, T-06 · **Complexity** L · **Breaking risk** Low
- **Files/modules** AI/assistant layer (`AskAssistant`), principal/scoping, RBAC bridge
- **DB impact** Agent principal records.
- **Migration impact** None.
- **Testing** AI ≤ acting human's entitlements; cannot self-elevate or bypass FY-lock; on-behalf-of recorded.
- **Rollback** Disable AI capability (kill switch, T-31).
- **Acceptance** AI-P2 satisfied.

### T-30 · Proposals-not-commits + audit attribution + explainability
- **Priority** P1 · **Deps** T-29 · **Complexity** L · **Breaking risk** Low
- **Files/modules** AI action layer, approval matrix bridge, audit envelope
- **DB impact** Proposal + human-decision records (same audit trail).
- **Migration impact** None.
- **Testing** No autonomous financial mutation (AI-N1); LLM never the source of a figure of record (AI-P3 — numbers from engines); every money-affecting suggestion cited (AI-X1).
- **Rollback** Kill switch; product fully operable with zero AI.
- **Acceptance** AI Constitution Art. I–IV, VI satisfied.

### T-31 · Tenant-isolated, consent-bound AI memory + kill switch
- **Priority** P1 · **Deps** T-29, T-19 · **Complexity** M · **Breaking risk** Low
- **Files/modules** AI memory store, consent bridge, feature flags
- **DB impact** Per-tenant memory; purge hooks.
- **Migration impact** None.
- **Testing** No cross-tenant leakage; erasure purges AI memory; instant global/per-society disable without breaking accounting.
- **Rollback** The kill switch *is* the rollback.
- **Acceptance** AI Constitution Art. V, VIII (AI-G4) satisfied.

---

## 11. Phase 8 — Offline-First & Sync (P0-Critical, sequenced)

*Marked **Critical / cannot-change-later** (TASK3.6 §21, TASK3.9). Its integrity constraints bind Phase 1; full delivery depends on the ledger + numbering being built sync-aware.*

### T-32 · Offline field capture + durable local queue
- **Priority** P0 · **Deps** T-06 · **Complexity** L · **Breaking risk** Med
- **Files/modules** client capture (collection/receipt entry first), local durable store
- **DB impact** Local queue schema; server ingest of queued events.
- **Migration impact** None.
- **Testing** Field capture works fully offline; queued entries survive app restart; scope limited to collection/receipt initially (TASK3.6).
- **Rollback** Disable offline capture; online-only.
- **Acceptance** Offline capture with guaranteed local durability.

### T-33 · Integrity-safe sync + conflict resolution + numbering reservation
- **Priority** P0 · **Deps** T-32, T-03 · **Complexity** XL · **Breaking risk** High
- **Files/modules** sync engine, conflict policy, numbering reservation-blocks
- **DB impact** Sync cursors; reservation ranges.
- **Migration impact** None.
- **Testing** **No silent divergence** on sync (TASK3.6 §21); replay queue on failure; offline numbers reconcile gaplessly; RULE 1 invariant holds across sync.
- **Rollback** Fail closed — unsynced data retained locally, never dropped.
- **Acceptance** Integrity-safe sync guaranteed; the market-gap differentiator delivered.

---

## 12. Phase 9 — Federation Graph (P2 — ADR-0009)

### T-34 · Federation relationships + consolidation-as-re-projection + residency placement
- **Priority** P2 · **Deps** T-06, T-01 · **Complexity** XL · **Breaking risk** Med
- **Files/modules** `societies`, `MultiSocietyConsolidation`, consolidation engine
- **DB impact** Typed tier relationships; residency-aware placement.
- **Migration impact** Model existing multi-society links into the graph.
- **Testing** Primary→district→state roll-up via re-projection; inter-entity awareness; residency honored.
- **Rollback** Consolidation is read-only projection; disable safely.
- **Acceptance** INV-6 realized for live tiers.

---

## 13. Phase 10 — Digital Preservation (P1 rehearsal / P2 archival)

### T-35 · Persisted end-to-end restore rehearsal (flip "export" → "backup")
- **Priority** P1 · **Deps** T-04 · **Complexity** M · **Breaking risk** Low
- **Files/modules** backup/restore, rehearsal harness
- **DB impact** Rehearsal evidence store.
- **Migration impact** None.
- **Testing** Full restore proven with post-restore integrity gates (RS-3); evidence persisted (DP-P7).
- **Rollback** N/A (verification only).
- **Acceptance** Persisted rehearsal passes → UI honestly renames "export" to "backup".

### T-36 · 3-2-1 off-vendor copies + WORM + escrowed keys
- **Priority** P2 · **Deps** T-04 · **Complexity** L · **Breaking risk** Low
- **Files/modules** backup pipeline, off-provider replication, key escrow
- **DB impact** None.
- **Migration impact** None.
- **Testing** ≥1 off-provider copy; WORM immutability; key-escrow recovery drill.
- **Rollback** Additive; disable extra copies.
- **Acceptance** DP-P4/P9 satisfied.

### T-37 · OAIS archival tier + PDF/A + fixity + forward-migration + org-continuity handover
- **Priority** P2 · **Deps** T-04, T-06 · **Complexity** XL · **Breaking risk** Low
- **Files/modules** archival packaging, PDF/A rendering, fixity, continuity plan (doc)
- **DB impact** Archival store (WORM).
- **Migration impact** Package closed FYs / exited entities into AIPs.
- **Testing** AIP self-sufficient; fixity verified; PDF/A opens standalone; continuity-handover procedure documented.
- **Rollback** Archival is additive to live data.
- **Acceptance** Digital Preservation Strategy Parts F/G/I realized.

---

## 14. Phase 11 — Localization & residual (P2)

### T-38 · Multi-language / vernacular beyond Hindi
- **Priority** P2 · **Deps** none · **Complexity** L · **Breaking risk** Low
- **Files/modules** i18n layer, statement rendering, message templates
- **DB impact** Localized content/labels.
- **Migration impact** None.
- **Testing** Regional-language UI + statutory rendering; UTF-8/script integrity (RULE 8).
- **Rollback** Language packs additive.
- **Acceptance** Vernacular principle (TASK4.1) extended beyond Hindi.

### ⛔ T-P1 · NABARD CAS conformance — PARKED (blocked)
- **Priority** P1 (when unblocked) · **Deps** external authoritative CAS spec (`SRC-OPS-PACSCAS`)
- **Status** Blocked; do **not** fabricate CAS heads/formats ([[ecr-23-nabard-cas-blocked]]). Not schedulable until the spec is captured.

---

## 15. Cross-cutting doctrine (applies to every task)

- **Testing floor (RULES):** double-entry ties (CL-1/RULE 2), FY-lock respected (RULE 6), UTF-8 preserved (RULE 8), no silent divergence (RULE 1), cascades complete (RULE 3/5). Every task's "Testing" row is *in addition* to this floor.
- **Rollback doctrine:** prefer **feature-flagged, dual-write/dual-read, per-tenant cutover with empty-diff parity** (used in T-06/T-09/T-12/T-17). Additive schema changes are left in place on rollback; only behavior is flagged off.
- **Migration doctrine:** additive-only, backfill-then-flip, never mutate historical financial rows (Canonical immutability). Each migration ships a **dry-run/preview** (API IE-3).
- **No new architecture:** if implementation surfaces an unmade decision, stop and raise an ADR — do not decide it inside a task.

---

## 16. Master summary

| ID | Task | Phase | Pri | Cx | Breaking |
|---|---|---|---|---|---|
| T-01 | Tenant+jurisdiction key | 0 | P0 | M | Low |
| T-02 | Exact minor-unit money | 0 | P0 | L | Med |
| T-03 | Server-authoritative numbering | 0 | P0 | L | Med |
| T-04 | Versioned export contract v1 | 0 | P0 | L | Low |
| T-05 | Typed financial columns | 0 | P1 | M | Med |
| T-06 | Event journal (SoR) | 1 | P0 | XL | High |
| T-07 | Projection engine | 1 | P0 | L | Med |
| T-08 | Reversing corrections | 1 | P0 | M | Med |
| T-09 | Cut reads to ledger | 1 | P0 | M | High |
| T-10 | Activities catalog/join/map | 2 | P0 | L | Low |
| T-11 | Resolve-within-entitlement + cache | 2 | P0 | M | Med |
| T-12 | Backfill parity cutover | 2 | P0 | M | High |
| T-13 | Missing types/caps (deposits/subsidy…) | 2 | P1 | M | Low |
| T-14 | Retire type-branching | 2 | P1 | M | Med |
| T-15 | Rule catalogs + resolver | 3 | P1 | L | Low |
| T-16 | Wire UCAS rules as data | 3 | P1 | M | Low |
| T-17 | Identity/PII separation | 4 | P1 | XL | High |
| T-18 | Delegated auth root | 4 | P1 | L | High |
| T-19 | DPDP consent + tombstoning | 4 | P1 | M | Med |
| T-20 | Appropriation posting | 5 | P1 | M | Med |
| T-21 | Capability-selected statements | 5 | P1 | M | Low |
| T-22 | Year-end close/opening/prior-period | 5 | P1 | L | High |
| T-23 | Governance-authority linkage | 5 | P1 | M | Low |
| T-24 | Versioned public API | 6 | P1 | XL | Low |
| T-25 | Event stream + webhooks | 6 | P1 | L | Low |
| T-26 | Anti-corruption adapter ring | 6 | P1 | L | Low |
| T-27 | Government adapters | 6 | P1/P2 | XL | Low |
| T-28 | Banking adapters | 6 | P1/P2 | L | Low |
| T-29 | AI scoped principal | 7 | P1 | L | Low |
| T-30 | AI propose-not-commit + audit + explain | 7 | P1 | L | Low |
| T-31 | AI memory isolation + kill switch | 7 | P1 | M | Low |
| T-32 | Offline capture + queue | 8 | P0 | L | Med |
| T-33 | Integrity-safe sync | 8 | P0 | XL | High |
| T-34 | Federation graph + consolidation | 9 | P2 | XL | Med |
| T-35 | Persisted restore rehearsal | 10 | P1 | M | Low |
| T-36 | Off-vendor copies + WORM + escrow | 10 | P2 | L | Low |
| T-37 | OAIS archival + PDF/A + continuity | 10 | P2 | XL | Low |
| T-38 | Multi-language beyond Hindi | 11 | P2 | L | Low |
| T-P1 | NABARD CAS conformance | — | Parked | — | — |

**Critical path (longest dependency chain):** T-02/T-03 → **T-06** → T-07/T-08 → T-09 → T-10 → T-11 → T-12 → (T-16→T-20→T-22) and (T-24→T-25) and (T-32→T-33). The **event ledger (T-06)** gates the most downstream work; it is the first XL to fund.

**One-line roadmap:** *stop writing irreversible history (Phase 0), make history immutable and replayable (Phase 1), model what societies actually do (Phase 2), then layer accounting, identity, API, and AI conformance on that spine — closing every delta between today's code and the frozen architecture, and nothing more.*
