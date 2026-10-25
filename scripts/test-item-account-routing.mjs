// Marketing batch C — per-item ledger routing guards (RULE 4) and the godown / Trading-head / SQL
// wiring that has no runnable harness (source guards, the house style).
// Imports the REAL src/lib/itemAccountRouting.ts. Run: node scripts/test-item-account-routing.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const R = await import(pathToFileURL(pathResolve(ROOT, 'src/lib/itemAccountRouting.ts')).href);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Which ledgers an item may route to.
ok(R.isRoutableItemAccount({ id: '5110' }) === true, 'Fertilizer Purchase is routable');
ok(R.isRoutableItemAccount({ id: '5150', subtype: 'closing_stock' }) === false, '5150 Closing Stock contra is NOT routable');
ok(R.isRoutableItemAccount({ id: 'X', subtype: 'closing_stock' }) === false, 'any closing_stock subtype is NOT routable');
ok(R.isRoutableItemAccount({ id: 'G', isGroup: true }) === false, 'a group is NOT routable');

// 2. Lines whose item is not in the stock list.
const items = [{ id: 'urea' }, { id: 'dap' }];
const lines = [{ itemId: 'urea' }, { itemId: 'gone', itemName: 'पुरानी वस्तु' }, { itemId: '' }];
const u = R.unknownItemLines(lines, items);
ok(u.length === 2 && u[0].itemId === 'gone' && u[1].itemId === '', 'unknown + empty itemId lines found');
ok(R.unknownItemLines([{ itemId: 'dap' }], items).length === 0, 'known items pass');
ok(R.UNKNOWN_ITEM_MESSAGE('sale', u).includes('पुरानी वस्तु') && R.UNKNOWN_ITEM_MESSAGE('purchase', u).includes('खरीद'), 'Hindi message names the items');

// 3. Source guards — the wiring.
const dc = readFileSync(pathResolve(ROOT, 'src/contexts/DataContext.tsx'), 'utf8');
const body = (name) => { const i = dc.indexOf(`const ${name} = useCallback(`); return i < 0 ? '' : dc.slice(i, dc.indexOf('\n  }, [', i)); };
for (const [fn, kind] of [['addSale', 'sale'], ['updateSale', 'sale'], ['addPurchase', 'purchase'], ['updatePurchase', 'purchase']]) {
  ok(/unknownItemLines\(data\.items, stockItems\)/.test(body(fn)) && body(fn).includes(`UNKNOWN_ITEM_MESSAGE('${kind}'`), `${fn} refuses unknown items`);
}
ok(/refuseClosingStockRouting\(data\)/.test(body('addStockItem')) && /refuseClosingStockRouting\(data\)/.test(body('updateStockItem')), 'stock item cannot be routed to 5150');
ok(/withTradingParents\(getTrialBalance\(effDate\), accounts\)/.test(body('getTradingAccount')), 'Trading A/c applies the Trading-head rule');
ok(/withTradingParents\(tb, accounts\)/.test(body('getProfitLoss')), 'P&L applies the same Trading-head rule');
ok(/godownMovementsWithOpening\(stockItemsRef\.current, reconcileMovements\(/.test(body('transferStock')), 'transfer availability = opening + reconciled');

const inv = readFileSync(pathResolve(ROOT, 'src/pages/Inventory.tsx'), 'utf8');
ok(/isRoutableItemAccount\(a\)/.test(inv), 'Inventory dropdowns filter 5150 out');
const gd = readFileSync(pathResolve(ROOT, 'src/pages/Godowns.tsx'), 'utf8');
ok(/godownMovementsWithOpening\(stockItems, reconciledStockMovements\)/.test(gd), 'Godowns page reads opening + reconciled movements');
const cas = readFileSync(pathResolve(ROOT, 'src/components/cas/CasStatements.tsx'), 'utf8');
ok(/withTradingParents\(getTrialBalance\(date\), accounts\)/.test(cas) && !/buildCasProfitLoss\(getTrialBalance\(/.test(cas), 'CAS uses the same Trading-head rule');

const sql = readFileSync(pathResolve(ROOT, 'supabase-tables.sql'), 'utf8');
for (const t of ['recoverables', 'kachi_aarat_entries']) {
  ok(!new RegExp(`create policy "allow_all" on ${t}\b`).test(sql), `bootstrap SQL no longer re-opens ${t} with allow_all`);
}

console.log(`\nitem-account-routing: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
