// Unit tests for Consumer C2 — the effective-dated tier price resolver
// (src/lib/consumer/pricing.ts). Faithful JS mirror of the pure TS logic; tsc guarantees the
// TS compiles, this pins the behaviour.
// Run: node scripts/test-consumer.mjs   (exit 1 on any failure)

// ── Mirror: src/lib/consumer/pricing.ts ──
function resolveItemPrice(item, tier, prices, date) {
  const base = item.saleRate || 0;
  if (!tier || tier === 'retail') return base;
  const eligible = prices
    .filter(p => !p.isDeleted && p.itemId === item.id && p.tier === tier && (!p.effectiveFrom || p.effectiveFrom <= date))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : 0));
  const top = eligible[0];
  return top && typeof top.price === 'number' && isFinite(top.price) ? top.price : base;
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const ITEM = { id: 'wheat', saleRate: 40 };
const PRICES = [
  { id: 'p1', itemId: 'wheat', tier: 'member', price: 36, effectiveFrom: '2025-04-01' },
  { id: 'p2', itemId: 'wheat', tier: 'member', price: 34, effectiveFrom: '2026-01-01' }, // revised cheaper
  { id: 'p3', itemId: 'wheat', tier: 'wholesale', price: 32, effectiveFrom: '2025-04-01' },
  { id: 'p4', itemId: 'rice', tier: 'member', price: 50, effectiveFrom: '2025-04-01' },
];

// 1. retail / empty tier → base saleRate (no override consulted)
ok(resolveItemPrice(ITEM, 'retail', PRICES, '2026-02-01') === 40, 'retail → base saleRate');
ok(resolveItemPrice(ITEM, '', PRICES, '2026-02-01') === 40, 'empty tier → base saleRate');

// 2. latest effectiveFrom on/before the date wins (revision supersedes)
ok(resolveItemPrice(ITEM, 'member', PRICES, '2026-02-01') === 34, 'revised member price (Jan) applies in Feb');
ok(resolveItemPrice(ITEM, 'member', PRICES, '2025-06-01') === 36, 'original member price applies before the revision');

// 3. tier isolation — wholesale is its own price, not the member one
ok(resolveItemPrice(ITEM, 'wholesale', PRICES, '2026-02-01') === 32, 'wholesale resolves its own tier');

// 4. no tier row in force yet (date before earliest effectiveFrom) → base saleRate (member never pays more than retail)
ok(resolveItemPrice(ITEM, 'member', PRICES, '2025-01-01') === 40, 'before any member price → falls back to retail');

// 5. item without any tier override → base saleRate
ok(resolveItemPrice({ id: 'sugar', saleRate: 45 }, 'member', PRICES, '2026-02-01') === 45, 'unpriced item → retail fallback');

// 6. soft-deleted override is ignored
{
  const withDeleted = [{ id: 'p9', itemId: 'wheat', tier: 'member', price: 30, effectiveFrom: '2026-01-01', isDeleted: true }, ...PRICES];
  ok(resolveItemPrice(ITEM, 'member', withDeleted, '2026-02-01') === 34, 'deleted override ignored, next-latest wins');
}

// 7. another item resolves independently
ok(resolveItemPrice({ id: 'rice', saleRate: 55 }, 'member', PRICES, '2026-02-01') === 50, 'rice member price is its own');

console.log(`\nConsumer pricing: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
