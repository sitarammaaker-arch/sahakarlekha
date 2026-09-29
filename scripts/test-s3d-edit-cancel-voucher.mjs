#!/usr/bin/env node
// S3-d-1 · static guard on migration 078 (edit_voucher + cancel_voucher). CI-safe (no DB).
// Behaviour as real JWT users on a restored backup: scripts/db-harness/tests/s3d-edit-cancel-voucher.mjs.
//
// Run: node scripts/test-s3d-edit-cancel-voucher.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(pathResolve(HERE, '../supabase/migrations/078_edit_cancel_voucher.sql'), 'utf8');
const code = raw.replace(/--[^\n]*/g, ' ');
const down = readFileSync(pathResolve(HERE, '../supabase/migrations/078_edit_cancel_voucher_down.sql'), 'utf8');
const fnOf = (name) => { const a = code.indexOf(`create or replace function public.${name}(`); return code.slice(a, code.indexOf('$$;', a) + 3); };
const edit = fnOf('edit_voucher'), cancel = fnOf('cancel_voucher');
const bodyOf = (fn) => fn.slice(fn.indexOf('begin'));
const eb = bodyOf(edit), cb = bodyOf(cancel);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const before = (b, a, c) => b.indexOf(a) >= 0 && b.indexOf(c) >= 0 && b.indexOf(a) < b.indexOf(c);

for (const [name, fn, b, gate, firstWrite] of [
  ['edit_voucher', edit, eb, 'jwt_can_write', 'update public.vouchers t set'],
  ['cancel_voucher', cancel, cb, 'jwt_can_delete', 'update public.vouchers set "isDeleted"'],
]) {
  console.log(name);
  ok('SECURITY DEFINER with search_path pinned to empty', /security definer\s+set search_path = ''/.test(fn));
  ok('society from get_current_society_id(); role claim required (fail-closed)', /v_sid\s+text := public\.get_current_society_id\(\)/.test(fn) && /if v_role is null then raise exception 'post_voucher:no_role_claim'/.test(b));
  ok(`role gate: ${gate}()`, new RegExp(`if not public\\.${gate}\\(\\)`).test(b));
  ok('row read only within the JWT society, locked FOR UPDATE', /society_id::text = v_sid for update/.test(b));
  for (const c of ['voucher_not_found', 'voucher_reversed', 'engine_voucher', 'fy_locked', 'period_locked', 'voucher_in_closed_fy']) {
    ok(`${c} checked before the first write`, b.indexOf(`post_voucher:${c}`) > 0 && b.indexOf(`post_voucher:${c}`) < b.indexOf(firstWrite));
  }
  ok('journal sequence = aggregate max + 1, computed in the function', /coalesce\(max\(e\.sequence\), 0\) into v_seq/.test(b));
  ok('reversal legs are flipped FROM the current posting event (not client input)', /_voucher_flip_legs\(v_posting\.payload -> 'lines'\)/.test(b) && /reversal_of/.test(b) && /v_posting\.event_id/.test(b));
  ok('current posting = latest reposted, else posted', /event_type in \('voucher\.posted', 'voucher\.reposted'\)\s+order by \(e\.event_type = 'voucher\.reposted'\) desc, e\.sequence desc limit 1/.test(b));
  ok('returns the events it wrote (the app swaps them into memory)', /'events', v_events/.test(b));
  ok('EXECUTE revoked from public/anon, granted to authenticated', new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon`).test(code) && new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to authenticated`).test(code));
}

console.log('edit_voucher specifics');
ok('only editable fields are taken from the payload', /where key in \('type', 'date', 'debitAccountId', 'creditAccountId', 'amount', 'narration', 'memberId', 'lines', 'editHistory'\)/.test(eb));
ok('both the old and the new date must clear the period lock', /v_old_date <= substr\(v_lock_date, 1, 10\)::date or v_new_date <= substr\(v_lock_date, 1, 10\)::date/.test(eb));
ok('new date must be in an open FY', /v_new_date between f\.start_date and f\.end_date/.test(eb) && /post_voucher:no_open_fy_for_date/.test(eb));
for (const c of ['too_few_legs', 'unbalanced', 'negative_amount', 'legs_do_not_match_voucher', 'pending_not_supported', 'voucher_cancelled']) {
  ok(`${c} checked before the first write`, eb.indexOf(`post_voucher:${c}`) > 0 && eb.indexOf(`post_voucher:${c}`) < eb.indexOf('update public.vouchers t set'));
}
ok('old voucher_lines → reversed, new lines inserted (source edit_voucher)', /update public\.voucher_lines set status = 'reversed' where voucher_id = v_id and status = 'posted'/.test(eb) && /'posted', 'edit_voucher'/.test(eb));
ok('voucher_entries REPLACED (delete then insert) — no stale rows', before(eb, 'delete from public.voucher_entries where "voucherId" = v_id', 'insert into public.voucher_entries'));
ok('changed legs → reversed + reposted; no posting → late posted; neutral → none', /elsif v_posting\.payload -> 'lines' is distinct from v_legs then/.test(eb) && /'voucher\.reversed'/.test(eb) && /'voucher\.reposted'/.test(eb) && /if v_posting\.event_id is null then[\s\S]*?'voucher\.posted'/.test(eb));

console.log('cancel_voucher specifics');
ok('idempotent: an already-cancelled voucher returns already_cancelled before any write', before(cb, "'already_cancelled'", 'update public.vouchers set'));
ok('soft-delete + lines reversed + entries deleted', /"isDeleted" = true/.test(cb) && /update public\.voucher_lines set status = 'reversed' where voucher_id = p_id/.test(cb) && /delete from public\.voucher_entries where "voucherId" = p_id/.test(cb));
ok('voucher.cancelled only when a posting exists and none is cancelled yet', /if v_posting\.event_id is not null and not exists \([\s\S]*?event_type = 'voucher\.cancelled'\) then/.test(cb));

console.log('Scope');
ok('no DROP / ALTER TABLE / CREATE TABLE — functions only', !/\bdrop table\b|\balter table\b|\bcreate table\b/i.test(code));
ok('no restore function (the journal has no un-cancel yet)', !/function public\.restore_voucher/.test(code));
ok("records '078' as the last statement", /values \('078', 'edit_cancel_voucher'\)\s*on conflict \(version\) do nothing;\s*commit;\s*$/.test(raw));
ok('down drops all three functions and the 078 record', /drop function if exists public\.edit_voucher\(jsonb, jsonb, text\)/.test(down) && /drop function if exists public\.cancel_voucher\(text, text, text\)/.test(down)
  && /drop function if exists public\._voucher_flip_legs\(jsonb\)/.test(down) && /version = '078'/.test(down));

console.log(`\nS3-d edit/cancel (static): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
