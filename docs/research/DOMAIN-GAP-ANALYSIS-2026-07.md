# SahakarLekha — Gap Analysis: Proposed Architecture vs. Current Implementation

**Companions:** [DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md](DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md) · [DOMAIN-DATABASE-DESIGN-2026-07.md](DOMAIN-DATABASE-DESIGN-2026-07.md)
**Date:** 2026-07-11
**Status:** Analysis only. No code. No schema changes.
**Method:** proposed capabilities-driven design compared against the code actually on `feat/data-portability-phase-0-1`.

---

## 0. Headline finding (context before the gaps)

**The current implementation is already ~70% of the proposed architecture — and on two axes it *exceeds* my proposal.** SahakarLekha already ships:

- A real **capability layer**: `Capability` union of 15 caps ([capabilities.ts:12](../../src/lib/navigation/capabilities.ts)), modules gate on capabilities via `CapabilityGuard` / `navVisibility`, never on type.
- A **pure, deterministic resolver** ([capabilityResolver.ts](../../src/lib/navigation/capabilityResolver.ts)) — entitlement → visibility, exactly the resolve-and-read pattern the design calls for.
- A **licensing/entitlement model** the proposal did *not* have: `society_capabilities` grant/revoke rows with sources `plan | trial | plugin | state | system | admin`, `expiresAt`, and **RLS source-trust enforcement** ([supabase-tables.sql:1160](../../supabase-tables.sql), [capabilities.ts:48-75](../../src/lib/navigation/capabilities.ts)).
- **Jurisdiction packs** (state → capability), e.g. Haryana/HAFED ([capabilityResolver.ts:34](../../src/lib/navigation/capabilityResolver.ts)).
- Built module surface across **dairy, marketing, consumer, housing, labour, loans** (MilkCollection, ProcurementRegisters, RetailCounter/Patronage/Dividend, Buildings/MaintenanceBilling, WorkerLedger/PfEsi, LoanRegister/KccLoan).

**The single structural gap is the ACTIVITIES layer.** Today capabilities are granted by **one `SocietyType` template + license rows**. There is **no concept of a society declaring many business activities**, so the Multipurpose-PACS reality (one society running 25+ activities) cannot be modelled. This gap is the root cause of most P0/P1 items below.

> This reframes the work from "rebuild" to "**insert one layer (Activities) between Type and Capabilities, and reconcile it with the existing entitlement model**."

**Honest correction to my own proposal:** the two prior design docs ignored the existing `society_capabilities` licensing layer. The final architecture must *keep* it — Activities resolve into capabilities **within** entitlement, never bypassing a plan the society hasn't purchased (see MR-04).

---

## Severity legend

| | Meaning | Fix window |
|---|---|---|
| **P0** | Blocks the 15-year thesis or the Multipurpose-PACS reality, or risks silent data/feature loss (RULE 1 class). Must resolve before the architecture is "adopted." | Before/with first activities release |
| **P1** | Real coverage or correctness gap with a workaround; degrades but doesn't block. | Near-term |
| **P2** | Breadth/polish/naming; deferrable without harm. | Backlog |

---

## 1. Missing society categories

Current `SocietyType` = **8** values: `marketing_processing, pacs, consumer, labour, dairy, housing, sugar, other` ([types/index.ts:984](../../src/types/index.ts)). Proposed legal-type anchor ≈ 12.

| ID | Missing category | Severity | Notes |
|---|---|---|---|
| SC-1 | **`multipurpose`** as a first-class legal type | **P1** | Today `other` is the catch-all; but the real fix is the activities layer, not another type. Add explicit `multipurpose` once activities exist. |
| SC-2 | **Producer Cooperative (FPO)** | **P1** | Distinct legal/registration identity; a live NCP-2025 growth segment. Absent. |
| SC-3 | **Multi-State Cooperative Society** | **P1** | Different regulator (Central Registrar / MSCS Act). No representation → wrong statutory report set. |
| SC-4 | **UCB / Cooperative Bank (StCB, DCCB, SCARDB, PCARDB)** | **P2** | RBI/NABARD-regulated banking; large build, likely out of near-term scope. Flag, don't schedule. |
| SC-5 | **Dairy *union/federation* tier** (`dairy_union`) vs. primary `dairy` | **P2** | Current `dairy` = primary only; federal tier (consolidation) is a later concern. |

**Not missing (correctly modelled as Activities, not Types):** fishery, weavers/handloom, transport, tourism, poultry, CSC, energy. The proposal deliberately keeps these out of the type list — current code agrees by omission. ✅

---

## 2. Missing business activities

**The category itself is missing.** No `activities` catalog, no `society_activities` join, no `activity_capability_map`. Capabilities are bundled per type ([societyTypeCapabilities.ts:10](../../src/lib/navigation/societyTypeCapabilities.ts)) or granted by license — never declared as business lines.

