# SahakarLekha — Domain Architecture Research & Recommendation

**Author role:** Cooperative Domain Architect · ERP Product Architect · Government Policy Researcher
**Date:** 2026-07-11
**Status:** Research + final recommendation. No code. No schema changes. Design only.
**Horizon:** 15-year future-proofing (2026 → 2041).

---

## 0. Executive answer (read this first)

> **Use a three-layer Capabilities-driven architecture: a thin legal *Base Type*, a set of declared *Activities*, and a resolved layer of *Capabilities* that everything else keys off.**
> This is **Option C (Capabilities-driven), anchored by a minimal legal Type**. Not Option A. Not plain Option B.

The single most important finding: **Indian cooperative policy is actively demolishing the "one society = one type" assumption.** The Multipurpose PACS reform lets a *single* PACS run 25+ businesses (credit + dairy + fisheries + fair-price shop + LPG + warehousing + CSC). The National Cooperation Policy 2025 pushes *every* society toward becoming a multi-service center. Any architecture where **behavior is gated by a `societyType` enum is already obsolete** and will require a painful migration within 2–3 years.

SahakarLekha must model **what a society *does*** (activities → capabilities), not **what it is called** (type). Type survives only as a *legal/statutory anchor*, not as a behavior switch.

---

## 1. Policy grounding (why "the next 15 years" points one direction)

The recommendation is not a hunch; it follows the stated direction of the Government of India.

| Signal | What it says | Architectural consequence |
|---|---|---|
| **Multipurpose PACS / Model Bye-laws** | A single PACS may now undertake **25+ business activities** — dairy, fisheries, godowns, foodgrain/fertilizer/seed procurement, LPG-CNG-petrol distributorship, short & long-term credit, custom hiring centres, Fair Price Shops, community irrigation, Common Service Centres. **32 States/UTs** have adopted the model bye-laws. | One society ⇒ many activities. **Type cannot gate behavior.** Activities must be an independently-toggled set. |
| **National Cooperation Policy 2025** — six pillars, incl. "Making Cooperatives Future-Ready" and "Entering New & Emerging Sectors" | Explicit push into **biogas, clean energy, warehousing, healthcare, platform cooperatives**; "cooperative stack"; IoT/blockchain; model cooperative village; one model PACS per district. | New activity categories will keep appearing. The catalog **must be extensible without schema change.** |
| **National Cooperative Database (NCD)** — launched 2024, ~8 lakh societies, 30 crore members, 24+ sector categories | Government now maintains a canonical **sectoral taxonomy** and reporting spine. | SahakarLekha's Base Type / Activity vocabulary should **map cleanly to NCD categories** so future statutory data-integration is trivial. |
| **State Cooperative Acts (common pattern)** | Legal identity, audit classification, statutory returns, and election rules are set by the **Act of registration**, which is *slow-changing* and *jurisdiction-specific*. | Keep a **thin legal Type** anchored to the Act — this is the only place "type" legitimately drives behavior (compliance/statutory reports). |

**Net:** Legal identity is stable and few; business behavior is fluid and many. The architecture must separate the two.

---

## 2. The three layers (definitions used throughout)

1. **Base Type (Legal Identity)** — *What the society is registered as, under which Act.* Small, enumerable, slow-changing. Drives **statutory identity, audit classification, and compliance returns** only. Examples: PACS, Urban Cooperative Bank, Housing Society, Producer Cooperative, Multi-State Cooperative, Cooperative Sugar Mill.

2. **Activity (Business Line)** — *What the society actually does.* User-declared, multi-select, evolves over the society's life. Examples: `credit`, `deposits`, `milk_procurement`, `agri_input_retail`, `consumer_retail`, `warehousing`, `fair_price_shop`, `lpg_distribution`, `custom_hiring`, `marketing_aggregation`, `processing`, `housing_management`.

3. **Capability (Runtime Feature Switch)** — *What the software turns on.* Fine-grained flags that **modules, reports, chart-of-accounts templates, RBAC, and validations read.** Capabilities are **derived** from Base Type defaults + enabled Activities via a mapping table. Examples: `cap.inventory`, `cap.pos_billing`, `cap.milk_fat_snf_pricing`, `cap.loan_ledger`, `cap.member_shares`, `cap.warehouse_receipts`, `cap.gst_output`, `cap.subsidy_reconciliation`.

**The golden rule:** *No module, report, or validation may branch on Base Type or Activity directly. They branch on Capabilities.* Type and Activity resolve **into** capabilities; code reads capabilities. This is the seam that makes the next 15 years survivable.

