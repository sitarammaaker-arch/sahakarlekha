// MAIL-01 (product audit 2026-11-17) — the anonymous signup could mail strangers a branded invite with caller-typed
// names, to any address, with no limit. Migration 181:
//   - register_society = 172's body + a limit (5 per network per hour, 3 per email per day, 20 in all per hour,
//     hashes only) + a transaction-local "self-signup" mark;
//   - tg_notify_society_user = 143's body, except that a self-signup sends only the neutral email_verify mail.
// The SQL was run end to end on Postgres (PGlite) while building: before 181 the invite carried "Fake Bank Pvt";
// after it the signup mail was email_verify with no name / society name, the 5th signup from one network and the 21st
// in an hour were refused (writing and sending nothing), an admin's invite was unchanged, the down file restored both.
// Run: node scripts/test-mail01-signup.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const m172 = read('supabase/migrations/172_register_society_own_rows.sql');
const m143 = read('supabase/migrations/143_notification_triggers.sql');
const m = read('supabase/migrations/181_signup_throttle_neutral_mail.sql');
const d = read('supabase/migrations/181_signup_throttle_neutral_mail_down.sql');
const rsOf = (s) => s.slice(s.indexOf('create or replace function public.register_society('), s.indexOf('$function$;') + 11);
const tgOf = (s) => { const a = s.indexOf('create or replace function public.tg_notify_society_user()'); return s.slice(a, s.indexOf('$$;', s.indexOf('as $$', a) + 5) + 3); };
const rs172 = rsOf(m172), rs181 = rsOf(m), rsDown = rsOf(d);
const tg143 = tgOf(m143), tg181 = tgOf(m), tgDown = tgOf(d);

// ── register_society: the limit ──
{
  ok(/if \(select count\(\*\) from public\.signup_attempts where at > now\(\) - interval '1 hour'\) >= 20/.test(rs181), 'at most 20 signups an hour in all');
  ok(/where ip_hash = v_ip_hash and at > now\(\) - interval '1 hour'\) >= 5\)/.test(rs181), 'at most 5 an hour from one network');
  ok(/where email_hash = v_em_hash and at > now\(\) - interval '1 day'\) >= 3/.test(rs181), 'at most 3 a day for one email');
  ok(/'error_code', 'rate_limited'/.test(rs181), 'a refused attempt returns rate_limited');
  ok(rs181.indexOf("'rate_limited'") < rs181.indexOf('insert into public.societies'), 'the limit is checked before anything is created');
  ok(/'cf-connecting-ip'[\s\S]*'x-real-ip'[\s\S]*'x-forwarded-for'/.test(rs181), 'the proxy\'s own address headers come before x-forwarded-for');
  ok(/extensions\.digest\(coalesce\(v_ip, 'unknown'\), 'sha256'\)/.test(rs181) && /extensions\.digest\(lower\(trim\(coalesce\(p_email, ''\)\)\), 'sha256'\)/.test(rs181), 'only sha256 hashes of the address and email are kept');
  ok(/delete from public\.signup_attempts where at < now\(\) - interval '2 days'/.test(rs181), 'and only for two days');
  ok(/perform set_config\('sahakarlekha\.signup', 'on', true\);\n  perform public\.app_register_admin\(/.test(rs181), 'the transaction is marked as a self-signup (local) right before the admin user is created');
  const strip = (s) => s
    .replace(/\n  v_ip       text;\n  v_ip_hash  text;\n  v_em_hash  text;/, '')
    .replace(/  -- 181 \(MAIL-01\)[\s\S]*?insert into public\.signup_attempts \(ip_hash, email_hash\) values \(v_ip_hash, v_em_hash\);\n\n/, '')
    .replace(/  -- 181: mark this transaction[^\n]*\n  -- [^\n]*\n  perform set_config\('sahakarlekha\.signup', 'on', true\);\n/, '');
  ok(strip(rs181) === rs172, 'everything else in register_society is 172\'s body unchanged');
}

// ── tg_notify_society_user: a self-signup gets only the neutral verification mail ──
{
  const branch = tg181.slice(tg181.indexOf("if current_setting('sahakarlekha.signup', true) = 'on' then"), tg181.indexOf('      else\n'));
  ok(/'email_verify', v_email, jsonb_build_object\('token', v_token\)/.test(branch) && /'signup_verify:' \|\| new\.id::text/.test(branch), 'self-signup → email_verify carrying only the token');
  ok(!/society_name|new\.name|new\.role/.test(branch), 'nothing the caller typed (no name, no society name, no role) is in that mail');
  ok(/if v_token is not null then/.test(branch), 'an already-verified address gets nothing');
  const strip = (s) => s.replace(/      if current_setting\('sahakarlekha\.signup', true\) = 'on' then[\s\S]*?      else\n/, '').replace(/\n      end if;\n    elsif new\.role/, '\n    elsif new.role');
  ok(strip(tg181) === tg143, 'every other invite (made by a signed-in admin) is 143\'s, unchanged');
}

// ── table, grants, down, page ──
{
  ok(/alter table public\.signup_attempts enable row level security;/.test(m) && /revoke all on table public\.signup_attempts from public, anon, authenticated;/.test(m), 'signup_attempts is closed to every client role');
  ok(!/revoke execute on function public\.register_society/.test(m), 'register_society stays callable by anon (signup runs before login)');
  ok(/^begin;/m.test(m) && /^commit;/m.test(m) && /values \('181', 'signup_throttle_neutral_mail'\)/.test(m), '181 runs in one transaction and registers itself');
  ok(rsDown === rs172 && tgDown === tg143 && /drop table if exists public\.signup_attempts;/.test(d), 'the down file restores 172 / 143 verbatim and drops the table');
  const reg = read('src/pages/Register.tsx');
  ok(/if \(code === 'rate_limited'\) \{/.test(reg) && /एक घंटे बाद फिर कोशिश करें/.test(reg) && /try again in an hour/.test(reg), 'the Register page explains a refused attempt (Hindi first, RULE 7)');
}

console.log(`MAIL-01 signup limit + neutral mail: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
