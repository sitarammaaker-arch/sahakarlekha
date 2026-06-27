# 02 — Knowledge Architecture

> The complete information hierarchy for SahakarLekha. Everything below is **expandable**:
> each leaf is a cluster in [03-topic-registry.md](03-topic-registry.md), each cluster a set of
> assets, each asset a node in the [knowledge graph](06-knowledge-graph.md).

---

## A. Architectural model

We separate three planes so they never collide:

1. **Topic plane** — *what the knowledge is about* (the 16 pillars below). Stable, expandable.
2. **Surface plane** — *where it renders* (the existing routes). Reuse, don't duplicate.
3. **Resource plane** — *what form it takes* (article, template, calculator, register, checklist).

> A single concept (e.g. *Depreciation*) appears once in the topic plane, but may render as a
> guide chapter **and** a blog article **and** a help task **and** a calculator **and** an app
> module — each with a **canonical** owner (see [07-seo-engine.md](07-seo-engine.md) §Canonical Rules).

### Surface plane — existing routes (REUSE THESE)

| Surface | Route | Role in SCOS | Canonical for |
| --- | --- | --- | --- |
| Guide | `/guide`, `/guide/:slug` (47 chapters) | Deep, structured *learning* | Concept explainers, foundations |
| Blog | `/blog`, `/blog/:slug` | Timely + SEO + seasonal drip | News, seasonal, opinion, long-tail |
| Help Center | `/help`, `/help/:slug` | *"How do I X in the app"* tasks | Product how-tos |
| Cookbook | `/cookbook`, `/cookbook/:slug` | *"Which voucher / recipe for Y"* | Transaction recipes |
| FAQ | `/faq` | Short answers | Quick-answer snippets |
| Site Search | `/search` | Retrieval across all surfaces | — |
| Ask Assistant | `/ask` | AI Q&A over the knowledge graph | — |
| Software landing | `/software`, `/software/:type` | Commercial / category | Society-type buying intent |
| State landing | `/cooperative-software/:state` | Programmatic geo-SEO | State buying intent |
| App modules | ~95 protected routes | *Do the work* | Action endpoints |

### Resource plane — forms a node can take

Article · Pillar page · Glossary entry · FAQ · How-to (help) · Recipe (cookbook) · Template (Excel/Word/PDF) · Register · Voucher format · Resolution/Notice · Checklist · Calculator · Case study · Quiz · Video · Schema/JSON-LD.

---

## B. The 16 Topic Pillars (top of the hierarchy)

```
Cooperative  →  Accounting  →  Audit  →  Taxation  →  Compliance  →  Management
   →  Governance  →  Technology  →  Digital Transformation  →  AI
   →  Templates  →  Tools  →  Downloads  →  Case Studies  →  Training  →  Help Center
```

Each pillar expands below. (Leaf nodes become clusters in [03](03-topic-registry.md).)

### P1 · Cooperative (Sector & Foundations)
- What is a cooperative; principles & values; history; cooperative vs company/firm
- **Society types** → PACS, MPACS, Credit, Consumer, Marketing, Dairy, Housing, Labour, Processing, Weavers, Fisheries, Apex/Federations
- Lifecycle: registration → operation → audit → AGM → dissolution
- Regulators & ecosystem: RCS, Ministry of Cooperation, NABARD, NCDC, NCUI, state federations

### P2 · Accounting
- Foundations: double-entry, golden rules, books of account
- Masters: Chart of Accounts, ledger heads, opening balances
- Vouchers & transactions (all types)
- Sub-ledgers: members, loans, deposits, suppliers, customers
- Inventory & procurement (MSP, kachi aarat, stock valuation)
- Final accounts: Trial Balance, Trading, P&L / Income & Expenditure, Receipts & Payments, Balance Sheet
- Assets & depreciation; reserves & funds; profit distribution; budgeting; ratios

### P3 · Audit
- Statutory / cooperative audit; internal; concurrent; cost; special audit
- Audit classification/grading; audit memo & rectification; audit schedules & certificates
- Auditor's checklist; audit trail & maker-checker

### P4 · Taxation
- GST for cooperatives (registration, ITC, returns, HSN, e-way bill, RCM)
- TDS / TCS, 26Q/24Q, Form 16A, advance tax
- Income tax for societies (80P deduction, exemptions, ITR) `⚠️ NEV`
- Professional tax, stamp duty, cess (state-specific) `⚠️ NEV`

