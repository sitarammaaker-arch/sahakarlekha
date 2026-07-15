# SahakarLekha Research Task 3.1 — Cooperative Operating System: Product Architecture

**Scope:** High-level product architecture only. No code, no database schema, no UI, no competitor comparison, no implementation detail. Conceptual design for a multi-tenant cloud platform serving eight cooperative types (PACS, Marketing, Consumer, Dairy, Housing, Labour, Industrial, Multi-State). **Types:** All = all eight · type-specific noted inline.

## Architectural backbone (layering model)
A **multi-tenant core** (shared by every society) → **shared cross-cutting services** (used by all modules) → **optional activity modules** (enabled per society's business) → **society-specific vertical modules** (encapsulate each type's unique logic). Master + transaction data sit under all layers; audit trail spans all layers. Type differences are expressed as **configuration + vertical plug-ins over one common core**, not as separate products.

## Architecture matrix (15 topics)

| Topic | Purpose | Why required | Dependencies | Applicable types | Priority | Risks | Scalability considerations |
|---|---|---|---|---|---|---|---|
| **1 Core Platform Modules** | Always-on foundation: accounting/GL, member management, share capital, financial statements, statutory compliance | No cooperative can function without ledger, members, capital and statutory reporting | Master data, authentication | All | **Core** | Over-coupling; one-size misfit across types | Multi-tenant, stateless services; per-tenant isolation |
| **2 Optional Modules** | Activity capabilities enabled on demand: loans, deposits (FD/RD), procurement, milk collection, POS/retail, payroll | Not every type needs every function | Core modules | Type-dependent | **Optional** | Feature sprawl; inconsistent behaviour | Modular/pluggable; independently deployable |
| **3 Shared Modules** | Reusable services used by all: approval workflow, notifications, documents, audit trail, reporting, tax engine | Avoid duplication; guarantee consistency | Core platform | All | **Core** | Shared-service bottleneck / single point of failure | Independent horizontally-scalable services |
| **4 Society-Specific Modules** | Encapsulate each type's unique logic: dairy Fat/SNF pricing, housing sinking/repair funds, PACS CAS+DCB, marketing pool accounting, labour muster | Type-specific accounting & workflows differ materially | Core + shared + optional | One per vertical | **Optional** (per type) | Vertical divergence; maintenance cost | Vertical plug-ins over common core; shared contracts |
| **5 Master Data Structure** | Canonical reference entities: members, chart of accounts, items, suppliers, employees, funds, rate masters | Single source of truth for all transactions | Core | All | **Core** | Duplication/inconsistency; weak governance | Centralized masters, per-tenant partitioning, versioning |
| **6 Transaction Data Structure** | Record all financial/operational events: vouchers, receipts, payments, loans, milk collection, sales | Core of double-entry and audit | Master data, COA | All | **Core** | **Data-integrity / local-vs-cloud divergence; rollback**; high volume | Append-only, partitioned by tenant/period; idempotent writes |
| **7 Approval Workflow Structure** | Configurable multi-level approval / maker-checker per transaction type & amount; FY-lock enforcement | Financial authorization matrix; governance; segregation | User roles, permissions | All | **Core** | Bottlenecks; misconfiguration bypasses controls | Rules engine; async; per-tenant configurable |
| **8 User Role Structure** | Standard roles: secretary, accountant, cashier, committee, auditor, member, platform-admin | Segregation of duties; least privilege | Authentication | All | **Core** | Role explosion; over-privilege | Role hierarchy; tenant-scoped; branch-scoped |
| **9 Permission Architecture** | Granular module/action/data-scoped access (RBAC + tenant + branch scope) | Least privilege across multi-branch / multi-society | Roles | All | **Core** | Complexity; privilege creep | Policy-based, cached evaluation, scope tags |
| **10 Reporting Architecture** | Statutory statements (R&P, P&L, Balance Sheet, DCB) + MIS + audit reports | Statutory obligation + management need | Transaction + master data | All | **Core** | **Formula divergence** (report vs source); performance under load | Read-replicas / OLAP separation from OLTP |
| **11 Notification Architecture** | Multi-channel alerts (SMS/email/app): dues, approvals, compliance deadlines | Member engagement; compliance reminders | Events, master contacts | All | **Optional** (Core for compliance alerts) | Spam/cost; delivery failure | Queue-based; provider-agnostic adapters |
| **12 Document Management** | Store/retrieve statutory documents: vouchers, KYC, minutes, audit reports, certificates | Record retention (≥10 yrs); audit evidence | Storage, audit trail | All | **Core** | Storage cost; retention-compliance failure | Object storage; lifecycle/retention policies |
| **13 Audit Trail Architecture** | Immutable log of every create/update/delete: actor, time, before/after | Statutory audit; fraud detection; non-repudiation | All modules | All | **Core** | Volume; tamper resistance | Append-only / WORM storage; partitioned |
| **14 Integration Architecture** | Connect to banks, NABARD/NLDR, GST/TDS portals, payment gateways, KYC/UIDAI, DCCB/StCB | Reporting, payments, KYC, refinance linkage | Auth, security | Type-dependent (PACS→NABARD; all→GST/bank) | **Optional** (Core for banking/tax) | External dependency; format churn; security exposure | API gateway; versioned adapters; retry/circuit-breaker |
| **15 AI Readiness Architecture** | Structure data/events to enable future analytics/AI (anomaly, credit scoring, forecasting, fraud) | Future differentiation — a data-foundation, not a current feature | Clean master/transaction data, audit trail | All | **Optional** | Premature complexity; data quality/privacy | Event stream + separate analytics store (data lake) |

## Cross-cutting architectural principles (derived from the matrix)

| Principle | Rationale |
|---|---|
| **One core, many verticals** | Eight types share ~70–80% (members, capital, GL, compliance); differences isolated in society-specific modules — avoids eight separate products |
| **Data integrity is the top non-functional requirement** | Transaction layer must guarantee no silent local-vs-cloud divergence and no report-vs-source formula drift — the highest-impact failure class |
| **Configuration over customization** | State/type variation (reserve %, dividend cap, forms, thresholds) handled as tenant configuration, not code forks |
| **Audit-first** | Immutable audit trail + document retention are core, not optional — statutory audit and fraud-defect patterns demand it |
| **Multi-tenant, multi-branch, multi-state by design** | Tenant + branch + state scoping baked into master data, permissions and reporting from the start (MSCS and multi-branch credit need it) |
| **Shared services must scale independently** | Approval, notification, reporting, audit are used by every module — each horizontally scalable to avoid a platform-wide bottleneck |

## Priority summary

| Priority | Modules/services |
|---|---|
| **Core (all societies)** | Core platform (1), Shared services (3), Master data (5), Transaction data (6), Approval workflow (7), User roles (8), Permissions (9), Reporting (10), Document management (12), Audit trail (13) |
| **Optional (per society/type)** | Optional activity modules (2), Society-specific verticals (4), Notifications (11 — core for compliance), Integrations (14 — core for banking/tax), AI readiness (15) |

## Key architectural risks (consolidated)
Transaction-layer **data integrity** (divergence/rollback) and reporting **formula consistency** are the two highest-impact risks; both are correctness risks, not scale risks. Secondary risks: vertical-module divergence, shared-service bottlenecks, permission/role sprawl, and external-integration fragility (format churn, security). AI readiness is a data-quality risk if pursued before master/transaction data is clean.

*End of Research Task 3.1 — stopping here. High-level product architecture only; no code, schema, UI, or implementation. (~980 words.)*
