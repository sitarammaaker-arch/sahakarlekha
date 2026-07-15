# SahakarLekha — Capabilities-Driven Database Design

**Companion to:** [DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md](DOMAIN-ARCHITECTURE-RESEARCH-2026-07.md)
**Date:** 2026-07-11
**Status:** Database structure design. **No code / no DDL. No schema changes executed.** Architecture only.
**Scope:** tables · relationships · lookup tables · capabilities · feature mapping · migration strategy.

---

## 0. Design principles (the rules this schema obeys)

1. **Behavior binds to capabilities, never to type or activity.** Every module/report/validation reads `society_effective_capabilities`. No query ever filters `societyType = 'PACS'`.
2. **Catalogs are data, not enums.** `legal_types`, `activities`, `capabilities` are seeded reference tables — a new government sector is an `INSERT`, never an `ALTER TABLE` or a TypeScript union edit.
3. **Additive-only evolution.** New concepts arrive as new rows / new nullable columns / JSONB keys. Existing financial tables (`vouchers`, `members`, `accounts`, `stock_*`, `sales`, `purchases`) are **never rekeyed** on type. This is what guarantees historical data survives policy change (aligns with **RULE 1**).
4. **Reuse existing conventions.** Text ids, `society_id text` tenancy, camelCase quoted columns, JSONB extras, `isDeleted` soft-delete, `alter table … add column if not exists` migrations, UTF-8 (**RULE 8**). Nothing here breaks the current save/rollback discipline.
5. **Resolve-and-cache.** Effective capabilities are computed once (Base-Type defaults ∪ Activity maps) and materialized, so the read path is a single indexed lookup — not a runtime join across catalogs on every render.

---

## 1. The four table groups

