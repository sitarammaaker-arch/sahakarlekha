# SahakarLekha Transformation Program — Phase 5.1 Engineering Backlog

**Source:** The approved Consolidated Engineering Change Register (30 ECRs) + the nine gap-analysis sessions, treated as the product specification. No new research. **Prepared:** 2026-07-08.
**Fields per story:** Story ID · Title · Business Value · Acceptance Criteria · Dependencies · Priority (P0/P1/P2) · Complexity (XS/S/M/L/XL) · Sprint · Risk.
**Scope of Sprints 1–6:** the P0 correctness/control cluster + the highest-priority P1 integrity/compliance foundations. P2/P3 breadth (warehouse, procurement control, GST completeness, branch, OLTP/OLAP, search, AI) is enumerated as **Backlog › Sprint 6**.

---

## 1. Executive Summary
The audit found the correctness **core** sound (double-entry, RULE-1 rollback, canonical stock formula, isDeleted filtering, depreciation, GST/TDS prep, grounded AI). The transformation therefore targets **control and integrity edges**, not a rewrite. Six sprints deliver the six P0 changes and the foundational P1 layer, sequenced so the enabling substrate (audit log, guaranteed persistence, soft-delete) lands first, RBAC second, then posting-discipline, integrity core, year-end correctness, and finally the compliance/notification platform. **32 user stories** across **10 epics** are scheduled into Sprints 1–6; P2/P3 items (a further ~10 changes) follow. The critical path runs **Audit substrate → RBAC → Approval-gating/Workflow → Period-lock/Reversal/Share-ledger → Year-end → Compliance platform**.

## 2. Epic List
| Epic | Title | ECRs | Sprints |
|---|---|---|---|
| **EP-A** | Data Integrity & Audit Foundation | ECR-02, 03, 04, 28 | 1, 4 |
| **EP-B** | Access Control & Security | ECR-06, 12, 30 | 1–2 |
| **EP-C** | Posting Discipline & Workflow | ECR-01, 11, 07, 08 | 3–4 |
| **EP-D** | Year-End & Statutory Accounting | ECR-09, 10, 23, 27 | 5 (23/27 backlog) |
| **EP-E** | Compliance, Notifications & Calendar | ECR-13, 14, 22 | 6 (22 backlog) |
| **EP-F** | Member, Share & Asset Statutory | ECR-05, 16, 15 | 4–6 |
| **EP-G** | Multi-Branch & Scale | ECR-17, 24, 26 | Backlog |
| **EP-H** | Reporting & Dashboards | ECR-18, 19 | 5 |
| **EP-I** | Procurement, Inventory & Warehouse | ECR-20, 21 | Backlog |
| **EP-J** | AI, Search & Knowledge | ECR-25, 29 | Backlog |

## 3. Feature List
- **EP-A:** A1 Append-only audit log · A2 Reliable overlay persistence · A3 Soft-delete parents · A4 Ledger hygiene
- **EP-B:** B1 RBAC model (roles×permissions) · B2 Route authorization (deny-by-default) · B3 Segregation & export gating · B4 Authn hardening (MFA/session)
- **EP-C:** C1 Approval-gates-posting · C2 Workflow engine (state machine + matrix) · C3 Period lock & immutable snapshots · C4 Reversal-not-edit
- **EP-D:** D1 Opening-balance carry · D2 Appropriation & year-end close · (D3 CAS · D4 Fund accounting — backlog)
- **EP-E:** E1 Compliance calendar · E2 Notification centre & channels · E3 Routed alerts · E4 Payroll statutory engine
- **EP-F:** F1 Control=subsidiary (share ledger, asset↔ledger) · F2 Member/share lifecycle · F3 Asset disposal/acquisition
- **EP-H:** H1 Role dashboards · H2 Report governance

## 4. User Stories