```
 Base Type (legal)  ─┐
                     ├──►  Capability Resolver  ──►  Effective Capabilities  ──►  Modules / Reports / COA / RBAC
 Activities (chosen) ─┘        (rules table)              (cached per society)
```

---

## 3. Answers to the ten questions

### Q1 — Society Types, Business Activities, or hybrid?

**Hybrid, but not a naive 50/50 hybrid — a *layered* hybrid where each layer has one job.**

- Base Type = legal anchor (compliance only).
- Activities = business intent (user-declared, many-per-society).
- Capabilities = the switch layer everything reads.

Pure "Society Type" fails immediately against Multipurpose PACS. Pure "Activities" loses the legal/statutory identity that audits and government returns require. The layered model keeps both and adds the decoupling layer that lets government policy evolve without code rewrites.

### Q2 — All major cooperative categories to support

Grounded in the **National Cooperative Database** taxonomy (so future NCD/statutory integration is clean). Grouped by economic function:

**A. Credit & Financial**
- Primary Agricultural Credit Society (PACS)
- Large Area Multipurpose Society (LAMPS)
- Farmers Service Society (FSS)
- Urban Cooperative Bank (UCB)
- State / District Central Cooperative Bank (StCB / DCCB)
- SCARDB / PCARDB (long-term rural credit)
- Salary-earners' / Thrift & Credit / Miscellaneous Credit Society

**B. Agriculture, Allied & Producer**
- Dairy Cooperative (VDCS / union / federation)
- Fishery Cooperative
- Livestock & Poultry Cooperative
- Sericulture Cooperative
- Multipurpose Cooperative
- Producer Cooperative (FPO-linked)

**C. Processing & Industry**
- Cooperative Sugar Mill
- Handloom / Textile / Weavers Cooperative
- Handicraft Cooperative
- Jute & Coir Cooperative
- Oilseed / Agro-processing Cooperative

**D. Marketing & Distribution**
- Marketing Cooperative
- Consumer Cooperative (stores)
- Fair Price Shop / PDS Cooperative

**E. Services & Social**
- Housing Cooperative
- Labour / Contract / Construction Cooperative
- Transport Cooperative
- Tourism Cooperative
- Educational & Training Cooperative
- Social Welfare & Cultural Cooperative
- Women Welfare Cooperative
- Tribal / SC-ST Cooperative

**F. New & Emerging (NCP 2025 mandated — must be *addable as data*, not shipped hardcoded)**
- Clean Energy / Biogas / Solar Cooperative
- Warehousing & Logistics Cooperative
- Healthcare Cooperative
- Waste Management Cooperative
- Platform / Digital-services Cooperative
- Common Service Centre (CSC) operations

The list is deliberately long to show the range — but **most of these should NOT be Base Types.** See Q3–Q5.

### Q3 — Which categories are Base Types?

Base Types = only the categories that carry a **distinct legal/statutory/audit identity**. Keep this list *short* (roughly a dozen), because every Base Type is a maintenance and compliance liability.

**Base Types (legal anchors):**
1. PACS (incl. LAMPS/FSS as sub-variants)
2. Urban Cooperative Bank
3. Cooperative Bank — StCB / DCCB / SCARDB / PCARDB
4. Housing Cooperative
5. Producer Cooperative
6. Cooperative Sugar Mill / Processing Cooperative
7. Consumer Cooperative
8. Marketing Cooperative
9. Multi-State Cooperative Society (cross-state legal regime)
10. Dairy/Milk Union (federal tier)
11. General/Multipurpose Cooperative (catch-all)

Everything else (fishery, weavers, transport, tourism, CSC, energy…) is expressed as **Activities on top of a Base Type** — usually "General/Multipurpose Cooperative" — not as its own type.

**Test for "is this a Base Type?":** *Does it change the statutory return, the audit classification, or the Act it registers under?* If no → it is an Activity, not a Type.

### Q4 — Which categories are Activities?

Activities = business lines a society *does*, independent of its legal name. This is where the 25+ Multipurpose-PACS activities live, plus everything sector-specific:

- `credit_short_term`, `credit_long_term`, `deposits_savings`, `deposits_term`
- `milk_procurement`, `milk_sales`, `cattle_feed`
- `agri_input_retail` (seed/fertilizer/pesticide), `custom_hiring_centre`
- `foodgrain_procurement`, `warehousing`, `cold_storage`
- `consumer_retail`, `fair_price_shop_pds`
- `lpg_cng_petrol_distribution`
- `marketing_aggregation`, `commodity_trading`, `export`
- `processing` (sugar/oil/rice/textile)
- `fishery_operations`, `poultry_livestock`
- `housing_management`, `maintenance_billing`
- `common_service_centre`, `insurance_agency`, `banking_correspondent`
- `clean_energy`, `biogas`, `waste_management` *(emerging — data rows)*

