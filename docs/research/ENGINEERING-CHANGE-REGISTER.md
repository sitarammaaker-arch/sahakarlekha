# SahakarLekha — Consolidated Engineering Change Register (ECR)

**Source:** All nine gap-analysis sessions consolidated, deduplicated, and prioritized. Audit-derived; **no code herein** — this is a prioritized change backlog.
**Method:** ~90 raw gap-register rows across Sessions 1–9 → merged by root cause into **30 engineering changes**. Priority = P0 (correctness/control, do first) → P1 (integrity/compliance/security foundations) → P2 (functional breadth/scale) → P3 (enhancements). Effort S/M/L/XL. **Prepared:** 2026-07-08.

**Session key:** S1 Platform/Nav/Auth · S2 Accounting/Voucher · S3 Member/Share · S4 Procurement/Inventory/Warehouse · S5 Assets/Payroll · S6 Reports/Dashboard/Analytics · S7 Audit/Compliance/GST/TDS · S8 Notifications/Workflow/Approval · S9 AI/Search/Help.

---

## Cross-cutting themes (why 90 gaps → 30 changes)
These root patterns recurred across many modules and are consolidated into single changes:
1. **Parent-record hard-deletes** (member, purchase, asset, audit objection) → **ECR-02**.
2. **No system-wide append-only audit log** (found in S2/S3/S5/S7/S8) → **ECR-03**.
3. **Fragile step-2 "extras" patch** (editHistory/approvalStatus/costCentreId/purchaseAccountId/valuationMethod silently lost) → **ECR-04**.
4. **Approval doesn't gate posting; reports include unapproved/rejected** (S2+S8) → **ECR-01**.
5. **Dual source of truth** (member shareCapital scalar; asset register vs ledger) → **ECR-05**.
6. **Coarse RBAC** (4 roles, no per-action perms, no SoD, sparse route gating) touching reports/approval → **ECR-06**.
7. **FY-lock only, no period lock; no immutable snapshots** (S2/S6/S7) → **ECR-07**.

---

## P0 — Correctness & Control (foundations; block others)

| ECR | Title | Consolidates | Problem | Change (high-level) | Effort | Risk if skipped | Depends on |
|---|---|---|---|---|---|---|---|
| **ECR-01** | Approval gates posting; reports on approved data | S2 AV-01; S8 NW-01/NW-02; S6 RD-05(part); S7 AC-07(part) | Vouchers post to GL on create; client reports include unapproved **and rejected** entries; client vs SQL divergence | Post only on approval (maker-checker); exclude unapproved/rejected from **all** report surfaces | L | Unapproved/rejected entries in statutory financials | ECR-06, ECR-11 |
| **ECR-02** | Soft-delete all parent records | S3 MS-01; S4 PI-06; S5 AP-05; S7 AC-03 | Member/purchase/asset/objection rows are hard-deleted (`.delete()` + console log); history lost | Replace hard delete with `isDeleted`/inactive everywhere; keep existing dependent cascades | M | Statutory-record loss; audits can't tie out | ECR-03 |
| **ECR-03** | System-wide append-only (WORM) audit log | S2 AV-03; S3 MS-10; S5 AP-11; S7 AG-2; S8 NW-10 | Audit trail = per-voucher editHistory + console logs; no immutable cross-entity log | One append-only log: who/what/when/before/after/reason across all mutations, approvals, exports | L | Non-repudiation gap; audit incompleteness | — |
| **ECR-04** | Guarantee overlay persistence (fix extras patch) | S2 AV-02/AV-09; S4 AG-5; S5/S8 trail | editHistory/approvalStatus/costCentre/purchaseAccountId/valuationMethod ride a best-effort patch that can fail silently | Move overlays to base columns or a transactional write; no silent partial saves | M | Lost audit/approval/routing data while base row saves | — |
| **ECR-05** | Control = subsidiary invariant | S3 MS-02/MS-03; S5 AP-02(part) | Member shareCapital is a scalar; asset register ≠ ledger — dual source of truth | Member-wise share ledger + asset register↔ledger reconciliation; enforce Σ subsidiaries = control | L | Dividend ≠ capital; register/ledger drift | ECR-02 |
| **ECR-06** | RBAC: per-action perms, 17 roles, SoD, route role-scoping | S1 G-01/G-02/G-03/G-04/G-11/G-12/G-13/G-18; S6 RD-03; S8 NW-04 | 4 roles, `admin=all`, no per-action model, sparse route gating, financials exportable by any role, non-catalog routes allowed | 17-role × 14-permission model; deny-by-default routes; segregation of duties; export gating | XL | Least-privilege & fraud-control failure; data exfil | — |

## P1 — Integrity, Compliance & Security foundations

