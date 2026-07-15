# SahakarLekha Research Task 3.8 — Reporting, Dashboard & Decision-Intelligence Architecture

**Scope:** Reporting/BI architecture only. No code, SQL, UI, or new research. Based on prior findings. **Types:** All = all eight · Trading = PACS/Marketing/Consumer/Dairy/Industrial · Credit = PACS/credit-thrift/MSCS-credit/coop-banks.

**BI architecture principle:** all reports/dashboards read from a **single shared computation layer** (one canonical formula per aggregate — no report-vs-source drift); OLTP/OLAP separation for heavy reports; every report is **role- and branch-scoped**; drill-down from KPI → transaction; statutory reports follow prescribed per-type formats (NABARD CAS for PACS).

## PART 1 & 2 — Report categories (18)

| Category | Purpose | Primary users | Frequency | M/O | Key KPIs | Types |
|---|---|---|---|---|---|---|
| **Financial** | Position & performance | Board, Manager, Secretary | Monthly/Annual | Mandatory | Surplus/deficit, net worth, liquidity | All |
| **Accounting** | Ledgers, trial balance, day book | Accountant, Auditor | Daily/Monthly | Mandatory | TB tally, ledger balances | All |
| **Statutory** | R&P, P&L/Trading, Balance Sheet, DCB | Registrar, Board, Auditor | Annual | Mandatory | Format compliance | All |
| **Audit** | Findings, objections, rectification | Auditor, Board, Registrar | Annual | Mandatory | Audit class A/B/C/D, objection count | All |
| **Tax** | GST/TDS/IT computations & returns | Accountant | Monthly/Quarterly/Annual | Mandatory | Tax liability, ITC, TDS | All (applicable) |
| **Procurement** | Purchases/procurement/agency | Procurement, Manager | Weekly/Monthly | Optional | Volume, cost, pending, agency balance | Trading/Marketing/PACS |
| **Inventory** | Stock status, valuation, movement | Store Keeper, Manager | Daily/Monthly | Optional (High) | Stock value, shortages, dead stock, reorder | Trading |
| **Sales** | Sales analysis | Sales, Manager | Daily/Monthly | Optional | Sales value, margin, debtors | Trading |
| **Purchase** | Purchase analysis | Procurement, Accountant | Monthly | Optional | Purchase value, GST input, creditors | Trading |
| **Payroll** | Salary & statutory | HR, Accountant | Monthly | Mandatory (staff) | Payroll cost, PF/ESI/TDS | All w/ staff |
| **Asset** | Asset register, depreciation | Accountant | Annual | Optional | Asset value, depreciation, WDV | All |
| **Member** | Member register & status | Secretary, Board | Monthly/Annual | Mandatory | Member count, active/inactive, new/exit | All |
| **Share Capital** | Shareholding & dividend | Secretary, Board | Annual | Mandatory | Share capital, dividend, transfers | All |
| **Loan** | Portfolio, DCB, NPA | Loan officer, Board, Auditor | Monthly/Quarterly | Mandatory (Credit) | Outstanding, overdue, NPA%, recovery% | Credit |
| **Investment** | Investment portfolio | Accountant, Board | Quarterly/Annual | Optional | Value, yield, maturity | All (Credit/Housing) |
| **Compliance** | Statutory-compliance status | Secretary, Compliance | Monthly | Mandatory | Filings done/pending, penalties | All |
| **Board** | Governance MIS | Board, Chairman | Monthly/Quarterly | Optional (High) | Financial summary, approvals, exceptions | All |
| **AGM** | Annual report & accounts | Members, Board, Registrar | Annual | Mandatory | Audited accounts, surplus, dividend | All |

## PART 3 — Dashboards (7)

| Dashboard | Primary users | Key metrics | Alerts | Decisions supported |
|---|---|---|---|---|
| **Chairman** | Chairman, Board | Surplus, net worth, member growth, loan/NPA, compliance status | FY-closing, audit-due, NPA spike, major exceptions | Strategy, dividend, governance |
| **Manager** | Manager, Secretary | Daily cash, collections, pending approvals, stock, sales/procurement | Pending approvals, low cash, stock shortage, overdue | Operations, approvals |
| **Accountant** | Accountant | Trial balance, cash/bank, reconciliation status, tax due | Unreconciled, tax/TDS/GST due, negative cash | Closing, remittance, reconciliation |
| **Auditor** | Auditor, Internal Auditor | Objections, high-risk txns, NPA, reconciliation, exceptions | Abnormal txns, unrectified objections, missing vouchers | Audit focus, risk assessment |
| **Procurement** | Procurement, Manager | Procurement volume, pending PO/GRN, supplier dues, agency reconciliation | Pending approvals, agency mismatch, price variance | Purchasing, supplier decisions |
| **Inventory** | Store Keeper, Manager | Stock value, reorder, dead stock, shortages, expiry | Shortage, excess, expiry, reorder | Replenishment, write-off |
| **Compliance** | Secretary, Compliance | Filing status, upcoming deadlines, audit status, penalties | Tax/return due, audit due, AGM due, FY closing | Compliance action, prioritisation |

## PART 4 — Decision intelligence (business alerts)

| Alert | Trigger | Severity | Responsible role | Recommended action |
|---|---|---|---|---|
| **Negative Cash Balance** | Cash balance < 0 | Critical | Cashier/Accountant | Investigate & correct entry immediately |
| **Overdue Receivables** | Dues past due date | High | Secretary/Loan officer | Recovery follow-up |
| **Pending Approvals** | Item pending > SLA | Medium | Approver | Approve/reject |
| **Stock Shortage** | Stock < reorder level | High | Store Keeper | Raise reorder |
| **Excess Inventory** | Stock > max / ageing | Medium | Manager | Review/liquidate |
| **Tax Due** | Tax deadline near | High | Accountant | Pay/file |
| **TDS Due** | 7th of month approaching | High | Accountant | Deposit TDS |
| **GST Due** | Return deadline near | High | Accountant | File GST return |
| **Audit Due** | 6-month deadline approaching | High | Secretary | Arrange statutory audit |
| **FY Closing Due** | FY-end approaching | High | Secretary/Accountant | Run closing activities |
| **Budget Variance** | Actual vs budget > threshold | Medium | Manager | Review & correct |
| **Abnormal Transactions** | Outlier vs pattern | High | Auditor/Manager | Investigate |
| **Duplicate Payments** | Same payee/amount/date | Critical | Accountant | Verify & reverse |
| **Inactive Members** | No activity > period | Low | Secretary | Review/reactivate |
| **Loan Overdue / NPA** | Overdue > threshold | Critical | Loan officer | Recovery + NPA classification |

**Alert governance:** severity drives channel & escalation (Critical → immediate + escalation; High → dashboard + notification; Medium/Low → dashboard). Alerts are **role-scoped** (routed to the responsible role) and logged; the highest-priority cluster (negative cash, duplicate payments, NPA) maps directly to the data-integrity and credit-defect risks identified in prior research.

*End of Task 3.8 — stopping here. Reporting/BI architecture only; no code, SQL, or UI. (~780 words.)*
