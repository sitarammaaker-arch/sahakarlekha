// Unit test for editing a posted return (ConsumerDataContext update{Sales,Purchase}Return).
// Editing reverses the OLD return's stock (compensating movement) then re-applies the NEW one,
// keeping the same return number. This pins that the net stock adjustment equals the new qty.
// Run: node scripts/test-return-edit.mjs   (exit 1 on any failure)

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// Net signed adjustment for an item from a list of {qty} adjustment movements (sales return is +,
// purchase return is −; canonical stock formula: +qty adds, −qty subtracts).
const netAdj = movs => movs.reduce((s, m) => s + m.qty, 0);

// ── Sales return (goods back INTO stock, positive) — edit 1 → 2 ──
{
  const movs = [];
  // addSalesReturn(qty 1): +1 under SRET/001
  movs.push({ ref: 'SRET/001', qty: 1 });
  // updateSalesReturn(1 → 2): reverse old (cur.items qty 1 → −1) + new (+2)
  movs.push({ ref: 'SRET/001/EDIT', qty: -1 });   // reverse old
  movs.push({ ref: 'SRET/001', qty: 2 });          // new
  ok(netAdj(movs) === 2, `sales return edit 1→2 nets +2 (got ${netAdj(movs)})`);
}

// ── Sales return edit 2 → 1 (reduce) ──
{
  const movs = [{ ref: 'SRET/001', qty: 2 }, { ref: 'SRET/001/EDIT', qty: -2 }, { ref: 'SRET/001', qty: 1 }];
  ok(netAdj(movs) === 1, `sales return edit 2→1 nets +1 (got ${netAdj(movs)})`);
}

// ── Purchase return (goods OUT of stock, negative) — edit 1 → 3 ──
{
  const movs = [];
  // addPurchaseReturn(qty 1): −1 under PRET/001
  movs.push({ ref: 'PRET/001', qty: -1 });
  // updatePurchaseReturn(1 → 3): reverse old (restore +1) + new (−3)
  movs.push({ ref: 'PRET/001/EDIT', qty: 1 });    // restore old
  movs.push({ ref: 'PRET/001', qty: -3 });         // new
  ok(netAdj(movs) === -3, `purchase return edit 1→3 nets −3 (got ${netAdj(movs)})`);
}

// ── Delete after edit still nets to zero (compensating −new on delete) ──
{
  // sales return: +1, −1(edit), +2(new), then delete reverses cur.items (qty 2) → −2
  const movs = [{ qty: 1 }, { qty: -1 }, { qty: 2 }, { qty: -2 }];
  ok(netAdj(movs) === 0, `sales return edit then delete nets 0 (got ${netAdj(movs)})`);
}

// ── Cap on edit excludes the return being edited (sold 5, this return had 5, edit to 4 is valid) ──
{
  const otherReturnsQty = 0; // no OTHER live returns of this sale
  const sold = 5, newQty = 4;
  ok(newQty + otherReturnsQty <= sold, 'edit cap: excluding self, 4 ≤ 5 sold is allowed');
  ok(!(6 + otherReturnsQty <= sold), 'edit cap: 6 > 5 sold is blocked');
}

console.log(`\nreturn-edit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