| ID | Gap | Severity | Notes |
|---|---|---|---|
| BA-1 | **No Activities layer at all** (catalog + per-society join + activity→capability map) | **P0** | This is the core of the proposed architecture and the only way to model Multipurpose PACS. Without it, a PACS cannot declare "milk + FPS + LPG" independently of its type bundle. |
| BA-2 | **Member deposits / savings** as an activity+capability | **P1** | Cap list has `lending` but no deposits ([capabilities.ts:12](../../src/lib/navigation/capabilities.ts)). PACS and credit societies *take* deposits — real functional hole. |
| BA-3 | **Fair Price Shop / PDS** activity + subsidy reconciliation | **P1** | Government-pushed, common in PACS; no capability or module today. |
| BA-4 | **Foodgrain procurement** distinct from generic `procurement_msp` | **P2** | Partly covered by `procurement_msp`; the coarse cap conflates milk/foodgrain/marketing. |
| BA-5 | **LPG/CNG/petrol distribution**, **custom hiring centre**, **CSC** | **P2** | Multipurpose-PACS activities with no current surface. Add as catalog rows when demanded. |
| BA-6 | **Warehouse receipts (WDRA)** as a sub-activity of `warehousing` | **P2** | `warehousing` cap exists but no receipt/storage-billing sub-capability. |
| BA-7 | **Emerging sectors** (clean energy, biogas, waste, healthcare, platform) | **P2** | NCP-2025 mandated as *addable data*; none needed now, but the catalog must accept them without code change (tie to BA-1). |

---

## 3. Missing capabilities

Current `Capability` union = **15** ([capabilities.ts:12](../../src/lib/navigation/capabilities.ts)). Against the proposed granular catalog:

| ID | Missing capability | Severity | Notes |
|---|---|---|---|
| CAP-1 | `deposit_ledger` (deposits/savings) | **P1** | Pairs with BA-2. |
| CAP-2 | `subsidy_reconciliation` | **P1** | Pairs with BA-3; FPS + fertilizer/seed subsidy claims. |
| CAP-3 | `warehouse_receipts` (sub-cap of `warehousing`) | **P2** | Pairs with BA-6. |
| CAP-4 | `quality_pricing` (fat/SNF) surfaced as its *own* cap | **P2** | Likely embedded inside the dairy module today; not independently gateable. Fine until a non-dairy activity needs it. |
| CAP-5 | `bom_costing` / production costing (sugar/processing) | **P2** | `sugar` type gets inventory+procurement but no production/costing capability. |
| CAP-6 | Banking caps (CRAR/SLR/NPA-banking) | **P2** | Only if UCB/bank scope (SC-4) is ever taken on. |
| CAP-7 | **Granularity mismatch:** `procurement_msp` is one coarse cap doing milk+foodgrain+marketing | **P2** | Proposal unifies these as one reusable `procurement_engine`. Current naming is MSP-flavoured but functionally close. **Alias, do not rename** (see BC-4). |

**Note:** proposed `cap.member_shares`, `cap.chart_of_accounts`, `cap.vouchers` etc. are **not missing** — they exist as the always-on core (never gated), which is the correct treatment. ✅

---

## 4. Migration risks

| ID | Risk | Severity | Why it matters / mitigation |
|---|---|---|---|
| MR-1 | **Backfill parity — a society losing a visible module post-migration** | **P0** | Inferring activities from `societyType` + Group C data can silently hide a module a user relied on. This is the RULE 1 "silent divergence" failure class applied to features. **Mitigation:** mandatory empty-diff parity check per tenant before cut-over; feature-flag the flip; keep the type-template path as fallback. |
| MR-2 | **Resolver contract change is high-blast-radius** | **P0** | `resolveCapabilities(societyType, rows, now, state)` is consumed by `useCapabilities`, `useNavigation`, `navigationService`, `CapabilityGuard`. Adding activity-derived caps changes the resolver's inputs. Must stay **pure/deterministic**; any missed call site under/over-resolves capabilities. **Mitigation:** activities resolve into the *same* `Set<Capability>` the resolver already returns — additive input, unchanged output type. |
| MR-3 | **Type enum → data catalog is a breaking shape change** | **P1** | `SocietyType` is a compile-time TS union referenced across 23 files. Moving to a data-driven `legal_types` table can't be a hard swap. **Mitigation:** keep the union as the seed of the catalog; introduce the table additively; don't remove values. |
| MR-4 | **Activities could bypass the licensing/entitlement model** | **P1** (flag as near-P0 for monetization integrity) | Current design deliberately separates *entitlement* (server-controlled: plan/trial/plugin) from *admin visibility*. If `activity → capability` grants caps directly, a society enables features it hasn't paid for. **Mitigation:** activities may only enable capabilities **within** entitlement — `effective = (type ∪ activities ∪ grants) ∩ entitled`. This must be an explicit resolver rule. |
| MR-5 | **New RLS surface for `society_activities`** | **P1** | Activities are admin-declared (client-writable), unlike entitlement rows (server-only). New RLS must let an admin write activities **without** letting them self-grant unentitled capabilities (consistent with the C6 source-trust model). |
| MR-6 | **Effective-capabilities cache vs. existing `society_capabilities` table** | **P2** | Proposed `society_effective_capabilities` (resolved *output*) must not be confused with existing `society_capabilities` (entitlement *input*). Keep both, name clearly, single writer for the cache. |
| MR-7 | **Tenancy alignment** | **P2** | Most Group C tables default `society_id='SOC001'`; `society_settings` is an `id='main'` singleton. Per-society activities/cache must key on the same tenancy the app actually uses, or multi-society consolidation drifts. |

