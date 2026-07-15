# SahakarLekha — Conformance Audit (Current Code vs. Approved Architecture)

- **Status:** Audit — point-in-time (2026-07-11), branch `feat/data-portability-phase-0-1`. Evidence-based.
- **Method:** each frozen decision (ADRs, Canonical Model, UCAS, AI/API Constitutions, 2040-Vision INV-*, IRR-*) checked against actual code; a deviation is reported only with **file:line evidence**.
- **Scope:** reports **implementation gaps only** — deviations of code from approved architecture. **Proposes no architecture and no solutions.** Where a frozen remediation already exists in the [Master Implementation Blueprint](MASTER-IMPLEMENTATION-BLUEPRINT.md), it is cited as a *pointer* (T-xx), not a proposal.
- **Reading note:** many deviations are against ADRs marked *planned / in-principle* — i.e. the product predates the decision. That is expected; severity below is ranked by **live data-integrity / irreversibility / legal risk**, not by "does today's code already match a future decision."

## Severity scale

| | Meaning |
|---|---|
| **S1 — Critical** | Violates a core integrity invariant and/or accrues **irreversible** data/legal harm every day it persists. |
| **S2 — High** | Structural conformance gap with real data, monetization, or compliance impact; additive to fix but material. |
| **S3 — Medium** | Conformance gap that is lower-risk, scoped, or "not-yet-built vs. actively-violating." |

---

## Part 1 — What IS conformant (audited, no gap)

Recorded so the gaps are read against a real baseline. These **pass**:

- **Capability architecture (ADR-0002)** — pure resolver, entitlement/RLS, module gating (`capabilityResolver.ts`, `capabilities.ts`). In force. *(Exception: residual type-branches — CA-06.)*
- **Global-unique keys** — `crypto.randomUUID()` PKs (`DataContext.tsx`). Merge-safe (ADR-0009 friendly).
- **Soft-cancel cascades, FY-lock, per-item routing** — RULES 3/4/5/6 present (`guardFYLocked`, cascade logic).
- **Money at rest** — PostgreSQL `numeric` (exact). *(Gap is the compute layer — CA-02.)*
- **Backup/restore + portability round-trip** — client + weekly-server backup live. *(Gap is contract shape + rehearsal — CA-09, T-35.)*
- **Encoding** — UTF-8 / ISO-8601 strings (RULE 8). *(Gap is text-typed timestamps — CA-14.)*

---

## Part 2 — Deviations (ranked by severity)

### S1 — Critical

---

**CA-01 · No event ledger; mutable state is the source of truth (optimistic write + manual rollback)**
- **Evidence:** `persistVoucher(...)` "two-step + rollback" helper and optimistic `setVouchersState` then revert-on-failure — `DataContext.tsx:1166`, `:1356-1359`; `vouchersRef.current` as working truth `:314`. No append-only journal table in `supabase-tables.sql`.
- **Architecture violated:** 2040-Vision **INV-1** (event log is SoR); IRR-1.
- **ADR violated:** **ADR-0001** (event ledger).
- **UCAS violated:** indirectly — reproducibility of statements/appropriation as-of-date (UCAS relies on immutable inputs).
- **Canonical Model violated:** **CL-2** (immutability / reversing-corrections), **CL-4** (aggregates as projections), **CL-7** (provenance).
- **AI/API violated:** **AI-A1..A5** (single append-only audit trail presupposes it); **API EVT-1/EVT-4** (event stream is projected from the log).
- **Tracked by:** T-06/07/08/09. **Severity: S1** — every write accrues un-reconstructable history (RULE 1 is a symptom, not a fix).

