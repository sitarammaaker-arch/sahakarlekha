// A bill's balance (lib/billUtils): payments and returns adjusted against the party's account lower it, the same
// amount the party's ledger falls. Run: node scripts/test-bill-balance.mjs   (npm run test:bill-balance)
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const out = join(mkdtempSync(join(tmpdir(), 'bal-')), 'bundle.cjs');
await build({ entryPoints: [join(ROOT, 'src/lib/billUtils.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  alias: { '@': join(ROOT, 'src') }, absWorkingDir: ROOT });
const { getBillStatusFor, getBillStatus, getOpenBills, getOpenPurchaseBills, getSaleReturnedMap, getPurchaseReturnedMap } = createRequire(import.meta.url)(out);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a}, want ${b})`);

// ── which returns count ──
const map = getSaleReturnedMap([
  { originalSaleId: 'A', grandTotal: 200, refundMode: 'credit-adjust' },
  { originalSaleId: 'A', grandTotal: 50, refundMode: 'credit-adjust' },
  { originalSaleId: 'A', grandTotal: 10, refundMode: 'cash' },
  { originalSaleId: 'A', grandTotal: 20, refundMode: 'bank' },
  { originalSaleId: 'A', grandTotal: 40, refundMode: 'credit-adjust', isDeleted: true },
  { grandTotal: 99, refundMode: 'credit-adjust' },
]);
eq(map.A, 250, 'only live credit-adjust returns count');
eq(Object.keys(map).length, 1, 'a return with no bill counts for nothing');
eq(getPurchaseReturnedMap([{ originalPurchaseId: 'P', grandTotal: 30, refundMode: 'credit-adjust' }]).P, 30, 'purchase returns');

// ── the balance ──
eq(getBillStatusFor(1000, 0, 200).balance, 800, 'the founder example: 1000 less a 200 return');
eq(getBillStatusFor(1000, 300, 200).balance, 500, 'payment and return together');
eq(getBillStatusFor(1000, 800, 200).balance, 0, 'paid off by the two together');
eq(getBillStatusFor(1000, 800, 200).status, 'paid', 'status paid');
eq(getBillStatusFor(1000, 0, 1000).status, 'paid', 'a fully returned bill is settled');
eq(getBillStatusFor(1000, 0, 200).status, 'partial', 'a partly returned bill is partial');
eq(getBillStatusFor(1000, 1000, 200).balance, 0, 'paid in full, then returned: no negative balance');
eq(getBillStatusFor(1000, 0, 5000).balance, 0, 'a return above the bill: no negative balance');

// ── nothing changes for a bill with no return ──
eq(getBillStatusFor(1000, 0).status, 'unpaid', 'no return: unpaid');
eq(getBillStatusFor(1000, 400).balance, 600, 'no return: part paid');
eq(getBillStatusFor(1000, 400).received, 400, 'no return: received');
eq(getBillStatusFor(1000, 1000).status, 'paid', 'no return: paid');
eq(getBillStatus({ grandTotal: 1000 }, 0, 200).balance, 800, 'sale wrapper passes the return');

// ── open bills ──
const sales = [
  { id: 'A', customerId: 'C', paymentMode: 'credit', grandTotal: 1000, date: '2026-04-01' },
  { id: 'B', customerId: 'C', paymentMode: 'credit', grandTotal: 500, date: '2026-04-02' },
];
const open = getOpenBills(sales, [], 'C', { A: 200, B: 500 });
eq(open.length, 1, 'a fully returned bill leaves the open list');
eq(open[0].balance, 800, 'open list shows the balance after the return');
eq(getOpenBills(sales, [], 'C').length, 2, 'no returns passed: as before');
const pur = [{ id: 'P', supplierId: 'S', paymentMode: 'credit', grandTotal: 700, date: '2026-04-01' }];
eq(getOpenPurchaseBills(pur, [], 'S', { P: 100 })[0].balance, 600, 'purchase open list');

console.log(`bill balance: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
