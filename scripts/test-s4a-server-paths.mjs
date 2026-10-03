#!/usr/bin/env node
// S4-a · with the posting service ON, the app reaches the five accounting writes it used to make directly
// through their server functions (migration 103), and the direct write survives only on the flag-OFF path.
// Static guarantees on DataContext; the functions themselves are proven by the db-harness suite
// scripts/db-harness/tests/s4-a-server-paths.mjs (41 checks).
//
// Run: node scripts/test-s4a-server-paths.mjs   (npm run test:s4a-server-paths)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(ROOT, 'src/contexts/DataContext.tsx'), 'utf8');
const sql = readFileSync(resolve(ROOT, 'supabase/migrations/103_s4_server_paths.sql'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

function body(name) {
  const re = new RegExp(`\\n  const ${name} = (useCallback\\()?(async )?\\(`);
  const m = re.exec(src);
  if (!m) return '';
  const next = src.indexOf('\n  const ', m.index + 10);
  return src.slice(m.index, next < 0 ? undefined : next);
}
/** The flag-ON rpc appears, and (when given) the direct write is reachable only outside the flag branch. */
const before = (b, a, c) => b.indexOf(a) >= 0 && b.indexOf(c) >= 0 && b.indexOf(a) < b.indexOf(c);

const reject = body('rejectVoucher');
ok('rejectVoucher: posting service → rpc reject_voucher', reject.includes("rpc('reject_voucher'"));
ok('rejectVoucher: the direct update is after (outside) the flag branch', before(reject, "rpc('reject_voucher'", "from('vouchers').update({ approvalStatus: 'rejected'"));
ok('rejectVoucher: a server refusal rolls back + destructive toast (RULE 1)', /undoReject/.test(reject) && /variant: 'destructive'/.test(reject));

for (const fn of ['clearVoucher', 'unclearVoucher']) {
  const b = body(fn);
  ok(`${fn}: posting service → rpc set_voucher_cleared, else the targeted update`, /postingServiceRef\.current\s*\?\s*supabase\.rpc\('set_voucher_cleared'/.test(b) && b.includes("from('vouchers').update({ isCleared"));
}

const reverse = body('reverseVoucher');
ok('reverseVoucher: links via rpc link_voucher_reversal', reverse.includes("rpc('link_voucher_reversal'"));
ok('reverseVoucher: …only after post_voucher made the reversal durable (onPersisted)', /onPersisted: linkOnServer/.test(reverse));
ok('reverseVoucher: the direct link updates run only when the flag is OFF', /if \(!viaServer\) \{\s*supabase\.from\('vouchers'\)\.update\(\{ reversalOf/.test(reverse));
const add = body('addVoucher');
ok('addVoucher: onPersisted fires after the server confirms (official number included)', /opts\?\.onPersisted\?\.\(nv\)/.test(add) && /else opts\?\.onPersisted\?\.\(v\)/.test(add));

ok('syncOpeningOnServer calls rpc sync_account_opening_event', /rpc\('sync_account_opening_event'/.test(src));
const addAcc = body('addAccount'), updAcc = body('updateAccount'), delAcc = body('deleteAccount');
ok('addAccount: no client opening event when ON; server sync after the account saves', /openingViaServer \? null : buildOpeningDelta/.test(addAcc) && /syncOpeningOnServer\(newAccount\.id\)/.test(addAcc));
ok('updateAccount: no client opening event when ON; server sync when the opening changed', /!openingViaServer \? buildOpeningDelta/.test(updAcc) && /openingTouched\) syncOpeningOnServer\(id\)/.test(updAcc));
ok('deleteAccount: journal opening netted to 0 by the server when ON', /zeroViaServer \? null : buildOpeningDelta/.test(delAcc) && /syncOpeningOnServer\(id, 0\)/.test(delAcc));

const merge = body('mergeAccounts');
ok('mergeAccounts: posting service → ONE rpc merge_accounts', merge.includes("rpc('merge_accounts'"));
ok('mergeAccounts: …before (and instead of) the client-side multi-write path', before(merge, "rpc('merge_accounts'", "from('vouchers').upsert"));
ok('mergeAccounts: applies the server journal events locally', /mapLedgerEventRows\(r\.events/.test(merge));

// Row 7 (104): pending (maker-checker) create / edit.
ok('addVoucher: a PENDING voucher with the posting service → rpc save_pending_voucher', /postingServiceRef\.current && newVoucher\.approvalStatus === 'pending'\) \{[\s\S]*?rpc\('save_pending_voucher', pp\)/.test(add));
ok('addVoucher: …before the post_voucher branch, with rollback + toast on failure', before(add, "rpc('save_pending_voucher'", "rpc('post_voucher'") && /failPending[\s\S]*?rollbackOptimistic\(\)/.test(add));
const upd = body('updateVoucher');
ok('updateVoucher: a PENDING voucher with the posting service → rpc save_pending_voucher', /postingServiceRef\.current && current\.approvalStatus === 'pending'\) \{[\s\S]*?rpc\('save_pending_voucher'/.test(upd));
const sql104 = readFileSync(resolve(ROOT, 'supabase/migrations/104_save_pending_voucher.sql'), 'utf8');
ok('104 defines save_pending_voucher as SECURITY DEFINER, anon revoked', /function public\.save_pending_voucher\([^)]*\)[\s\S]*?security definer/.test(sql104) && /revoke execute on function public\.save_pending_voucher\([^)]*\) from public, anon/.test(sql104));
ok('104 writes no lines / entries / journal for a pending voucher', !/insert into public\.(voucher_lines|voucher_entries|ledger_events)/.test(sql104));

for (const fn of ['reject_voucher', 'set_voucher_cleared', 'link_voucher_reversal', 'sync_account_opening_event', 'merge_accounts']) {
  ok(`103 defines ${fn} as SECURITY DEFINER`, new RegExp(`function public\\.${fn}\\([^)]*\\)[\\s\\S]*?security definer`).test(sql));
  ok(`103 revokes ${fn} from anon and grants authenticated`, new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon`).test(sql) && new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated`).test(sql));
}

console.log(`\nS4-a server paths: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
