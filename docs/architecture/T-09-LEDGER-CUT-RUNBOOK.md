# T-09 — Ledger Read-Cut Finale Runbook

**Purpose.** Everything needed to finish T-09 (ADR-0001) — cut the remaining financial reads to the
event journal, flip tenants safely, and retire the RULE-1 optimistic-rollback code. Written so a
fresh, focused session can pick this up with zero context loss. Financial-critical — **do not rush.**

---

## 1. Where T-09 already is (all shipped, DORMANT)

The journal is faithful and validated: live-path lifecycle events (post/reverse/cancel/edit), genesis
backfill, opening balances, all seeded; **13/13 tenants parity ✓** (2026-07-14). Migrations 036/037
applied. Pure engine + these reads are cut behind the per-tenant flag `society.ledgerReadsEnabled`
(default false) with a runtime `ledgerParity` fallback:

| Read | How it's cut | Safety net |
|---|---|---|
| `getTrialBalance` | direct — `ledgerTrialBalance(journal, accounts, asOf)` when flag+parity | `ledgerParity` (validates TB directly) ✅ |
| `getTradingAccount` | **transitive** — derives from `getTrialBalance` | inherits TB parity ✅ |
| `getProfitLoss` | **transitive** — derives from `getTrialBalance` + `getTradingAccount` | inherits TB parity ✅ |
| `getAccountBalance` | `ledgerBalanceMinorMap` memo (parity once, O(1) preserved) | `ledgerParity` ✅ |

On a flip, the trial balance, trading a/c, P&L, and every per-account balance already ride the ledger.

**Pure pieces available:** `projectTrialBalance`, `projectSplitTrialBalance`, `projectAccountLedger`,
`ledgerTrialBalance`, `balancesFromJournal`/`balancesFromVouchers`, `ledgerParity`, genesis/openings.
Ops: `backfill-genesis-ledger.mjs`, `check-ledger-parity.mjs`, `diagnose-ledger-parity.mjs`.

---

## 2. The remaining read cuts — and the safety GAP to close first

`getReceiptsPayments` and the ledgers (`getCashBookEntries`, `getBankBookEntries`, `getMemberLedger`)
are **not** derivable from the trial balance, so each needs its own projection. Critically, the
`getTrialBalance` gate's `ledgerParity` only validates the **trial balance** — it does **not** catch a
bug in an R&P or ledger projection. So before flipping any tenant onto these, **each needs its own
per-report parity check** (ledger-projected vs voucher-computed), or a subtle divergence ships wrong
statutory numbers unnoticed (the RULE-1 class this arc exists to kill).

### 2a. `getReceiptsPayments` (highest risk)
Cash-basis statement (NCDC Annexure VII) that, per voucher touching Cash/Bank, books the **non-cash
counterparty** once as a receipt/payment, classified **capital vs revenue** by account
`type`/`subtype`/`parentId` (see `CAPITAL_PARENTS`/`CAPITAL_SUBTYPES` in the current impl).
- **Projection approach:** `projectReceiptsPayments(events, accounts, asOf?)` — iterate posting events;
  for each, use `payload.lines`; if any leg is Cash/Bank, book each non-cash counterparty leg ONCE
  (replicate the "book once per voucher" fix), classified via the same `natureOf`/`glTypeOf` helpers.
  Openings feed `openingCash`/`openingBank` from `account.opening` events (or accounts, as today).
- **Risk:** the capital/revenue + counterparty-once logic must match EXACTLY. Extract the classifier
  into a pure shared helper and have BOTH `getReceiptsPayments` and the projection use it, so they
  cannot diverge (RULE 2 — one formula).

### 2b. The ledgers (`getCashBookEntries` / `getBankBookEntries` / `getMemberLedger`)
Running-balance khata for one account. `projectAccountLedger(events, accountId, asOf)` already gives
`{eventId, occurredAt, drMinor, crMinor, runningMinor}`. The report rows also need **voucherNo** and
**particulars** (the contra account name) — carry `voucherNo` in the payload (already present) and
derive particulars from the event's other legs + the accounts list.
- **Projection approach:** a thin mapper over `projectAccountLedger` that joins voucherNo/particulars.
- **Risk:** lower than R&P (running balance is well-tested), but particulars formatting must match.

### 2c. Per-report parity (the gap to close)
Add, alongside `ledgerParity`, a `reportParity` per statement — e.g. compare
`projectReceiptsPayments(journal, accounts)` to the current `getReceiptsPayments()` result, and each
ledger's projected rows to the computed rows. Extend `check-ledger-parity.mjs` to run these per
tenant. **A tenant is only safe to flip once TB parity AND every report parity shows ✓.**

---

## 3. Pilot-flip runbook (per tenant)

Do NOT flip all tenants at once. One pilot, verify, soak, then roll out.

1. **Pre-flight (read-only):** `node scripts/check-ledger-parity.mjs` → the pilot society must show ✓
   (and, once §2c lands, its report parities too).
2. **Flip the pilot:**
   ```sql
   update society_settings set "ledgerReadsEnabled" = true where society_id = '<pilot-society-id>';
   ```
3. **Verify in-app:** open Trial Balance, Trading A/c, P&L, Balance Sheet, a few account ledgers, R&P.
   Numbers must be identical to before the flip (the reads now come from the journal). Because the TB
   gate falls back on any parity miss, a wrong number means a real projection gap — investigate, don't
   paper over.
4. **Soak** (days). Watch for any report discrepancy or error.
5. **Instant revert** if anything looks off:
   ```sql
   update society_settings set "ledgerReadsEnabled" = false where society_id = '<pilot-society-id>';
   ```
6. **Roll out** to the rest once the pilot is clean, a few tenants at a time.

**Reactivity note:** the journal loads into `ledgerEventsRef` on society load (gated on the flag), and
`getTrialBalance`/`getAccountBalance` read it at call time. If a memoized consumer shows a stale value
right after flip-time load, move the journal into React state (a `ledgerEvents` state + ref pair,
updating the ~5 append/remove sites) so the memos recompute reactively. The parity fallback keeps any
stale read correct (voucher-state) in the meantime.

---

## 4. RULE-1 removal (the acceptance — LAST, after full soak)

Once **all** reads are cut and **all** tenants are flipped and soaked, the ledger is authoritative and
the RULE-1 optimistic-rollback machinery is unreachable. Retire it:
- The `persistVoucher` two-step + `onBaseFail` local-state reverts, and the destructive "Cloud save
  failed" toast path (the whole RULE-1 pattern in `DataContext`), become dead once state is a pure
  projection of the journal. Remove them **only** when nothing can diverge (writes append to the
  journal first; reads project from it).
- Update `CLAUDE.md` RULE 1 to reflect that the ledger is the system of record.
- **Acceptance (ADR-0001 / blueprint T-09):** ledger authoritative; RULE-1 failure class retired;
  optimistic-rollback code removed.

Keep this reversible behind the per-tenant flag until the removal is proven across all tenants.

---

## 5. Suggested slice order for the finale session

1. `getCashBookEntries`/`getBankBookEntries` cut (lower risk; `projectAccountLedger` exists) + parity.
2. `getMemberLedger` cut + parity.
3. `getReceiptsPayments` cut — extract the shared capital/revenue classifier first (RULE 2) + parity.
4. Extend `check-ledger-parity.mjs` with the per-report parities (§2c).
5. Pilot flip → soak → rollout (§3).
6. RULE-1 removal (§4).

All prior pure pieces + TB/Trading/P&L/balance cuts are done and tested. See the `event-ledger-arc`
memory for commit-level history.
