# SahakarLekha Gap Analysis — Session 5 (Assets & Payroll)

**Nature:** Audit only. No code written, no files modified. Scope strictly **Assets + Payroll** (`lib/depreciation.ts`; `DataContext.tsx` asset + salary/wage/muster functions; `LabourDataContext` PF/ESI; pages AssetRegister/DepreciationSchedule/SalaryManagement/MusterRoll/WageRegister/PfEsi/WorkerMaster/WorkerAdvances). Measured against Blueprints (Task 2.5/2.6, 4.x) and CLAUDE.md RULES 1–6. **Prepared:** 2026-07-08.

---

## 1. Current Architecture

**Assets.** `Asset` = category, cost, `depreciationRate`, `depreciationMethod` (SLM/WDV), `residualValue`, `usefulLife`, `depreciationPostedFY[]`, `disposalDate`, `saleProceeds`, status, condition, marketValue. **Depreciation engine** (`lib/depreciation.ts`) is sophisticated: SLM (pro-rated, ICAI AS-6 cost − residual) and WDV (book value, capped at residual), per-category expense/accumulated accounts (`DEP_ACCOUNTS`), and — notably — **`wdvAccumulatedBefore` replays each asset's OWN depreciation from its purchase date** rather than deriving from the shared category ledger (an explicit "Audit #6" correctness fix). `postDepreciation` is **idempotent** (skips already-posted FYs via `depreciationPostedFY`, disposed/land/zero-rate assets), posts Dr expense / Cr accumulated-dep, and marks the FY posted. `addAsset` has RULE-1 rollback; `deleteAsset` soft-cancels linked depreciation vouchers (RULE 3).

**Payroll — two subsystems.**
- **Generic Employee/Salary** (`SalaryRecord`): mercantile — an **accrual voucher** (Dr Salary Expense / Cr Salary Payable, `accrualVoucherId`) at processing and a **payment voucher** (Dr Salary Payable / Cr Bank, `voucherId`) on pay. Deductions are a **single lump `deductions` number** — no PF/ESI/TDS breakdown, no attendance/muster link.
- **Labour cooperative** (`Worker`/`MusterEntry`/`WorkOrder` + `LabourDataContext`): `postWageAccrual` (Dr Wages / Cr Wages Payable 2109), `payWages` (Dr 2109/5202, Cr Cash-Bank, allocation-based, muster tie-out), worker advances/ledger, and a **real PF/ESI engine** — `computePfEsi(period, cfg)` with configurable `PF_ESI_DEFAULTS` (EPF employee/employer/admin-EDLI, ESI employee/employer), `postPfEsi`, `depositPfEsi`, and an **ECR challan breakup** for reconciliation.

**Verdict:** the **depreciation engine and the labour-cooperative payroll are genuinely strong**; the gaps are **asset disposal/acquisition accounting**, **parent hard-deletes**, and a **thin generic-employee salary path** (no statutory-deduction engine).

---

## 2. Business Rule Issues

| # | Issue | Detail |
|---|---|---|
| BR-1 | **No asset-disposal accounting** | `disposalDate`/`saleProceeds` are fields, but **no `disposeAsset` function** books the disposal entry (Dr Cash + Dr Accumulated Dep, Cr Asset, Dr/Cr gain-or-loss). `postDepreciation` merely *skips* disposed assets; the gain/loss on sale is never posted. |
| BR-2 | **Asset acquisition not auto-posted** | `addAsset` records the asset only; capitalization (Dr Fixed Asset / Cr Bank) is a **separate manual voucher**. The asset register and the Fixed-Asset ledger can therefore **drift** (dual source of truth, like the member-shareCapital scalar). |
| BR-3 | **Asset is hard-deleted** | `deleteAsset` cascades the dep vouchers (RULE 3) but then `supabase.from('assets').delete()` — parent gone; only `[AUDIT-DELETE]` console log. |
| BR-4 | **Depreciation ↔ voucher linkage is by narration string** | `deleteAsset` finds dep vouchers via `narration.includes(assetNo)`. Brittle vs a proper `assetId` FK on the voucher; a renamed narration breaks the cascade. |
| BR-5 | **Generic salary has no statutory-deduction engine** | `SalaryRecord.deductions` is one lump figure — no PF/ESI/TDS/professional-tax computation or separate payable accounts, and no attendance/muster tie-out. (The statutory engine exists **only** in the labour subsystem.) |
| BR-6 | **No committee-approval gate on capex/disposal** | Asset add/dispose are not gated by the authorization matrix. |
| BR-7 | **Two disconnected payroll models** | Generic Employee salary and Labour worker wages are separate engines with different rigor; a non-labour society with staff gets the weaker path. |

---

## 3. Missing Features (vs Blueprints)

