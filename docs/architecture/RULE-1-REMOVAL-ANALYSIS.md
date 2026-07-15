# RULE-1 Removal — Execute-Ready Analysis (T-09 acceptance)

**Status:** Analysis (read-only), 2026-07-15. Prepared while the T-09 ledger-read cutover soaks, so
the final acceptance can be executed with a correct map instead of a naive code-deletion.

**TL;DR — the single most important finding:** *RULE-1 removal is NOT "delete the rollback code after
the soak."* Two hard facts below make it a **scoped, architecturally-gated change**, and most of the
RULE-1 machinery is **load-bearing forever** under the current design. Read this before touching a
single `onBaseFail`.

---

## 1. What "RULE-1 removal" was assumed to be

The event-ledger arc's acceptance (ADR-0001 / BUILD-ORDER T-09) is stated as: *"ledger authoritative;
RULE-1 failure class retired; optimistic-rollback code removed."* The natural reading — "once every
tenant reads from the journal and the soak is clean, delete `persistVoucher`'s two-step + `onBaseFail`
reverts and the destructive toasts" — **is wrong on its own.** Here's why.

---

## 2. Fact A — the journal is a SHADOW of the table write, not the write itself

Current voucher write path (`addVoucher` → `persistVoucher`, `DataContext.tsx:1428`):

1. Build voucher, apply **optimistic** local update (`vouchersRef` + `setVouchersState`).
2. `persistVoucher` writes to the **`vouchers` TABLE** — two-step: base upsert → verify-read → extras patch.
3. The ledger event is appended to `ledger_events` **only in `onBaseSuccess`** — i.e. AFTER the table
   row is confirmed durable. It is best-effort/shadow (`persistLedgerEvent`, try/catch, dropped on rollback).
4. On base failure → `onBaseFail()` rolls local state back + a destructive "cloud par save NAHI hua" toast.

So the **`vouchers` table is still the authoritative write target**; the journal is a *projection of a
successful table write*. Reads were cut to the journal (T-09), but **writes were not.**

**Consequence:** if the `vouchers` table write fails, the optimistic local voucher is still in state
AND the journal event was never appended (it is gated on `onBaseSuccess`). On F5 both the table and the
journal have nothing → the voucher is lost → **exactly the RULE-1 divergence.** The rollback is *still
necessary*. Soak completing does not change this — soak proves *reads* are faithful, not that *writes*
are journal-first.

> **Prerequisite for removing the voucher rollback:** writes must become **journal-first** — append the
> event to `ledger_events` as the authoritative save, then project it into the `vouchers` table + local
> state. Only when a durable journal append *is* the save does a `vouchers`-table write failure stop
> being a divergence (the table becomes a rebuildable projection). **This refactor does not exist yet.**
> It is the real gate, on top of the soak.

---

## 3. Fact B — the journal only holds VOUCHER + ACCOUNT events

`ledger_events` carries `voucher.posted / cancelled / reversed / reposted` and `account.opening`
(+ opening deltas). It does **not** carry members, share-capital scalars, deposits, loans, stock,
payroll, master data, or `society_settings`.

Those entities each have their **own** optimistic-write + RULE-1 rollback machinery, independent of the
ledger — e.g.:

| Site (`DataContext.tsx`) | Entity | Journal-projected? |
|---|---|---|
| `persistVoucher` + `addVoucher`/`updateVoucher` (`1428/1675/1937`) | vouchers | ✅ yes |
| `refundShareCapital` / `buyAdditionalShares` (`2474/2490`) | voucher + `member.shareCapital` scalar | voucher yes; **scalar NO** |
| `transferShares` rollback (`2794`) | member share scalars | ❌ no |
| `approveMember` reverts + auto-voucher (`3211/3228/3240/3256`) | member + vouchers | member **NO**; voucher yes |
| `mergeAccounts` `rollbackMerge` (`3441`) | accounts/suppliers/customers re-point | ❌ no |
| `society_settings` optimistic + rollback (`3478`) | society config | ❌ no |
| muster allocation snapshot (`3189`) | muster/wage records | ❌ no |
| Housing flats / Labour work-orders (`3008/3009`, member-pattern) | master data | ❌ no |

**Consequence:** even with a perfect journal-first voucher write, **every ❌ row above keeps its RULE-1
rollback forever** (or until each gets its own event-sourced write path — which is out of scope for
T-09). The ledger cutover retires the RULE-1 *failure class* only for the **voucher-posting path**.

---

## 4. What "removal" actually means, scoped correctly

After (a) soak clean AND (b) the journal-first-write refactor for vouchers:

**Safe to remove — voucher path only:**
- `persistVoucher`'s `onBaseFail` local-state revert + the destructive "cloud par save NAHI hua" toast,
  IF the write is now journal-first (a durable event append is the save; the `vouchers` row is a
  projection rebuilt from the journal, so its write failing is recoverable, not lost work).
- The two-step base/extras split *may* stay as the projection-write mechanism, but its **rollback**
  semantics become unnecessary.
- The optimistic-then-revert wrappers at `addVoucher:1675` / `updateVoucher:1937` / the auto-voucher
  callers (`2474/2490/3228/3240`).

**Must stay (load-bearing) — not journal-projected:**
- All ❌ rows in §3: share-capital scalars, member records, `mergeAccounts`, `society_settings`, muster,
  housing/labour masters, deposits, loans, stock. Their local↔Supabase divergence is real and the
  journal does not cover them.

**So CLAUDE.md RULE 1 does NOT get deleted** — it narrows: "the ledger is the system of record **for
vouchers**; voucher writes are journal-first and cannot silently diverge. For all non-journaled
entities, the optimistic-write + rollback pattern remains mandatory."

---

## 5. Execute plan (in order)

1. **[gate] Soak clean** — all tenants read every statement from the journal, parity ✓ (in progress).
2. **[build] Journal-first voucher writes** — the real architectural work:
   - `addVoucher`/`updateVoucher`/cancel/reverse append the event to `ledger_events` FIRST (authoritative,
     with its own failure→rollback of the *optimistic UI* only), then project into the `vouchers` table
     + state as a best-effort rebuildable cache.
   - Prove: kill the `vouchers`-table write mid-flight → the voucher survives F5 (rebuilt from the journal).
   - This is a T-09-sized slice of its own; do NOT fold it into "removal".
3. **[remove] Voucher rollback machinery** — only the voucher-path sites in §4, once step 2 proves the
   table is a projection. Keep every non-journaled site.
4. **[docs] Narrow CLAUDE.md RULE 1** per §4 — do not delete it.

---

## 6. Recommendation

The honest status: **T-09's read cutover is done + soaking, but the acceptance's "remove optimistic-
rollback code" is gated on an unbuilt journal-first-WRITE refactor, and even then only retires the
voucher-path RULE-1 — not the pattern across members/shares/masters/settings.** Treat step 2 as the
next real ledger slice after soak, not as cleanup. Until it lands, **every RULE-1 rollback in
DataContext is load-bearing and must not be removed.**
