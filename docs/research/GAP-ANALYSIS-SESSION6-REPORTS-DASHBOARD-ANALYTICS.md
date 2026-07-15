# SahakarLekha Gap Analysis — Session 6 (Reports, Dashboard & Analytics)

**Nature:** Audit only. No code written, no files modified. Scope strictly **Reports + Dashboard + Analytics** (~40 report/statement/register pages; `DataContext` report getters; `pages/Dashboard.tsx` + `components/dashboard/*`; recharts usage; `lib/analytics.ts`). Measured against Blueprint 3.8 (Reporting/BI/Decision-Intelligence) and CLAUDE.md RULES 2 & 5. **Prepared:** 2026-07-08.

---

## 1. Current Architecture

**Reports (broad + formula-consistent).** ~40 pages: statutory statements (`TrialBalance`, `ProfitLoss`, `TradingAccount`, `BalanceSheet`, `ReceiptsPayments`, `DayBook`, `CashBook`, `BankBook`), full register set (Form1/Member, Share, Nomination, Loan, Audit, Meeting, Transfer, Recoverables, KachiAarat, Advance, Wage, Worker ledger), tax (`GstSummary`, `TdsRegister`, `TdsForm16A`), and specials (`NabardReport`, `FederationReport`, `FundStatement`, `AgingAnalysis`, `StockValuation`, `ClosingStockReport`, `MultiSocietyConsolidation`). A `Reports` hub navigates them. **All statutory statements read from the shared getters** (`getTrialBalance/getProfitLoss/getTradingAccount/getReceiptsPayments`) over `activeVouchers` (RULE 2 + RULE 5) with `asOnDate` scoping. **32 pages export PDF/Excel** (jsPDF/html2canvas/xlsx). Prior-year comparison exists on `ProfitLoss` and `BalanceSheet` — sourced from **manually-stored `society.previousYearIE/previousYearBalances` snapshots**.

**Dashboard (single, rich).** One `Dashboard.tsx` computes KPIs + cooperative-specific compliance: Reserve Fund posted (Sec 65), Balance-Sheet tally, closing stock, **Sec 32 loan-limit** (10× (share capital + reserves)), FY-lock, overdue loans, pending audit objections. It derives a **Financial Health Score (0–100)** (weighted across those checks) and a set of **severity-tagged bilingual Smart Advisories** (critical/warning/info: BS imbalance, Sec 32 breach, overdue loans, pending objections, FY-lock reminder, dividend suggestion). Charts via recharts (monthly income/expense, category pie); sub-components `StatCard/QuickActions/RecentVouchers/TodayTransactions`.

**Analytics (thin).** recharts appears in only **two** app surfaces (Dashboard, WorkOrderProfit) + SuperAdminDashboard. `lib/analytics.ts` is **GA page-tracking**, not business analytics. There is no dedicated analytics/BI module, no computed trend/YoY, no drill-down, no OLAP layer.

**Verdict:** report **breadth and formula-consistency are strong**; the Dashboard's health-score + advisories are a genuine cooperative-specific decision-intelligence asset. The gaps are the **role/scale/immutability** dimensions of Blueprint 3.8: one dashboard (not seven), an advisory list (not a routed alert engine), no BI/analytics layer, no OLTP/OLAP separation, and reports that recompute live from mutable data.

---

## 2. Business Rule Issues

| # | Issue | Detail |
|---|---|---|
| BR-1 | **Reports are not role-scoped** | No `hasPermission` in report pages — any authenticated role (incl. viewer) can view **and export** full financials. Gated only by society-type capability, not by role (confirms Session-1 authorization + export-gating gaps). |
| BR-2 | **Prior-year comparison is manual** | `ProfitLoss`/`BalanceSheet` compare against `society.previousYearIE/previousYearBalances` **snapshots the admin must maintain** — not computed from prior-FY vouchers; can be stale/absent/wrong. |
| BR-3 | **Reports reflect unapproved vouchers** | Because posting is pre-approval (Session 2 BR-1), a statutory report can include entries that have not been approved. |
| BR-4 | **Reports recompute live from mutable data** | With only FY-lock (no period lock), a report printed today can differ tomorrow if a back-dated entry lands in the open FY; there is no "as-generated" snapshot. |
| BR-5 | **Decision-intelligence lives on one dashboard** | Health score + advisories are computed once, role-agnostically; they are not routed to responsible roles or escalated. |

---

## 3. Missing Features (vs Blueprint 3.8)