```
┌─ GROUP A — CATALOG / LOOKUP (seeded, versioned, extensible) ──────────────┐
│  legal_types · activities · capabilities                                   │
│  activity_capability_map · legal_type_default_caps                         │
│  coa_templates · report_registry · module_registry                         │
└────────────────────────────────────────────────────────────────────────────┘
┌─ GROUP B — SOCIETY / INSTANCE (per-tenant declarations) ──────────────────┐
│  societies (extend) · society_settings (extend) · society_activities       │
│  society_effective_capabilities (materialized cache)                       │
└────────────────────────────────────────────────────────────────────────────┘
┌─ GROUP C — EXISTING OPERATIONAL (unchanged; bind via society_id only) ─────┐
│  accounts · members · vouchers · voucher_entries · loans · assets           │
│  stock_items · stock_movements · sales · purchases · employees · …          │
└────────────────────────────────────────────────────────────────────────────┘
┌─ GROUP D — GOVERNANCE (audit of the catalog itself) ──────────────────────┐
│  catalog_versions · society_activity_log                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

Group C is the ~20 tables you already have. **This design adds Groups A, B, D and does not restructure Group C.**

---

## 2. Group A — Catalog / lookup tables

Field lists are conceptual (name · intent), not DDL.

### A1. `legal_types` — the thin legal anchor (~12 rows)
| Field | Intent |
|---|---|
| `code` (PK) | Stable slug: `pacs`, `ucb`, `coop_bank`, `housing`, `producer`, `sugar_processing`, `consumer`, `marketing`, `multistate`, `dairy_union`, `multipurpose` |
| `name`, `nameHi` | Display (Hindi-first per **RULE 7**) |
| `ncd_category_code` | Maps to National Cooperative Database sector code (future statutory integration) |
| `governing_act` | e.g. "State Coop Societies Act", "Multi-State Coop Act 2002", "BR Act (UCB)" |
| `regulator` | RCS / RBI / NABARD / Central Registrar |
| `statutory_report_set` (jsonb) | Which Tier-3 statutory returns apply |
| `jurisdiction` | `central` \| state code — lets State-Act variants coexist |
| `version`, `effective_from`, `is_active`, `superseded_by` | Versioning |

### A2. `activities` — business lines (extensible, dozens of rows)
| Field | Intent |
|---|---|
| `code` (PK) | `credit_short_term`, `deposits_savings`, `milk_procurement`, `agri_input_retail`, `consumer_retail`, `warehousing`, `fair_price_shop_pds`, `lpg_distribution`, `custom_hiring_centre`, `marketing_aggregation`, `processing`, `housing_management`, `fishery_operations`, `common_service_centre`, `clean_energy` … |
| `name`, `nameHi`, `description` | Display |
| `ncd_category_code` | NCD mapping |
| `activity_group` | Credit · Agri-Allied · Processing · Marketing · Services · Emerging |
| `version`, `effective_from`, `is_active`, `superseded_by` | Additive lifecycle — deprecate, never delete |

### A3. `capabilities` — the runtime switches (many small rows)
| Field | Intent |
|---|---|
| `code` (PK) | `cap.member_shares`, `cap.loan_ledger`, `cap.deposit_ledger`, `cap.inventory`, `cap.pos_billing`, `cap.procurement_engine`, `cap.quality_pricing`, `cap.warehouse_receipts`, `cap.subsidy_reconciliation`, `cap.gst_output`, `cap.tds`, `cap.property_units`, `cap.bom_costing` … |
| `name`, `description` | Display |
| `module_group` | Which functional area it belongs to |
| `is_core` | `true` = always on regardless of type/activity (spine) |
| `version`, `is_active` | Versioning |

### A4. `activity_capability_map` — resolver rules (activity → capability, many-to-many)
| Field | Intent |
|---|---|
| `activity_code` (FK → activities) | |
| `capability_code` (FK → capabilities) | |
| `is_required` | Hard dependency vs optional enhancement |
| `version`, `effective_from` | Rules themselves are versioned |

### A5. `legal_type_default_caps` — baseline caps a type always grants
| Field | Intent |
|---|---|
| `legal_type_code` (FK → legal_types) | |
| `capability_code` (FK → capabilities) | e.g. every `pacs` gets `cap.member_shares`, `cap.loan_ledger` by default |

### A6. `coa_templates` — chart-of-accounts seeds **keyed by capability, not type**
| Field | Intent |
|---|---|
| `capability_code` (FK → capabilities) | When this cap turns on, seed these accounts |
| `account_code`, `name`, `nameHi`, `type`, `subtype` | Mirrors existing `accounts` shape |
| `is_default_routing` | Feeds **RULE 4** per-item ledger routing (e.g. `4101`/`5101` defaults) |
| `version` | |

### A7. `report_registry` — which report shows, and why
| Field | Intent |
|---|---|
| `report_code` (PK) | `trial_balance`, `dcb`, `milk_payment_sheet`, `pacs_nabard_return` … |
| `tier` | `universal` \| `capability` \| `statutory` |
| `required_capability` (nullable) | Tier-2 binding |
| `required_legal_type` (nullable) | **Only** Tier-3 statutory reports set this |
| `scope`, `nav_group`, `version` | |

### A8. `module_registry` — which module/nav item appears
| Field | Intent |
|---|---|
| `module_code` (PK) | `loans`, `deposits`, `inventory`, `pos`, `milk_collection`, `warehouse`, `housing_units` … |
| `required_capability` (FK → capabilities) | The single gate |
| `nav_placement`, `min_role` | UI + RBAC hint (ties to ECR-06 RBAC work) |
| `version` | |

---

## 3. Group B — Society / instance tables

### B1. `societies` / `society_settings` — extend, don't replace
The existing `society_settings.societyType` (currently single text, default `'marketing_processing'`) is **retained as the Base-Type pointer** — it becomes a FK-by-convention to `legal_types.code`. Add (additive, nullable):
| New field | Intent |
|---|---|
| `legalTypeCode` | Canonical FK to `legal_types` (backfilled from `societyType`) |
| `jurisdiction` | State code for State-Act resolution |
| `capabilitiesResolvedAt` | Cache freshness stamp |

`societyType` stays for backward-compat during transition; `legalTypeCode` is the forward field. No behavior reads either directly after migration — both feed the resolver.

### B2. `society_activities` — the multipurpose join (the heart of the model)
| Field | Intent |
|---|---|
| `id` (PK) | |
| `society_id` (FK) | Tenant |
| `activity_code` (FK → activities) | One row per business line the society runs |
| `status` | `active` \| `paused` \| `retired` |
| `enabled_at`, `disabled_at` | History |
| `config` (jsonb) | Activity-specific settings (rate charts, subsidy rules, interest slabs) — **schema-flexible edge**, no ALTER needed for new policy fields |
| `isDeleted` | Soft-delete per house style |

A Multipurpose PACS = one `societies` row + 10–15 `society_activities` rows. This is exactly what the Model Bye-laws' 25+ activities require.

### B3. `society_effective_capabilities` — materialized resolver output (read everywhere)
| Field | Intent |
|---|---|
| `society_id` (FK) | |
| `capability_code` (FK → capabilities) | |
| `source` | `base:<legalType>` \| `activity:<activityCode>` — provenance for debugging/audit |
| `resolved_at` | Rebuild stamp |

Uniqueness on (`society_id`, `capability_code`). **The single hot-path table**: `has_capability(societyId, cap)` = one indexed lookup here.

---

## 4. Group D — Governance tables

| Table | Purpose |
|---|---|
| `catalog_versions` | Every catalog change (new activity/capability/mapping) recorded with `entity`, `code`, `version`, `effective_from`, `change_note`, `ncd_alignment`. Makes policy evolution auditable and reproducible across tenants. |
| `society_activity_log` | Append-only trail of activity enable/disable + capability re-resolution per society (who, when, why). Feeds the audit trail discipline the product already enforces. |

---

## 5. Relationships (ER map)

```
legal_types ─1───┐
                 │ (default caps)
                 ├───< legal_type_default_caps >───┐
                 │                                  │
