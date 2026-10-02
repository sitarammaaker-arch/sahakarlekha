#!/usr/bin/env node
// 095 client side · isEditLocked locks a REVERSAL voucher (reversalOf) as well as a reversed one, so the
// app refuses before the server does (legacy path included). Server side: db-harness h-reversal-edit-lock.
// Run: node scripts/test-h-reversal-edit-lock.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { isEditLocked } = await import(pathToFileURL(resolve(root, 'src/lib/voucherReversal.ts')).href);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };
ok('plain voucher editable', !isEditLocked({}, false));
ok('reversed original locked', isEditLocked({ reversedBy: 'r1' }, false));
ok('reversal voucher locked', isEditLocked({ reversalOf: 'o1' }, false));
ok('approved under maker-checker locked; not without it', isEditLocked({ approvalStatus: 'approved' }, true) && !isEditLocked({ approvalStatus: 'approved' }, false));
const dc = readFileSync(resolve(root, 'src/contexts/DataContext.tsx'), 'utf8');
ok('updateVoucher explains the reversal lock in Hindi', /current\.reversalOf\s*\n\s*\? 'यह एक reversal वाउचर है/.test(dc));
const pv = readFileSync(resolve(root, 'src/lib/ledger/postVoucherClient.ts'), 'utf8');
ok('server code voucher_is_reversal has a Hindi message', /voucher_is_reversal: '/.test(pv));
const mig = readFileSync(resolve(root, 'supabase/migrations/095_edit_voucher_reversal_lock.sql'), 'utf8');
ok('095 adds the reversalOf check right after the reversedBy check', /voucher_reversed'; end if;\s*\n(?:\s*--[^\n]*\n)*\s*if v_cur\."reversalOf" is not null and v_cur\."reversalOf" <> '' then raise exception 'post_voucher:voucher_is_reversal'; end if;/.test(mig));
ok('095 is transactional and recorded', /^begin;/m.test(mig) && /values \('095', 'edit_voucher_reversal_lock'\)/.test(mig) && /^commit;/m.test(mig));
console.log(`\nreversal edit lock (client): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