### P5 · Compliance
- Statutory returns to Registrar/RCS; annual return; audit filing
- NABARD returns; federation/apex reporting; RBI (for cooperative banks) `⚠️ NEV`
- Member/share filings; byelaw amendments; statutory registers
- Deadlines calendar; penalties

### P6 · Management
- Financial management; budgeting; cash-flow; recovery & NPA management
- Working capital; deposit mobilization; pricing & margins
- MIS & dashboards; KPIs; multi-society consolidation

### P7 · Governance
- Board of directors; committees; meetings (AGM, SGM, board) & minutes
- Elections; byelaws; member rights & grievance; nomination
- Roles & delegation; conflict of interest; transparency

### P8 · Technology
- Accounting software fundamentals; cloud vs desktop; data model
- Security, roles, backup/restore, import/migration, integrations
- Mobile, offline, multi-user, multi-branch

### P9 · Digital Transformation
- Rajasthan/Pan-India PACS computerization; going paperless
- Change management; staff training; from register to cloud
- Member self-service; digital payments; e-governance linkages

### P10 · AI
- AI in cooperative accounting; auto-categorization; anomaly/fraud detection
- AI assistant (`/ask`); document/voucher OCR; forecasting & recovery scoring
- Responsible AI, data privacy `⚠️ NEV` for any compliance claims

### P11 · Templates (resource pillar → [09](09-template-library.md))
Excel · Word · PDF · Voucher formats · Registers · Ledgers · Resolutions · Notices · Audit/Compliance checklists.

### P12 · Tools (resource pillar → [10](10-calculators.md))
Calculators (depreciation, interest, EMI, dividend, NPA, GST, TDS, ratios, etc.).

### P13 · Downloads
Aggregated download hub indexing P11 + P12 + sample reports + chart-of-accounts packs.

### P14 · Case Studies
Full-year worked examples per society type; problem→fix stories; migration stories; before/after.

### P15 · Training
Structured courses, the existing **Guide + Quizzes + Certificate** (`/guide/quiz/:partId`, `/guide/certificate`, `/guide/verify`), role-based learning paths, webinars.

### P16 · Help Center
Task how-tos (`/help`), recipes (`/cookbook`), FAQ, troubleshooting, onboarding.

---

## C. Module Index (Product ↔ Knowledge map)

Every knowledge area has a **live module** to act on. This is the content→product conversion backbone.

| Knowledge area | App module(s) / route |
| --- | --- |
| Books & vouchers | `/vouchers`, `/compound-voucher`, `/day-book`, `/cash-book`, `/bank-book`, `/voucher-approval` |
| Masters | `/ledger-heads`, `/society-setup`, `/opening-balances`, `/chart-of-accounts` (guide) |
| Ledgers & reports | `/ledger`, `/trial-balance`, `/reports` |
| Final accounts | `/trading-account`, `/profit-loss`, `/receipts-payments`, `/balance-sheet` |
| Members & shares | `/members`, `/member-application`, `/share-register`, `/nomination-register`, `/form1-member-list` |
| Loans & recovery | `/loan-register`, `/loan-interest`, `/kcc-loan`, `/recoverables`, `/aging-analysis` |
| Inventory & procurement | `/inventory`, `/stock-valuation`, `/closing-stock-report`, `/hsn-master`, `/kachi-aarat` |
| Sales & purchase | `/sales`, `/sale-register`, `/purchases`, `/purchase-register`, `/receive-payment`, `/make-payment`, `/bills-outstanding`, `/customers`, `/suppliers` |
| Tax | `/gst-summary`, `/tds-register`, `/tds-form16a`, `/eway-bill` |
| Payroll | `/salary` |
| Assets | `/asset-register`, `/depreciation-schedule` |
| Audit | `/audit-register`, `/audit-schedules`, `/audit-certificate` |
| Governance | `/meeting-register`, `/election-module`, `/board-of-directors` |
| Profit & funds | `/reserve-fund`, `/profit-distribution`, `/budget-module` |
| Banking | `/bank-reconciliation` |
| Regulator reports | `/nabard-report`, `/federation-report` |
| Multi-society | `/multi-society-consolidation` |
| Data & users | `/backup-restore`, `/universal-importer`, `/user-management` |

> **Rule:** every cluster in [03](03-topic-registry.md) lists its mapped module in the "Possible Tools"
> column. If a knowledge area has **no** module, that's a **product-gap signal** for the PM (feed to roadmap).

---

### Cross-references
[Topic Registry](03-topic-registry.md) · [Knowledge Graph](06-knowledge-graph.md) · [SEO Engine](07-seo-engine.md) · [Template Library](09-template-library.md) · [Calculators](10-calculators.md)