A society picks any subset. A Multipurpose PACS legitimately enables 10–15 of these at once.

### Q5 — Which should be Capabilities?

Capabilities = the **functional switches** the software actually consumes. They sit *below* activities and are *shared* across activities (this is what prevents module duplication). Examples:

| Capability | Turned on by (activities) | What it unlocks |
|---|---|---|
| `cap.member_shares` | (all — base) | Member register, share ledger, patronage |
| `cap.loan_ledger` | credit_* | Loan accounts, interest, DCB, NPA |
| `cap.deposit_ledger` | deposits_* | Savings/term deposit accounts, interest posting |
| `cap.inventory` | agri_input_retail, consumer_retail, milk_sales | Stock items, movements, valuation |
| `cap.pos_billing` | consumer_retail, fair_price_shop | Counter sale / POS |
| `cap.procurement_engine` | foodgrain_procurement, milk_procurement, marketing_aggregation | Purchase/collection → payment → posting |
| `cap.quality_pricing` | milk_procurement | Fat/SNF, moisture-based rate charts |
| `cap.warehouse_receipts` | warehousing, cold_storage | WDRA-style receipts, storage charges |
| `cap.subsidy_reconciliation` | fair_price_shop, agri_input_retail | Government subsidy claims |
| `cap.gst_output` / `cap.tds` | retail/marketing/processing | Tax modules |
| `cap.property_units` | housing_management | Flats/plots, maintenance billing |

Capabilities are **many, small, and reusable.** The same `cap.procurement_engine` serves dairy, foodgrain, and marketing — no forked code.

### Q6 — Which modules auto-enable from activities?

Modules subscribe to **capabilities**, and capabilities are resolved from activities. So enabling an activity lights up modules *transitively*:

| Enable activity | Resolves capabilities | Modules that auto-appear |
|---|---|---|
| `credit_short_term` | loan_ledger, member_shares, interest_engine | Loans, DCB register, NPA, Interest posting |
| `deposits_savings` | deposit_ledger, interest_engine | Deposits, Passbook, Interest |
| `milk_procurement` | procurement_engine, quality_pricing, inventory | Milk collection, Fat/SNF pricing, Producer payments |
| `agri_input_retail` | inventory, pos_billing, gst_output | Inventory, Counter sales, GST |
| `consumer_retail` | inventory, pos_billing, gst_output | POS, Stock, Day-book |
| `warehousing` | warehouse_receipts, inventory | Warehouse, Storage billing |
| `fair_price_shop_pds` | pos_billing, subsidy_reconciliation | PDS sales, Subsidy claims |
| `housing_management` | property_units, maintenance_billing | Units, Maintenance, Society dues |
| `processing` | inventory, bom_costing | Production, Costing, By-products |

**Always-on core** (Base capabilities, no activity needed): Chart of Accounts, Vouchers, Member register, Trial Balance, Ledgers, Audit trail, FY lock, Backup/Restore. This is SahakarLekha's generic accounting spine — already ~80% of the product.

### Q7 — Which reports auto-change by society type?

Split reports into three tiers by *what drives the change*:

**Tier 1 — Universal (never change):** Trial Balance, General Ledger, Cash/Bank Book, Journal, Receipts & Payments, Balance Sheet, Member Register, Audit Trail.

**Tier 2 — Capability-driven (change by activity/capability, NOT by type):**
- `cap.loan_ledger` → **Demand-Collection-Balance (DCB)**, NPA classification, Overdue register
- `cap.deposit_ledger` → Deposit maturity, Interest-paid statements
- `cap.inventory` → Stock summary, Trading A/c per category (your RULE 2/RULE 4 lives here)
- `cap.procurement_engine` → Procurement register, Producer payment register
- `cap.quality_pricing` → Fat/SNF milk payment sheet
- `cap.warehouse_receipts` → Storage register, WDRA receipts
- `cap.property_units` → Maintenance dues, Defaulter list
- `cap.subsidy_reconciliation` → Subsidy claim statement

**Tier 3 — Legal-Type-driven (the ONLY reports that key off Base Type):** Statutory returns and audit formats set by the Act/registrar:
- PACS → NABARD/RCS returns, PACS audit classification
- UCB / Cooperative Bank → RBI returns, CRAR, SLR/CRR
- Housing → State registrar's annual return, AGM statutory statements
- Sugar/Processing → Sugar Commissioner / cane-price returns
- Multi-State → Central Registrar (CRCS) filings

