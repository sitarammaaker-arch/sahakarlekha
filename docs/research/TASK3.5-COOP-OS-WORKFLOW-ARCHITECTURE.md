# SahakarLekha Research Task 3.5 — Workflow & Approval Architecture

**Scope:** Workflow/approval architecture only. No code, schema, UI, or new research. Based on prior findings.

**Uniform patterns (stated once — apply to every workflow below):**
- **Exception handling:** blocked entries route to the next-higher authority; **FY-lock blocks all mutation**; validation failures return to creator.
- **Rejection:** approver rejects **with mandatory reason** → returns to creator as *Draft* → logged.
- **Cancellation:** pre-approval by creator; post-approval by Manager/Secretary **with reason** → **soft-cancel + cascade reversal** (financial records never hard-deleted).
- **Reopening:** only via **Unlock (dual-control)** if period/FY locked; otherwise edit while *Draft*.
- **Audit trail:** **required on every workflow** — create/verify/approve/reject/cancel/reopen with actor, time, before/after.

## PART 1 & 2 — Business workflows (21)

| Workflow | Trigger | Start → End condition | Owner | Depts | Key documents | Approval levels |
|---|---|---|---|---|---|---|
| **Member Registration** | Application | Form+fee submitted → member no. allotted, registers updated | Secretary | Membership | Application, KYC, fee receipt | Committee |
| **Share Capital** | Share app/transfer/refund | Request → certificate/register updated | Secretary | Membership/Accounts | Share form, certificate | Committee |
| **Receipt** | Money received | Tender → posted & deposited | Cashier | Cash | Receipt | Cashier + Accountant verify |
| **Payment** | Payable due | Bill → paid & posted | Accountant | Accounts | Bill, sanction, voucher | Manager/Secretary by amount |
| **Journal Voucher** | Adjustment need | JV drafted → approved & posted | Accountant | Accounts | Supporting docs | Accountant + Manager verify |
| **Contra Voucher** | Cash–bank transfer | Transfer initiated → posted | Cashier | Cash/Bank | Deposit/withdrawal slip | Accountant verify |
| **Purchase** | Indent/reorder | Indent → GRN + purchase posted | Procurement | Store/Accounts | Indent, quotes, PO, GRN, invoice | Manager/Committee by limit |
| **Sales** | Customer order | Order → invoice + collection | Sales | Sales/Store | Order, invoice | Counter (auto)/Manager for credit |
| **Procurement (MSP/pool)** | Season/agency mandate | Produce received → farmer paid + dispatched | Procurement | Procurement/Accounts | Procurement slip, quality data | Committee / agency terms |
| **Inventory Issue** | Issue request | Request → stock reduced | Store Keeper | Store | Issue slip | Store Keeper + Manager |
| **Inventory Receipt** | Goods in | GRN → stock added | Store Keeper | Store | GRN | Store Keeper verify |
| **Stock Transfer** | Inter-godown/branch need | Transfer note → received & posted | Store Keeper | Store | Transfer note | Manager |
| **Asset Purchase** | Asset need | Proposal → capitalized & tagged | Accountant | Accounts/Committee | Proposal, quotes, invoice | Committee (capex) |
| **Asset Disposal** | Obsolescence | Disposal proposal → removed + gain/loss booked | Accountant | Committee | Disposal note, approval | Committee/General body |
| **Loan Processing** | Loan application | Application → disbursed + registers | Loan officer | Loans/Committee | Application, KYC, security, bond | Loan committee by amount |
| **Deposit Processing** | Deposit request | Request → deposit created/interest set | Accountant | Deposits | Deposit form, KYC | Accountant + Manager |
| **Payroll** | Month-end | Attendance compiled → paid + dues remitted | Accountant/HR | HR/Accounts | Attendance, salary register | Manager/Secretary |
| **Budget Approval** | Budget cycle | Draft budget → approved | Accountant | Accounts/Committee | Budget draft | Committee/General body |
| **Audit Observation** | Audit | Observation raised → rectified & reported | Auditor | Audit/Accounts | Audit note | Committee accepts; Secretary rectifies |
| **Compliance Activity** | Due date | Obligation due → filed/remitted | Accountant | Accounts/Compliance | Return, challan | Manager/Secretary |
| **Financial Year Closing** | FY-end | Books closed → FY locked post-AGM | Secretary | Accounts/Committee | Final accounts, audit report | Board + AGM |

## PART 3 — Approval matrix
**Common rules:** *Rejects* = the approver at that level · *Cancels* = Manager/Secretary (post-approval, with reason) · *Reopens* = Society Admin + Chairman (dual-control) · *Views* = role/branch-scoped + Board + Auditor. Table shows the varying **Create / Verify / Approve** chain.

| Transaction | Creates | Verifies | Approves |
|---|---|---|---|
| Member Registration | Secretary | Secretary | Committee |
| Share Capital | Secretary | Accountant | Committee |
| Receipt | Cashier | Accountant | Accountant (auto ≤ limit) |
| Payment | Accountant | Manager | Manager/Secretary (by amount) |
| Journal Voucher | Accountant | Manager | Secretary |
| Contra Voucher | Cashier | Accountant | Accountant |
| Purchase | Procurement | Store Keeper | Manager/Committee (by limit) |
| Sales | Sales Operator | Accountant | Manager (credit) / auto (cash) |
| Procurement (MSP) | Procurement | Accountant | Committee |
| Inventory Issue/Receipt | Store Keeper | Store Keeper | Manager |
| Stock Transfer | Store Keeper | Manager | Manager |
| Asset Purchase | Accountant | Manager | Committee |
| Asset Disposal | Accountant | Committee | General body |
| Loan Processing | Loan officer | Manager | Loan committee/Committee |
| Deposit Processing | Accountant | Manager | Manager |
| Payroll | Accountant/HR | Manager | Secretary |
| Budget Approval | Accountant | Manager | Committee/General body |
| Audit Observation | Auditor | Secretary | Committee |
| Compliance Activity | Accountant | Manager | Secretary |
| Financial Year Closing | Secretary | Auditor | Board + AGM |