| ECR | Title | Consolidates | Problem | Change | Effort | Risk | Depends on |
|---|---|---|---|---|---|---|---|
| **ECR-07** | Period lock + dual-control unlock/FY-close + immutable snapshots | S1 G-05; S2 AV-05; S6 RD-05; S7 AC-08 | Only whole-FY lock; single-admin unlock; reports/returns recompute from mutable data | Monthly period lock; dual-control unlock/close; "as-filed" immutable report/return snapshots | L | Back-dating; non-reproducible filed statements | ECR-03, ECR-06 |
| **ECR-08** | Reversal-not-edit for posted entries | S2 AV-04; S3 MS-04 | Posted vouchers edited in place (editHistory) / join voucher rewritten | Lock posted vouchers; corrections via linked reversal voucher | L | Back-dating; statutory reversal expectation unmet | ECR-01, ECR-07 |
| **ECR-09** | Opening balance = audited closing (auto, locked) | S2 AV-07 | Opening balances manually editable | Carry prior-year audited closing automatically; lock post-audit | M | Wrong openings poison the year | ECR-07 |
| **ECR-10** | Appropriation-order + year-end close automation | S2 AV-06 | Reserve/education/dividend appropriation is manual | Engine-enforced sequence (reserve ≥25% → education → funds → dividend) at year-end | M | Compliance/audit objections | ECR-07 |
| **ECR-11** | Workflow state machine + approval matrix | S8 NW-03; S2/S8 approval | Flat 3-state approval; no routing/escalation/matrix | Uniform state machine + configurable approval matrix (amount/type/role) | L | No real authorization control | ECR-06 |
| **ECR-12** | MFA + hardened session | S1 G-06/G-07 | No MFA; localStorage session | MFA for privileged roles/actions; hardened session storage | M | Account takeover; token theft | ECR-06 |
| **ECR-13** | Compliance calendar + notification platform (channels + routed alerts) | S7 AC-01; S8 NW-05/NW-06/NW-07/NW-08/NW-09; S6 RD-02 | No compliance calendar; notifications = toasts + a derived badge; no delivery channels or routed alerts | Statutory due-date engine + persistent notification centre + SMS/email/WhatsApp + role-routed alerts & escalation | XL | Missed deadlines/penalties; risks not surfaced | ECR-06 |
| **ECR-14** | Salary statutory engine (PF/ESI/TDS/PT + 24Q) + attendance | S5 AP-03/AP-04/AP-08(part); S7 AC-02/AC-09 | Generic salary uses lump deductions; no statutory computation, no 24Q, no attendance | PF/ESI/TDS(192)/PT engine + payable heads + 24Q + muster/attendance tie-out; unify with labour path | L | Statutory payroll non-compliance | ECR-13(calendar) |
| **ECR-15** | Asset disposal + acquisition accounting | S5 AP-01/AP-02/AP-06/AP-07/AP-09/AP-10 | No disposal gain/loss; acquisition not auto-posted; narration-based dep linkage | Dispose→gain/loss to P&L; capitalize on add (register↔ledger); assetId FK; rate master; capex approval | M | Disposal unrecorded; register/ledger drift | ECR-05, ECR-06 |
| **ECR-16** | Member lifecycle + nominee + share operations + KYC | S3 MS-05/MS-06/MS-07/MS-08/MS-09/MS-11/MS-12/MS-13 | Binary status; optional single nominee; no forfeit/surrender/redeem/bonus; no premium cap; weak KYC | Full lifecycle (resign/expel/death/reactivate); mandatory+multiple nominees; share ops; transfer-premium cap; KYC docs; certificate lifecycle | L | Statutory member/share gaps | ECR-05 |
| **ECR-17** | Multi-branch dimension + inter-branch accounting | S1 G-08; S2 AV-12; S4 PI-07 | No branch scope; no inter-branch account; godown-less stock | Branch as first-class scope; inter-branch control (nets to zero); godown-wise stock | XL | Multi-branch/MSCS unsupported at scale | ECR-06 |
| **ECR-18** | Role dashboards | S1 G-10; S6 RD-01 | One role-agnostic dashboard | 7 role dashboards (Chairman/Manager/Accountant/Auditor/Procurement/Inventory/Compliance) | L | Weak role decision-support | ECR-06 |
| **ECR-19** | Report governance (role-scope, computed comparatives) | S6 RD-03/RD-04 | Financials viewable/exportable by any role; prior-year is manual snapshot | Role-scoped view/export; computed multi-period comparatives | M | Data governance; comparative reliability | ECR-06, ECR-07 |

## P2 — Functional breadth & scale

