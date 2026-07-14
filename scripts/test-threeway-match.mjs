// Procurement 3-way match (ECR-21 Phase 1) — imports the REAL src/lib/consumer/threeWayMatch.ts
// (via the '@/' loader, since it imports @/types) so this validates the actual code.
// (Was a self-contained mirror before.)
// Run: node scripts/test-threeway-match.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { threeWayMatch, hasBlockingVariance, blockingReasons } = await import(abs('../src/lib/consumer/threeWayMatch.ts'));

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const po = (itemId, qty, rate, receivedQty) => ({ itemId, itemName: itemId, unit: 'kg', qty, rate, amount: round2(qty * rate), receivedQty });
const inv = (itemId, qty, rate) => ({ itemId, itemName: itemId, unit: 'kg', qty, rate, amount: round2(qty * rate) });

// 1. Perfect match — ordered = received = billed, same rate.
let r = threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 100)]);
ok(r.summary.status === 'matched', 'perfect match → matched');
ok(r.summary.matched === 1 && r.summary.exceptions === 0, 'perfect match counts');
ok(r.lines[0].reasons.length === 0, 'perfect match: no reasons');
ok(r.summary.amountVarianceTotal === 0, 'perfect match: zero amount variance');

// 2. Short delivery, correctly billed for what arrived → within-tolerance (flag, not payment block).
r = threeWayMatch([po('A', 10, 100, 7)], [inv('A', 7, 100)]);
ok(r.summary.status === 'within-tolerance', 'short delivery + correct bill → within-tolerance');
ok(r.lines[0].reasons.includes('short-delivery'), 'short delivery reason flagged');
ok(r.lines[0].qtyVarOrderedReceived === -3, 'short delivery qty variance = -3');

// 3. Over-billed qty (billed > received) → exception.
r = threeWayMatch([po('A', 10, 100, 10)], [inv('A', 12, 100)]);
ok(r.summary.status === 'exception', 'over-billed qty → exception');
ok(r.lines[0].reasons.includes('over-billed-qty'), 'over-billed reason');
ok(r.lines[0].amountVar === 200, 'over-billed amount variance = +200');

// 4. Price variance beyond tolerance → exception.
r = threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 110)]);
ok(r.summary.status === 'exception', 'price +10% → exception');
ok(r.lines[0].reasons.includes('price-variance'), 'price-variance reason');
ok(r.lines[0].priceVar === 10, 'price variance = +10');

// 5. Price variance WITHIN tolerance (1% of 100 = 1 ≤ 2% band) → within-tolerance.
r = threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 101)]);
ok(r.summary.status === 'within-tolerance', 'price +1% (≤2%) → within-tolerance');
ok(r.lines[0].reasons.includes('price-variance'), 'small price still flagged as reason');

// 6. Received but no invoice line → unbilled exception.
r = threeWayMatch([po('A', 10, 100, 10)], []);
ok(r.summary.status === 'exception', 'received but unbilled → exception');
ok(r.lines[0].reasons.includes('unbilled'), 'unbilled reason');
ok(r.lines[0].billedAmount === 0, 'unbilled: billed amount 0');

// 7. Extra invoice line (billed an item never on the PO) → exception.
r = threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 100), inv('B', 5, 50)]);
ok(r.summary.status === 'exception', 'extra invoice line → exception');
ok(r.lines.length === 2, 'extra line added');
const extra = r.lines.find(l => l.itemId === 'B');
ok(extra && extra.reasons.includes('extra-invoice-line'), 'extra-invoice-line reason');
ok(extra && extra.amountVar === 250, 'extra line amount variance = full bill');

// 8. Multi-line mixed: one clean, one price exception → overall exception.
r = threeWayMatch([po('A', 10, 100, 10), po('B', 4, 50, 4)], [inv('A', 10, 100), inv('B', 4, 80)]);
ok(r.summary.status === 'exception', 'mixed → worst-line (exception) wins');
ok(r.summary.matched === 1 && r.summary.exceptions === 1, 'mixed counts: 1 matched + 1 exception');

// 9. Over-delivery, correctly billed for received → within-tolerance with over-delivery flag.
r = threeWayMatch([po('A', 10, 100, 12)], [inv('A', 12, 100)]);
ok(r.summary.status === 'within-tolerance', 'over-delivery + correct bill → within-tolerance');
ok(r.lines[0].reasons.includes('over-delivery'), 'over-delivery reason');

// 10. Totals roll up across lines.
r = threeWayMatch([po('A', 10, 100, 10), po('B', 5, 20, 5)], [inv('A', 10, 100), inv('B', 5, 20)]);
ok(r.summary.orderedTotal === 1100 && r.summary.receivedTotal === 1100 && r.summary.billedTotal === 1100, 'totals roll up (1100 each)');
ok(r.summary.status === 'matched', 'clean multi-line → matched');

// ECR-21 Phase 3 — blocking-variance gate (hasBlockingVariance / blockingReasons imported above).

// 11. Clean / within-tolerance → NOT blocked; exception → blocked.
ok(!hasBlockingVariance(threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 100)])), 'perfect match: not blocked');
ok(!hasBlockingVariance(threeWayMatch([po('A', 10, 100, 7)], [inv('A', 7, 100)])), 'short delivery correctly billed: not blocked');
ok(hasBlockingVariance(threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 110)])), 'price +10%: blocked');
ok(hasBlockingVariance(threeWayMatch([po('A', 10, 100, 10)], [inv('A', 12, 100)])), 'over-billed qty: blocked');
ok(hasBlockingVariance(threeWayMatch([po('A', 10, 100, 10)], [])), 'unbilled receipt: blocked');

// 12. blockingReasons lists the distinct exception reasons.
const br = blockingReasons(threeWayMatch([po('A', 10, 100, 10)], [inv('A', 10, 110)]));
ok(br.includes('price-variance') && br.length === 1, 'blockingReasons = [price-variance]');

console.log(`\n3-way match (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
