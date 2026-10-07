// Posting to a GROUP account is refused at every layer: the app (addVoucher / updateVoucher →
// blockGroupPosting, #655) and — migration 112 — the database itself (a trigger on voucher_lines, so
// post_voucher / post_stock_document / edit_voucher / approve_voucher are all covered at once).
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const root = (p) => resolve(HERE, '..', p);
const read = (p) => readFileSync(root(p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

console.log('migration 112');
const up = read('supabase/migrations/112_refuse_group_account_legs.sql');
ok(/before insert on public\.voucher_lines/i.test(up), 'trigger fires BEFORE INSERT on voucher_lines');
ok(/for each row/i.test(up), 'row-level');
ok(/raise exception 'post_voucher:group_account'/.test(up), "refusal uses the client-mapped 'post_voucher:group_account' code");
ok(/a\.society_id::text = new\.society_id::text/.test(up), 'society compared as text (mixed uuid/text society_id)');
ok(/coalesce\(a\."isGroup", false\)/.test(up), 'only isGroup accounts refused');
ok(/revoke execute on function public\.tg_refuse_group_account_leg\(\) from public, anon, authenticated/.test(up), 'trigger function not callable by app users');
ok(/drop trigger if exists trg_refuse_group_account_leg/.test(up), 'idempotent (drop trigger if exists)');
ok(!/\b(update|delete)\s+public\.(voucher_lines|vouchers|accounts)\b/i.test(up.replace(/--.*$/gm, '')), 'never rewrites existing rows');
const down = read('supabase/migrations/112_refuse_group_account_legs_down.sql');
ok(/drop trigger if exists trg_refuse_group_account_leg/.test(down) && /drop function if exists public\.tg_refuse_group_account_leg/.test(down), 'down removes trigger and function');
ok(/from public\.voucher_lines/.test(read('supabase/diagnostics/preview_112_group_account_legs.sql')) && !/\b(insert|update|delete)\b/i.test(read('supabase/diagnostics/preview_112_group_account_legs.sql').replace(/--.*$/gm, '')), 'preview is read-only');

console.log('client message');
const M = await import(pathToFileURL(root('src/lib/ledger/postVoucherMessages.ts')).href);
ok(M.postVoucherErrorCode('post_voucher:group_account') === 'group_account', 'refusal code parsed');
ok(/ग्रुप/.test(M.postVoucherMessage('group_account')), 'Hindi message, not the raw code');

console.log('app guard still in place');
const dc = read('src/contexts/DataContext.tsx');
ok((dc.match(/blockGroupPosting\(/g) || []).length >= 2, 'addVoucher and updateVoucher both call blockGroupPosting');

console.log(`Group-account guard: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
