#!/usr/bin/env node
// Audit 2026-11-16, Sprint 5 (docs/audits/SAHAKARLEKHA-USER-JOURNEY-CONVERSION-AUDIT.md, sections 11–12, S-13):
//   1. the page address sent to Google Analytics carries no record id, token, name or free text;
//   2. the login / registration / reset funnel has an event at every step, with a REASON CODE on failure;
//   3. no trackEvent call anywhere in src/ passes a parameter that could hold personal data.
// Run: node scripts/test-funnel-analytics.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const read = (p) => readFileSync(pathResolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const load = (p) => import(pathToFileURL(pathResolve(ROOT, p)).href);
const { analyticsPath, analyticsQuery } = await load('src/lib/analyticsPath.ts');
const { needsAppData } = await load('src/lib/appDataPaths.ts');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const P = (p) => analyticsPath(p, needsAppData);
const Q = (p, s) => analyticsQuery(p, s, needsAppData);

console.log('analyticsPath');
ok('a member\'s page loses the member id', P('/members/3f2a9c1e-77aa') === '/members/:id');
ok('the member portal loses the society id', P('/member/d5e007f0-1111-2222-3333-444444444444') === '/member/:id' && P('/sadasya/abc') === '/sadasya/:id');
ok('a plain app screen is unchanged', P('/vouchers') === '/vouchers' && P('/dashboard') === '/dashboard');
ok('named sections keep their name (it is not a record)', P('/hub/reports') === '/hub/reports' && P('/super-admin/feedback') === '/super-admin/feedback');
ok('public content addresses are unchanged (they are the product of the site)', P('/blog/some-post') === '/blog/some-post' && P('/glossary/account') === '/glossary/account' && P('/software/dairy') === '/software/dairy' && P('/en/blog/some-post') === '/en/blog/some-post');
ok('home, /en and single-segment pages are unchanged', P('/') === '/' && P('/en') === '/en' && P('/pricing') === '/pricing');
ok('an unknown deeper app path is masked too (unknown paths count as app)', P('/some-new-screen/abc/def') === '/some-new-screen/:id');

console.log('analyticsQuery');
ok('one-time and long-lived tokens never leave the browser', Q('/verify-email', '?token=abcdef0123456789') === '' && Q('/email-unsubscribe', '?token=zzz&x=1') === '');
ok('the assistant\'s question is dropped (it can name a member)', Q('/ask', '?q=ram+kumar+ka+balance') === '' && Q('/en/ask', '?q=x') === '');
ok('?next= and ?ref= are dropped', Q('/register', '?next=%2Fsales&ref=SL-ABC234') === '' && Q('/login', '?next=/vouchers') === '');
ok('the type / state a visitor came with are kept (they are categories)', Q('/register', '?type=dairy&state=haryana&next=%2Fsales') === '?type=dairy&state=haryana');
ok('which view of an app screen was open is kept', Q('/vouchers', '?billwise=receive') === '?billwise=receive' && Q('/vouchers', '?mode=expert&type=journal') === '?mode=expert&type=journal' && Q('/surplus-appropriation', '?step=3') === '?step=3');
ok('free text inside the app is dropped, even under an allowed key', Q('/members', '?q=ram+kumar') === '' && Q('/members', '?tab=राम कुमार') === '' && Q('/ledger', '?type=' + 'a'.repeat(60)) === '');
ok('a public search term is kept (the privacy policy says so), with a length cap', Q('/search', '?q=share+capital') === '?q=share%20capital' && Q('/search', '?q=' + 'a'.repeat(101)) === '');
ok('unknown keys are dropped everywhere', Q('/pricing', '?utm_source=x&gclid=y&email=a%40b.c') === '');
ok('no query → empty string', Q('/pricing', '') === '' && Q('/pricing', '?') === '');

console.log('usePageTracking uses them');
const an = read('src/lib/analytics.ts');
ok('page_path, page_location and the fallback title are all built from the cleaned address',
  /const path = analyticsPath\(location\.pathname, needsAppData\);/.test(an) && /const search = analyticsQuery\(location\.pathname, location\.search, needsAppData\);/.test(an)
  && /page_path: path \+ search,/.test(an) && /const pageLocation = window\.location\.origin \+ path \+ search;/.test(an) && /`SahakarLekha — \$\{path\}`/.test(an));
ok('the raw browser address is no longer sent', !/page_path: location\.pathname/.test(an) && !/origin \+ location\.pathname/.test(an));

const vit = read('src/lib/vitals.ts');
ok('web_vitals and app_error report the cleaned path too (3 places)', (vit.match(/page_path: analyticsPath\(window\.location\.pathname, needsAppData\)/g) || []).length === 3 && !/page_path: window\.location\.pathname/.test(vit));

