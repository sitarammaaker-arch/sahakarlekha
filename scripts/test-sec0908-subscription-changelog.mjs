// SEC-09 + SEC-08 (product audit 2026-11-17) — migration 184.
//   SEC-09  an expired subscription paused new vouchers only in the browser → post_voucher / save_pending_voucher refuse
//           with 'subscription_expired' using the same rule as src/lib/plans.ts effectiveStatus.
//   SEC-08  a write straight to a table left no trace → change_log, written only by a trigger on every direct client
//           write; audit_log and change_log refuse update / delete / truncate from app logins.
// The SQL was run end to end on Postgres (PGlite) on 183's bodies while building: before 184 a voucher posted 10 days past
// the end date, a client could delete audit_log, and a direct loan insert left nothing. After 184: past grace and a stored
// 'expired' were refused for posting and for a new held voucher, grace / no end date / no row still posted; a client
// insert / real update / delete each left one change_log row with the token's email + role and only the changed
// column, an unchanged update and the server's own writes left none; the client could neither write change_log nor
// delete / update / truncate audit_log but could still add audit rows; re-run clean; down restored everything.
// Run: node scripts/test-sec0908-subscription-changelog.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const m = read('supabase/migrations/184_subscription_gate_and_change_log.sql');
const d = read('supabase/migrations/184_subscription_gate_and_change_log_down.sql');
const m183 = read('supabase/migrations/183_maker_checker_server.sql');
const fn = (sql, name) => { const i = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`); return i < 0 ? '' : sql.slice(i, sql.indexOf('$function$', sql.indexOf('AS $function$', i) + 14)); };

// ── SEC-09 ──
{
  const gate = m.slice(m.indexOf('create or replace function public.subscription_writable'), m.indexOf('$$;', m.indexOf('create or replace function public.subscription_writable')));
  ok(gate.includes(`s.status = 'expired' or (s.period_end is not null and now() >= s.period_end + interval '7 days')`), 'expired = stored expired OR 7 days past period_end');
  const plans = read('src/lib/plans.ts');
  ok(/export const GRACE_DAYS = 7;/.test(plans) && plans.includes("nowMs >= end + GRACE_DAYS * DAY_MS ? 'expired' : 'grace'") && plans.includes('if (!periodEnd) return stored;'), 'the client rule is still 7 days of grace / no end date = stored status');
  ok(/revoke execute on function public\.subscription_writable\(text\) from public, anon, authenticated;/.test(m), 'a browser cannot probe another society\'s plan through the gate');
  const strip = (s) => s.replace(/  -- 184 \/ SEC-09[^\n]*\n  if not public\.subscription_writable\(v_sid\) then raise exception 'post_voucher:subscription_expired'; end if;\n/, '');
  for (const name of ['post_voucher', 'save_pending_voucher']) {
    const f = fn(m, name);
    ok(f.includes(`if not public.subscription_writable(v_sid) then raise exception 'post_voucher:subscription_expired'; end if;`), `${name} refuses on an expired plan`);
    ok(strip(f) === fn(m183, name), `${name} = 183's body + only the gate`);
    ok(fn(d, name) === fn(m183, name), `down restores 183's ${name}`);
  }
  const sp = fn(m, 'save_pending_voucher');
  ok(sp.indexOf('subscription_expired') > sp.indexOf("return jsonb_build_object('status', 'updated'"), 'only a NEW held voucher is paused; editing one already held is not');
  const pv = fn(m, 'post_voucher');
  ok(pv.indexOf('subscription_expired') > pv.indexOf("'status', 'exists'"), 'a retry of a voucher already saved still answers "exists"');
  for (const f of ['approve_voucher', 'reject_voucher', 'edit_voucher', 'cancel_voucher']) ok(!new RegExp(`function public\\.${f}\\(`, 'i').test(m), `${f} is untouched (existing vouchers stay manageable)`);
}

// ── SEC-08 ──
{
  ok(/create table if not exists public\.change_log/.test(m) && /revoke all on table public\.change_log from public, anon, authenticated;\ngrant select on table public\.change_log to authenticated;/.test(m), 'change_log: clients may only read it');
  ok(/create policy change_log_tenant_select on public\.change_log for select to authenticated\n  using \(society_id = public\.get_current_society_id\(\)\);/.test(m), 'each society reads only its own rows');
  const trg = m.slice(m.indexOf('create or replace function public._change_log_row()'), m.indexOf('$$;', m.indexOf('create or replace function public._change_log_row()')));
  ok(/security definer/.test(trg) && trg.includes(`lower(nullif(auth.jwt() ->> 'email', ''))`) && trg.includes(`nullif(auth.jwt() ->> 'user_role', '')`), 'the actor comes from the token');
  ok(trg.includes(`where k not in ('updated_at', 'updatedAt') and (v_new -> k) is distinct from (v_old -> k);`) && trg.includes('if v_changed is null then return null; end if;'), 'an update stores only the changed columns; an unchanged one stores nothing');
  ok(m.includes(`'when (current_user = ''authenticated'') execute function public._change_log_row()'`), 'only direct client writes are logged (server functions already journal)');
  ok(m.includes(`and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'society_id' and not a.attisdropped)`), 'every society table is covered');
  const excl = (m.match(/excl text\[\] := array\[([^\]]*)\]/) || [, ''])[1];
  for (const t of ['audit_log', 'change_log', 'ledger_events', 'error_log', 'subscriptions', 'orders', 'document_sequences']) ok(excl.includes(`'${t}'`), `${t} is not logged (own trail / server-only / counter)`);
  for (const t of ['loans', 'members', 'accounts', 'society_users', 'society_settings', 'deposit_accounts', 'stock_items']) ok(!excl.includes(`'${t}'`), `${t} is logged`);
  const refuse = m.slice(m.indexOf('create or replace function public._refuse_log_rewrite()'), m.indexOf('$$;', m.indexOf('create or replace function public._refuse_log_rewrite()')));
  ok(!/security definer/.test(refuse) && refuse.includes(`if current_user in ('authenticated', 'anon') then`), 'the refusal sees the caller (invoker), owners / migrations can still maintain the table');
  for (const t of ['audit_log', 'change_log']) {
    ok(m.includes(`create trigger refuse_rewrite before update or delete on public.${t} for each row`) && m.includes(`create trigger refuse_truncate before truncate on public.${t} for each statement`), `${t} refuses update / delete / truncate`);
  }
  ok(/revoke update, delete, truncate on table public\.audit_log from anon, authenticated;/.test(m), 'audit_log loses its client update / delete / truncate grants');
  ok(/drop table if exists public\.change_log;/.test(d) && /grant update, delete, truncate on table public\.audit_log to authenticated;/.test(d), 'down drops change_log and restores the grants');
  ok(/^begin;/m.test(m) && /^commit;/m.test(m) && /values \('184', 'subscription_gate_and_change_log'\)/.test(m), '184 is one transaction and registers itself');
}

// ── client message ──
{
  const msg = read('src/lib/ledger/postVoucherMessages.ts');
  ok((msg.match(/\bsubscription_expired:/g) || []).length === 2, 'subscription_expired has a Hindi and an English message');
}

console.log(`SEC-09/08 migration 184: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
