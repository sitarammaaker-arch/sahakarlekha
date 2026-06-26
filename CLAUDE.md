# SahakarLekha — Project Rules for Claude

This file is read by Claude on every session. **The rules here are mandatory** and
must be applied to every code change, not just the immediate task.

---

## GOVERNING DOCUMENTS (read before non-trivial work)

These define the product's law and workflow. The RULES below (RULE 1–8) are the
data-integrity and encoding subset; the Constitution generalises them.

- **[CONSTITUTION.md](CONSTITUTION.md)** — Product Constitution SSOT v1.0. Supreme
  law: vision, principles, Product Laws **L1–L14**, Decision Framework, and the
  **Claude Code Operating Rules** (Appendix C) — run that pre-flight checklist
  before implementing anything. RULES 1–8 here map to Laws L1–L6/L11/L12.
- **[DELIVERY-FRAMEWORK.md](DELIVERY-FRAMEWORK.md)** — how every feature ships:
  classify (T0–T4 + modifiers) → gates G0–G4. Data-integrity-touching changes
  (save/report/delete/inventory) carry the most-enforced modifier.
- **[PRODUCT-AUDIT-2026-06.md](PRODUCT-AUDIT-2026-06.md)** — 2026-06-26 codebase
  audit vs. the above; prioritized backlog (P0–P3) and roadmap. **Phase 0
  (data-integrity remediation: L1 rollback, L5 FY-guard, L3 cascades) is the
  approved active priority.** Re-verify file:line cites before acting.

---

## RULE 1 — Local state must NEVER diverge silently from Supabase

This is the most important invariant in the project.

The app keeps every entity in React state AND in Supabase. The bug pattern we
have hit repeatedly:

1. User submits a new voucher / member / loan / etc.
2. Local state updates immediately (optimistic) → UI shows the new row.
3. Supabase upsert fires asynchronously.
4. Supabase upsert FAILS (schema cache miss, unknown column, network).
5. The failure was logged to console (or shown briefly in a toast the user
   missed). Local state is **never rolled back.**
6. User hits **F5**. Local state is wiped. Supabase had nothing. Voucher gone.

The user calls this "लोकल में सेव हो रहा है, Supabase में नहीं" and loses real
work. We must prevent this on every save path.

### The required pattern for every `add*` / `update*` function

```ts
// 1. Build the new/updated entity locally.
// 2. Apply optimistic update to ref + state.
// 3. Call Supabase with the TWO-STEP pattern:
//      - Step 1: upsert ONLY base columns (these always exist).
//      - Step 2: .update() the late-added columns (lines, refType, salesAccountId,
//        editHistory, etc.) — these may fail without losing the row.
// 4. On step 1 FAILURE → revert local state (remove the new row, or restore the
//    previous version on update) AND show a destructive toast with a clear
//    description ("Cloud save failed — refresh karne par data lose nahi hoga").
//    Duration ≥ 10s.
// 5. On step 2 failure → show a milder warning ("Saved partially, run migration")
//    but DO NOT roll back. The base row is safe.
```

