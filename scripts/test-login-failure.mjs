#!/usr/bin/env node
// Audit 2026-11-16, Sprint 1 (docs/audits/SAHAKARLEKHA-USER-JOURNEY-CONVERSION-AUDIT.md) — guards for:
//   J-1  a login failure says what actually failed (network / server / too many attempts / inactive)
//   J-2  the login page never claims a request was recorded when nothing was sent anywhere
//   J-7  the plan banner does not send a non-admin to a page they cannot open
//   S-2  the idle timeout really ends the Supabase session, and does not kick a tab the user is working in
//   S-3  deactivating a user checks the result (RULE 1) and a deactivated user has no society (migration 173)
//   S-1  register_society forces every inserted row into the society being registered (migration 172)
// Pure functions are imported and run; the wiring is pinned from source.
// Run: node scripts/test-login-failure.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const read = (p) => readFileSync(pathResolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const code = (sql) => sql.replace(/--[^\n]*/g, '');
const { classifyAuthError, idleRemainingMs, parseLogoutReason } =
  await import(pathToFileURL(pathResolve(ROOT, 'src/lib/auth/loginFailure.ts')).href);

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

console.log('classifyAuthError');
ok('wrong password (400 invalid_credentials) → credentials', classifyAuthError({ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }) === 'credentials');
ok('no error object → credentials (the generic message stays the default)', classifyAuthError(null) === 'credentials');
ok('supabase-js dropped connection (AuthRetryableFetchError, status 0) → network', classifyAuthError({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }) === 'network');
ok('"Failed to fetch" without a status → network', classifyAuthError({ message: 'TypeError: Failed to fetch' }) === 'network');
ok('browser offline → network, whatever the error says', classifyAuthError({ status: 400 }, false) === 'network');
ok('429 → rate_limited', classifyAuthError({ status: 429, message: 'Request rate limit reached' }) === 'rate_limited');
ok('over_request_rate_limit code → rate_limited', classifyAuthError({ status: 400, code: 'over_request_rate_limit' }) === 'rate_limited');
ok('500 / 503 → service', classifyAuthError({ status: 500 }) === 'service' && classifyAuthError({ status: 503 }) === 'service');
ok('email_not_confirmed stays credentials (no account detail leaks)', classifyAuthError({ status: 400, code: 'email_not_confirmed' }) === 'credentials');

console.log('idleRemainingMs / parseLogoutReason');
const T = 30 * 60 * 1000;
ok('activity 10 minutes ago in another tab → 20 minutes left (no sign-out)', idleRemainingMs(1_000_000, 1_000_000 + 10 * 60 * 1000, T) === 20 * 60 * 1000);
ok('activity exactly at the limit → 0 (sign out)', idleRemainingMs(0, T, T) === 0);
ok('activity older than the limit → negative (sign out)', idleRemainingMs(0, T + 1, T) < 0);
ok('no recorded activity → sign out (fail closed)', idleRemainingMs(null, 5, T) === 0 && idleRemainingMs(NaN, 5, T) === 0);
ok('only known reasons are accepted from sessionStorage', parseLogoutReason('idle') === 'idle' && parseLogoutReason('inactive') === 'inactive' && parseLogoutReason('<b>x</b>') === null && parseLogoutReason(null) === null);

console.log('AuthContext wiring');
const auth = read('src/contexts/AuthContext.tsx');
const loginFn = auth.slice(auth.indexOf('const login = async'), auth.indexOf('const logout = useCallback'));
ok('login() classifies the Supabase error instead of ignoring it', /if \(authError\) failure = classifyAuthError\(authError, online\);/.test(loginFn));
ok('a thrown request is a network failure, not a wrong password', /catch \{[^}]*failure = 'network';/.test(loginFn));
ok('login() returns the reason', /return \{ status: 'failed', reason: failure \};/.test(loginFn));
ok('correct password but no active user → signed out and reported as inactive',
  /await supabase\.auth\.signOut\(\{ scope: 'local' \}\)[\s\S]*?failure = rowFailure === null \? 'inactive'/.test(loginFn));