**CA-02 · Money computed in JavaScript floating point and persisted**
- **Evidence:** ~53 `Number(...)/toFixed/parseFloat` sites in `DataContext.tsx`; e.g. `amount: Number(member.shareCapital)` `:629`. Computed tax/allocation values persisted into postings.
- **Architecture violated:** IRR-8.
- **ADR violated:** **ADR-0006** (exact minor-unit money).
- **UCAS violated:** exactness of appropriation (≥25% reserve, dividend cap), interest, and tax computations.
- **Canonical Model violated:** **CL-3** (integer minor units, explicit currency, Dr/Cr).
- **AI/API violated:** — (indirect: AI-P3 forbids the LLM being the money calculator; here the app itself is imprecise).
- **Tracked by:** T-02. **Severity: S1** — persisted float rounding is frozen into history irreversibly.

**CA-03 · Voucher numbers generated client-side from in-memory state (with collision-retry)**
- **Evidence:** `storage.getNextVoucherNo(type, fy, vouchersRef.current)` `DataContext.tsx:1336`; explicit duplicate-number **collision-retry** `:1211-1213`.
- **Architecture violated:** IRR-2 (Class A+C).
- **ADR violated:** **ADR-0005** (server-authoritative gapless numbering).
- **UCAS violated:** statutory **gapless, non-duplicated** numbering of vouchers/registers (audit requirement).
- **Canonical Model violated:** **Voucher** immutable `voucherNo` gapless issuance.
- **AI/API violated:** —.
- **Tracked by:** T-03. **Severity: S1** — non-conformant numbers are already filed/printed; unrenumberable.

