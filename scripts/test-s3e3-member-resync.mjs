#!/usr/bin/env node
// S3-e-3 · editing a member's share capital / admission fee re-syncs its voucher through updateVoucher
// (guards + rollback + journal + edit_voucher under the posting service), never a direct upsert. CI-safe.
//
// Run: node scripts/test-s3e3-member-resync.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const dc = readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8');
const a = dc.indexOf('const updateMember = useCallback(');
const um = dc.slice(a, dc.indexOf('\n  const ', a + 40));
const rs = um.slice(um.indexOf('const resyncMemberVoucher'), um.indexOf('if (data.shareCapital !== undefined'));

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

ok('the resync goes through updateVoucher (amount + rebuilt lines + narration)', /updateVoucher\(active\.id, \{ amount: newAmount, lines: newLines, narration: /.test(rs));
ok('no direct vouchers upsert / syncEntries / setVouchersState in the resync', !/from\('vouchers'\)|syncEntries\(|setVouchersState\(/.test(rs));
ok('an amount of 0 cancels the voucher WITH its journal (cancelLinkedVouchers), not a ₹0 receipt', /if \(!\(newAmount > 0\)\) \{\s*cancelLinkedVouchers\(\[active\.id\]/.test(rs));
ok('a refused edit (updateVoucher → false) is surfaced with a destructive toast', /if \(!applied\) \{[\s\S]*?variant: 'destructive'/.test(rs));
ok('updateMember lists updateVoucher as a dependency', /\}, \[updateVoucher\]\);/.test(um));
ok('updateVoucher is declared before updateMember (no TDZ at call time)', dc.indexOf('const updateVoucher = useCallback(') < a);

console.log(`\nS3-e-3 member resync: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