---

## 5. Backward compatibility issues

| ID | Issue | Severity | Notes |
|---|---|---|---|
| BC-1 | **`SOCIETY_TYPE_CAPABILITIES` is an exhaustive `Record<SocietyType, Capability[]>`** | **P2** | Adding a new type forces a mapping entry (compile-enforced) — safe, self-correcting. Adding `producer/multistate/multipurpose` is additive. ✅ low risk. |
| BC-2 | **23 files reference `societyType`** | **P2** | Any rename/removal breaks compiles; TypeScript will catch it. Keep additive. |
| BC-3 | **Existing entitlement rows must keep resolving unchanged** | **P1** | Post-migration, a society with only type-template caps (no activities yet) must resolve to the *exact same* capability set as today. Activities are purely additive on day one. Guarantee via MR-1 parity check. |
| BC-4 | **Do not rename `procurement_msp` → `procurement_engine`** | **P1** | The cap string is embedded in the type template and module gates; renaming breaks live gating. Introduce a new alias/cap and map, or keep the name and treat it as the engine. |
| BC-5 | **Statutory reports already gate on type (NabardReport, FederationReport)** | **P2** | This is *permitted* by the proposal — Tier-3 statutory reports are the one legitimate type gate. Verify these read `legalTypeCode` (or `societyType`) and not scattered ad-hoc type checks; otherwise no change needed. ✅ mostly compliant. |
| BC-6 | **`society_settings.societyType` stays as the seed for `legalTypeCode`** | **P2** | Backfill `legalTypeCode` from `societyType`; keep `societyType` populated as a deprecated mirror for audit history (matches DB-design Phase M5). |

---

## 6. Scorecard & what to do first

| Proposed layer | Current state | Verdict |
|---|---|---|
| Capabilities as the single gate | **Built** ([capabilities.ts](../../src/lib/navigation/capabilities.ts), CapabilityGuard) | ✅ Keep |
| Pure resolver + cache pattern | **Built** ([capabilityResolver.ts](../../src/lib/navigation/capabilityResolver.ts)) | ✅ Extend, don't replace |
| Licensing / entitlement (plan/trial/plugin) | **Built + RLS-enforced** | ✅ Exceeds proposal — reconcile into it (MR-4) |
| Jurisdiction packs (state → cap) | **Built** | ✅ Keep |
| Legal-type anchor | **Partial** — enum, not data catalog | ⚠️ MR-3 |
| **Activities layer** | **Absent** | ❌ **BA-1 (P0)** — the whole gap |
| Effective-caps materialized cache | Resolved in-memory per render (no persisted cache) | ⚠️ MR-6 (optional) |

### P0 items (must resolve to call the architecture adopted)
1. **BA-1** — introduce the Activities layer (catalog + `society_activities` + `activity_capability_map`).
2. **MR-1** — backfill parity guarantee: no society loses a module at cut-over.
3. **MR-2** — extend the resolver additively; activities resolve into the same `Set<Capability>`, purity preserved.

### P1 (near-term)
SC-1/2/3 (multipurpose, producer, multistate types) · BA-2/BA-3 (deposits, FPS+subsidy) · CAP-1/CAP-2 · MR-3/MR-4/MR-5 · BC-3/BC-4.

### P2 (backlog)
SC-4/SC-5 · BA-4/5/6/7 · CAP-3/4/5/6/7 · MR-6/MR-7 · BC-1/2/5/6.

---

## 7. One-paragraph conclusion

SahakarLekha does **not** need to adopt a new architecture — it already *is* a capabilities-driven app with a resolver, module gating, licensing, and jurisdiction packs, several of which exceed the original proposal. The genuine gap is a single missing layer: **Activities**. Insert it *between* the existing `SocietyType` anchor and the existing `Capability` gate, make it resolve **into the current capability set within entitlement** (never bypassing a plan), and guarantee **backfill parity** so no live society loses a module. Do that and the Multipurpose-PACS reality and the 15-year data-as-policy property fall out of what's already built — at P1/P2 cost, not a rewrite.