### EP-A — Data Integrity & Audit Foundation
| ID | Title | Business value | Acceptance criteria (key) | Deps | Pri | Cx | Sprint | Risk |
|---|---|---|---|---|---|---|---|---|
| SL-01 | Append-only (WORM) audit-log service | Non-repudiation across all actions | Every create/update/delete/approve/export writes who/what/when/before/after/reason; append-only; immutable; queryable | — | P0 | L | 1 | High |
| SL-02 | Guarantee overlay persistence | No silent loss of audit/approval/routing data | Overlays (editHistory/approvalStatus/costCentre/purchaseAccountId/valuationMethod) persist atomically with base row; no "saved partially" data loss | — | P0 | M | 1 | Med |
| SL-03 | Soft-delete all parent records | Statutory records never lost | member/purchase/asset/objection use isDeleted/inactive; existing dependent cascades preserved; restore path; hard-delete removed | SL-01 | P0 | M | 1 | Med |
| SL-04 | Ledger hygiene (numbering, cost-centre, sub-rupee log) | Gap-free trail; segment costing | Server-side gap-free voucher numbers; cost-centre allocation posts; sub-rupee auto-adjustments logged | SL-01 | P1 | M | 4 | Low |
*Sub-tasks (SL-01):* schema/table · write-hook in persist layer · redaction/PII rules · read/query API · retention policy.

### EP-B — Access Control & Security
| ID | Title | Business value | Acceptance criteria | Deps | Pri | Cx | Sprint | Risk |
|---|---|---|---|---|---|---|---|---|
| SL-05 | 17-role × 14-permission model | Least privilege; real duties | Roles & permission categories defined; per-action checks enforced server + client; auditor ≠ viewer | — | P0 | L | 1–2 | High |
| SL-06 | Route authorization deny-by-default | Close URL-bypass holes | Every route role+capability gated; non-catalog routes denied; server (RLS) parity | SL-05 | P0 | M | 2 | High |
| SL-07 | Segregation of duties + export gating | Fraud control; data-exfil control | entry≠approval≠audit≠config enforced; export/print permissioned + logged | SL-05, SL-01 | P0 | M | 2 | Med |
| SL-08 | MFA for privileged roles/actions | Account-takeover defence | MFA required for Admin/Chairman/Secretary + unlock/FY-close | SL-05 | P1 | M | 2 | Med |
| SL-09 | Hardened session + auth consolidation | Reduce token-theft & complexity | Hardened session storage; consolidate multi-path login; remove demo creds; client↔RLS parity tests | SL-05 | P1 | M | 2 | Med |

### EP-C — Posting Discipline & Workflow
| ID | Title | Business value | Acceptance criteria | Deps | Pri | Cx | Sprint | Risk |
|---|---|---|---|---|---|---|---|---|
| SL-10 | Post-on-approval (maker-checker) | Only authorized entries in the ledger | Unapproved vouchers excluded from GL/reports; approval posts; high-risk (payment/loan) require checker | SL-05, SL-06 | P0 | L | 3 | High |
| SL-11 | Exclude unapproved/rejected from all reports | Client & SQL reports agree | Rejected vouchers excluded from client-side reports too; both surfaces reconcile | SL-10 | P0 | S | 3 | Med |
| SL-12 | Uniform workflow state machine | Predictable lifecycle | Draft→Verified→Approved→Posted→Locked→Archived; reason-gated transitions | SL-10 | P1 | L | 3 | Med |
| SL-13 | Configurable approval matrix | Governance per society | Amount+type+role routing configurable; delegation; multi-level | SL-05, SL-12 | P1 | L | 3–4 | Med |
| SL-14 | Period lock + dual-control unlock/FY-close | Stop back-dating | Monthly period lock; unlock/close need dual-control; logged | SL-01, SL-05 | P1 | L | 4 | High |
| SL-15 | Immutable "as-filed" snapshots | Reproduce filed statements/returns | Filed report/return stored immutably; regenerable byte-identical | SL-14, SL-01 | P1 | M | 4 | Med |
| SL-16 | Reversal-not-edit for posted vouchers | Statutory correction model | Posted vouchers immutable; correction via linked reversal voucher; no in-place rewrite | SL-10, SL-14 | P1 | L | 4 | High |