## PART 4 — Workflow states
**Draft → Pending → Verified → Approved → Posted/Completed → Locked → Archived**, with side-states **Rejected** (→ back to Draft) and **Cancelled** (→ reversed). Transitions: only forward on approval; *Rejected/Cancelled* require reason; *Locked* on period/FY close (reversible only via dual-control Unlock); *Archived* after retention cut-off (read-only, ≥10 yrs).

## PART 5 — Notification events
Approval Pending · Approval Completed · Verified · Rejected (with reason) · Cancelled · Payment/Receipt posted · Document Expiring (KYC/licence) · Compliance Due (GST/TDS/PF/ESI/PT) · Return Filed · Audit Due / Observation Raised · Rectification Pending · Loan Overdue / NPA Flag · Deposit Maturity · Dividend Declared · Member Dues · AGM Due · **Financial Year Closing / Locked** · Backup Completed · Unlock Requested (dual-control alert).

---

# Top 50 highest-impact design decisions (finalize before development)

**A. Data integrity & correctness (highest priority)**
1. Rollback rule: optimistic local update **must** revert on cloud-save failure (no silent divergence).
2. Two-step persist (base columns first, extras second) as the standard save contract.
3. Single canonical formula per aggregate (stock, closing balance) shared by state, report, aggregator.
4. Financial records are **soft-delete only**; hard-delete forbidden platform-wide.
5. Cascade rules on parent delete/edit (voucher, entries, inventory, sub-ledger) defined per entity.
6. `isDeleted` filtering enforced in every financial computation and report.
7. FY-lock guard on every state-changing function.
8. Opening balance = prior-year **audited** closing; enforced, not manual.

**B. Multi-tenancy & scope**
9. Tenant (society) + branch + state scoping baked into every entity from day one.
10. Society-type as a first-class configuration axis (drives module enablement).
11. Multi-state (MSCS) consolidation & inter-branch account model.
12. Per-state configuration of reserve %, dividend cap, forms, thresholds (config, not code).

**C. Accounting core**
13. Chart-of-accounts coding standard & per-category sales/purchase routing (4101/5101…).
14. Accrual vs cash basis policy (NABARD CAS = accrual for PACS).
15. Appropriation order engine (reserve ≥25% → education → funds → dividend).
16. NPA classification & provisioning rules (NABARD/RBI) as configurable policy.
17. DCB (demand-collection-balance) model for credit types.
18. Fund accounting with backing-investment linkage (sinking/repair/education).
19. Voucher-type taxonomy (receipt/payment/journal/contra + trading notes).
20. Control-account ↔ subsidiary-ledger reconciliation invariant.

**D. Type-specific verticals**
21. Dairy Fat/SNF two-axis pricing engine + collection/fat-test records.
22. Housing sinking (≥0.25%)/repair (~0.75%) fund & ₹25,000 transfer-premium cap.
23. Marketing pool-accounting & agency/NAFED settlement model.
24. Labour muster-roll/wage engine & contract billing linkage.
25. Consumer POS/retail + patronage-rebate handling.
26. Industrial raw-material→production→finished-goods costing.
27. Which verticals ship first (scope/sequencing).

**E. Compliance & tax**
28. Statutory-report format set (R&P, P&L/Trading, Balance Sheet, DCB) per type.
29. Tax-engine config for GST/TDS/PT with annual-change tolerance.
30. Income-tax regime handling (s.80P vs 115BAD) — data capture, not advice.
31. Compliance-calendar engine (monthly/quarterly/half-yearly/annual).
32. Record-retention policy (≥10 yrs) & archival lifecycle.
33. Statutory register generation (Form I/J and equivalents, state-variant).
34. A/B/C/D audit-classification data capture.

**F. Security & access**
35. RBAC model: 17 roles × 14 permission categories, tenant/branch-scoped.
36. Segregation of duties (entry ≠ approval ≠ audit ≠ config) enforced.
37. Sensitive-permission governance (delete/unlock/FY-close/user/backup/config).
38. Dual-control for Unlock & FY-close; auditor/CA read-only + time-boxed.
39. Platform-admin (JWT-less) data access via SECURITY-DEFINER-style controlled RPCs.
40. Immutable audit-trail scope & storage (WORM/append-only).

**G. Workflow & approvals**
41. Approval-matrix engine (amount + type + role) — configurable per society.
42. Uniform state machine (Draft→…→Locked→Archived) with reason-gated transitions.
43. Rejection/cancellation/reopening standard contract.
44. Maker-checker for electronic payments & high-risk transactions.

**H. Integration & platform**
45. Bank / NABARD-NLDR / GST-TDS / payment-gateway / KYC integration boundaries & versioned adapters.
46. Offline-tolerance strategy (data-integrity-safe sync) — the market gap.
47. Notification channel/provider abstraction (SMS/email/app) & event catalog.
48. Document-management storage, indexing & retention linkage to audit.
49. Reporting: OLTP/OLAP separation & formula-consistency guarantee.
50. AI-readiness data foundation (clean master/transaction data + event stream) — deferred, not built.

*End of Task 3.5 — stopping here. Workflow/approval architecture + pre-development decision list only; no code, schema, or UI.*
