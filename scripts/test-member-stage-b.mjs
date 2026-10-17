// Member-area re-audit 2026-10-17 — stage B (server-side security). STATIC guard for migrations 120–123, the
// member-portal-login Edge Function and the keyed login email. (The SQL behaviour itself was rehearsed on a throwaway
// local Postgres 18 with prod's helper bodies: cashier / employee / role-less refused, accountant allowed, duplicate
// member number refused, FY lock blocks users but not service role / SQL editor, audit actor stamped, 5 tries then
// lock, PII redirected — this file pins the source so none of that can silently regress.)
// Run: node scripts/test-member-stage-b.mjs   (npm run test:member-stage-b)
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const sql = (p) => read(p).replace(/--[^\n]*/g, '');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── 120: role-scoped writes, server FY lock, one live member number ──
const m120 = sql('supabase/migrations/120_members_write_scope.sql');
const d120 = sql('supabase/migrations/120_members_write_scope_down.sql');
ok(/begin;[\s\S]*commit;/.test(m120), '120 runs in a transaction');
ok(/jwt_can_write_members\(\)[\s\S]*?coalesce\(auth\.jwt\(\) ->> 'user_role', ''\) in \('admin', 'societyAdmin', 'accountant', 'secretary', 'manager'\)/.test(m120), 'jwt_can_write_members: exactly the five member-office roles, fail-closed on a missing claim');
for (const cmd of ['insert', 'update', 'delete']) {
  const re = new RegExp(`create policy members_tenant_${cmd} on public\\.members for ${cmd}[\\s\\S]*?jwt_can_write_members\\(\\)`);
  ok(re.test(m120), `members ${cmd} policy uses jwt_can_write_members`);
}
ok(!/members_tenant_select/.test(m120), 'SELECT policy untouched');
ok(/member_photos_insert[\s\S]*?jwt_can_write_members\(\)/.test(m120) && /member_photos_delete[\s\S]*?jwt_can_write_members\(\)/.test(m120), 'photo storage writes use the same role gate');
ok(/before insert or update or delete on public\.members[\s\S]*members_fy_lock_guard/.test(m120), 'FY-lock trigger on every write');
ok(/auth\.jwt\(\) is null or coalesce\(auth\.jwt\(\) ->> 'role', ''\) = 'service_role'/.test(m120), 'FY-lock trigger lets the SQL editor and service-role jobs through');
ok(/coalesce\(s\."fyLocked", false\)[\s\S]*raise exception 'members:fy_locked'/.test(m120), 'locked year raises members:fy_locked');
ok(/security definer set search_path to ''/.test(m120), 'trigger function pins search_path');
ok(/create unique index if not exists members_society_memberid_live_uq[\s\S]*on public\.members \(society_id, "memberId"\)[\s\S]*where not coalesce\("isDeleted", false\) and coalesce\("memberId", ''\) <> ''/.test(m120), 'unique live member number per society (soft-deleted may be reissued)');
ok(/members_tenant_update[\s\S]*jwt_can_write\(\)/.test(d120) && /drop function if exists public\.jwt_can_write_members\(\)/.test(d120) && /drop index if exists public\.members_society_memberid_live_uq/.test(d120), '120 down restores jwt_can_write and drops the new objects');
ok(read('supabase-tables.sql').includes('members_society_memberid_live_uq'), 'schema file declares the index');

// ── 121: audit actor stamped by the server ──
const m121 = sql('supabase/migrations/121_audit_actor_stamp.sql');
ok(/before insert on public\.audit_log/.test(m121), '121 stamps BEFORE INSERT');
ok(/v_email is null or coalesce\(auth\.jwt\(\) ->> 'role', ''\) = 'service_role'/.test(m121), 'service role / SQL editor rows keep their actor');
ok(/new\.actor_email := v_email/.test(m121) && /new\.actor_role\s*:= coalesce\(v_role, new\.actor_role\)/.test(m121) && /from public\.society_users su/.test(m121), 'signed-in rows get email + role from the JWT, name from society_users');

// ── 122: PII Phase 3 ──
const m122 = sql('supabase/migrations/122_member_pii_phase3.sql');
ok(/to_regclass\('public\.member_identity'\) is null[\s\S]*raise exception/.test(m122), '122 refuses to run without 106');
ok(/insert into public\.member_identity[\s\S]*?on conflict \(society_id, member_id\) do nothing;/.test(m122), 'legacy PII copied first, an existing identity row never overwritten');
ok(/before insert or update on public\.members[\s\S]*members_pii_redirect/.test(m122) && /new\.aadhaar := null;\s*new\.pan := null;/.test(m122), 'a stale tab cannot put PII back on members');
ok(/update public\.members set aadhaar = null, pan = null/.test(m122), 'originals blanked');
ok(/^-- RUN LAST/m.test(read('supabase/migrations/122_member_pii_phase3.sql')) && /PREVIEW/.test(read('supabase/migrations/122_member_pii_phase3.sql')), '122 says run last + gives the preview query');

// ── 123: login attempt limit ──
const m123 = sql('supabase/migrations/123_member_portal_login_lockout.sql');
ok(/revoke all on public\.member_portal_login_attempts from anon, authenticated/.test(m123), 'attempt table unreachable from browsers');
for (const fn of ['member_portal_login_begin\\(text\\)', 'member_portal_login_success\\(text\\)', 'member_portal_end_sessions\\(uuid\\)']) {
  ok(new RegExp(`revoke execute on function public\\.${fn} from public, anon, authenticated`).test(m123) && new RegExp(`grant execute on function public\\.${fn} to service_role`).test(m123), `${fn.replace(/\\\\/g, '')}: service role only`);
}
ok(/c_max\s+constant integer\s+:= 5/.test(m123) && /for update/.test(m123), '5 attempts, taken under a row lock (no parallel slip-through)');
ok(/delete from auth\.sessions where user_id = p_user/.test(m123), 'end_sessions removes the member sessions (refresh tokens cascade)');

