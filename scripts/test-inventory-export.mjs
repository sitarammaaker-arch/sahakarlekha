// Inventory export: Stock Value is at weighted-average cost (RULE 2), so it must travel with its own
// Avg Cost Rate column, the master purchase rate must be labelled as such, and money must be rounded
// to paise — an average like 1283.333… leaked into inventory.xlsx as 10266.666666… (2026-10-03).
// STATIC check on src/pages/Inventory.tsx.
//
// Run: node scripts/test-inventory-export.mjs   (npm run test:inventory-export)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(pathResolve(ROOT, 'src/pages/Inventory.tsx'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗', m); } };

const hdr = src.match(/const exportHeaders = \[([^\]]*)\]/)?.[1] ?? '';
ok(/'Purchase Rate \(Master\)'/.test(hdr), 'master purchase rate is labelled as master');
ok(/'Avg Cost Rate'/.test(hdr), 'the weighted-average cost rate is exported as its own column');
ok(/'Stock Value \(at Avg Cost\)'/.test(hdr), 'stock value says it is at average cost');
ok(hdr.indexOf("'Avg Cost Rate'") < hdr.indexOf("'Stock Value (at Avg Cost)'"), 'avg cost sits before stock value');
ok(/const r2 = \(n: number\) => toRupees\(toMinor\(n\)\)/.test(src), 'money is rounded to paise via money.ts');
ok(/r2\(computeStockCostRate\(i, reconciledStockMovements\)\)/.test(src), 'avg cost rate is rounded');
ok(/r2\(computeStockValue\(i, reconciledStockMovements\)\)/.test(src), 'stock value is rounded');
ok(/handleCSV = \(\) => downloadCSV\(exportHeaders, exportRows\(\)/.test(src) && /handleExcel = \(\) => downloadExcelSingle\(exportHeaders, exportRows\(\)/.test(src), 'CSV and Excel share one row builder');
ok(!/'Purchase Rate', 'Sale Rate', 'Stock Value'/.test(src), 'the old ambiguous header set is gone');

console.log(`\ninventory export: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
