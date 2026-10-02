#!/usr/bin/env node
// H4 / RULE 3 · a return document and its voucher live and die together.
// Prod (2026-10-01): two Rania returns stayed LIVE (return register + stock) after their vouchers were
// cancelled from the voucher screen, and their sale/purchase had been deleted under them.
//  - cancelVoucher refuses a '<kind>.return' voucher unless the Returns page asks (viaParent);
//  - an already-cancelled voucher is a no-op success (parent cleanup never double-cancels);
//  - return delete/edit abort when the voucher cannot be cancelled;
//  - a sale/purchase with a live return cannot be deleted; pages toast success only if it ran.
// Run: node scripts/test-h4-return-voucher-guard.mjs
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
const read = p => readFileSync(resolve(root, p), 'utf8');

const dc = read('src/contexts/DataContext.tsx');
const cv = dc.slice(dc.indexOf('const cancelVoucher = useCallback'), dc.indexOf('const cancelVoucher = useCallback') + 2200);
ok('cancelVoucher accepts { viaParent }', /cancelVoucher: \(id: string, reason: string, deletedBy: string, opts\?: \{ viaParent\?: boolean \}\) => boolean;/.test(dc) && /opts\?: \{ viaParent\?: boolean \}\): boolean =>/.test(cv));
ok('already-cancelled voucher ⇒ true, before any other check', /if \(!current\) return false;\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(current\.isDeleted\) return true;/.test(cv));
ok('return vouchers refused unless viaParent', /\(current\.refType === 'sale\.return' \|\| current\.refType === 'purchase\.return'\) && !opts\?\.viaParent[\s\S]{0,600}return false;/.test(cv));

const cc = read('src/contexts/ConsumerDataContext.tsx');
const viaParent = (cc.match(/cancelVoucher\([^;]*'(Sales|Purchase) return[^']*'[^;]*\{ viaParent: true \}\)/g) || []).length;
ok('all 6 return cancel sites pass viaParent', viaParent === 6);
ok('return delete aborts if its voucher stays live', /if \(cur\.voucherId && !cancelVoucher\(cur\.voucherId, 'Sales return deleted'[^)]*\{ viaParent: true \}\)\) return;/.test(cc) && /if \(cur\.voucherId && !cancelVoucher\(cur\.voucherId, 'Purchase return deleted'[^)]*\{ viaParent: true \}\)\) return;/.test(cc));
ok('return edit aborts if the old voucher stays live', /!cancelVoucher\(cur\.voucherId, 'Sales return edited'[^)]*\{ viaParent: true \}\)\) return null;/.test(cc) && /!cancelVoucher\(cur\.voucherId, 'Purchase return edited'[^)]*\{ viaParent: true \}\)\) return null;/.test(cc));

ok('live-return check reads return vouchers (refType + refId)', /v\.refType === `\$\{kind\}\.return` && v\.refId === docId/.test(dc));
for (const k of ['Sale', 'Purchase']) {
  const f = dc.slice(dc.indexOf(`const delete${k} = useCallback`), dc.indexOf(`const delete${k} = useCallback`) + 400);
  ok(`delete${k} returns boolean and refuses with a live return`, f.includes(`guardLiveReturns('${k.toLowerCase()}', id)) return false;`) && /\(id: string\): boolean =>/.test(f));
}
for (const [p, fn] of [['src/pages/SaleManagement.tsx', 'deleteSale'], ['src/pages/PurchaseManagement.tsx', 'deletePurchase']]) {
  ok(`${p.split('/').pop()} toasts "deleted" only when ${fn} ran`, new RegExp(`const done = ${fn}\\(deleteId\\);[\\s\\S]{0,200}if \\(done\\) toast\\(`).test(read(p)));
}

console.log(`\nH4 return voucher guard: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