societies ─*─────┘ (legalTypeCode)                  │
   │                                                ▼
   │ 1                                          capabilities ─1──< coa_templates
   │                                                ▲   ▲
   ▼ *                                              │   │
society_activities >──*── activities ─1──< activity_capability_map >──*─┘
   │                                                │
   │  (resolver: base_caps ∪ activity_caps)         │
   ▼                                                │
society_effective_capabilities >──*────────────────┘
   ▲
   │ read by
   ├── module_registry.required_capability
   ├── report_registry.required_capability      (report_registry.required_legal_type ── legal_types, Tier-3 only)
   └── all Group C operational tables via society_id  (never via type)
```

Cardinalities:
- `societies` **1—*** `society_activities` (a society does many activities).
- `activities` **\*—\*** `capabilities` via `activity_capability_map`.
- `legal_types` **\*—\*** `capabilities` via `legal_type_default_caps`.
- `society_effective_capabilities` = derived rows; refreshed whenever a society's `legalTypeCode` or its `society_activities` set changes.
- Group C tables relate to `societies` by `society_id` only — **structurally blind to type and activity.**

---

## 6. Capabilities catalog (seed set)

Core (always on — `is_core = true`): `cap.chart_of_accounts`, `cap.vouchers`, `cap.member_register`, `cap.member_shares`, `cap.ledgers`, `cap.trial_balance`, `cap.audit_trail`, `cap.fy_lock`, `cap.backup_restore`.

Activity-driven (illustrative):

| Capability | Granted by activities |
|---|---|
| `cap.loan_ledger`, `cap.interest_engine`, `cap.npa` | `credit_short_term`, `credit_long_term` |
| `cap.deposit_ledger` | `deposits_savings`, `deposits_term` |
| `cap.inventory` | `agri_input_retail`, `consumer_retail`, `milk_sales`, `warehousing`, `processing` |
| `cap.pos_billing` | `consumer_retail`, `fair_price_shop_pds` |
| `cap.procurement_engine` | `foodgrain_procurement`, `milk_procurement`, `marketing_aggregation` |
| `cap.quality_pricing` | `milk_procurement` |
| `cap.warehouse_receipts` | `warehousing`, `cold_storage` |
| `cap.subsidy_reconciliation` | `fair_price_shop_pds`, `agri_input_retail` |
| `cap.gst_output`, `cap.tds` | retail / marketing / processing activities |
| `cap.property_units`, `cap.maintenance_billing` | `housing_management` |
| `cap.bom_costing` | `processing` |

Note the reuse: **one `cap.procurement_engine` serves dairy, foodgrain, and marketing** — no forked module per domain. This is the payoff that collapses your in-flight Housing / Dairy / Consumer / Marketing branches into a single spine.

---

## 7. Feature mapping (end-to-end resolution examples)

**Example 1 — a Multipurpose PACS enabling milk collection:**
```
society_activities += milk_procurement
   → activity_capability_map: milk_procurement → {cap.procurement_engine, cap.quality_pricing, cap.inventory}
      → society_effective_capabilities gains those 3 (source=activity:milk_procurement)
         → module_registry: cap.procurement_engine ⇒ "Milk Collection" module appears
         → module_registry: cap.quality_pricing   ⇒ "Fat/SNF Rate Chart" appears
         → report_registry: cap.quality_pricing   ⇒ "Milk Payment Sheet" report appears
         → coa_templates: cap.procurement_engine  ⇒ seeds producer-payment / procurement accounts
