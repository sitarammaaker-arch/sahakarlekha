// SEC-01 / SEC-05 / MP-01 / REF-01 (product audit 2026-11-17).
//   SEC-01  supabase-tables.sql held 35 allow-everyone ("using (true)") policies behind "if not exists" — re-running it
//           on a database that had lost a policy would re-open that table → all removed, and the file refuses to run
//           where app_migrations exists (a live database).
//   SEC-05  app_mfa_admin_reset matched lower-cased while society_users.email was unique case-sensitively → unique
//           lower(email) index + refusal of a login that also belongs to a society the admin does not run (189).
//   MP-01   legacy member-portal logins (sha256 address, computable) → moved to the keyed address on first login.
//   REF-01  register_society left societies.created_at NULL (21/38) → referral attach always too_late → stamped +
//           backfilled (189).
// PGlite while building: backfill from first financial year / first login, existing value kept, case-variant email
// refused, both functions compile, down removes the index.
// Run: node scripts/test-security-leftovers.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── SEC-01 ──
{
  const s = read('supabase-tables.sql');
  ok(!/using\s*\(\s*true\s*\)/i.test(s), 'supabase-tables.sql creates no allow-everyone policy');
  ok(!/with\s+check\s*\(\s*true\s*\)/i.test(s), '…and no "with check (true)" either');
  const head = s.slice(0, 1200);
  ok(head.includes("if to_regclass('public.app_migrations') is not null then") && head.includes('raise exception'), 'the file refuses to run on a live database (app_migrations exists)');
  ok(s.indexOf("to_regclass('public.app_migrations')") < s.search(/create table/i), '…before it creates or changes anything');
}

// ── 189: SEC-05 + REF-01 ──
const m = read('supabase/migrations/189_mfa_reset_lower_email_and_society_created_at.sql');
const d = read('supabase/migrations/189_mfa_reset_lower_email_and_society_created_at_down.sql');
{
  ok(/create unique index if not exists society_users_email_lower_key on public\.society_users \(lower\(email\)\);/.test(m), 'one login per email whatever its case');
  const f = m.slice(m.indexOf('CREATE OR REPLACE FUNCTION public.app_mfa_admin_reset'), m.indexOf('$function$\n;', m.indexOf('CREATE OR REPLACE FUNCTION public.app_mfa_admin_reset')));
  ok(f.includes('and t.society_id not in (select a.society_id from society_users a') && f.indexOf('-- 189 / SEC-05') < f.indexOf('delete from user_mfa where email = target;'), 'the reset refuses a login that belongs to another society — before deleting anything');
  ok(/revoke execute on function public\.app_mfa_admin_reset\(text, text\) from public, anon;\ngrant execute on function public\.app_mfa_admin_reset\(text, text\) to authenticated;/.test(m), 'mfa reset: signed-in only');
  const r = m.slice(m.indexOf('CREATE OR REPLACE FUNCTION public.register_society'), m.indexOf('$function$\n;', m.indexOf('CREATE OR REPLACE FUNCTION public.register_society')));
  ok(r.includes("jsonb_populate_record(null::public.societies, v_society || jsonb_build_object('created_at', localtimestamp))"), 'register_society stamps created_at (the browser cannot override it)');
  ok(/update public\.societies s\s+set created_at = coalesce\(/.test(m) && m.includes('where s.created_at is null;'), 'the societies without one are backfilled (and only those)');
  ok(m.includes('-- anon-exec: register_society') && /grant execute on function public\.register_society\(text, text, text, text, jsonb, jsonb, jsonb\) to anon, authenticated;/.test(m), 'register_society keeps its public sign-up grant (documented)');
  const att = read('supabase/migrations/164_referral_partners.sql');
  ok(att.includes("v_created is null or v_created < now() - interval '30 minutes'"), 'the referral window it unblocks is unchanged (30 minutes after signup)');
  ok(/drop index if exists public\.society_users_email_lower_key;/.test(d) && /^begin;/m.test(m) && /^commit;/m.test(m) && /values \('189', /.test(m), 'down drops the index; 189 is one transaction and registers itself');
}

// ── MP-01 ──
{
  const s = read('supabase/functions/member-portal-login/index.ts');
  ok(s.includes('if (email === legacyEmail && data.user?.id) {') && s.includes('svc.auth.admin.updateUserById(data.user.id, { email: keyedEmail, email_confirm: true })'), 'a successful legacy login moves itself to the keyed address');
  ok(s.includes("anon.auth.signInWithPassword({ email: keyedEmail, password: parsed.pin })") && s.indexOf('member_portal_login_success') < s.indexOf('if (email === legacyEmail'), 'the member gets a session on the new address, after the attempt counter is cleared');
  ok(s.includes("console.error('member-portal-login: legacy → keyed move failed'"), 'a failed move still lets the member in (and is logged, retried next login)');
}

console.log(`Security leftovers: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
