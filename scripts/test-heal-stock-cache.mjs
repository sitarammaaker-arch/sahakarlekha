#!/usr/bin/env node
// Unit tests of scripts/heal-stock-cache.mjs (planner uses the app's own computeStockMap +
// reconcileMovements; SQL builders). CI-safe. The real run (plan → apply → re-plan 0 → re-apply refused
// → undo → re-plan) is done on the db-harness with a restored backup before any production apply.
//
// Run: node scripts/test-heal-stock-cache.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { planStockCache, buildStockCacheSql, buildStockCacheUndoSql, FIX } = await import(pathToFileURL(pathResolve(HERE, 'heal-stock-cache.mjs')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const S = 'SOC';
const item = (id, os, cs, name = id) => ({ id, society_id: S, name, openingStock: os, currentStock: cs });

console.log('Planner (the app formula)');
// The Rania Gurh case: opening 0, purchase 10 (live), sale 9 (live), cache 195 → 1.
let ch = planStockCache({
  items: [item('gurh', 0, 195, 'Gurh 500 Gram')],
  movements: [{ society_id: S, itemId: 'gurh', type: 'purchase', qty: '10', referenceNo: 'PUR/1' }, { society_id: S, itemId: 'gurh', type: 'sale', qty: 9, referenceNo: 'SL/6' }],
  purchases: [{ society_id: S, purchaseNo: 'PUR/1', date: 'd', isDeleted: false, items: [{ itemId: 'gurh', qty: '10', rate: 25, amount: 250 }] }],
  sales: [{ society_id: S, saleNo: 'SL/6', date: 'd', isDeleted: false, items: [{ itemId: 'gurh', qty: 9, rate: 25, amount: 225 }] }],
});
ok('Gurh: cache 195 → canonical 1', ch.length === 1 && ch[0].from === 195 && ch[0].to === 1, JSON.stringify(ch));
ch = planStockCache({
  items: [item('a', 5, 0)],
  movements: [{ society_id: S, itemId: 'a', type: 'sale', qty: 3, referenceNo: 'SL/DEL' }],
  sales: [{ society_id: S, saleNo: 'SL/DEL', date: 'd', isDeleted: true, items: [{ itemId: 'a', qty: 3 }] }], purchases: [],
});
ok('a DELETED sale\'s orphan movement is ignored (records are authoritative) → 5', ch.length === 1 && ch[0].to === 5, JSON.stringify(ch));
ch = planStockCache({
  items: [item('b', 0, 7)],
  movements: [{ society_id: S, itemId: 'b', type: 'adjustment', qty: 7, referenceNo: 'ADJ' }], sales: [], purchases: [],
});
ok('adjustments (no parent record) still count; a matching cache is left alone', ch.length === 0);
ch = planStockCache({ items: [item('c', 2, 10)], movements: [{ society_id: S, itemId: 'c', type: 'adjustment', qty: -5 }], sales: [], purchases: [] });
ok('never below zero (2 − 5 → 0)', ch.length === 1 && ch[0].to === 0);
ch = planStockCache({ items: [item('d', 4, null)], movements: [], sales: [], purchases: [] });
ok('a NULL cache is set too (null → opening 4)', ch.length === 1 && ch[0].from === null && ch[0].to === 4);
ch = planStockCache({
  items: [item('x', 0, 0), { id: 'x2', society_id: 'OTHER', name: 'x2', openingStock: 0, currentStock: 0 }],
  movements: [{ society_id: 'OTHER', itemId: 'x', type: 'purchase', qty: 9, referenceNo: 'P' }],
  purchases: [{ society_id: 'OTHER', purchaseNo: 'P', date: 'd', isDeleted: false, items: [{ itemId: 'x', qty: 9 }] }], sales: [],
});
ok('societies never mix (another society\'s purchase of the same id does not move this cache)', ch.length === 0);

ch = planStockCache({ items: [item('u', 0, 0)], movements: [{ society_id: S, itemId: 'u', type: 'adjustment', qty: 0.1 }, { society_id: S, itemId: 'u', type: 'adjustment', qty: 0.2 }], sales: [], purchases: [] });
ok('float noise is rounded to 6 decimals (0.1 + 0.2 → 0.3, not 0.30000000000000004)', ch.length === 1 && ch[0].to === 0.3, JSON.stringify(ch));

console.log('SQL');
const changes = [{ society_id: S, id: 'gurh', name: "Gurh's 500", from: 195, to: 1 }, { society_id: S, id: 'd', name: 'd', from: null, to: 4 }];
const sql = buildStockCacheSql({ runAt: 't', changes });
ok('one transaction', /\nbegin;[\s\S]*\ncommit;\s*$/.test(sql));
ok('refuses a second apply', new RegExp(`fix = '${FIX}';\\s*if n > 0 then raise exception '${FIX}: already applied`).test(sql));
ok('re-checks every old value (NULL-safe) before writing', /"currentStock" is not distinct from 195/.test(sql) && /"currentStock" is not distinct from null/.test(sql) && sql.indexOf('changed since the plan') < sql.indexOf('update public.stock_items'));
ok('logs the old value before updating', sql.indexOf("'stock_item_current_stock'") < sql.indexOf('update public.stock_items'));
ok('updates only the cache column, society-scoped', (sql.match(/update public\.stock_items set "currentStock" = /g) || []).length === 2 && !/update public\.(stock_movements|sales|purchases|vouchers)/.test(sql)
  && /where id = 'gurh' and society_id::text = 'SOC'/.test(sql));
ok('post-check compares every item to its target', /post-check failed for % items/.test(sql));
ok('quotes are escaped in names', sql.includes("Gurh''s 500"));
const undo = buildStockCacheUndoSql({ runAt: 't' });
ok('undo restores the logged old values and clears the log', /set "currentStock" = \(l\.old_row ->> 'currentStock'\)::numeric/.test(undo) && /delete from public\.data_fix_log where fix = /.test(undo));

console.log(`\nheal-stock-cache: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