| # | Missing | Priority |
|---|---|---|
| MF-1 | **Role dashboards** (Chairman/Manager/Accountant/Auditor/Procurement/Inventory/Compliance) — only one generic dashboard exists | P1 |
| MF-2 | **Decision-intelligence alert engine** — the 15 routed alerts (negative cash, duplicate payment, stock shortage, tax/TDS/GST due, NPA, budget variance…) with severity→channel→escalation; today only static dashboard advisories | P1 |
| MF-3 | **Computed prior-year / period comparison & trends** (replace manual snapshots; YoY, multi-period) | P1 |
| MF-4 | **Report-generation audit + immutable "as-filed" snapshots** (reproduce a filed report byte-for-byte) | P1 |
| MF-5 | **Export permission gating + export log** (who exported which financials) | P1 |
| MF-6 | **Dedicated analytics/BI module** (drill-down, dimensional, cross-period, cross-branch) | P2 |
| MF-7 | **OLTP/OLAP separation** (reports compute client-side on every render — scale ceiling) | P2 |
| MF-8 | **Scheduled / emailed reports** | P2 |
| MF-9 | **Custom/configurable report builder** | P3 |

---

## 4. Compliance Gaps

| # | Gap | Standard |
|---|---|---|
| CG-1 | Reports can include **unapproved** entries | Maker-checker / report on approved data |
| CG-2 | Comparative statements rely on manual prior-year figures | Statutory comparative disclosure |
| CG-3 | No immutable snapshot of a **filed** statutory report | Audit reproducibility / Registrar filings |
| CG-4 | Financials viewable/exportable by any role | Access-control over statutory data |

**Not gaps (strong):** RULE-2 formula consistency across all statutory statements; broad statutory report/register set (Form I, NABARD, Federation, R&P, TB, P&L, Trading, Balance Sheet); Sec 32/Sec 65 cooperative compliance checks; wide PDF/Excel export; bilingual advisories.

---

## 5. Audit Gaps

| # | Gap | Detail |
|---|---|---|
| AG-1 | **No report-generation/export audit trail** | No record of who generated or exported which report when — a data-governance and statutory-filing gap. |
| AG-2 | **No reproducible "as-filed" report** | Reports recompute from current data; a report filed earlier cannot be regenerated identically after later edits (open FY). |
| AG-3 | **Health-score/advisory logic unlogged** | Compliance advisories are computed client-side and not persisted for audit. |
| AG-4 | **Prior-year snapshot provenance unclear** | Manually-stored `previousYear*` values have no audit trail of who set them. |

---

## 6. Performance / Scalability Notes
Every statutory report and the Dashboard compute **client-side from the full `activeVouchers` set on each render** (`useMemo`, `forEach` over all vouchers/lines). Correct and consistent, but a **client CPU/memory ceiling** for large/long-lived societies; there is no server-side aggregation or OLAP/read-replica layer (Blueprint 3.8 OLTP/OLAP split). This is the primary scale risk in the reporting layer.

---

## 7. Gap Register

| Gap ID | Area | Current situation | Expected (Blueprint 3.8) | Business impact | Priority | Complexity | Dependencies |
|---|---|---|---|---|---|---|---|
| RD-01 | Dashboard | Single role-agnostic dashboard | 7 role dashboards | Weak role decision-support | **P1** | L | Roles (Session 1) |
| RD-02 | Analytics | Static advisories only | Routed decision-intelligence alert engine (15 alerts) | Risks not surfaced to owners | **P1** | L | Notifications, roles |
| RD-03 | Reports | Not role-scoped; export ungated | Role-scoped view/export + export log | Financial data exfil risk | **P1** | M | RBAC |
| RD-04 | Reports | Manual prior-year snapshots | Computed multi-period comparison/trends | Comparative reliability | **P1** | M | Report engine |
| RD-05 | Reports | Reflect unapproved entries; no snapshot | Approved-data reports + immutable as-filed snapshot | Statutory reproducibility | **P1** | L | Approval gate, period lock |
| RD-06 | Audit | No report-gen/export trail | Generation/export audit log | Governance/non-repudiation | **P1** | M | Audit log |
| RD-07 | Analytics | No BI module | Drill-down/dimensional analytics | Limited insight | **P2** | L | OLAP |
| RD-08 | Scale | Client-side compute on every render | OLTP/OLAP separation / server aggregation | Perf ceiling at scale | **P2** | XL | Backend |
| RD-09 | Reports | No scheduled/emailed reports | Scheduling + delivery | Manual effort | **P2** | M | Notifications |
| RD-10 | Reports | No custom report builder | Configurable reports | Flexibility | **P3** | L | Report engine |

---

## Summary
The reporting layer is a **strength** — comprehensive statutory coverage, RULE-2 formula consistency, broad PDF/Excel export, and a cooperative-specific health-score/advisory engine (Sec 32/65) that is real decision-intelligence. The gaps are the **role, scale, and immutability** dimensions of Blueprint 3.8: **(RD-01)** one dashboard instead of seven, **(RD-02)** static advisories instead of a routed alert engine, **(RD-03)** financials viewable/exportable by any role with no export log, and **(RD-05/06)** no approved-data/immutable "as-filed" snapshots or report-generation audit. The client-side compute model (RD-08) is the main scale ceiling. No P0s — the correctness of the numbers is sound; the gaps are governance, role-fit, and scale.

*End of Gap Analysis Session 6 — audit only; no code, no changes. STOP.*
