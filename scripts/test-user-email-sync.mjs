// User email change must move the Supabase Auth login too (migration 098).
//
// Rania admin, 2026-10-02: User Management wrote society_users.email only, so the Auth login stayed on
// the old email — sign-in to Auth succeeded but the app found no society_users row and said "Invalid
// email or password", even right after a password reset. STATIC checks on the migration + the page.
//
// Run: node scripts/test-user-email-sync.mjs   (npm run test:user-email-sync)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(pathResolve(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.error('  ✗', m); } };

const sql = read('supabase/migrations/098_update_society_user_email.sql');
console.log('migration 098');
ok(/create or replace function public\.app_update_society_user_email\(\s*p_su_id\s+text,[^\n]*\n\s*p_new_email text\s*\)/.test(sql), 'defines app_update_society_user_email(text, text)');
ok(/security definer/.test(sql), 'is SECURITY DEFINER (it writes auth.users)');
ok(/if not public\.is_society_admin\(v_society_id\) then\s*raise exception/.test(sql), 'only an admin of the target society may call it');
ok(/platform_admins/.test(sql) && /This login cannot be changed from here/.test(sql), 'never touches a platform-admin login');
ok(/shared with another society/.test(sql), 'refuses an old email shared with another society');
ok(/This email is already in use/.test(sql) && /from auth\.users u where lower\(u\.email\) = v_new/.test(sql), 'refuses a new email already used by another login or user');
ok(/update auth\.users set email = v_new/.test(sql), 'updates the Auth login email');
ok(/update auth\.identities\s+set identity_data = jsonb_set\(identity_data, '\{email\}'/.test(sql), 'updates the email identity too');
ok(/update public\.society_users set email = v_new/.test(sql), 'updates society_users in the same call');
ok(/insert into public\.audit_log/.test(sql), 'writes an audit_log row');
ok(/revoke execute on function public\.app_update_society_user_email\(text, text\) from public, anon/.test(sql)
  && /grant execute on function public\.app_update_society_user_email\(text, text\) to authenticated/.test(sql), 'anon cannot call it; authenticated can');
ok(/^begin;[\s\S]*insert into public\.app_migrations \(version, name\) values \('098'[\s\S]*commit;\s*$/m.test(sql), 'transactional and recorded in app_migrations');

const page = read('src/pages/UserManagement.tsx');
const edit = page.slice(page.indexOf('if (editing) {'), page.indexOf('} else {', page.indexOf('if (editing) {')));
console.log('UserManagement edit');
ok(/supabase\.rpc\('app_update_society_user_email', \{ p_su_id: editing\.id, p_new_email: newEmail \}\)/.test(edit), 'a changed email goes through the RPC');
ok(edit.indexOf("rpc('app_update_society_user_email'") < edit.indexOf(".from('society_users')"), 'the RPC runs before the other fields are saved');
ok(/if \(emErr\) \{[\s\S]*?return;/.test(edit), 'an RPC failure stops the save with a visible error');
const upd = edit.slice(edit.indexOf('const updateData'), edit.indexOf('};', edit.indexOf('const updateData')));
ok(!/\bemail\s*:/.test(upd), 'the direct society_users update no longer writes email');
ok(/logout\(\)/.test(edit), 'changing your own email signs you out to log in again');

const auth = read('src/contexts/AuthContext.tsx');
console.log('AuthContext');
ok(!/\.eq\('email', email\)/.test(auth), 'society_users lookups match the lower-cased email');

console.log(`\nuser email sync: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
