#!/usr/bin/env node
// H / RULE 3 · a module delete must not mark its document deleted while its voucher stays live.
// cancelVoucher can refuse (FY/period lock, permission, a reversed voucher); the module deletes used
// to ignore that and delete the document anyway. Cancel-first modules now abort; Labour (which hard-
// deletes the row first) now says so loudly. MaintenanceBilling toasts "deleted" only when it ran.
// Run: node scripts/test-h-module-delete-abort.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
const read = p => readFileSync(resolve(root, p), 'utf8');

const abortOn = (src, reason) => new RegExp(`&& !cancelVoucher\\([^;]*${reason.replace(/[()$]/g, m => '\\' + m)}[^;]*\\{ viaParent: true \\}\\)\\) return( false)?;`).test(src);
const cc = read('src/contexts/ConsumerDataContext.tsx');
ok('Consumer: patronage run delete aborts on a refused cancel', abortOn(cc, "'Patronage run deleted'"));
const dd = read('src/contexts/DairyDataContext.tsx');
for (const r of ["'Settlement deleted'", "'Dispatch deleted'", "'Input issue deleted'", "'Distribution deleted'"]) ok(`Dairy: ${r} aborts on a refused cancel`, abortOn(dd, r));
const hh = read('src/contexts/HousingDataContext.tsx');
ok('Housing: maintenance bill delete aborts and returns false', abortOn(hh, '`Maintenance bill ${bill.billNo} deleted`') && /deleteMaintenanceBill: \(id: string\) => boolean;/.test(hh));
ok('Housing: fund investment cancels redemption first and stops at a refusal', abortOn(hh, '`Fund investment deleted (redemption reversed)`') && /if \(inv\.voucherId && !cancelVoucher\(inv\.voucherId, `Fund investment deleted`/.test(hh) && hh.indexOf('redemption reversed)`') < hh.indexOf("if (inv.voucherId && !cancelVoucher(inv.voucherId"));
ok('Housing: flat transfer delete aborts on a refused cancel', abortOn(hh, '`Transfer ${t.flatNo} deleted`'));
const ll = read('src/contexts/LabourDataContext.tsx');
ok('Labour: every cascade checks its cancels and toasts a refusal (3 deletes)', (ll.match(/'वाउचर रद्द नहीं हुआ'/g) || []).length === 3 && !/^\s*if \(old\.(voucherId|depositVoucherId)\) cancelVoucher\(/m.test(ll) && !/\.forEach\(v => cancelVoucher\(/.test(ll));
for (const [name, src] of [['Consumer', cc], ['Dairy', dd], ['Housing', hh]]) {
  ok(`${name}: no delete-path cancel ignores its result`, !/^\s*if \([^)]*\) cancelVoucher\([^;]*deleted[^;]*;\s*$/m.test(src));
}
ok('MaintenanceBilling toasts "deleted" only when the delete ran', /if \(deleteMaintenanceBill\(id\)\) toast\(/.test(read('src/pages/MaintenanceBilling.tsx')));

console.log(`\nH module delete abort: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