```

**Example 2 — report tier resolution for the same society:**
```
Trial Balance      → tier=universal   → always shown
DCB register       → tier=capability  → shown iff has_capability(cap.loan_ledger)
Milk Payment Sheet → tier=capability  → shown iff has_capability(cap.quality_pricing)
PACS NABARD return → tier=statutory   → shown iff legalTypeCode = 'pacs'   ← the ONLY type-gated reports
```

**Example 3 — module visibility & RBAC:** a module appears only if its `required_capability` is present *and* the user's role ≥ `min_role` (bridges to ECR-06 RBAC). Type is never consulted.

---

## 8. How existing (Group C) tables participate — without change

- `accounts` — seeded/extended by `coa_templates` (keyed on capability). Existing accounts untouched; new capability turning on *adds* heads. **RULE 4** default routing (`4101`/`5101`) preserved via `coa_templates.is_default_routing`.
- `vouchers`, `voucher_entries`, `sales`, `purchases`, `stock_*`, `loans`, `members`, `assets`, `salary_records` — **no new type/activity columns.** They already carry `society_id`; that is their only link. Reports over them filter `isDeleted = false` (**RULE 5**) and read capability flags to decide *which* aggregations to run — the data shape is identical.
- Save paths keep the **two-step upsert + rollback** discipline (**RULE 1**) and the **FY-lock guard** (**RULE 6**). Enabling/disabling an activity is itself a mutation → it must carry the FY-lock check and rollback-on-failure, same as any `add*`.

**Net:** turning SahakarLekha into a capabilities platform touches *configuration* tables, not the financial ledger tables. Historical books are provably safe.

---

## 9. Migration strategy (additive, zero-loss, phased)

Every step is backward-compatible; the app runs correctly after **each** phase, not only at the end. All migrations follow `add column if not exists` / seed-insert style (**RULE 8** encoding).

**Phase M0 — Ship catalogs (no behavior change).**
Create Group A + B-new + D tables. Seed `legal_types` (12), `activities`, `capabilities`, and the two mapping tables. App ignores them for now. Purely additive; nothing reads them yet → zero risk.

**Phase M1 — Backfill Base Type.**
Add `society_settings.legalTypeCode`. Backfill from the existing `societyType`:
`'marketing_processing' → 'marketing'` (+ seed activities `marketing_aggregation`, `processing`); map any other current values to their `legal_types.code`. Keep `societyType` populated in parallel. **No behavior change** — resolver not yet live.

**Phase M2 — Seed each society's activities.**
For every society, infer initial `society_activities` from (a) its backfilled type defaults and (b) evidence in Group C (has loans → `credit_*`; has `stock_items`/`sales` → retail; has milk accounts → `milk_procurement`; etc.). This is a one-time inference migration; results are reviewable per tenant before cut-over.

**Phase M3 — Build & populate the resolver.**
Compute `society_effective_capabilities` for all societies (base defaults ∪ activity maps). Validate: every currently-visible module/report must map to a capability the society now has, so **nothing disappears** at cut-over. Diff report generated per society; fix mappings until the diff is empty.

**Phase M4 — Flip the read path (feature-flagged).**
Switch modules/reports/COA/RBAC from reading `societyType` to reading `has_capability(...)`, behind a per-tenant flag. Roll out society-by-society; the M3 empty-diff guarantees parity. Rollback = flip the flag off (old type-based path still present).

**Phase M5 — Decommission type-branching.**
Once all tenants are on the capability path and stable, remove the legacy `societyType` behavior branches from code. `societyType` column is retained as a deprecated mirror of `legalTypeCode` (kept, not dropped, for audit history).

**Forward operating rule (post-migration):** a new government activity/sector = seed `activities` + `capabilities` + `activity_capability_map` rows (Phase-M0-style insert) → tenants opt in via `society_activities` → resolver rebuilds. **No schema migration, no code deploy, no historical-data touch.** That is the 15-year property.

---

## 10. Versioning & governance rules (so the catalog stays trustworthy)

1. **Never mutate meaning of a `code`.** Deprecate with `is_active=false` + `superseded_by`; introduce a new code for new meaning.
2. **Every catalog change writes `catalog_versions`** with `effective_from` and `ncd_alignment`, so a tenant's historical behavior is reconstructable.
3. **Config lives in JSONB at `society_activities.config` / `societies.config`;** typed columns only for data that is reported, aggregated, or integrity-checked (keeps **RULE 1/RULE 2** discipline intact).
4. **Resolver is the sole writer** of `society_effective_capabilities`; nothing else inserts there. One source of truth → policy changes re-resolve centrally.
5. **Map to National Cooperative Database codes** on `legal_types` and `activities` so future statutory/NCD data-exchange is a projection, not a rebuild.

---

## Summary

- **3 new lookup catalogs** (`legal_types`, `activities`, `capabilities`) + **2 mapping tables** + **3 binding registries** (`coa_templates`, `report_registry`, `module_registry`).
- **1 multipurpose join** (`society_activities`) + **1 materialized cache** (`society_effective_capabilities`) + **2 governance tables**.
- **Zero restructuring** of the ~20 existing operational tables — they bind by `society_id` and read capabilities; they never learn type or activity names.
- **6-phase additive migration**, each phase independently shippable and reversible, backfilling from today's `societyType`.
- **Forward property:** every future Ministry-of-Cooperation bye-law is absorbed as **catalog data**, not as a migration.
