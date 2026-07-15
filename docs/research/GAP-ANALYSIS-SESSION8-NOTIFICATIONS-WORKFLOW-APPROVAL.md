# SahakarLekha Gap Analysis — Session 8 (Notifications, Workflow & Approval System)

**Nature:** Audit only. No code written, no files modified. Scope strictly **Notifications + Workflow + Approval** (`DataContext` approveVoucher/rejectVoucher; `pages/VoucherApproval`; `components/layout/Header` notification badge; toast usage; approval overlay fields). Measured against Blueprints 3.5 (Workflow/Approval) & 3.2/3.8 (Notifications) and CLAUDE.md RULES. **Prepared:** 2026-07-08.

---

## 1. Current Architecture

**Approval.** `approveVoucher` / `rejectVoucher` set a flat `approvalStatus` (`pending` | `approved` | `rejected`) plus `approvedBy/approvedAt/approvalRemarks`, each with RULE-1 rollback. `VoucherApproval` is an **admin-only page** (`requiredRoles: ['admin']`) with pending/approved/rejected tabs and Excel/CSV export. Approve → `syncEntries` (mirror to `voucher_entries`); reject → `deleteEntries` (remove from SQL entries). Engine-generated vouchers cannot be approved/rejected. Member admission has a **separate** approval (`approveMember`/`rejectMember`).

**Workflow.** There is **no workflow engine**. `approvalStatus` is a flat 3-state field — no `Draft→Verified→Approved→Posted→Locked` state machine, no multi-level routing, no approval matrix, no escalation. "Cancellation" is `cancelVoucher` (soft-delete + reason); there is no reversal (Session 2). Per-voucher immutability is only via whole-FY lock.

**Notifications.** There is **no notification infrastructure** (no SMS/email/WhatsApp/push library, no notifications table, no per-user inbox). Two mechanisms exist:
1. **Transient toasts** (`use-toast`/sonner across ~79 pages) — ephemeral, unrouted, unpersisted.
2. **Header notification badge** — a **client-derived count** `overdueLoans + pendingObjections + (cancelledVouchers?1:0)`, recomputed live; three hard-coded categories, no unread state, no event log, no routing.

**Verdict:** the approval system is a **cosmetic review overlay** (it neither gates posting nor filters client reports), workflow is a flat status field, and notifications are ephemeral. This is — with the platform-access layer (Session 1) — one of the least-developed areas versus the blueprints.

---

## 2. Business Rule Issues

| # | Issue | Detail |
|---|---|---|
| BR-1 | **Approval does not gate posting** | Vouchers post to the GL on creation (Session 2); `approvalStatus` is set *after the fact*. There is no maker-checker control — approval is optional review, not authorization. |
| BR-2 | **Client reports ignore approval status** | `activeVouchers = filter(!isDeleted)` — client-side Trial Balance/P&L/Balance Sheet include **unapproved** vouchers, and (because reject sets `approvalStatus` but **not** `isDeleted`) **rejected vouchers too**. |
| BR-3 | **Client vs SQL report divergence for rejected vouchers** | `rejectVoucher` calls `deleteEntries` (removes from `voucher_entries` → SQL reports exclude it) but leaves the voucher non-deleted → **client-side reports still include it**. The two reporting surfaces disagree. |
| BR-4 | **No approval requirement / threshold** | Nothing *requires* approval; there is no amount- or type-based routing (the authorization matrix from Blueprint 3.5 is absent). Every voucher is effectively self-approved unless an admin happens to review it. |
| BR-5 | **Single-stage, single-role approval** | Only `admin` approves, in one step. No verify→approve chain, no multi-signatory, no delegation. |
| BR-6 | **No workflow state machine** | The Draft→Verified→Approved→Posted→Locked→Archived lifecycle (Blueprint 3.5) does not exist; status is a flat enum. |

---

## 3. Missing Features (vs Blueprints 3.5 / 3.2 / 3.8)

| # | Missing | Priority |
|---|---|---|
| MF-1 | **Approval-before-posting gate** (maker-checker; unapproved excluded from reports) | P0 |
| MF-2 | **Approval-matrix engine** (amount + type + role routing; configurable per society) | P1 |
| MF-3 | **Multi-level / multi-signatory approval + delegation** | P1 |
| MF-4 | **Notification infrastructure** — persistent notification centre + event catalog | P1 |
| MF-5 | **Multi-channel delivery** (SMS/email/WhatsApp/push) with provider abstraction | P1 |
| MF-6 | **Routed, role-targeted alerts** (approval-pending → approver; compliance-due; overdue/NPA; member dues/dividend/AGM) | P1 |
| MF-7 | **Workflow state machine** (uniform lifecycle + reason-gated transitions) | P1 |
| MF-8 | **Escalation / SLA** on pending approvals | P2 |
| MF-9 | **Member-facing notifications** (dues, dividend, AGM notice) | P2 |
| MF-10 | **Notification preferences / throttling / DLT (SMS)** | P2 |