So: **Statutory/compliance reports switch on Base Type; all operational reports switch on Capabilities.** Type touches a *small, well-defined* report set — not the whole reporting engine.

### Q8 — DB design that absorbs future government policy without breaking existing data

Five principles (design intent, not DDL):

1. **Catalogs are data, not enums.** `activities`, `capabilities`, and `legal_types` live in **reference tables**, never as Postgres `enum` types or hardcoded TypeScript unions that gate behavior. Adding the 26th PACS activity or NCP-2026's "hydrogen cooperative" is an **INSERT**, not a migration.

2. **Additive-only, versioned catalogs.** Never repurpose or delete a catalog row's meaning. Deprecate with `is_active=false` + `superseded_by`. Each catalog row carries `version`, `effective_from`, `ncd_category_code` (map to National Cooperative Database), and `jurisdiction` (state/central) so State-Act variants coexist.

3. **Config in JSONB, at the edges.** Society-specific and activity-specific settings (rate charts, subsidy rules, interest slabs) go in a `config jsonb` column — schema-flexible, so new policy fields don't force `ALTER TABLE`. Structured, queried, reported data stays in typed columns (per your RULE 1/RULE 2 integrity discipline).

4. **Effective capabilities are resolved and cached, never inferred ad-hoc.** Compute `society_effective_capabilities` = (Base-Type default caps) ∪ (caps from each enabled activity), store it, and read it everywhere. One resolver, one source of truth — so a policy change re-resolves centrally instead of rippling through call sites.

5. **Behavior binds to capabilities only.** No report/module/validation query filters on `society.type = 'PACS'`. It checks `has_capability(society, 'cap.loan_ledger')`. This is the invariant that makes the schema future-proof: *government can invent new types and activities forever; the code never learns their names.*

Compatibility with your existing product: this generalizes the domain branches already in flight (Housing context, Dairy VDCS plan, Consumer C1 retail, Marketing procurement). Instead of forking a context per domain, each becomes **an activity + capability set on the shared spine** — collapsing four half-built silos into one extensible core.

### Q9 — Ideal data model (conceptual, no DDL)

**Reference / catalog layer (seeded, versioned, extensible):**
- `legal_types` — id, code, name, `ncd_category_code`, act/regulator, statutory_report_set, jurisdiction, version, is_active
- `activities` — id, code, name, `ncd_category_code`, description, version, is_active, superseded_by
- `capabilities` — id, code, name, module_group, description, version, is_active
- `activity_capability_map` — activity_id → capability_id (the resolver rules)
- `legal_type_default_caps` — legal_type_id → capability_id (baseline caps a type always gets)

**Society / instance layer:**
- `societies` — id, name, **legal_type_id** (FK, single), jurisdiction/state, registration_no, `config jsonb`, fy_locked …
- `society_activities` — society_id → activity_id, status, enabled_at, disabled_at, `config jsonb` *(many per society — this is the multipurpose join)*
- `society_effective_capabilities` — society_id → capability_id, source (`base` | `activity:<id>`), resolved_at *(materialized cache; rebuilt when activities change)*

**Binding layer (how features find their config):**
- `coa_templates` keyed by capability (not type) → seeds accounts when a capability turns on
- `report_registry` — report_id, `required_capability` OR `required_legal_type` (statutory tier), scope
- `module_registry` — module_id, `required_capability`, nav placement

**Read path everywhere in code:**
`has_capability(societyId, 'cap.x')` → single indexed lookup on `society_effective_capabilities`. Modules, reports, COA seeding, RBAC, and validations all funnel through this one predicate.

**Write path when policy changes:**
Add `activities` / `capabilities` rows → add `activity_capability_map` rows → societies opt-in via `society_activities` → resolver rebuilds `society_effective_capabilities`. **Zero migration of historical financial data.** Existing vouchers, members, and ledgers are untouched because they never depended on type.

### Q10 — Final recommended architecture

**Capabilities-Driven Architecture with a Legal-Identity Anchor (layered hybrid).**

- **Base Type** — thin, legal, ~12 values, drives *only* statutory/compliance reports.
- **Activities** — rich, user-declared, many-per-society, catalog-extensible, express business intent.
- **Capabilities** — the resolved switch layer; *the only thing application code reads.*
- **Resolver + cache** — Type defaults ∪ Activity-mapped caps → `society_effective_capabilities`.
- **Catalogs as versioned data**, config in JSONB, additive-only, mapped to NCD codes.

