#!/usr/bin/env node
// S3-a · static guard on migration 077 (post_voucher + society_flags). CI-safe (no DB).
// Behaviour as real JWT users on a restored backup: scripts/db-harness/tests/s3a-post-voucher.mjs.
//
// Run: node scripts/test-s3a-post-voucher.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(pathResolve(HERE, '../supabase/migrations/077_post_voucher.sql'), 'utf8');
const code = raw.replace(/--[^\n]*/g, ' ');
const down = readFileSync(pathResolve(HERE, '../supabase/migrations/077_post_voucher_down.sql'), 'utf8');
const fn = code.slice(code.indexOf('create or replace function public.post_voucher'), code.indexOf('$$;') + 3);
const body = fn.slice(fn.indexOf('begin'));

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const before = (a, b) => body.indexOf(a) >= 0 && body.indexOf(b) >= 0 && body.indexOf(a) < body.indexOf(b);

console.log('Security');
ok('SECURITY DEFINER with search_path pinned to empty', /security definer\s+set search_path = ''/.test(fn));
ok('society comes from get_current_society_id(), never the payload', /v_sid\s+text := public\.get_current_society_id\(\)/.test(fn) && /'society_id', v_sid/.test(body) && !/p_voucher ->> 'society_id'/.test(body));
ok('role claim required (fail-closed) and jwt_can_write()', /if v_role is null then raise exception 'post_voucher:no_role_claim'/.test(body) && /if not public\.jwt_can_write\(\)/.test(body));
ok('identity checks run before anything else', before("post_voucher:not_a_society_user", 'select id, society_id'));
ok('EXECUTE revoked from public/anon, granted to authenticated', /revoke all on function public\.post_voucher\(jsonb, jsonb, jsonb\) from public, anon/.test(code) && /grant execute on function public\.post_voucher\(jsonb, jsonb, jsonb\) to authenticated/.test(code));
ok('a voucher id owned by another society is refused', /post_voucher:voucher_id_taken/.test(body));

console.log('Invariants (all checked before the first write)');
const firstWrite = body.indexOf('insert into public.vouchers');
for (const c of ['fy_locked', 'period_locked', 'no_open_fy_for_date', 'too_few_legs', 'unbalanced', 'negative_amount', 'legs_do_not_match_voucher', 'bad_event', 'event_lines_differ', 'pending_not_supported']) {
  const at = body.indexOf(`post_voucher:${c}`);
  ok(`${c} checked before writing`, at > 0 && at < firstWrite);
}
ok('idempotent: an existing voucher id returns status exists before any check that could fail', before("'status', 'exists'", 'post_voucher:pending_not_supported'));

console.log('One transaction, four writes');
const writes = ['insert into public.vouchers', 'insert into public.voucher_lines', 'insert into public.voucher_entries', 'insert into public.ledger_events'];
ok('writes vouchers, voucher_lines, voucher_entries and ledger_events', writes.every((w) => body.includes(w)));
ok('all four inside the one function body (one statement = one transaction)', writes.every((w) => body.indexOf(w) > 0 && body.indexOf(w) < body.lastIndexOf('return jsonb_build_object')));
ok("voucher_lines carry the resolved open FY and source 'post_voucher'", /v_fy, ord::int/.test(body) && /'posted', 'post_voucher'/.test(body));
ok('ledger event forced to voucher.posted, sequence 1, this voucher, the JWT society', /values \(p_event ->> 'event_id', 'voucher\.posted', coalesce\(\(p_event ->> 'schema_version'\)::int, 1\), v_sid, v_juris, 'voucher',\s*v_id, 1,/.test(body));
ok('no UPDATE / DELETE anywhere in the function', !/\bupdate\s+public\.|\bdelete\s+from\b/i.test(body));

console.log('society_flags');
ok('society_flags: posting_service default false, tenant SELECT only, writes revoked', /posting_service\s+boolean not null default false/.test(code)
  && /create policy society_flags_tenant_select on public\.society_flags\s+for select/.test(code) && /revoke insert, update, delete, truncate on public\.society_flags from anon, authenticated/.test(code));
ok("records '077' as the last statement", /values \('077', 'post_voucher'\)\s*on conflict \(version\) do nothing;\s*commit;\s*$/.test(raw));
ok('down drops the function, society_flags and the 077 record', /drop function if exists public\.post_voucher\(jsonb, jsonb, jsonb\)/.test(down) && /drop table if exists public\.society_flags/.test(down) && /version = '077'/.test(down));

console.log(`\nS3-a post_voucher (static): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
