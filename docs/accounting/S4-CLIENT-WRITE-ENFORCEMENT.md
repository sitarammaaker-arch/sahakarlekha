# S4: the database enforces server posting

> Status: **S4-0 LIVE** (102). **S4-a LIVE** for rows 1–6 (103, applied 2026-10-03 14:11 UTC); row 7 built (104, awaiting apply). S4-b: after the S4-0 week (ends 2026-10-10). S4-c: SSK decision.
> Goal: for a society whose posting service is ON, the database itself refuses any direct client write
> to the accounting tables. Today server posting is authoritative only because the client takes that path.

## 1. Facts (prod, read-only, 2026-10-03)
- `society_flags.posting_service` is ON for **26 of 27** societies. The one OFF (SSK, `d0dd474f`) has 3 vouchers, the last in 2026-07. New societies start ON (089).
- RLS lets any writer of the society INSERT/UPDATE `vouchers` and INSERT `ledger_events`. `voucher_entries` is `society_rw FOR ALL`.
- The server functions that post are `SECURITY DEFINER`, owned by `postgres`, with `rolbypassrls = true`: `post_voucher`, `edit_voucher`, `cancel_voucher`, `approve_voucher`, `post_stock_document`, `update_stock_document`, `cancel_stock_document`, `close_financial_year`. No accounting table has `FORCE ROW LEVEL SECURITY`.
  **⇒ A restrictive RLS policy for clients cannot break these functions.**
- Edge functions (pay-*, restore-commit, scheduled-backup) use the service role and also bypass RLS.

## 2. Inventory: client writes that still run when the flag is ON
Mapped by reading `src/contexts/DataContext.tsx` on `main` (flag-off fallbacks excluded). S4-0 measures it.

| # | Function | Table / write | Kind | Server path today |
|---|---|---|---|---|
| 1 | `reverseVoucher` | `vouchers` UPDATE `reversalOf` / `reversedBy` (links, after `addVoucher` posts the contra via the server) | link metadata | none |
| 2 | `clearVoucher` / `unclearVoucher` | `vouchers` UPDATE `isCleared`, `clearedDate` | bank-reco status, non-financial | none |
| 3 | `rejectVoucher` | `vouchers` UPDATE `approvalStatus='rejected'` … + `voucher_entries` DELETE | pending voucher → rejected | none (approve has `approve_voucher`) |
| 4 | `mergeAccounts` | `vouchers` UPSERT (rewrites account ids on every affected voucher) + `voucher_entries` sync | **financial rewrite, client-side** | none |
| 5 | `addAccount` / `updateAccount` (opening balance) | `ledger_events` INSERT (opening delta event via `persistLedgerEvent`) | journal write | none |
| 6 | `persistLedgerEvent` callers (shadow appends, approval/cancel/edit repair helpers) | `ledger_events` INSERT | journal write | mostly flag-off; must be proven unreachable when ON |

| 7 | `addVoucher` / `updateVoucher` for a **pending** (maker-checker) voucher | `vouchers` UPSERT (+ entries) | create/edit before approval | `save_pending_voucher` (104) | found while building S4-a; usage is tiny (3 pending vouchers ever, last 2026-07) |

**Found while building S4-a, row 1:** with the flag ON, `reverseVoucher`'s two direct link updates ran right after `addVoucher` returned, *before* `post_voucher` had written the reversal row. The update could hit 0 rows and link nothing, silently. In prod, 1 of 2 reversals ever made (2026-08-23) is missing its `reversalOf`. S4-a links only after the server confirms (`onPersisted`).

Anything not in this table that writes `vouchers` / `voucher_entries` / `ledger_events` while the flag is ON is a bug, and S4-b will surface it as a refused write in `error_log`.

## 3. Plan (dependency-safe; each step on the harness, then staging, then prod with backup + undo)

**S4-0: observe first, change nothing.** An `AFTER INSERT OR UPDATE OR DELETE` trigger on the three tables writes one `error_log` row (source `s4-direct-write`, table, op, society) when `current_user = 'authenticated'` and the society's flag is ON. The posting functions run as `postgres`, so they are not logged. A week of these rows is the exact, measured inventory: it confirms §2 and catches anything the code reading missed. It is read-only for the books, and the down file drops the trigger.

**S4-a: give every row in §2 a server path** (one migration + client switch per row, behind the existing flag):

| Row | New server function | Notes |
|---|---|---|
| 1 | `reverse_voucher(p_id, p_reason)` | posts the contra AND sets both links in one transaction (today it takes 3 client round trips) |
| 2 | `set_voucher_cleared(p_id, p_cleared, p_date)` | touches only the two columns; refuses a cancelled voucher |
| 3 | `reject_voucher(p_id, p_by, p_reason)` | pending only; no journal event (a pending voucher never posted) |
| 4 | `merge_accounts(p_keep, p_remove)` | one transaction: rewrite legs, voucher_entries and the journal via reversal + repost events, audit row; refuses across societies |
| 5 | `set_opening_balance(p_account, p_minor, p_side)` | writes the account and its opening delta event together |
| 6 | (no new fn) | prove each `persistLedgerEvent` caller is flag-off only, or route it through 1–5 |

**S4-b: restrictive RLS**, one migration, after S4-a is live and the S4-0 trigger has logged no direct writes for 7 days:

```sql
-- for authenticated clients only; SECURITY DEFINER posting fns and the service role bypass RLS
create policy s4_no_direct_write on public.vouchers as restrictive for insert to authenticated
  with check (not public.posting_service_on(society_id));
-- + update/delete on vouchers, all writes on voucher_entries and ledger_events
```
`posting_service_on(sid)` is a STABLE SECURITY DEFINER helper reading `society_flags`. Down file: drop the policies.

**S4-c: SSK.** Either turn its flag ON (posting-readiness → heal → flip, the B2 rule), or leave it as the single legacy society documented as such.

## 4. Tests
- **Harness (prod dump):** for an ON society, a direct INSERT/UPDATE/DELETE on each table as an S1 writer is refused (42501), while `post_voucher`, `edit_voucher`, `cancel_voucher`, `approve_voucher` and every new S4-a function succeed. An OFF society is unaffected. Run a6 (469) again.
- **E2E on staging:** voucher persist / cancel / approve / reject / reverse / clear / merge / opening balance all succeed with S4-b applied.
- **Drift:** `ledger_drift()` stays 0 before and after.

## 5. Risk
- A missed client path becomes a **refused save**, not silent corruption. RULE 1 rollback and the destructive toast already handle a refused write. S4-b is applied only after the S4-0 trigger shows a 7-day zero-direct-write window.
- Undo: drop the S4-b policies (one statement per table).