For vouchers, use `persistVoucher(voucher, { isUpdate, onBaseFail })` —
implemented at the top of `DataContext.tsx`. For other entities, use the same
pattern inline (or create a sibling helper if you're adding ≥ 3 paths).

### When adding a new column to a TypeScript type

1. Add it to `supabase-tables.sql` with `alter table X add column if not exists`.
2. Tell the user (in chat) that they MUST run the migration in Supabase SQL Editor.
3. In the save function, put the column in the **Step 2 / extras** bucket so the
   base upsert still succeeds even before the user runs the migration.

### Forbidden patterns

- ❌ Optimistic local update + async Supabase + no rollback on error.
- ❌ Silent `console.warn` on a Supabase error that the user needs to see.
- ❌ Upserting an object that includes columns the base table does not have, in
  a single call (this is the "schema cache" failure).
- ❌ Suppressing the destructive toast on schema-cache misses ("we'll show a
  mild warning instead") — local state must be rolled back so the user
  immediately sees that the entry didn't save.

---

## RULE 2 — Reports must use the same formula as the underlying state

When we compute closing stock, opening balance, or any other aggregate, three
places typically need to match:

- The **state field** on the entity (e.g. `stockItem.currentStock`).
- The **per-page report** (e.g. Inventory page's `computedStockMap`).
- The **aggregator** (e.g. `getTradingAccount().physicalClosingStock`).

If you change one, audit the other two. Mixing `currentStock` field with
`openingStock + sum(movements)` formula caused the phantom ₹1,12,500 Trading
Account bug.

The canonical stock formula is:

```ts
let qty = item.openingStock || 0;
for (const m of stockMovements) {
  if (m.itemId !== item.id) continue;
  if (m.type === 'purchase' || (m.type === 'adjustment' && m.qty > 0)) qty += m.qty;
  else qty -= Math.abs(m.qty);
}
qty = Math.max(0, qty);
```

---

## RULE 3 — Cascade everything when a parent record is deleted/edited

When you delete or edit a sale, purchase, salary record, member, etc., remember
the full set of dependents:

- The parent table row (`sales`, `purchases`, `salary_records`, etc.).
- The linked voucher(s) (soft-cancel via `isDeleted = true` + `cancelVoucher`-equivalent).
- The `voucher_entries` rows for those vouchers (`deleteEntries(vid)`).
- Inventory: `stock_items.currentStock` AND `stock_movements` rows (delete by
  `referenceNo === purchaseNo/saleNo`).
- Sub-ledger accounts: don't hard-delete an account that historical vouchers
  reference — rename it to `"<name> [Supplier deleted]"` instead, so audits
  still tie out.

If you forget any of these, ghost balances and orphan rows leak into reports.

---

## RULE 4 — Per-item ledger routing for stock-related vouchers

Sales and purchases must group items by their `salesAccountId` /
`purchaseAccountId` and emit one Cr / Dr line per account. Default to `'4101'` /
`'5101'` when unset. This is what makes Trial Balance / Trading A/c / I&E show
per-category lines (Fertilizer Sales, Consumer Goods Sales, etc.) instead of
one lumped account.

---

## RULE 5 — `isDeleted` filtering and orphan-link rules

- All financial computations use `activeVouchers = vouchers.filter(v => !v.isDeleted)`.
- Soft-deleted vouchers MUST be excluded from `getTrialBalance`, `getProfitLoss`,
  `getTradingAccount`, `getReceiptsPayments`, every report page.
- `getEntityLinks(...)` blocking checks must filter out orphan refs (parent
  already deleted) and soft-deleted vouchers, otherwise the user can't delete
  an item that has no live dependencies.

---

## RULE 6 — FY-locked guard on every mutation

Every state-changing function (add/update/delete/approve/reject) must check
`society.fyLocked` at the top and bail out with a destructive toast if true.
Read-only functions don't need this. The check is one line:

```ts
if (society.fyLocked) {
  toastRef.current({ title: 'FY Locked', description: 'Cannot modify data while Financial Year is audit-locked.', variant: 'destructive' });
  return;
}
```

---

## RULE 7 — Hindi-first, plain English fallback

User communicates primarily in Hindi (often Hinglish / Devanagari mixed).
Toasts, error descriptions, and audit-log narrations should be friendly Hindi
or Hinglish first, plain English second. Code comments stay English.

---

## RULE 8 — Encoding when editing this codebase

Source files are UTF-8. Some contain Hindi (`वाउचर`, `खरीद`, etc). NEVER use
PowerShell `Set-Content` or `Out-File` without `-Encoding utf8` on these files
— it mojibakes the entire file. Prefer the `Edit` tool, which preserves
encoding. If a wide find/replace is unavoidable, use the `Edit` tool with
`replace_all: true` instead of shell text manipulation.