### EP-F — Member, Share & Asset Statutory
| ID | Title | Business value | Acceptance criteria | Deps | Pri | Cx | Sprint | Risk |
|---|---|---|---|---|---|---|---|---|
| SL-17 | Member-wise share ledger + reconciliation | Dividend = capital; no drift | Scalar shareCapital replaced by per-txn share ledger; Σ subsidiaries = Share-Capital control = Balance Sheet; reconciliation report | SL-03 | P0 | L | 4 | High |
| SL-18 | Asset register ↔ ledger reconciliation | Register = Fixed-Asset ledger | Acquisition auto-posts; Σ asset cost = ledger; drift report | SL-03 | P1 | M | 5 | Med |
| SL-19 | Asset disposal + acquisition accounting | Disposal gain/loss recorded | Dispose posts Dr Cash+Accum Dep, Cr Asset, gain/loss to P&L; assetId FK; capex approval | SL-18, SL-16 | P1 | M | 5 | Med |
| SL-20 | Member lifecycle + nominee + KYC | Statutory member management | Resign/expel/death/reactivate states; mandatory + multiple nominees (%=100); KYC docs; certificate lifecycle | SL-17 | P1 | L | 6 | Med |
| SL-21 | Share operations + transfer-premium cap | Full share ops | Forfeiture/surrender/redemption/bonus; transfer premium ≤ cap; committee approval | SL-17, SL-13 | P1 | L | 6 | Med |

### EP-D — Year-End & Statutory Accounting
| ID | Title | Business value | Acceptance criteria | Deps | Pri | Cx | Sprint | Risk |
|---|---|---|---|---|---|---|---|---|
| SL-22 | Opening = audited closing (auto, locked) | Correct year rollover | Opening carried from prior audited closing; no manual override post-audit | SL-14 | P1 | M | 5 | Med |
| SL-23 | Appropriation-order + year-end close | Compliant surplus distribution | Enforced reserve≥25%→education→funds→dividend; close routine; FY lock | SL-14, SL-17 | P1 | M | 5 | Med |

### EP-H — Reporting & Dashboards
| ID | Title | Business value | Acceptance criteria | Deps | Pri | Cx | Sprint | Risk |
|---|---|---|---|---|---|---|---|---|
| SL-24 | Role dashboards (7) | Role decision-support | Chairman/Manager/Accountant/Auditor/Procurement/Inventory/Compliance dashboards; role-scoped KPIs | SL-05 | P1 | L | 5 | Low |
| SL-25 | Report governance (scope, comparatives) | Data governance; reliable comparatives | Role-scoped view/export + export log; computed multi-period comparison (replace manual snapshots) | SL-06, SL-15 | P1 | M | 5 | Med |

### EP-E — Compliance, Notifications & Calendar
| ID | Title | Business value | Acceptance criteria | Deps | Pri | Cx | Sprint | Risk |
|---|---|---|---|---|---|---|---|---|
| SL-26 | Compliance-calendar engine | No missed statutory deadlines | Monthly/quarterly/annual due-dates (GST/TDS/PF/ESI/PT/AGM/return); status; effective-dated rules | SL-01 | P1 | L | 6 | Med |
| SL-27 | Notification centre + channels | Reliable off-app reach | Persistent notification centre; SMS/email/WhatsApp providers (DLT for SMS); event catalog | SL-01 | P1 | L | 6 | Med |
| SL-28 | Routed role-targeted alerts + escalation | Risks reach owners | Approval-pending→approver; compliance-due; overdue/NPA; member dues/dividend/AGM; severity→channel→escalation | SL-26, SL-27, SL-05 | P1 | M | 6 | Med |
| SL-29 | Salary statutory engine (PF/ESI/TDS/PT + 24Q) + attendance | Payroll compliance for all societies | PF/ESI/TDS(192)/PT computation + payable heads; 24Q; muster/attendance tie-out; unify with labour path | SL-26 | P1 | L | 6 | Med |