---

## 4. Compliance Gaps

| # | Gap | Standard |
|---|---|---|
| CG-1 | No enforced maker-checker | Financial authorization / segregation of duties |
| CG-2 | Reports can reflect unapproved (and rejected) entries | Report on approved data |
| CG-3 | No AGM/compliance-deadline notifications | Statutory notice/reminder cadence (ties to Session 7 no-calendar) |
| CG-4 | No dual-control / multi-signatory approval | Cooperative authorization norms |

**Not gaps (present):** admin-gated approval page; RULE-1 rollback on approve/reject; FY-lock guard on approval actions; soft-delete cancellation with reason; a basic header alert badge for overdue loans / pending objections / cancelled vouchers.

---

## 5. Audit Gaps

| # | Gap | Detail |
|---|---|---|
| AG-1 | **Approval trail is a single overwrite** | `approvedBy/approvedAt/approvalRemarks` capture only the *last* action; no history of the review chain, and it rides the fragile step-2 extras patch (Session 2 AG-2). |
| AG-2 | **No notification/event log** | Alerts are ephemeral toasts or a derived badge — nothing is persisted, so "was the approver notified / did the member get the dues alert" is unanswerable. |
| AG-3 | **Rejected-voucher divergence is silent** (BR-3) | The mismatch between client and SQL reports is not surfaced or logged. |
| AG-4 | **No system-wide audit log** | Recurring — approval/rejection/cancellation are not events in an append-only trail. |

---

## 6. Gap Register

| Gap ID | Area | Current situation | Expected (Blueprint 3.5/3.2/3.8) | Business impact | Priority | Complexity | Dependencies |
|---|---|---|---|---|---|---|---|
| NW-01 | Approval | Post-then-mark; reports ignore status | Approval gates posting; reports exclude unapproved | Unapproved/rejected entries in financials | **P0** | L | Voucher engine, reports |
| NW-02 | Approval | Rejected voucher still in client reports | Reject → excluded from all reporting surfaces | Client vs SQL divergence | **P0** | S | Report getters |
| NW-03 | Workflow | Flat 3-state; no engine | State machine + approval matrix (amount/type/role) | No real authorization control | **P1** | L | RBAC |
| NW-04 | Approval | Single-stage, admin-only | Multi-level / multi-signatory + delegation | Weak segregation | **P1** | L | Roles |
| NW-05 | Notifications | Toasts + derived badge only | Persistent notification centre + event catalog | No reliable surfacing | **P1** | L | Schema |
| NW-06 | Notifications | No delivery channels | SMS/email/WhatsApp/push (provider-agnostic) | No off-app reach | **P1** | L | Integrations |
| NW-07 | Notifications | Nothing routed to owners | Role-targeted alerts (approver, compliance, member) | Actions missed | **P1** | M | Roles, calendar |
| NW-08 | Workflow | No escalation/SLA | Escalation on pending approvals | Stuck items | **P2** | M | Workflow |
| NW-09 | Notifications | No member-facing alerts | Dues/dividend/AGM notices | Member engagement | **P2** | M | Delivery |
| NW-10 | Audit | Approval = single overwrite; no event log | Append-only approval/notification trail | Non-repudiation | **P2** | M | Audit log |

---

## Summary
Along with the platform-access layer (Session 1), this is the **least-developed cluster** versus the blueprints. The **approval system is cosmetic** — it does not gate posting, and client-side reports include both unapproved and (critically) **rejected** vouchers, which also diverge from the SQL reporting surface: **NW-01/NW-02 are the two P0s** and are correctness/control issues, not just missing features. **Workflow** is a flat status field with no state machine or approval matrix, and **notifications** are limited to ephemeral toasts plus a three-category derived header badge — there is no persistent notification centre, no delivery channels, and no routed alerts. The strengths worth keeping are narrow but real: RULE-1 rollback on approve/reject, FY-lock guards, the admin-gated approval page, and soft-delete cancellation.

*End of Gap Analysis Session 8 — audit only; no code, no changes. STOP.*