**CA-04 · Member/counterparty PII stored inline in financial tables**
- **Evidence:** `members` holds `name, fatherName, address, phone, nomineeName, nomineeRelation, nomineePhone` — `supabase-tables.sql:112-131`. (Also suppliers/customers `nameHi`, contact fields.)
- **Architecture violated:** IRR-3 (Class B+D); INV-5.
- **ADR violated:** **ADR-0007** (identity/PII separation; pseudonymous key).
- **UCAS violated:** —.
- **Canonical Model violated:** **CL-6** (financial entities reference `identityRef`, never embed PII).
- **AI/API violated:** **API-P6** (no PII where it can't be governed/erased); **AI-M2/M3** (consent-bound, minimized memory presupposes separation).
- **Tracked by:** T-17/19. **Severity: S1** — DPDP erasure vs. retention becomes legally unsatisfiable at scale.

---

### S2 — High

---

**CA-05 · No Activities layer; a society has exactly one `SocietyType`**
- **Evidence:** `export type SocietyType = 'marketing_processing' | 'pacs' | ...` `types/index.ts:984`; single-type template `societyTypeCapabilities.ts:10`. No `activities`/`society_activities`/`activity_capability_map`.
- **Architecture violated:** Domain-Architecture Option C (Activities layer); Gap-Analysis **BA-1**.
- **ADR violated:** **ADR-0003** (Activities layer).
- **UCAS violated:** UCAS variation packs (a Multipurpose PACS running many activities) cannot be expressed.
- **Canonical Model violated:** **Activity** entity / `society_activities` relationship absent.
- **AI/API violated:** —.
- **Tracked by:** T-10/11/12/13. **Severity: S2** — the one structural domain gap.

**CA-06 · Residual behavior-branching on `societyType`**
- **Evidence:** `societyRef.current?.societyType === 'consumer'` gating defaults — `DataContext.tsx:4485`, `:4505`; setup UI branch `SocietySetup.tsx:561`.
- **Architecture violated:** capability-as-single-gate principle.
- **ADR violated:** **ADR-0002** (behavior binds to capability, never type — except Tier-3 statutory).
- **UCAS violated:** —. **Canonical:** —.
- **AI/API violated:** —.
- **Tracked by:** T-14. **Severity: S2** (S3 for the pure-UI branch) — type-branch debt in a data path.

**CA-07 · No tenant/jurisdiction partition key; single-tenant default**
- **Evidence:** `society_id text not null default 'SOC001'` across ~20 tables (`supabase-tables.sql`); no `jurisdiction` column anywhere.
- **Architecture violated:** IRR-4 (Class B).
- **ADR violated:** **ADR-0009** (tenant + jurisdiction stamped at write time).
- **UCAS violated:** —.
- **Canonical Model violated:** **CL-5** (every record carries `(tenantId, jurisdiction)`).
- **AI/API violated:** **API AUTH-2** (principal+tenant+jurisdiction scoping); residency (**API-P6**).
- **Tracked by:** T-01. **Severity: S2** — cheap now, un-backfillable at scale; blocks residency compliance.

**CA-08 · Self-managed credential store is the identity root**
- **Evidence:** `society_users.password text not null` `supabase-tables.sql:66`; platform-admin JWT-less (SECURITY DEFINER RPCs).
- **Architecture violated:** IRR-5 (Class D).
- **ADR violated:** **ADR-0007** (delegated identity root).
- **UCAS violated:** —. **Canonical:** —.
- **AI/API violated:** **API AUTH-1** (delegated identity, not a bespoke credential table); **AUTH-5** (secrets handling).
- **Tracked by:** T-18. **Severity: S2** — national-scale identity-root liability.

**CA-09 · Export/`.slbak` serializes the internal storage shape, not a versioned domain contract**
- **Evidence:** `lib/export/entities/*` mirror the camelCase table columns 1:1; `.slbak` = internal shape.
- **Architecture violated:** IRR-6 (Class C); INV-7.
- **ADR violated:** **ADR-0004** (versioned contract ≠ storage shape).
- **UCAS violated:** —.
- **Canonical Model violated:** — (adjacent to CL versioning doctrine).
- **AI/API violated:** **API IE-1 / VER-3** (export IS the contract; versioned independently of storage).
- **Preservation:** **DP-P2** (open, storage-independent authoritative copy).
- **Tracked by:** T-04. **Severity: S2** — freezes internal quirks as a public contract the moment anyone ingests it.

**CA-10 · Financially-material data in unconstrained JSONB**
- **Evidence:** `vouchers.lines jsonb`, `vouchers."billAllocations" jsonb`, sales/purchases tax breakups as jsonb (`supabase-tables.sql:482,490,454-479`).
- **Architecture violated:** IRR-7.
- **ADR violated:** ADR-0006 (adjacent — money-material fields must be typed/constrained).
- **UCAS violated:** — (enables the RULE 2 formula-drift class).
- **Canonical Model violated:** **Voucher Entry** / money-material fields should be typed, not loose JSONB.
- **AI/API violated:** —.
- **Tracked by:** T-05. **Severity: S2** — cannot retro-constrain historical blobs.

**CA-11 · Jurisdiction/compliance logic hardcoded in code, not effective-dated rule data**
- **Evidence:** ~~Haryana pack hardcoded — `capabilityResolver.ts:37`~~ ✅ CLOSED (2026-07-15): jurisdiction packs are now effective-dated DATA (`jurisdictionPacks.ts`, `JURISDICTION_CAPABILITY_PACKS` + `resolveJurisdictionPacks`); the resolver just normalizes+looks up. Appropriation rates ✅ already rule-data via the T-15/16 engine (`ucas.ts` `UCAS_RULES`, effective-dated + jurisdiction-scoped) consumed by `appropriation.ts`. **RESIDUAL:** tax constants (GST/TDS rates) are still in code, not the rule store — the remaining CA-11 slice.
- **Architecture violated:** INV-3.
- **ADR violated:** **ADR-0008** (rules as effective-dated, jurisdiction-scoped data).
- **UCAS violated:** UCAS CM rates/formats meant to be rule-data (`[NV per state]`).
- **Canonical Model violated:** —.
- **AI/API violated:** —.
- **Tracked by:** T-15/16. **Severity: S2** — each state/policy change becomes a code deploy; history not reproducible.

**CA-12 · Clients write directly to DB tables; no versioned domain API / anti-corruption ring**
- **Evidence:** `DataContext.tsx` upserts Supabase tables directly; the DB schema *is* the client shape; no server-side domain API or adapter layer.
- **Architecture violated:** INV-7 (protocol-agnostic core behind adapters).
- **ADR violated:** ADR-0004 (contract boundary).
- **UCAS violated:** —.
- **Canonical Model violated:** — (mutation-law enforcement is client-side only, weakening CL-1/CL-2/RULE 6 guarantees at the boundary).
- **AI/API violated:** **API-P1** (API is a contract, not a window into the DB), **API-P2** (anti-corruption ring), **API-P4** (mutation laws at the boundary).
- **Tracked by:** T-24/26. **Severity: S2** — structural; lower urgency only because no external consumers exist yet.

---

### S3 — Medium

---

**CA-13 · UCAS statutory output partially conformant (appropriation posting / statement-selection / year-end close)**
- **Evidence:** reports exist (`Reports.tsx`, `FundStatement`, `BudgetModule`), but posted **P&L Appropriation A/c** in the mandatory order, **capability-selected statement set** (FS-1..8), and the year-end-close/opening-balance lifecycle are not implemented to the UCAS/TASK4.2 spec.
- **Architecture violated:** —.
- **ADR violated:** ADR-0008 (drives it).
- **UCAS violated:** **CM-1** appropriation order; **Part D** statement selection.
- **Canonical Model violated:** CL-4 (statements as projections) partially.
- **AI/API violated:** —.
- **Tracked by:** T-20/21/22. **Severity: S3** — researched (TASK4.2), an implementation gap; verify current partial coverage before build.

**CA-14 · Timestamps stored as `text`**
- **Evidence:** `"clearedDate" text`, `"approvedAt" text`, voucher `date` text (`supabase-tables.sql:450,503`, etc.).
- **Architecture violated:** —. **ADR:** —.
- **UCAS violated:** —.
- **Canonical Model violated:** Record-Header `createdAt`/event-time typing (mild — values are ISO-8601, unambiguous).
- **AI/API violated:** —. **Preservation:** **LT-3** (encoding hygiene — mild).
- **Tracked by:** (folds into T-05). **Severity: S3** — data-quality, not integrity loss (ISO strings).

**CA-15 · AI capabilities are below the AI Constitution (not yet a governed principal) — not actively violating**
- **Evidence:** `AskAssistant.tsx` / site search are help/read-oriented; no AI write path into `DataContext`. No agent-principal, on-behalf-of scoping, or AI-specific audit attribution.
- **Architecture violated:** —.
- **ADR violated:** ADR-0010 (target).
- **UCAS violated:** —. **Canonical:** —.
- **AI/API violated:** **AI Constitution Art. II–VIII** are *unimplemented*, not breached — AI does not post autonomously (AI-N1 not violated) because it is read-only.
- **Tracked by:** T-29/30/31. **Severity: S3** — "not built" vs. "violating"; must be met **before** any AI write feature ships.

**CA-16 · Offline integrity-safe sync not implemented to the (Critical) decision**
- **Evidence:** local persistence via `localStorage`/in-memory (`storage.ts`, `setVouchersState` from `lsVouchers` `:1113`) without an integrity-safe event-sync/conflict model or numbering reservation.
- **Architecture violated:** TASK3.6 §21 / TASK3.9 (**Critical, cannot-change-later**) offline-first + integrity-safe sync.
- **ADR violated:** ADR-0001/0005 (its substrate).
- **UCAS violated:** —.
- **Canonical Model violated:** RULE 1 divergence risk across devices/sessions.
- **AI/API violated:** —.
- **Tracked by:** T-32/33. **Severity: S3→S2 when multi-device** — no autonomous harm in single-device use today, but a Critical decision unmet.

---

## Part 3 — Conformance scorecard

| Frozen decision | Conformance | Deviation |
|---|---|---|
| ADR-0001 Event ledger | ❌ Not met | CA-01 (S1) |
| ADR-0002 Capabilities | ⚠️ Mostly | CA-06 residual type-branches (S2) |
| ADR-0003 Activities | ❌ Not met | CA-05 (S2) |
| ADR-0004 Export contract | ❌ Not met | CA-09 (S2) |
| ADR-0005 Numbering | ❌ Not met | CA-03 (S1) |
| ADR-0006 Money precision | ⚠️ Storage yes, compute no | CA-02 (S1), CA-10 (S2) |
| ADR-0007 Identity/PII | ❌ Not met | CA-04 (S1), CA-08 (S2) |
| ADR-0008 Rules engine | ❌ Not met | CA-11 (S2) |
| ADR-0009 Federation/residency | ❌ Not met | CA-07 (S2) |
| ADR-0010 AI actor | ➖ Not built (not violated) | CA-15 (S3) |
| Canonical Model | ⚠️ Partial | CA-01/02/03/04/07/10 |
| UCAS | ⚠️ Partial | CA-03, CA-13 |
| API Constitution | ❌ Not built | CA-09/12 |
| AI Constitution | ➖ Not built | CA-15 |
| Digital Preservation | ⚠️ Backup yes, archive/contract no | CA-09; (T-35/37) |
| Offline (Critical) | ❌ Not to spec | CA-16 |

---

## Part 4 — Ranked summary

| # | Deviation | Sev | Primary decision violated | Evidence |
|---|---|---|---|---|
| CA-01 | No event ledger; state-as-truth + optimistic rollback | **S1** | ADR-0001 / CL-2 / INV-1 | `DataContext.tsx:1166,1356` |
| CA-02 | Money in JS float, persisted | **S1** | ADR-0006 / CL-3 | `DataContext.tsx` (~53 sites) |
| CA-03 | Client-side voucher numbering + collision-retry | **S1** | ADR-0005 / UCAS gapless | `DataContext.tsx:1336,1211` |
| CA-04 | PII inline in financial tables | **S1** | ADR-0007 / CL-6 | `supabase-tables.sql:112-131` |
| CA-05 | No Activities layer; single `SocietyType` | S2 | ADR-0003 / Option C | `types/index.ts:984` |
| CA-06 | Residual `societyType` behavior-branches | S2 | ADR-0002 | `DataContext.tsx:4485,4505` |
| CA-07 | No tenant/jurisdiction key; `SOC001` default | S2 | ADR-0009 / CL-5 | `supabase-tables.sql` |
| CA-08 | Self-managed credential root | S2 | ADR-0007 / API AUTH-1 | `supabase-tables.sql:66` |
| CA-09 | Export = internal shape, unversioned | S2 | ADR-0004 / API IE-1 / DP-P2 | `lib/export/entities/*` |
| CA-10 | Money-material data in JSONB | S2 | Canonical / IRR-7 | `supabase-tables.sql:482,490` |
| CA-11 | Compliance logic hardcoded, not rule-data | S2 | ADR-0008 / UCAS CM | `capabilityResolver.ts:37` |
| CA-12 | Direct client→DB writes; no domain API/ring | S2 | API-P1/P2/P4 / INV-7 | `DataContext.tsx` |
| CA-13 | UCAS appropriation/statements/close partial | S3 | UCAS CM-1 / Part D | `Reports.tsx` |
| CA-14 | Timestamps as `text` | S3 | Canonical header / DP-P3 | `supabase-tables.sql:450,503` |
| CA-15 | AI below Constitution (not built, not violating) | S3 | ADR-0010 / AI Const. | `AskAssistant.tsx` |
| CA-16 | Offline integrity-safe sync not to spec | S3→S2 | TASK3.6 §21 (Critical) | `storage.ts`, `DataContext.tsx:1113` |

**Headline:** four **S1** deviations — no event ledger (CA-01), float money (CA-02), client-side numbering (CA-03), inline PII (CA-04) — are the ones accruing **irreversible** harm and should stop first. They are exactly the Phase 0 + Phase 1 items of the frozen roadmap; this audit adds no work beyond confirming, with evidence, where today's code stands against the approved architecture.
