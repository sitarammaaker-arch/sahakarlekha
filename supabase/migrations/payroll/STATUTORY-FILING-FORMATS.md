# Payroll — Statutory Filing Formats (SSOT)

This is the **format** of every statutory return SahakarLekha payroll can produce.
It is the layout spec only. **Values come from the run; authoritative RATES and the
final FORMAT confirmation are the admin's** (Act / circular / current portal spec) —
the engine never guesses a statutory number. This mirrors the editable-rates rule:
I build the mechanism, the admin owns the sourced values.

> ⚠️ Portal specs change. Each generated file says "confirm against the CURRENT
> portal spec before upload." Treat the layouts below as *documented defaults*, not
> a substitute for the live EPFO / Income-Tax / State-PT specification.

Legend for "Source" column: the payslip figure or setting that fills the field.

---

## 1. PF — EPFO ECR (Electronic Challan cum Return)

**File:** plain text, one line per member, fields separated by `#~#`, lines by `\n`.
Upload: EPFO Unified Portal → ECR → Upload. **Format ref:** EPFO ECR file format
(v2.0). Employer/EPS/EDLI split rates are **editable-sourced settings** (below).

| # | Field | Source |
|---|-------|--------|
| 1 | UAN (12 digit) | `statutory_identity.uan` |
| 2 | Member name | `employee.full_name` |
| 3 | Gross wages | payslip gross earnings |
| 4 | EPF wages | BASIC (+DA if applicable) |
| 5 | EPS wages | min(EPF wages, `eps_wage_ceiling`) |
| 6 | EDLI wages | min(EPF wages, `eps_wage_ceiling`) |
| 7 | EPF contribution remitted | EPF-wages × `pf_rate`/100 (the employee PF the run computed) |
| 8 | EPS contribution remitted | EPS-wages × `eps_rate`/100 |
| 9 | EPF-EPS diff remitted (employer) | field 7 − field 8 |
| 10 | NCP days (non-contributory) | attendance LOP days |
| 11 | Refund of advances | 0 (not modelled) |

**Editable-sourced rates it needs** (`pay_config.statutory_setting`):
`pf_rate` (12, employee), `employer_pf_rate` (12, employer total → split into EPS + EPF),
`eps_rate` (8.33), `edli_rate` (0.5), `eps_wage_ceiling` (15000). Field 7 uses the
employee rate (the PF deducted); fields 8–9 use the employer rate — the two are
independent statutory numbers, each admin-owned.

---

## 2. ESI — Contribution (MC) return

**File:** CSV / portal upload. **Ref:** ESIC portal monthly contribution format.
Fields per Insured Person (IP). *Fills in once an ESI component is added to the
structure (rates already editable-sourced).* 

| # | Field | Source |
|---|-------|--------|
| 1 | IP number | `statutory_identity.esic_ip` |
| 2 | IP name | `employee.full_name` |
| 3 | No. of days | attendance paid days |
| 4 | Total monthly wages | payslip gross (ESI-wage rules apply) |
| 5 | IP contribution | wages × `esi_employee_rate`/100 |
| 6 | Reason code (if 0) | manual |

Rates: `esi_employee_rate` (0.75), `esi_employer_rate` (3.25),
`esi_wage_ceiling` (21000) — editable-sourced.

---

## 3. TDS on Salary — Form 24Q (quarterly)

**Filed via** NSDL RPU → FVU (a validated file, NOT free text). SahakarLekha
produces the **Annexure data as CSV** that feeds the RPU; it does not fabricate the
FVU binary. **Ref:** Income-Tax Form 24Q, Annexure I (every quarter) + II (Q4).

Annexure I (deductee-wise, per employee, per quarter):

| # | Field | Source |
|---|-------|--------|
| 1 | PAN | `statutory_identity.pan` |
| 2 | Employee name | `employee.full_name` |
| 3 | Amount paid / credited | gross for the quarter |
| 4 | TDS deducted | TDS component (once added) |
| 5 | Section | 192 |
| 6 | Date of payment / deduction | run pay date |

*Fills in once a TDS component is added; the tax-engine gap is tracked separately
([[tier0-tax-rules-gap]] — do not guess slabs).* 

---

## 4. Professional Tax (PT) — state return

State-specific (slabs differ per state). **Ref:** the society's State PT Act
schedule. Register format:

| # | Field | Source |
|---|-------|--------|
| 1 | Employee name / code | employee |
| 2 | Gross wages | payslip gross |
| 3 | PT deducted | PT component (slab-driven; state schedule) |

Slabs are **not** hard-coded — they are the state's schedule, entered as sourced
settings when the PT component is added.

---

## Universal Statutory Register (always available)

Independent of any portal: one CSV row per employee for a run, with every statutory
figure the four returns above draw from (UAN / PAN / IP + PF / ESI / TDS / PT +
wages + LOP). This is the safe, portal-agnostic feed and is generated today; the
per-portal files (ECR text, 24Q CSV) are formatting layers on top of it.

---

### What is live today

- **PF ECR** — end-to-end (PF is computed; UAN captured; employer split via
  editable-sourced rates). ✅
- **Universal Statutory Register CSV** — end-to-end. ✅
- **ESI / TDS / PT** — format defined; the register carries their columns; the
  values fill in when each component is added to the salary structure with its
  own sourced rate. The format does not change — only the numbers arrive.