ok('a failed society_users read is not called "inactive"', /const rowFailure = rowError \? classifyAuthError\(rowError, online\) : null;/.test(loginFn));
const idle = auth.slice(auth.indexOf('const armIdleTimer'), auth.indexOf('// Restore Supabase Auth session on mount'));
ok('idle timer ends the Supabase session in this browser (not only React state)', /supabase\.auth\.signOut\(\{ scope: 'local' \}\)[^;]*\.finally\(doLogout\)/.test(idle));
ok('idle timer checks activity shared by the other tabs before signing out', /idleRemainingMs\(last \|\| null, Date\.now\(\), SESSION_TIMEOUT_MS\)/.test(idle) && /if \(left > 0\) \{ armIdleTimer\(left\); return; \}/.test(idle));
ok('the idle sign-out leaves a reason for the login page', /noteLogoutReason\('idle'\)/.test(idle));
ok('nothing sets the timer to the UI-only doLogout any more', !/setTimeout\(doLogout/.test(auth));
ok('restore: no active user and not a platform admin → session ended, but never on a failed request',
  /if \(!rowError && !saError && getAuthSession\(\)\) \{\s*noteLogoutReason\('inactive'\);/.test(auth));
ok('password reset no longer logs the response / address to the console', !/console\.(info|error|log)\('\[Auth\]/.test(auth));

console.log('Login page');
const login = read('src/pages/Login.tsx');
for (const r of ['network', 'service', 'rate_limited', 'inactive']) ok(`has its own message for "${r}"`, new RegExp(`result\\.reason === '${r}'`).test(login));
ok('the "Forgot User ID" form that sent nothing is gone', !/handleForgotIdSubmit|fiName|fiPhone|fiSubmitted/.test(login));
ok('no "request received / noted" claim anywhere on the page', !/Request Received|Request noted|अनुरोध प्राप्त हुआ|अनुरोध दर्ज किया गया/.test(login));
ok('a reset that could not be sent is shown as a failure', /setFpFailed\(!result\.success\)/.test(login) && /\{fpFailed \? \(/.test(login));
ok('the "sent" message does not confirm that the address has an account', /अगर "\$\{fpEmail\}" सहकार लेखा में पंजीकृत है/.test(login) && !/पर पासवर्ड reset लिंक भेजा गया है/.test(login));
ok('the logout reason is read once and cleared', /parseLogoutReason\(window\.sessionStorage\.getItem\(LOGOUT_REASON_KEY\)\)/.test(login) && /sessionStorage\.removeItem\(LOGOUT_REASON_KEY\)/.test(login));

console.log('Plan banner + deactivation');
const banner = read('src/components/SubscriptionBanner.tsx');
ok('the banner links to the plan page only for a user who can open it', /const canBuy = can\('userMgmt'\);/.test(banner) && /canBuy\s*\? <Link to=\{PLAN_PAGE\}/.test(banner));
ok('no unconditional link to the plan page is left', (banner.match(/<Link /g) || []).length === 1);
ok('everyone else is told to ask the Admin (Hindi first)', /Plan लेने के लिए अपने Admin से कहें/.test(banner));
const um = read('src/pages/UserManagement.tsx');
const toggle = um.slice(um.indexOf('const toggleActive = async'), um.indexOf('// ECR-12 — admin resets a locked-out user'));
ok('toggleActive reads the result of the update', /const \{ data, error \} = await supabase\.from\('society_users'\)\.update\(\{ is_active: newVal \}\)\.eq\('id', id\)\.select\('id'\);/.test(toggle));
ok('an RLS refusal (0 rows) counts as a failure', /failed = !!error \|\| !data \|\| data\.length === 0;/.test(toggle));
ok('on failure the switch is reverted and a destructive toast ≥ 10 s is shown (RULE 1)', /apply\(!newVal\);/.test(toggle) && /variant: 'destructive'/.test(toggle) && /duration: 12000/.test(toggle));

console.log('Migration 172 — register_society');
const m172 = code(read('supabase/migrations/172_register_society_own_rows.sql'));
ok('accounts rows are forced into the society being registered', /jsonb_agg\(a\.elem \|\| jsonb_build_object\('society_id', p_society_id\)\)/.test(m172));
ok('society and settings ids are forced too', /v_society\s*:= p_society\s*\|\| jsonb_build_object\('id', p_society_id\);/.test(m172) && /v_settings := p_settings \|\| jsonb_build_object\('id', p_society_id, 'society_id', p_society_id\);/.test(m172));
ok('the inserts use the forced payloads, never the raw parameters',
  /jsonb_populate_record\(null::public\.societies, v_society\)/.test(m172) && /jsonb_populate_record\(null::public\.society_settings, v_settings\)/.test(m172)
  && /jsonb_populate_recordset\(null::public\.accounts, v_accounts\)/.test(m172) && !/jsonb_populate_record(set)?\([^)]*, p_(society|settings|accounts)\)/.test(m172));
ok('p_accounts must be an array of a bounded size', /jsonb_typeof\(p_accounts\) <> 'array'/.test(m172) && /jsonb_array_length\(p_accounts\) > 2000/.test(m172));
ok('still SECURITY DEFINER with a pinned search_path', /security definer\s+set search_path = ''/.test(m172));
ok('the error codes Register.tsx reads are unchanged', ['society_exists', 'duplicate_registration', 'duplicate_email'].every((c) => m172.includes(`'${c}'`)));
ok('anon keeps EXECUTE (signup) — nothing revokes it', !/revoke[^;]*register_society/i.test(m172));
const d172 = code(read('supabase/migrations/172_register_society_own_rows_down.sql'));
ok('down restores the trusting body and removes the app_migrations row', /jsonb_populate_recordset\(null::public\.accounts, p_accounts\)/.test(d172) && /delete from public\.app_migrations where version = '172'/.test(d172));

console.log('Migration 173 — a deactivated user has no society');
const m173 = code(read('supabase/migrations/173_inactive_user_no_tenant.sql'));
const fn = (name) => { const a = m173.indexOf(`function public.${name}()`); return a < 0 ? '' : m173.slice(a, m173.indexOf('$function$;', a)); };
ok('get_current_society_id ignores a deactivated row', /is_active is not false/.test(fn('get_current_society_id')));
ok('get_current_user_role ignores a deactivated row', /is_active is not false/.test(fn('get_current_user_role')));
ok('both keep the 2FA gate and the case-insensitive society match', /not public\.jwt_mfa_pending\(\)/.test(fn('get_current_society_id')) && /lower\(email\) = lower\(auth\.jwt\(\) ->> 'email'\)/.test(fn('get_current_society_id')) && /not public\.jwt_mfa_pending\(\)/.test(fn('get_current_user_role')));
const d173 = code(read('supabase/migrations/173_inactive_user_no_tenant_down.sql'));
ok('down removes the filter from both', !/is_active/.test(d173) && /get_current_society_id/.test(d173) && /get_current_user_role/.test(d173));

console.log(`\nlogin-failure / sprint-1: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
