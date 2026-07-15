# SahakarLekha Gap Analysis — Session 7 (Audit Module, Compliance, GST & TDS)

**Nature:** Audit only. No code written, no files modified. Scope strictly **Audit Module + Compliance + GST + TDS** (`DataContext` auditObjection/GST/TDS functions; pages AuditRegister/AuditCertificate/AuditSchedules, GstSummary, TdsRegister/TdsForm16A, HsnMaster, EWayBill, ReserveFund; `lib/tds26q`, audit-schedule libs). Measured against Blueprints 2.4/2.6/3.8 and CLAUDE.md RULES. **Prepared:** 2026-07-08.

---

## 1. Current Architecture

**Audit module (mature).** `AuditObjection` (objectionNo, auditYear, paraNo, category, amountInvolved, dueDate, actionTaken, rectifiedDate, status) with `addAuditObjection` (RULE-1 rollback + FY-lock guard) and a rectification-tracking register. `AuditCertificate` captures **audit classification A/B/C/D** and prints the certificate (PDF). **`AuditSchedules`** renders **state-wise statutory audit schedules I–X**, data-driven from the society's state Cooperative Act (PDF export) — a sophisticated, jurisdiction-aware feature.

**GST (strong).** `GstSummary` (1,432 lines) is a real return-preparation engine: **GSTR-1** (B2B, B2CS, HSN summary), **GSTR-3B** (Table 3.1 outward incl. an RCM row, Table 4 ITC), purchase-return **ITC reversal** (debit notes), sales-return credit notes, and **month-wise reconciliation**. GST posts CGST/SGST/IGST to **2201 (output)** / **3310 (ITC)** from sale/purchase flows; `HsnMaster` and `EWayBill` support it; per-item `gstRate`.

**TDS (strong).** `TdsRegister` is a proper compliance module: sections (192/194A/194C/194H/194I/194J/194Q/195), deductee PAN/type, **challan linking** (`TdsChallan`: BSR code/serial/date), **Form 26Q text export** (`lib/tds26q` — generate/validate/download, quarter due dates), auto-import from purchases (`pur-<id>`) + manual entries, `Form16A`, status pending/deposited/filed. `TdsEntry` is **soft-deletable** (`isDeleted`).

**Compliance (partial/scattered).** No dedicated compliance-calendar module. Cooperative compliance is spread across the Dashboard (Sec 65 reserve, **Sec 32** loan-limit, BS tally, FY-lock, overdue, objections + advisories), the TDS quarter due-dates, `ReserveFund`/`ProfitDistribution`, `MeetingRegister`/`ElectionModule`, and `NabardReport`/`FederationReport`/`Form1MemberList`.

**Verdict:** GST, TDS, and the audit register/schedules are **among the most mature modules in the product**. The gaps are **completeness** (GSTR-9, salary-TDS/24Q, RCM auto-compute), a **unified compliance calendar**, and the **recurring hard-delete / audit-log / period-lock** patterns.

---

## 2. Business Rule Issues

| # | Issue | Detail |
|---|---|---|
| BR-1 | **Audit objection is hard-deleted** | `deleteAuditObjection` → `supabase.from('audit_objections').delete()` (console log only). A statutory objection record can be erased. (Note: TDS entries, by contrast, are soft-deleted — inconsistent.) |
| BR-2 | **No compliance calendar** | There is no monthly/quarterly/annual due-date engine (GST 20th, TDS 7th, PF/ESI 15th, AGM, annual return). Due-dates live in silos (TDS quarter, audit-objection dueDate, dashboard FY-lock advisory). |
| BR-3 | **Salary TDS (24Q) not integrated** | Section 192 exists in the TDS dropdown, but generic salary uses a lump `deductions` (Session 5) — salary TDS does not auto-flow to the register or a 24Q; only 26Q (non-salary) is exported. |
| BR-4 | **RCM not auto-computed** | The GSTR-3B Table 3.1(d) reverse-charge row is present but hard-coded to 0.00 — inward RCM liability is not derived from purchases. |
| BR-5 | **No maker-checker on rectification** | Objection `actionTaken`/`rectifiedDate`/`status` are free field-updates; no approval, and no auto-generated rectification/follow-up report to the Registrar. |
| BR-6 | **Compliance reflects unapproved/period-open data** | With posting pre-approval and only FY-lock (Sessions 2/6), GST/TDS/compliance figures can shift within an open FY. |

---

## 3. Missing Features (vs Blueprints 2.4/2.6/3.8)

