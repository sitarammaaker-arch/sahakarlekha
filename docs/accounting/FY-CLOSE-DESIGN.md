# Financial-year close: design (Phase-2 C2–C8)

Status: **proposed, needs founder decisions D1–D5** (2026-10-01). Builds on 090 (rollover; previous year
stays `closing` — decision (अ)).

## 1. How the books work today (verified in code and the prod catalog)

| Fact | Evidence |
|---|---|
| Every year's vouchers are loaded and kept | `DataContext` loads all `vouchers` (no FY filter) |
| Trial balance is **cumulative from the start**: static `accounts.openingBalance` (go-live) + every voucher ≤ the as-of date. There is no FY-start cut. | `getTrialBalance(asOnDate)` |
| Income & Expenditure / Trading = TB as of the FY end, so it is **also cumulative across years** | `getProfitLoss` → `getTrialBalance(fyEnd)` |
| Trading opening stock = the **static** opening debit of the stock accounts | `getTradingAccount` (`openingStockItems` from `openingDebit`) |
| "Close FY" = only `fyLocked = true`. No closing entries, no `financial_years` status change. | `closeFinancialYear` |
| Rollover snapshot (`previousYearBalances`) is a frozen copy used for last-year columns; the OpeningBalances "Carry Forward" button overwrites `accounts.openingBalance` with last year's closing | `SocietySetup.handleRolloverFY`, `OpeningBalances.tsx` |
| `computeYearClose` / `openingBalanceLines` (pure, tested) exist with **zero callers** | `src/lib/rules/yearClose.ts` |

**Consequence:** as soon as a society keeps two years of vouchers in the app, this year's I&E also counts
last year's income and expenses. Prod today: **Bacher** has 50 live 2024-25 vouchers inside its 2025-26
year, so its 2025-26 I&E includes 2024-25. Its balance sheet is right, because it is cumulative and the
openings are 0. A society that **also** used "Carry Forward" while keeping the old vouchers would count
the old year twice. No society does today. Assandh rolled over without keeping 2025-26 vouchers.

## 2. Recommended model (D1): one continuous ledger + a year-transfer entry

Keep every year's vouchers (the audit trail), never re-type openings, and close the year with **one
server-posted journal**:

- **Year-transfer entry**, posted by the server, dated the **first day of the new year** (1 April),
  `refType = 'fy.close'`:
  - it zeroes every income/expense account of the closed year;
  - it moves the net to **Net Surplus/(Deficit) 1208** (D2);
  - Dr/Cr are built by the existing `computeYearClose` (Σ = 0).
- **Why the date is 1 April:** the closed year's statements (as of 31 March) do not see it. From 1 April
  on, the income/expense accounts start at zero and 1208 carries the accumulated result. So the
  **existing cumulative reports become correct for every year without being rewritten.** The balance
  sheet is unaffected, because the entry only moves balances between equity and nominal accounts.
- **Appropriation (T-20)** then distributes from 1208 under the AGM resolution, as the code already intends.
- **Stock (D3):**
  - At close, the closing stock value of the year (THE formula: `lib/tradingAccount.closingStock`) is
    frozen into the year-transfer entry as Dr Stock-in-hand / Cr Trading (closing stock).
  - Next year's **opening stock = the stock account's balance on 1 April** (instead of the static go-live
    opening), so Trading opening stock = last year's closing stock automatically.
- **No manual Carry Forward after go-live:** the OpeningBalances "Carry Forward" button is limited to the
  society's FIRST year. Otherwise it would double count.

The alternative (D1-b: "fresh books each year", deleting or archiving old vouchers and re-entering
openings) loses the audit trail and the multi-year reports. **Not recommended.**

## 3. The close itself (C2–C4): server function `close_financial_year(fy_id)`

1. **Who:** an admin with a verified session (085). Optionally a board-resolution reference (D4;
   `fyCloseAuthorityRequired` exists).
2. **Checks (refuse with a Hindi reason if any fails):**
   - the year is `closing` (rolled over) — closing an `open` year is not allowed;
   - no pending or rejected-but-posted vouchers dated in the year;
   - parity is zero for the society (readiness check: vouchers = journal = entries = lines);
   - the trial balance as of the year end balances;
   - closing stock is computed (trading societies).
3. **Writes, in one transaction:**
   - the year-transfer voucher + lines + entries + journal event (same path as `post_voucher`);
   - `financial_years.status = 'closed'`, `net_result_minor`, `closed_at` / `closed_by`, `opening_event_id`;
   - an audit log row.
4. **After close:** every server posting function refuses the year (only `open`/`closing` are postable —
   already true). A correction is a **new voucher in the open year** (prior-period item), never an edit
   in the closed year.
5. **Audit (C later):** `closed → audited` with `audited_at` / `audit_reference`; `audited` is final.

## 4. Verification (C7/C8, harness)

- Opening (1 April) of year N+1 = closing (31 March) of year N, per account, to the paisa.
- The year-N I&E is unchanged by the close; the year-N+1 I&E starts at zero.
- Balance-sheet totals unchanged across the close.
- Re-run refused; undo restores; a closed year refuses post/edit/cancel.

## 5. Decisions needed

| # | Question | Recommendation |
|---|---|---|
| D1 | Continuous ledger with a year-transfer entry, vs fresh books each year | Continuous ledger |
| D2 | Where the year's surplus/deficit goes at close | 1208 Net Surplus/(Deficit), then appropriation under the AGM |
| D3 | Closing stock: freeze into the ledger at close, and take next year's opening stock from the stock account | Yes |
| D4 | Require a board-resolution reference to close a year | Yes (the flag exists; make it the default for closing) |
| D5 | Bacher: post the 2024-25 year-transfer (dated 1 Apr 2025) so its 2025-26 I&E stops including 2024-25 | Yes, after Bacher's admin confirms its 2024-25 figures |