This is **Option C, with a legal Type retained as an anchor** (a disciplined superset of Option B).

---

## 4. Option comparison (A vs B vs C)

| Dimension | **A. Society Type only** | **B. Type + Activities** | **C. Capabilities-driven (+ legal Type anchor) — RECOMMENDED** |
|---|---|---|---|
| Models Multipurpose PACS (25+ activities in one society) | ❌ Impossible — one type, one behavior | ✅ Yes | ✅ Yes |
| New govt sector added (NCP 2025 energy/health/platform) | ❌ New type + code branches + migration | ⚠️ Add activity, but modules still often branch on type | ✅ Insert catalog rows only; no code, no migration |
| Where code branches | On `type` everywhere — brittle | On type *and* activity — two axes, drift | On **capability only** — one axis, one predicate |
| Module duplication across domains | Severe (per-type forks) | Moderate | ✅ None — shared capabilities (one procurement engine for dairy/foodgrain/marketing) |
| Statutory/compliance reports | ✅ Natural | ✅ Natural | ✅ Natural (Type anchor retained) |
| Historical-data safety on policy change | ❌ Migrations risk existing ledgers | ⚠️ Some risk | ✅ Additive-only; financial data never keyed on type |
| Fits SahakarLekha's existing branches (Housing/Dairy/Consumer/Marketing) | ❌ Forces 4 silos | ⚠️ Partial unification | ✅ Collapses all into one extensible spine |
| 15-year durability | ❌ Obsolete in ~2 yrs | ⚠️ Survives but accrues type-branch debt | ✅ Government can invent types/activities forever; code never learns their names |
| Implementation cost now | Low | Medium | Medium-high (resolver + catalogs) |
| Cost of the *next* policy change | High (recurring) | Medium (recurring) | ✅ Near-zero (recurring) |

**Why not A:** Dead on arrival against Multipurpose PACS and NCP 2025. Every future sector = a migration.

**Why not plain B:** Correct instinct (type + activity), but if modules/reports still branch on **type**, you carry a growing type-switch debt and re-duplicate modules per domain. B without a capability layer is a slow-motion version of A.

**Why C:** The capability layer is the seam that absorbs 15 years of policy churn *as data*. The one-time cost of the resolver + catalogs is repaid at every future policy change — and it unifies the domain silos you're already building.

---

## 5. Final recommendation (single, decisive)

Adopt **Option C — Capabilities-Driven Architecture with a Legal-Identity Anchor.**

1. **Base Type** stays, but shrinks to a **legal anchor** (~12 values) that drives statutory returns and audit classification *only*.
2. **Activities** become a **multi-select, catalog-driven** declaration of what the society does — directly modeling Multipurpose PACS and every emerging NCP-2025 sector.
3. **Capabilities** are the **single switch layer** that modules, reports, chart-of-accounts, RBAC, and validations read. **No feature ever branches on Type or Activity directly.**
4. A **resolver** computes effective capabilities (Type defaults ∪ Activity maps) into a **cached table**; catalogs are **versioned data mapped to National Cooperative Database codes**, evolving **additively** with config in JSONB.

**One-line rationale:** Indian cooperative policy has decoupled *what a society is called* from *what it does*; SahakarLekha's architecture must do the same, or it inherits a migration every time the Ministry of Cooperation issues a new bye-law — which, on the current trajectory, is roughly annually.

---

## Sources

- [National Cooperation Policy 2025 — PIB / official PDF](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/aug/doc202582598301.pdf)
- [National Cooperation Policy 2025 — analysis (six pillars, new sectors)](https://cooptalksindia.com/national-cooperation-policy-2025/)
- [Model Bye-laws for PACS — Ministry of Cooperation](https://www.cooperation.gov.in/en/model-bylaws-pacs)
- [Initiatives of Ministry of Cooperation (25+ PACS activities, 32 States/UTs adopted)](https://www.cooperation.gov.in/en/initiatives-ministry-cooperation)
- [National Cooperative Database — Ministry of Cooperation](https://www.cooperation.gov.in/en/national-cooperative-database)
- [National Cooperative Database portal (sector-wise taxonomy)](https://cooperatives.gov.in/en)
- [Amit Shah launches National Cooperative Database — Business Standard](https://www.business-standard.com/india-news/cooperation-minister-amit-shah-launches-national-cooperative-database-124030800752_1.html)
- [NABARD — Cooperatives: Tackling Challenges, Building Opportunities](https://www.nabard.org/pdf/2024/cooperatives-tackling-challenges-building-opportunities.pdf)
