#!/usr/bin/env node
// Phase-2 D3 · 194Q advice on a purchase bill (src/lib/tax/purchaseTdsAdvice.ts) + its wiring.
// Run: node scripts/test-purchase-tds-advice.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)}; const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));
const { purchaseTdsAdvice } = await import(pathToFileURL(pathResolve(SRC, 'lib/tax/purchaseTdsAdvice.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n} ${x}`); } };
const P = (id, amt, date = '2026-06-01', sup = 'S1', extra = {}) => ({ id, supplierId: sup, date, netAmount: amt, ...extra });
const hist = [P('a', 3000000), P('b', 1500000), P('old', 9000000, '2026-03-15'), P('other', 9000000, '2026-06-01', 'S2'), P('del', 9000000, '2026-06-01', 'S1', { isDeleted: true })];
ok('not a 194Q supplier → nothing to say', purchaseTdsAdvice({ supplierSection: '194C', supplierId: 'S1', bill: { date: '2026-07-01', netAmount: 100 }, purchases: hist }).kind === 'none');
ok('no supplier → nothing to say', purchaseTdsAdvice({ supplierSection: '194Q', bill: { date: '2026-07-01', netAmount: 100 }, purchases: hist }).kind === 'none');
const below = purchaseTdsAdvice({ supplierSection: '194Q', supplierId: 'S1', bill: { date: '2026-07-01', netAmount: 400000 }, purchases: hist });
ok('₹45L this FY + ₹4L bill = ₹49L → below ₹50L, no TDS (last-FY / other supplier / deleted bills ignored)', below.kind === 'below' && below.aggregateMinor === 4900000 * 100, JSON.stringify(below).slice(0, 120));
ok('…with both caveats (turnover gate, GST base) stated', below.caveats?.length === 2);
const above = purchaseTdsAdvice({ supplierSection: '194Q', supplierId: 'S1', bill: { date: '2026-07-01', netAmount: 1000000 }, purchases: hist });
// before ₹45L → after ₹55L: TDS(after) = 0.1% of ₹5L = ₹500; TDS(before) = 0 → this bill ₹500
ok('crossing the threshold: this bill brings 0.1% of the part above ₹50L = ₹500', above.kind === 'above' && above.billTdsMinor === 50000, JSON.stringify(above).slice(0, 160));
const next = purchaseTdsAdvice({ supplierSection: '194Q', supplierId: 'S1', bill: { date: '2026-08-01', netAmount: 1000000 }, purchases: [...hist, P('c', 1000000, '2026-07-01')] });
ok('once over the threshold: the whole next bill at 0.1% = ₹1,000', next.kind === 'above' && next.billTdsMinor === 100000);
const edit = purchaseTdsAdvice({ supplierSection: '194Q', supplierId: 'S1', bill: { id: 'b', date: '2026-06-01', netAmount: 1500000 }, purchases: hist });
ok('editing a bill does not count it twice', edit.kind === 'below' && edit.aggregateMinor === 4500000 * 100);
const page = readFileSync(pathResolve(SRC, 'pages/PurchaseManagement.tsx'), 'utf8');
ok('the purchase form shows the advice and never sets the TDS % from it', /purchaseTdsAdvice\(\{/.test(page) && /data-testid="tds-194q-advice"/.test(page) && !/setTdsPct\(tdsAdvice/.test(page));
console.log(`\npurchase TDS advice: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