### Backlog › Sprint 6 (P2/P3 — enumerated, not scheduled)
| ID | Title | ECR | Pri | Cx |
|---|---|---|---|---|
| SL-30 | Warehouse/Godown module | ECR-20 | P2 | XL |
| SL-31 | Procurement/inventory control (3-way match, reorder, stock-take, valuation-method, batch/expiry, agency recon) | ECR-21 | P2 | L |
| SL-32 | GST/TDS completeness (GSTR-9, RCM, portal upload, voucher-level validation) | ECR-22, AV-15 | P2 | L |
| SL-33 | Multi-branch + inter-branch accounting | ECR-17 | P2 | XL |
| SL-34 | OLTP/OLAP separation + BI + scheduled reports | ECR-24 | P2 | XL |
| SL-35 | NABARD CAS conformance | ECR-23 | P2 | M |
| SL-36 | Fund-accounting engine | ECR-27 | P2 | M |
| SL-37 | Per-type provider loading + dashboard compute | ECR-26 | P2 | L |
| SL-38 | Unified + fuzzy + Hinglish search | ECR-25 | P2 | M |
| SL-39 | In-app AI copilot + live knowledge engine + AI-readiness | ECR-29 | P3 | L |
| SL-40 | Custom report builder | ECR-30/RD-10 | P3 | L |

## 5. Sprint Backlog
| Sprint | Theme | Stories | Priority mix |
|---|---|---|---|
| **Sprint 1** | Integrity substrate + RBAC start | SL-01, SL-02, SL-03, SL-05 (start) | 3×P0, 1×P0(L) |
| **Sprint 2** | Access control & security | SL-05 (finish), SL-06, SL-07, SL-08, SL-09 | 3×P0, 2×P1 |
| **Sprint 3** | Posting discipline & workflow | SL-10, SL-11, SL-12, SL-13 (start) | 2×P0, 2×P1 |
| **Sprint 4** | Integrity core | SL-13 (finish), SL-14, SL-15, SL-16, SL-17, SL-04 | 1×P0, 5×P1 |
| **Sprint 5** | Year-end, assets, reporting | SL-18, SL-19, SL-22, SL-23, SL-24, SL-25 | 6×P1 |
| **Sprint 6** | Compliance & statutory breadth | SL-26, SL-27, SL-28, SL-29, SL-20, SL-21 | 6×P1 |
| **Backlog** | Functional breadth & scale | SL-30…SL-40 | P2/P3 |

## 6. Critical Path
**SL-01/SL-02 (audit substrate + persistence) → SL-03 (soft-delete) → SL-05 (RBAC) → SL-06/07 (route authz + SoD) → SL-10 (post-on-approval) → SL-12/13 (workflow + matrix) → SL-14 (period lock) → SL-16 (reversal) & SL-17 (share ledger, P0) → SL-22/23 (opening + appropriation) → SL-26/27/28 (compliance + notifications).**

Notes:
- **SL-05 (RBAC)** is the widest bottleneck — it gates SL-06/07/08/10/13/24/25/28. Start it in Sprint 1 to de-risk.
- **SL-01 (audit log)** and **SL-02 (persistence)** are low-coupling enablers — land them first; SL-04/SL-14/SL-16 depend on the trail.
- **SL-10 + SL-11** (approval gating + report exclusion) are the highest correctness payoff; SL-11 is a small, high-value fix (exclude rejected vouchers from client reports).
- **SL-17** (member-wise share ledger) is the only P0 outside the substrate/RBAC/posting cluster; it depends only on soft-delete (SL-03) and can run in parallel from Sprint 4.

## 7. Risk register (delivery)
| Risk | Stories | Mitigation |
|---|---|---|
| RBAC rebuild destabilises access | SL-05/06/07 | Feature-flag; parity tests vs current + RLS |
| Approval-gating changes report figures | SL-10/11 | Migrate historical to approved; reconcile client vs SQL before cutover |
| Share-ledger migration from scalar | SL-17 | Backfill from vouchers; reconciliation gate before switch |
| Period-lock/reversal disrupt workflows | SL-14/16 | Dual-control + clear UX; pilot with one society type |
| Notification cost/deliverability | SL-27 | Throttling, DLT registration, provider fallback |

*End of Phase 5.1 Engineering Backlog — planning artifact derived from approved specs; no code, no changes. STOP.*
