// Born-exact invoice totals (T-02 slice 5 / ADR-0006).
//
// SaleManagement / PurchaseManagement computed GST/TDS with `+(x).toFixed(2)` /
// `Math.round(x*100)/100`, which misround at a float half-boundary (2.5% of ₹107 = ₹2.675,
// but `(2.675).toFixed(2)` === "2.67"). computeInvoiceTotals now runs every percentage
// through money.applyPercent (disciplined half-up) and every sum in integer paise.
//
// Imports the REAL src/lib/invoiceTotals.ts (which imports @/lib/money) via an '@/'-resolving
// loader — not a reimplementation.
//
// Run: node scripts/test-invoice-totals.mjs   (npm run test:invoice-totals)

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

const { computeInvoiceTotals } = await import(abs('../src/lib/invoiceTotals.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. THE toFixed HALF-BOUNDARY MISROUND IS FIXED ───────────────────────────
ok(+(107 * 2.5 / 100).toFixed(2) === 2.67, 'baseline bug: (2.675).toFixed(2) rounds DOWN to 2.67');
const t1 = computeInvoiceTotals({ items: [{ amount: 107 }], cgstPct: 2.5 });
ok(t1.cgstAmount === 2.68, `applyPercent rounds ₹2.675 half-up to ₹2.68 (got ${t1.cgstAmount})`);
ok(t1.taxAmount === 2.68 && t1.grandTotal === 109.68, 'tax = 2.68, grandTotal = net + tax = 109.68');

// ── 2. NET = Σ items − discount, floored at 0 ────────────────────────────────
ok(computeInvoiceTotals({ items: [{ amount: 100 }, { amount: 50 }], discount: 30 }).netAmount === 120, 'net = 150 − 30 = 120');
ok(computeInvoiceTotals({ items: [{ amount: 100 }], discount: 250 }).netAmount === 0, 'discount ≥ total → net floored at 0 (no negative)');
const t3 = computeInvoiceTotals({ items: [{ amount: 33.33 }, { amount: 33.33 }, { amount: 33.34 }] });
ok(t3.netAmount === 100 && t3.grandTotal === 100, 'item amounts sum exactly to ₹100 (no float drift), no tax → grandTotal 100');

// ── 3. taxAmount === cgst + sgst + igst, to the paisa ────────────────────────
const t4 = computeInvoiceTotals({ items: [{ amount: 1000 }], cgstPct: 9, sgstPct: 9 });
ok(t4.cgstAmount === 90 && t4.sgstAmount === 90 && t4.taxAmount === 180, 'CGST 9% + SGST 9% of ₹1000 = 90 + 90 = 180');
ok(t4.grandTotal === 1180, 'grandTotal = 1000 + 180 = 1180');

// ── 4. PURCHASE: grandTotal = net + tax − tds ────────────────────────────────
const t5 = computeInvoiceTotals({ items: [{ amount: 107 }], cgstPct: 2.5, tdsPct: 10 });
ok(t5.tdsAmount === 10.70, 'TDS 10% of ₹107 = ₹10.70');
ok(t5.grandTotal === 98.98, `grandTotal = 107 + 2.68 − 10.70 = 98.98 (got ${t5.grandTotal})`);

// ── 5. tdsPct omitted (sale) ⇒ tds 0, unaffected ─────────────────────────────
ok(computeInvoiceTotals({ items: [{ amount: 500 }], igstPct: 18 }).tdsAmount === 0, 'a sale (no tdsPct) has tds 0');

console.log(`\nInvoice totals (born-exact): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