console.log('Funnel events');
const login = read('src/pages/Login.tsx'), reg = read('src/pages/Register.tsx'), reset = read('src/pages/ResetPassword.tsx');
const has = (src, name) => new RegExp(`trackEvent\\('${name}'`).test(src);
for (const e of ['login_form_start', 'login_submit', 'login_failure', 'login', 'mfa_challenge_view', 'mfa_failure', 'password_reset_start', 'password_reset_send_failed', 'session_ended'])
  ok(`Login emits ${e}`, has(login, e));
ok('login_failure carries the reason code login() returned', /trackEvent\('login_failure', \{ reason: result\.reason \?\? 'credentials' \}\)/.test(login));
ok('login_submit is sent before the request, login only on success', login.indexOf("trackEvent('login_submit')") < login.indexOf('await login(email, password)') && login.indexOf("trackEvent('login', { method: 'email' })") > login.indexOf('await login(email, password)'));
ok('ResetPassword emits password_reset_success after the password is saved', has(reset, 'password_reset_success') && reset.indexOf("trackEvent('password_reset_success')") > reset.indexOf('supabase.auth.updateUser'));
for (const e of ['sign_up_start', 'sign_up_step', 'sign_up_failure', 'sign_up']) ok(`Register emits ${e}`, has(reg, e));
const reasons = [...reg.matchAll(/fail\('([a-z_]+)', [12]\)/g)].map((m) => m[1]);
ok(`sign_up_failure reasons are fixed codes (${[...new Set(reasons)].join(', ')})`, ['required', 'email_format', 'password_mismatch', 'password_short', 'referral_shape', 'network'].every((r) => reasons.includes(r)));
ok('a server refusal is reported as a known code or "server" — never the message text', /fail\(code === 'duplicate_registration' \|\| code === 'duplicate_email' \|\| code === 'society_exists' \|\| code === 'rate_limited' \? code : 'server', 2\);/.test(reg));
ok('sign_up says the society type, whether a referral code was used and how the visitor arrived', /trackEvent\('sign_up', \{ method: 'email', society_type: societyType, has_referral: !!refCode, entry \}\)/.test(reg));
ok('sign_up is still sent only after the society exists', reg.indexOf("trackEvent('sign_up',") > reg.indexOf("rpc('register_society'"));
ok('the first dashboard view of an empty society is counted once per session', /trackEvent\('dashboard_first_view'\)/.test(read('src/components/dashboard/OnboardingChecklist.tsx')) && /sl\.ga\.firstDashboard/.test(read('src/components/dashboard/OnboardingChecklist.tsx')));
const banner = read('src/components/SubscriptionBanner.tsx');
ok('the plan notice is counted once per session per state, with the role group only', /trackEvent\('plan_notice_view', \{ state: notice, role_group: roleGroup \}\)/.test(banner) && /trackEvent\('plan_cta_click'/.test(banner));

console.log('No personal data in any event, anywhere in src/');
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = pathResolve(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(n) ? [p] : []; });
// Parameter NAMES that would carry a person's or a society's identity, or a secret.
const FORBIDDEN_KEY = /\b(e?mail|phone|mobile|tel|password|passwd|pwd|otp|token|secret|pan|aadhaar|gstin|society_?id|societyId|society_?name|societyName|member_?id|memberId|member_?name|user_?id|userId|user_?name|userName|registration_?no|registrationNo|referral_?code|address|code)\s*:/i;
// Values passed straight from a form field or the signed-in user.
const FORBIDDEN_VALUE = /\b(adminEmail|adminPassword|adminName|confirmPassword|fpEmail|registrationNo|societyName|referralCode|refCode\b(?!\s*\})|user\.email|user\.name|user\.societyId|password|mfaCode)\b/;
let calls = 0;
const bad = [];
for (const file of walk(pathResolve(ROOT, 'src'))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/trackEvent\(\s*'([a-z_]+)'\s*(?:,\s*(\{[^}]*\}))?\s*\)/g)) {
    calls++;
    const params = m[2] ?? '';
    const withoutBooleans = params.replace(/has_referral: !!refCode/, 'has_referral: true');
    if (FORBIDDEN_KEY.test(withoutBooleans) || FORBIDDEN_VALUE.test(withoutBooleans)) bad.push(`${file.replace(ROOT, '').replace(/\\/g, '/')}: ${m[0]}`);
  }
}
ok(`scanned ${calls} trackEvent calls`, calls >= 45);
ok(`none passes a personal-data parameter${bad.length ? ' — ' + bad.join(' | ') : ''}`, bad.length === 0);
const pp = read('src/content/legal/privacySections.tsx');   // SEO-04: the policy text moved here (the page renders it)
ok('the privacy policy says login / registration steps are sent, and what is not', /लॉगिन\/पंजीकरण के चरण/.test(pp) && /login \/ registration steps/.test(pp) && /never your email, your password or anything typed into a form/.test(pp));

console.log(`\nfunnel-analytics / sprint-5: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