| ECR | Title | Consolidates | Change | Effort | Depends on |
|---|---|---|---|---|---|
| **ECR-20** | Warehouse/Godown module | S4 PI-01/PI-07/PI-09 | WHR, stack cards, gate pass, inter-godown transfer, godown-wise stock, storage-loss vs norm | XL | ECR-17 |
| **ECR-21** | Procurement/inventory control | S4 PI-02/PI-03/PI-04/PI-05/PI-08/PI-10/PI-12; S4 AG | 3-way match (PO/GRN/invoice); honour `valuationMethod`; per-item reorder; stock-take + approval; generic batch/expiry; agency reconciliation; movement soft-delete | L | ECR-01 |
| **ECR-22** | GST/TDS completeness | S7 AC-04/AC-05/AC-06; S2 AV-15 | GSTR-9; RCM auto-compute; GSTN/TRACES portal upload; voucher-level GST/TDS validation | L | — |
| **ECR-23** | NABARD CAS conformance (PACS) | S2 AV-14 | Verify/align COA & statement formats to NABARD CAS | M | — |
| **ECR-24** | OLTP/OLAP separation + analytics/BI + scheduled reports | S1 G-20; S6 RD-07/RD-08/RD-09 | Server-side aggregation / read-replica; BI drill-down; scheduled/emailed reports | XL | — |
| **ECR-25** | Unified + fuzzy + Hinglish search | S9 AK-02/AK-03/AK-04; S1 G-16 | Merge app-entity + content search; fuzzy/semantic; transliteration-aware matching | M | — |
| **ECR-26** | Per-type provider loading + dashboard compute | S1 G-09/G-15 | Mount vertical providers per society type; lazy/memoized KPI compute | L | — |
| **ECR-27** | Fund-accounting engine | S2 AV-13 | Fund ledgers + backing-investment link (sinking/repair/education) | M | ECR-05 |
| **ECR-28** | Ledger hygiene (server numbering, cost centre, sub-rupee log) | S2 AV-08/AV-10/AV-11 | Server-side gap-free numbering; cost-centre allocation; log sub-rupee adjustments | M | ECR-03 |

## P3 — Enhancements

| ECR | Title | Consolidates | Change | Effort | Depends on |
|---|---|---|---|---|---|
| **ECR-29** | AI copilot + live knowledge engine + AI-readiness | S9 AK-01/AK-05/AK-06/AK-07/AK-08 | In-app grounded copilot over user data; wire KAE; optional LLM synthesis; answer-quality loop; event-stream data foundation | L | ECR-06, ECR-24 |
| **ECR-30** | Auth consolidation + hygiene + custom reports | S1 G-14/G-17/G-19; S6 RD-10 | Consolidate multi-path login; remove demo creds; client↔RLS parity tests; custom report builder | M | ECR-06 |

---

## Recommended sequencing (critical path)
1. **ECR-03 (audit log) + ECR-04 (overlay persistence)** — enabling substrate for almost everything; low coupling.
2. **ECR-02 (soft-delete parents)** — small, high-value, unblocks audit integrity.
3. **ECR-06 (RBAC)** — the widest dependency; gates ECR-01/07/11/12/13/17/18/19.
4. **ECR-01 (approval gates posting) + ECR-11 (workflow/matrix)** — correctness + control, depend on ECR-06.
5. **ECR-05 (control=subsidiary) + ECR-07 (period lock/snapshots) + ECR-08 (reversal)** — integrity core.
6. **ECR-09/10 (opening balance, appropriation)** — year-end correctness.
7. Then P1 breadth (ECR-13 calendar/notifications, ECR-14 payroll, ECR-15 assets, ECR-16 member/share, ECR-17 branch, ECR-18 dashboards, ECR-19 report governance).
8. P2/P3 as capacity allows.

## Priority summary
| Priority | Count | Theme |
|---|---|---|
| **P0** | 6 | Correctness & control (approval-gating, soft-delete, audit log, overlay persistence, control=subsidiary, RBAC) |
| **P1** | 13 | Integrity, compliance, security, statutory breadth |
| **P2** | 9 | Functional breadth (warehouse, procurement control, GST/TDS completeness, scale) |
| **P3** | 2 | AI/search/auth enhancements |
| **Total** | **30** | consolidated from ~90 raw gap rows |

**Headline:** the correctness *core* (double-entry, rollback, canonical stock formula, isDeleted filtering, depreciation, GST/TDS prep) is sound; the **P0 cluster is about closing control and integrity edges** — making approval actually gate posting, stopping parent hard-deletes, guaranteeing the audit trail and overlay persistence, eliminating dual-source-of-truth, and rebuilding RBAC. Those six unblock most of the P1 compliance/security work.

*End of Consolidated Engineering Change Register — audit-derived planning artifact; no code, no changes. STOP.*
