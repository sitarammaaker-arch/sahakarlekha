# SahakarLekha Research Task 3.3 — RBAC / Access-Control Architecture

**Scope:** Access-control architecture only. No code, no schema, no UI, no new research. Based on prior findings (segregation of duties, financial authorization matrix, FY-lock, maker-checker, soft-delete of financial records, audit trail). **Types:** All = all eight · Trading = PACS/Marketing/Consumer/Dairy/Industrial · Credit = PACS/credit-thrift/MSCS-credit/coop-banks. **Scope model:** every role is bounded by **tenant (society) + branch + module** scope; Super Admin is the only cross-tenant role.

## Table 1 — Role definitions (17 roles)

| Role | Primary responsibilities | Modules accessible | Transactions allowed | Approval authority | Restrictions & sensitive perms | Audit requirement | Types |
|---|---|---|---|---|---|---|---|
| **Super Administrator** | Platform operation, tenant/user/config/backup | Platform admin (no society financials) | None (business) | None (business) | **No society financial approvals or FY-close**; cross-tenant = highly sensitive | Every action logged; privileged-access review | Platform |
| **Society Administrator** | Tenant-level admin & configuration | All (own society) | All (config) | Scoped (up to bye-law limit) | Cannot hard-delete financial records; unlock = dual-control | Full trail; periodic access review | All |
| **Manager** | Operational head of society business | Operational modules | Operational txns | Up to defined limit | No user/backup/config; no FY-close | Trail on approvals | All |
| **Accountant** | Book-keeping, statements, closing prep | Accounting, Cash & Bank, Reports | Vouchers, journals, reconciliation | None (prepares, not authorizes) | Delete = soft only; cannot close FY | Full entry-level trail | All |
| **Cashier** | Cash/bank receipts & payments | Cash & Bank | Receipts, payments (own) | None | No export; no period lock; cash-limit bound | Daily cash-verification trail | All |
| **Store Keeper** | Stock receipts/issues, godown | Inventory, Godown | Stock in/out/adjustment | None | Trading types only; no financial modules | Stock-movement trail | Trading |
| **Procurement Officer** | Indent, PO, GRN, supplier mgmt | Procurement | Indent/PO/GRN | Recommend only | No payment release; agency reconciliation flagged | Procurement trail | Trading |
| **Sales Operator** | Billing, POS, collection | Sales | Invoices, returns (own) | None | Cannot alter posted invoices; no export | Sales/cash trail | Trading |
| **Auditor (Statutory/External)** | Statutory audit, objections | All (read) + Audit | Audit notes/objections only | None | **Read-only** on data; no txn CRUD; time-boxed | Own actions logged; independence | All |
| **Internal Auditor** | Ongoing internal control check | All (read) + Audit | Internal audit notes | None | Read-only; no txn CRUD | Own actions logged | All (large/banks) |
| **Board Member** | Governance oversight, sanctions | Reports, Dashboard, minutes | Resolution-linked approvals | Board-level (collective) | No direct txn CRUD; no config | Approval/resolution trail | All |
| **Chairman / President** | Highest governance approver | Reports, Dashboard, approvals | Approve/reject | **Highest** authority | Co-authorizes FY-close, unlock; no direct data entry | Approval trail; dual-control | All |
| **Secretary** | Statutory executive & record-keeper | Most modules | Most txns; statutory records | Scoped (executes board decisions) | Executes FY-close after board; user-mgmt scoped | Full trail; statutory custodian | All |
| **Employee** | Assigned operational tasks | Assigned module(s) | Assigned txns (limited) | None | Least-privilege; own scope only | Task-level trail | All |
| **Data Entry Operator** | Bulk/data entry | Assigned data-entry modules | Create/edit own unposted | None | No delete/approve/export/admin | Entry trail | All |
| **Read Only User** | View/monitor | Reports, Dashboard (read) | None | None | View only; no export | Access log | All |
| **External CA / Consultant** | Return prep, advisory, audit support | Financials (read) + Reports | Notes/return-prep only | None | **Time-boxed** access; sensitive financial data; logged | Access strictly logged | All |

## Table 2 — Permission matrix (roles × 14 categories)
**Legend:** ✓ full · ◐ scoped (own module/branch, or with approval/dual-control) · ✗ none. **C**reate **R**ead **U**pdate **D**elete **Ap**prove **Rj**Reject **Ex**port **Pr**int **Lk**Lock-period **Un**Unlock-period **CFY**Close-FY **UM**User-mgmt **BK**Backup **Cfg**Config.

| Role | C | R | U | D | Ap | Rj | Ex | Pr | Lk | Un | CFY | UM | BK | Cfg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Super Administrator | ◐ | ✓ | ◐ | ◐ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Society Administrator | ✓ | ✓ | ✓ | ◐ | ◐ | ◐ | ✓ | ✓ | ◐ | ◐ | ✗ | ✓ | ◐ | ✓ |
| Manager | ✓ | ✓ | ✓ | ✗ | ◐ | ◐ | ✓ | ✓ | ◐ | ✗ | ✗ | ✗ | ✗ | ◐ |
| Accountant | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Cashier | ✓ | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Store Keeper | ✓ | ◐ | ✓ | ✗ | ✗ | ✗ | ◐ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Procurement Officer | ✓ | ◐ | ✓ | ✗ | ◐ | ✗ | ◐ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Sales Operator | ✓ | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Auditor (Statutory) | ◐ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Internal Auditor | ◐ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Board Member | ✗ | ✓ | ✗ | ✗ | ◐ | ◐ | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Chairman / President | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | ◐ | ✗ | ✗ | ✗ |
| Secretary | ✓ | ✓ | ✓ | ◐ | ◐ | ◐ | ✓ | ✓ | ◐ | ✗ | ◐ | ◐ | ✗ | ◐ |
| Employee | ◐ | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Data Entry Operator | ✓ | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Read Only User | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| External CA / Consultant | ◐ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

## Governance rules for sensitive permissions
| Permission | Rule |
|---|---|
| **Delete** | Financial records are **never hard-deleted** — soft-delete + cascade only; no role gets hard-delete on financial data. |
| **Unlock Period** | **Dual-control** (Chairman/Secretary + Society Admin); every unlock logged with reason; highest-risk action. |
| **Close Financial Year** | Only after **board/AGM adoption**; executed by Secretary/Chairman; not available to Super Admin (governance, not platform, act). |
| **User Management** | Super Admin (platform-scope) and Society Admin (society-scope); Secretary scoped; separated from financial approval. |
| **Backup Access** | Super Admin (full); Society Admin (own-society export); logged. |
| **Configuration** | Platform config = Super Admin; society config (reserve %, forms, thresholds) = Society Admin; **config ≠ transaction rights** (segregation). |

**Cross-cutting principles:** least privilege; **segregation of duties** (entry ≠ approval ≠ audit ≠ config); auditor/CA roles are **read-only + time-boxed**; every privileged action (delete, unlock, FY-close, user/config/backup) is **logged to the immutable audit trail**; approval authority follows the society's **financial authorization matrix** (amount + type based).

*End of Task 3.3 — stopping here. Access-control architecture only; no code, schema, or UI. (~880 words.)*