| # | Missing | Priority |
|---|---|---|
| MF-1 | **Asset disposal workflow** with gain/loss posting + register removal | P1 |
| MF-2 | **Auto-post asset acquisition** (capitalize on add) linking register ↔ ledger | P1 |
| MF-3 | **Statutory-deduction engine for generic salary** (PF/ESI/TDS/PT breakdown + payable heads) | P1 |
| MF-4 | **Attendance/muster link for generic employees** (tie-out to salary) | P1 |
| MF-5 | **Soft-delete asset** (replace hard delete) | P1 |
| MF-6 | **`assetId` FK on depreciation vouchers** (replace narration matching) | P2 |
| MF-7 | **Asset revaluation / impairment** handling (`marketValue` captured but not posted) | P2 |
| MF-8 | **Unify the two payroll subsystems** (or clearly scope generic vs labour) | P2 |
| MF-9 | **Depreciation block/rate master** per statutory rates (Income-tax/Co-op) vs free-text rate | P2 |
| MF-10 | **Committee-approval gate** on capex/disposal | P2 |

---

## 4. Compliance Gaps

| # | Gap | Standard |
|---|---|---|
| CG-1 | Disposal gain/loss not booked | AS-10/AS-6; P&L on sale of asset |
| CG-2 | Asset register ↔ Fixed-Asset ledger not reconciled (acquisition not auto-posted) | Fixed-asset/property register (Rule 65) |
| CG-3 | Generic salary lacks PF/ESI/TDS statutory computation & remittance heads | EPF/ESI/Income-tax (TDS 192) |
| CG-4 | Professional Tax not modelled in salary deductions | State PT (where applicable) |
| CG-5 | Asset hard-deleted vs persistent property register | Register retention |

**Not gaps (compliant / strong):** SLM & WDV per ICAI AS-6 (cost − residual, no dep below residual); idempotent FY posting; per-asset WDV accumulated replay; labour PF/ESI with configurable rates + ECR challan; mercantile wage & salary accrual (accrue → pay); muster tie-out and allocation in `payWages`.

---

## 5. Audit Gaps

| # | Gap | Detail |
|---|---|---|
| AG-1 | **Asset hard-delete → console log only** | Parent asset row removed; no persistent trail ties the deletion to the asset/disposal. |
| AG-2 | **Narration-based depreciation linkage** (BR-4) | The audit chain asset→dep-voucher relies on a mutable string, not an FK. |
| AG-3 | **Disposal leaves no accounting trail** | A disposed asset has date/proceeds fields but no voucher — the audit cannot see the money or the gain/loss. |
| AG-4 | **Acquisition register ↔ ledger not tied** | No structural guarantee that Σ asset cost == Fixed-Asset ledger. |
| AG-5 | **Generic salary deductions opaque** | A single `deductions` figure gives no auditable statutory breakup. |

---

## 6. Gap Register

| Gap ID | Area | Current situation | Expected | Business impact | Priority | Complexity | Dependencies |
|---|---|---|---|---|---|---|---|
| AP-01 | Assets | No disposal accounting (fields only) | Dispose → Dr Cash + Dr Accum Dep, Cr Asset, gain/loss to P&L | Disposal gain/loss unrecorded | **P1** | M | Voucher engine |
| AP-02 | Assets | Acquisition not auto-posted | Capitalize on add; register ↔ ledger linked | Register/ledger drift | **P1** | M | Voucher engine |
| AP-03 | Payroll | Generic salary: lump `deductions` | PF/ESI/TDS/PT engine + payable heads | Statutory non-compliance for staff | **P1** | L | Tax/statutory config |
| AP-04 | Payroll | No attendance/muster for generic employees | Attendance → salary tie-out | Wage ≠ attendance audit gap | **P1** | M | Employee model |
| AP-05 | Assets | Asset hard-deleted | Soft-delete parent (cascade already soft) | Property-register loss | **P1** | M | Persist model |
| AP-06 | Assets | Dep linked by narration string | `assetId` FK on dep voucher | Brittle cascade/audit chain | **P2** | M | Voucher schema |
| AP-07 | Assets | `marketValue` captured, not posted | Revaluation/impairment posting | Valuation not reflected | **P2** | M | Voucher engine |
| AP-08 | Payroll | Two disconnected payroll engines | Unify / clearly scope | Inconsistent rigor | **P2** | L | Refactor |
| AP-09 | Assets | Free-text depreciation rate | Statutory block/rate master | Rate errors | **P2** | S | Config |
| AP-10 | Governance | No capex/disposal approval gate | Committee approval | Control gap | **P2** | M | RBAC |
| AP-11 | Audit | Hard-delete/disposal → no trail | Append-only asset/disposal audit | Non-repudiation | **P2** | M | Audit log |

---

## Summary
Two genuinely strong engines anchor this area — the **depreciation library** (SLM + WDV with per-asset accumulated replay, ICAI AS-6, idempotent posting) and the **labour-cooperative payroll** (mercantile wage accrual, muster tie-out, and a configurable PF/ESI engine with ECR challan). The priority gaps are all **P1, no P0s**: **(AP-01)** asset disposal books no gain/loss, **(AP-02)** acquisition isn't auto-posted (register↔ledger drift), and **(AP-03/04)** the generic-employee salary path lacks a statutory-deduction engine and attendance tie-out — a rigor cliff vs the labour path. Parent hard-delete (AP-05) and narration-based linkage (AP-06) mirror recurring patterns from Sessions 2–4.

*End of Gap Analysis Session 5 — audit only; no code, no changes. STOP.*
