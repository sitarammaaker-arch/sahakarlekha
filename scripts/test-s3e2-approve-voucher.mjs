#!/usr/bin/env node
// S3-e-2 · static guard on migration 079 (approve_voucher) and the approveVoucher wiring. CI-safe.
// Behaviour as real JWT users on a restored backup: scripts/db-harness/tests/s3e2-approve-voucher.mjs.
//
// Run: node scripts/test-s3e2-approve-voucher.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(pathResolve(HERE, '../supabase/migrations/079_approve_voucher.sql'), 'utf8');
const code = raw.replace(/--[^\n]*/g, ' ');
const down = readFileSync(pathResolve(HERE, '../supabase/migrations/079_approve_voucher_down.sql'), 'utf8');
const fn = code.slice(code.indexOf('create or replace function public.approve_voucher('), code.indexOf('$$;') + 3);
const b = fn.slice(fn.indexOf('begin'));
const dc = readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const firstWrite = b.indexOf('update public.vouchers set "approvalStatus"');

console.log('approve_voucher (079)');
ok('SECURITY DEFINER with search_path pinned to empty', /security definer\s+set search_path = ''/.test(fn));
ok('society from the JWT; role claim required; jwt_can_write()', /v_sid\s+text := public\.get_current_society_id\(\)/.test(fn) && /post_voucher:no_role_claim/.test(b) && /if not public\.jwt_can_write\(\)/.test(b));
ok('row locked FOR UPDATE within the JWT society', /society_id::text = v_sid for update/.test(b));
ok('idempotent: already approved → already_approved before any write', b.indexOf("'already_approved'") > 0 && b.indexOf("'already_approved'") < firstWrite);
for (const c of ['voucher_not_found', 'voucher_cancelled', 'engine_voucher', 'not_pending', 'self_approval', 'fy_locked', 'period_locked', 'no_open_fy_for_date', 'too_few_legs', 'unbalanced', 'negative_amount', 'legs_do_not_match_voucher']) {
  ok(`${c} checked before the first write`, b.indexOf(`post_voucher:${c}`) > 0 && b.indexOf(`post_voucher:${c}`) < firstWrite);
}
ok('maker ≠ checker by approver name AND JWT identity; system makers exempt', /not in \('', 'system', 'system \(repair\)'\)/.test(b) && /lower\(u\.email\) = lower\(auth\.jwt\(\) ->> 'email'\)/.test(b));
ok('voucher total read from the STORED row, not the payload', /jsonb_typeof\(v_cur\.lines\)/.test(b) && /round\(v_cur\.amount \* 100\)/.test(b));
ok('lines reversed + reinserted (source approve_voucher); entries replaced', /update public\.voucher_lines set status = 'reversed' where voucher_id = p_id/.test(b) && /'posted', 'approve_voucher'/.test(b)
  && b.indexOf('delete from public.voucher_entries where "voucherId" = p_id') < b.indexOf('insert into public.voucher_entries'));
ok('journal: no posting → voucher.posted; different posting → reversed + reposted', /if v_posting\.event_id is null then[\s\S]*?'voucher\.posted'/.test(b) && /elsif v_posting\.payload -> 'lines' is distinct from v_legs then[\s\S]*?'voucher\.reversed'[\s\S]*?'voucher\.reposted'/.test(b));
ok('sequence = max + 1, computed in the function', /coalesce\(max\(e\.sequence\), 0\) into v_seq/.test(b));
ok('meta = voucherEventMeta shape, createdAt as ISO Z', /'voucherNo', v_cur\."voucherNo"/.test(b) && /'createdBy', coalesce\(v_cur\."createdBy", ''\)/.test(b) && /to_char\(v_cur\."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS\.MS"Z"'\)/.test(b));
ok('EXECUTE revoked from public/anon, granted to authenticated', /revoke all on function public\.approve_voucher\(text, jsonb, text\) from public, anon/.test(code) && /grant execute on function public\.approve_voucher\(text, jsonb, text\) to authenticated/.test(code));
ok("records '079' last; down drops it", /values \('079', 'approve_voucher'\)\s*on conflict \(version\) do nothing;\s*commit;\s*$/.test(raw) && /drop function if exists public\.approve_voucher\(text, jsonb, text\)/.test(down) && /version = '079'/.test(down));

console.log('approveVoucher wiring');
const a = dc.slice(dc.indexOf('const approveVoucher = useCallback('), dc.indexOf('const rejectVoucher = useCallback('));
const rpc = a.slice(a.indexOf('if (postingServiceRef.current)'), a.indexOf("supabase.from('vouchers').upsert(withSoc(updated))"));
ok('posting service → approve_voucher with the getVoucherLines legs, before the table path', rpc.length > 100 && /supabase\.rpc\('approve_voucher', \{ p_id: id, p_lines: buildEditVoucherPayload\(updated\)\.p_lines, p_approved_by: approvedBy \}\)/.test(rpc));
ok('RPC error AND rejection → roll back + destructive toast + reportError', (rpc.match(/undoApprove\(/g) || []).length === 2 && /reportError\('voucher-approve-post-service'/.test(rpc) && /variant: 'destructive', duration: 15000/.test(rpc));
ok("server events swapped into the journal; RPC branch returns before the table path", /mapLedgerEventRows\(/.test(rpc) && /return true;\s*\}\s*$/.test(rpc));
ok('flag off: after the upsert succeeds → entries + ensureVoucherPostedEvent', /syncEntries\(updated\);[\s\S]*?void ensureVoucherPostedEvent\(updated, approvedBy\);/.test(a));
const e = dc.slice(dc.indexOf('const ensureVoucherPostedEvent = async'), dc.indexOf('// P0 #3: append-only audit.'));
ok('ensureVoucherPostedEvent: reads the DB journal, appends only when there is no posting and no cancel', /from\('ledger_events'\)\.select\('event_type, sequence'\)/.test(e)
  && /e\.event_type === 'voucher\.posted' \|\| e\.event_type === 'voucher\.reposted' \|\| e\.event_type === 'voucher\.cancelled'\)\) return;/.test(e) && /sequence: maxSeq \+ 1/.test(e));
ok('ensureVoucherPostedEvent: failures reported, success mirrored into a loaded journal', (e.match(/reportError\('voucher-approve-journal'/g) || []).length >= 2 && /journalLoadedRef\.current/.test(e));

console.log(`\nS3-e-2 approve_voucher (static): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