// ── keyed login email + login function ──
const core = await import(pathToFileURL(resolve(ROOT, 'supabase/functions/_shared/member-portal-core.mjs')).href);
const P = 'p'.repeat(40);
const e1 = await core.memberLoginEmailV2('SOC1', ' m-001 ', P);
ok(e1 === await core.memberLoginEmailV2('SOC1', 'M-001', P) && /^m2-[0-9a-f]{40}@m\.sahakarlekha\.com$/.test(e1), 'keyed email: deterministic, normalised, m2- prefix');
ok(e1 !== await core.memberLoginEmailV2('SOC1', 'M-001', 'q'.repeat(40)) && e1 !== await core.memberLoginEmail('SOC1', 'M-001'), 'keyed email depends on the secret and differs from the legacy address');
let threw = false; try { await core.memberLoginEmailV2('SOC1', 'M-001', 'short'); } catch { threw = true; }
ok(threw, 'a missing / short pepper is refused');
ok(/^[0-9a-f]{64}$/.test(await core.loginAttemptKey(e1)), 'attempt key is a sha256 hex (no email stored)');
ok(core.parseLoginRequest({ society_id: 'S', member_no: 'm-1', pin: '012345' }).ok && !core.parseLoginRequest({ society_id: 'S', member_no: 'm-1', pin: '12345' }).ok && !core.parseLoginRequest({ society_id: '', member_no: 'x', pin: '123456' }).ok, 'login body: 6-digit PIN, society + member no required');

const fnPath = 'supabase/functions/member-portal-login/index.ts';
ok(existsSync(resolve(ROOT, fnPath)), 'member-portal-login exists');
const lf = read(fnPath);
ok(lf.indexOf("svc.rpc('member_portal_login_begin'") > -1 && lf.indexOf("svc.rpc('member_portal_login_begin'") < lf.indexOf('signInWithPassword'), 'an attempt slot is taken BEFORE the PIN is tried');
ok(lf.includes("reason: 'locked'") && lf.includes("reason: 'invalid'") && !/reason: 'not_found'|member_not_found/.test(lf), 'refusals are generic (no member-existence oracle)');
ok(lf.includes("pepper.length < 32") && lf.includes("member_portal_login_success"), 'fails closed without the secret; success clears the counter');
ok(!/access_token[^\n]*email|email[^\n]*json\(\{ ok: true/.test(lf), 'the login email is never returned to the browser');

const adm = read('supabase/functions/member-portal-admin/index.ts');
ok(adm.includes('memberLoginEmailV2(societyId, memberNo, pepper)') && !/await memberLoginEmail\(/.test(adm), 'admin issues logins on the keyed email only');
ok(/updateUserById\(link\.auth_user_id, \{ password: pin, email, email_confirm: true \}\)/.test(adm), 'reset_pin moves a legacy login to the keyed email');
ok((adm.match(/await endSessions\(link\.auth_user_id\)/g) || []).length >= 2, 'reset_pin and revoke end the member sessions');
ok(adm.includes("if (pepper.length < 32) return fail('server_error', 500);"), 'admin never issues an unkeyed login');

// ── browser ──
const cl = read('src/lib/memberPortalClient.ts');
ok(cl.includes('/functions/v1/member-portal-login') && cl.includes('auth.setSession(') && !cl.includes('signInWithPassword') && !cl.includes('memberLoginEmail'), 'portal sign-in goes through the Edge Function; the browser derives no login email');
ok(read('src/pages/MemberPortal.tsx').includes("res.reason === 'locked' ? 'locked'"), 'portal page explains the 15-minute lock');
const ho = await import(pathToFileURL(resolve(ROOT, 'src/lib/memberPortalHandout.ts')).href);
if (ho) {
  const noPin = ho.handoutMessage({ memberName: 'R', memberNo: 'M-1', pin: null, url: 'u' });
  ok(!/\d{6}/.test(noPin) && noPin.includes('अलग से'), 'hand-out without PIN says the PIN comes separately');
} else ok(true, '');
const dlg = read('src/components/members/MemberPortalDialog.tsx');
ok(dlg.includes('whatsappLink(member.phone, whatsappMessage)') && dlg.includes('pin: null, url'), 'the WhatsApp link (text in the URL) carries no PIN');

// ── friendly server refusals + edit duplicate check ──
const we = await import(pathToFileURL(resolve(ROOT, 'src/lib/members/writeErrors.ts')).href);
if (we) {
  ok(/पहले से/.test(we.memberWriteErrorText({ code: '23505', message: 'duplicate key value violates unique constraint "members_society_memberid_live_uq"' })), 'duplicate number → Hindi reason');
  ok(/audit-lock/.test(we.memberWriteErrorText({ message: 'members:fy_locked' })), 'FY lock → Hindi reason');
  ok(/भूमिका/.test(we.memberWriteErrorText({ code: '42501', message: 'new row violates row-level security policy for table "members"' })), 'RLS refusal → Hindi reason');
  ok(we.memberWriteErrorText({ message: 'network' }) === null, 'anything else → generic text');
} else ok(true, '');
const dc = read('src/contexts/DataContext.tsx');
ok((dc.match(/memberWriteErrorText\(error\) \?\?/g) || []).length >= 3, 'add / update / status toasts use the friendly reason');
ok(read('src/pages/Members.tsx').includes("allMembers.some(m => m.id !== editMember.id && (m.memberId || '').trim().toLowerCase() === editedNo.toLowerCase())"), 'editing a member number checks for a duplicate');

console.log(`member-stage-b: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