| # | Missing | Priority |
|---|---|---|
| MF-1 | **Compliance-calendar engine** — statutory due-dates (GST/TDS/PF/ESI/PT/AGM/annual-return) with alerts & status | P1 |
| MF-2 | **Salary-TDS (24Q)** integration + export | P1 |
| MF-3 | **GSTR-9 (annual return)** | P2 |
| MF-4 | **RCM auto-computation** from purchases | P2 |
| MF-5 | **GSTN / TRACES portal-format upload** (JSON for GSTR-1/3B; validated 26Q already text-exports) | P2 |
| MF-6 | **Soft-delete audit objections** (consistency with TDS) | P2 |
| MF-7 | **Rectification/follow-up report to Registrar** + maker-checker on objection status | P2 |
| MF-8 | **Professional Tax** compliance (where applicable) | P3 |
| MF-9 | **Lower-deduction / 27Q (non-resident)** TDS cases | P3 |

---

## 4. Compliance Gaps

| # | Gap | Standard |
|---|---|---|
| CG-1 | No unified statutory compliance calendar | Blueprint 2.6/3.8 compliance cadence |
| CG-2 | Salary TDS not deducted/registered (24Q) | Income-tax s.192 |
| CG-3 | GSTR-9 annual return absent | GST annual filing |
| CG-4 | RCM liability not auto-computed | GST reverse-charge |
| CG-5 | Audit objection can be hard-deleted | Objection-register retention |
| CG-6 | Compliance figures can change within open FY (no period lock) | Filed-return immutability |

**Not gaps (strong / compliant):** GSTR-1/3B preparation (B2B/B2CS/HSN/ITC/reconciliation); TDS 26Q export + challan linking + PAN validation + sections; **audit classification A/B/C/D**; **state-wise audit schedules I–X**; audit-objection register with rectification tracking + RULE-1 rollback + FY-lock guard; TDS soft-delete; Sec 32/65 checks; e-Way Bill + HSN master.

---

## 5. Audit Gaps

| # | Gap | Detail |
|---|---|---|
| AG-1 | **Audit-objection hard-delete → console log only** | The very record that evidences audit findings can be erased with no persistent trail. |
| AG-2 | **No system-wide audit log** | Recurring across sessions — GST/TDS/compliance actions have no immutable, append-only trail. |
| AG-3 | **No compliance-action audit** | Filing/remittance status changes (TDS deposited→filed, objection resolved) are field updates, not logged events. |
| AG-4 | **No immutable as-filed GST/TDS snapshot** | Returns recompute from live data; a filed GSTR/26Q cannot be reproduced identically after later edits (Session 6 AG-2 applies here). |

---

## 6. Gap Register

| Gap ID | Area | Current situation | Expected | Business impact | Priority | Complexity | Dependencies |
|---|---|---|---|---|---|---|---|
| AC-01 | Compliance | No compliance calendar | Statutory due-date engine + alerts + status | Missed deadlines/penalties | **P1** | L | Notifications |
| AC-02 | TDS | Salary TDS (24Q) not integrated | s.192 deduction → register → 24Q | s.192 non-compliance | **P1** | L | Payroll (Session 5) |
| AC-03 | Audit | Objection hard-deleted | Soft-delete + append-only trail | Objection record loss | **P1** | M | Persist model, audit log |
| AC-04 | GST | No GSTR-9 | Annual return | Annual-filing gap | **P2** | M | GST engine |
| AC-05 | GST | RCM row hard-coded 0 | Auto-compute RCM from purchases | Understated liability | **P2** | M | Purchase engine |
| AC-06 | GST/TDS | No portal-format upload | GSTN JSON / TRACES upload | Manual re-keying | **P2** | M | Integrations |
| AC-07 | Audit | No maker-checker / follow-up report | Approval + Registrar rectification report | Governance gap | **P2** | M | RBAC |
| AC-08 | Audit/Tax | Returns/objections recompute live | Immutable as-filed snapshots | Reproducibility | **P2** | L | Period lock, snapshots |
| AC-09 | Compliance | No Professional Tax / 27Q | PT + non-resident TDS | Edge-case non-compliance | **P3** | M | Tax config |

---

## Summary
This cluster is a **product strength** — the GSTR-1/3B preparation engine, the TDS 26Q register with challan linking, the A/B/C/D audit classification, and especially the **state-wise audit schedules I–X** are mature, jurisdiction-aware features well ahead of the platform-access and member/share layers audited earlier. The priority gaps are **completeness and cadence**: **(AC-01)** there is no unified compliance calendar, **(AC-02)** salary TDS (24Q) is not integrated (a knock-on of the payroll lump-deduction gap), and **(AC-03)** audit objections are hard-deletable with no trail. GSTR-9, RCM auto-compute, portal upload, and immutable as-filed snapshots round out the backlog. No P0s — the tax computations and audit register are sound; the gaps are breadth, calendar, and the recurring hard-delete/audit-log/period-lock themes.

*End of Gap Analysis Session 7 — audit only; no code, no changes. STOP.*
