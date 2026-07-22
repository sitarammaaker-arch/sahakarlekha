# Payroll Partition Automation — Design (Sprint-1 T1.10)

- **Status:** Design only — build is a queued follow-up (no code this sprint)
- **Date:** 2026-07-21
- **Traceability:** Sprint-1 T1.10 · Phase-4 §107/§103 partitioning · reuse the existing `pg_cron` pattern

## What is partitioned

| Table | Partition key | Strategy |
|---|---|---|
| `pay_calc.payslip` | `period_month` (date) | RANGE, per financial year (`2026-04-01`→`2027-04-01`, …) |
| `pay_calc.payslip_line` | `period_month` (date) | RANGE, co-partitioned with `payslip` (composite FK) |
| `pay_audit.change_log` | `occurred_at` (timestamptz) | RANGE, per calendar year |
| `pay_audit.config_history` | `occurred_at` | RANGE, per calendar year |
| `pay_core.employment_event` | `occurred_at` | RANGE, per calendar year |

Each parent also has a **`default` partition** that catches any row outside the declared ranges.

## Problem

Phase-4 created only the initial partitions (`2026`, `2027`/`2026_27`, `2027_28`) plus a `default`.
Without automation, once time advances past the declared ranges every new row lands in the **default
partition** — which defeats partition pruning, bloats one partition, and makes retention/detach
impossible per period. New months/FYs must get their own partitions **ahead of time**.

## Design

### 1. An idempotent "ensure partitions" DB function

A `SECURITY DEFINER` function that, for each partitioned parent, creates the upcoming range
partitions if they do not already exist (`create table if not exists … partition of … for values …`).
Signature (to implement later — not written here):

```
pay_core.ensure_partitions(p_periods_ahead int default 2) returns void
```

- For date/FY-partitioned tables: ensure the current + next `p_periods_ahead` FYs exist.
- For time-partitioned WORM tables: ensure the current + next `p_periods_ahead` years exist.
- Idempotent (safe to run repeatedly); never touches existing partitions or data.
- Naming follows the Phase-4 convention (`<parent>_<period>`).

### 2. Scheduled execution (reuse the existing `pg_cron` pattern)

Schedule `ensure_partitions()` on `pg_cron` (as the scheduled-backup/rehearsal jobs already are),
e.g. **monthly**, well before any FY/period boundary. The cron schedule is tracked in a migration
(as the existing cron jobs are), and `cron.job_run_details` "succeeded" is **not** treated as proof —
a follow-up check asserts the expected partitions actually exist (prove-don't-assume).

### 3. Retention / detach (later)

Old partitions past the jurisdiction retention window are **detached** (not dropped) and handed to the
preservation pipeline (AIP/PDF-A), per Phase-17/18 archival. Retention windows are config, not
hardcoded. Detach is a separate, audited operation.

## Interim runbook (until automated)

Before a new financial year or calendar year begins, run the manual step:

```bash
# create the next FY / year partitions ahead of the boundary (idempotent)
node scripts/pay-apply.mjs <a small SQL adding the next period partitions>
```

A short "next-period partitions" SQL is prepared per boundary until `ensure_partitions()` +
`pg_cron` land. The **default partition is the safety net** — nothing is ever lost if a boundary is
missed; it just needs re-homing into the correct partition afterward.

## Non-goals

- No implementation this sprint (design + queued task only).
- No change to the Phase-4 partition keys or scheme.
