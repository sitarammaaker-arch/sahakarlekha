#!/usr/bin/env node
// Under the posting service a new sale / purchase gets its OFFICIAL number from the server after
// addSale / addPurchase returns. The pages must not toast the provisional number (the Rania pilot showed
// "Sale saved: SL/2026-27/005" while SL/2026-27/006 was stored): DataContext toasts the official number,
// and the saved-banners read the number from the (restamped) list by id. CI-safe static checks.
//
// Run: node scripts/test-stock-doc-toast-number.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(pathResolve(HERE, '..', p), 'utf8');
const dc = read('src/contexts/DataContext.tsx');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

console.log('DataContext');
ok('usesPostingService() is typed and exposed', /usesPostingService: \(\) => boolean;/.test(dc) && /const usesPostingService = useCallback\(\(\): boolean => postingServiceRef\.current, \[\]\);/.test(dc)
  && (dc.match(/restoreVoucher, usesPostingService, clearVoucher,/g) || []).length === 2);
const ps = dc.slice(dc.indexOf('const postStockDocument = ('), dc.indexOf('const cancelStockDocument = ('));
ok('postStockDocument toasts the OFFICIAL number on success', /toastRef\.current\(\{ title: `✅ \$\{label\} सहेजी गई: \$\{docNo\}`/.test(ps) && ps.indexOf('✅') > ps.indexOf('const docNo = r.docNo'));

for (const [page, add, idState, list, noKey] of [
  ['src/pages/SaleManagement.tsx', 'addSale', 'savedSaleId', 'sales', 'saleNo'],
  ['src/pages/PurchaseManagement.tsx', 'addPurchase', 'savedPurchaseId', 'purchases', 'purchaseNo'],
  ['src/pages/consumer/RetailCounter.tsx', 'addSale', 'lastSaleId', 'sales', 'saleNo'],
]) {
  const s = read(page);
  console.log(page);
  ok('no provisional-number toast under the posting service', /if \(!usesPostingService\(\)\) toast\(/.test(s) && !new RegExp(`\\n\\s+toast\\(\\{ title: [^\\n]*\\$\\{new(Sale|Purchase)\\.${noKey}\\}`).test(s.replace(/if \(!usesPostingService\(\)\) toast\(/g, 'GUARDED(')));
  ok('the saved banner reads the number from the list by id (restamped)', new RegExp(`${idState}\\) => .*|\\(${idState} && ${list}\\.find\\(\\w+ => \\w+\\.id === ${idState}\\)\\?\\.${noKey}\\)`).test(s) && /shown(Sale|Purchase)No/.test(s));
  ok(`the id is kept from ${add}'s result`, new RegExp(`set\\w+Id\\(new(Sale|Purchase)\\.id \\|\\| null\\)`).test(s));
}

console.log(`\nstock-doc toast number: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
