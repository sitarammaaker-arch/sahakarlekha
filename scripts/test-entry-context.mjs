#!/usr/bin/env node
// Audit 2026-11-16, Sprint 2 (docs/audits/SAHAKARLEKHA-USER-JOURNEY-CONVERSION-AUDIT.md) — guards for:
//   J-3   ?next= survives login and registration, and can only ever be an in-app path of this site
//   J-4   a new society is signed in after registering instead of being sent to type its password again
//   J-5   the Register page states the trial and links the terms
//   J-10  /software/<type> and /cooperative-software/<state> pre-select the type / state on Register
//   J-12  a half-filled registration survives a refresh — without ever storing the email or password
// Run: node scripts/test-entry-context.mjs

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const read = (p) => readFileSync(pathResolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const load = (p) => import(pathToFileURL(pathResolve(ROOT, p)).href);
const { safeNext, withNext, resolveEntryType, resolveEntryState, MAX_NEXT_LENGTH } = await load('src/lib/auth/entryContext.ts');
const { needsAppData } = await load('src/lib/appDataPaths.ts');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const next = (raw) => safeNext(raw, needsAppData);

console.log('safeNext — accepted');
ok('/sales', next('/sales') === '/sales');
ok('/vouchers?billwise=receive keeps its query', next('/vouchers?billwise=receive') === '/vouchers?billwise=receive');
ok('/members/abc-123 (detail page)', next('/members/abc-123') === '/members/abc-123');
ok('/hub/reports', next('/hub/reports') === '/hub/reports');

console.log('safeNext — refused (open redirect and friends)');
const HOSTILE = [
  'https://evil.example/', 'http://evil.example', '//evil.example', '/\\evil.example', '\\\\evil.example',
  '/%2Fevil.example', '/%2fevil.example/x', '/%5Cevil.example', 'javascript:alert(1)', 'data:text/html,x',
  '/sales//evil.example', '/sales@evil.example', '/sales\n/x', '/sales x', '/ sales', '/../login', '/sales/../../x',
  '/./sales', '/', '', '   ', 'sales', '/%00sales', '/-x', '/?next=/sales',
];
for (const h of HOSTILE) ok(`refuses ${JSON.stringify(h)}`, next(h) === null);
ok('refuses non-strings', next(null) === null && next(undefined) === null && next(42) === null);
ok(`refuses anything longer than ${MAX_NEXT_LENGTH} characters`, next('/sales?x=' + 'a'.repeat(MAX_NEXT_LENGTH)) === null);

console.log('safeNext — only app screens are a destination');
for (const p of ['/login', '/register', '/reset-password', '/pricing', '/blog/some-post', '/member/abc', '/partner/portal', '/en/pricing'])
  ok(`refuses the public page ${p}`, next(p) === null);

console.log('withNext');
ok('adds an encoded next to /login', withNext('/login', '/vouchers?billwise=pay', needsAppData) === '/login?next=%2Fvouchers%3Fbillwise%3Dpay');
ok('a hostile or missing next leaves the bare path', withNext('/login', '//evil.example', needsAppData) === '/login' && withNext('/register', null, needsAppData) === '/register');
ok('round trip: what withNext writes, safeNext reads back', next(new URLSearchParams(withNext('/register', '/sales', needsAppData).split('?')[1]).get('next')) === '/sales');

console.log('resolveEntryType / resolveEntryState');
const constants = read('src/lib/constants.ts');
const TYPES = [...constants.slice(constants.indexOf('SOCIETY_TYPES'), constants.indexOf('INDIAN_STATES')).matchAll(/value: '([a-z_]+)'/g)].map((m) => m[1]);
const STATES = [...constants.slice(constants.indexOf('INDIAN_STATES')).matchAll(/\{ value: '([a-z]+)', label: '([^']+)'/g)].map((m) => ({ value: m[1], label: m[2] }));
ok(`read the form's lists from lib/constants (${TYPES.length} types, ${STATES.length} states)`, TYPES.length >= 10 && STATES.length >= 30);
ok('a form value passes through', resolveEntryType('dairy', TYPES) === 'dairy' && resolveEntryType('DAIRY ', TYPES) === 'dairy');
ok('page slugs with a different spelling are mapped', resolveEntryType('marketing', TYPES) === 'marketing_processing' && resolveEntryType('thrift-credit', TYPES) === 'thrift_credit');
ok('unknown / hostile type → nothing selected', resolveEntryType('<script>', TYPES) === '' && resolveEntryType('preset:cm_pacs', TYPES) === '' && resolveEntryType(null, TYPES) === '');
const softwareSlugs = [...read('src/content/societyTypes.tsx').matchAll(/^\s{4}slug: '([a-z-]+)'/gm)].map((m) => m[1]);
ok(`every /software/<slug> page (${softwareSlugs.length}) pre-selects a real type`, softwareSlugs.length >= 8 && softwareSlugs.every((s) => resolveEntryType(s, TYPES) !== ''));
ok('state by value or by page slug', resolveEntryState('hr', STATES) === 'hr' && resolveEntryState('haryana', STATES) === 'hr' && resolveEntryState('Uttar-Pradesh', STATES) === 'up');
const stateSlugs = [...read('src/content/states.ts').matchAll(/^\s{4}slug: '([a-z-]+)'/gm)].map((m) => m[1]);
ok(`every /cooperative-software/<slug> page (${stateSlugs.length}) pre-selects a real state`, stateSlugs.length >= 1 && stateSlugs.every((s) => resolveEntryState(s, STATES) !== ''));
ok('unknown state → nothing selected', resolveEntryState('atlantis', STATES) === '' && resolveEntryState('', STATES) === '');

console.log('Wiring');
const shell = read('src/AppDataShell.tsx');
ok('the route guard remembers the destination for a deep link and for the idle sign-out only',
  /const next = arrivedSignedOut \|\| idle \? pathname \+ search : null;/.test(shell) && /<Navigate to=\{withNext\('\/login', next, needsAppData\)\} replace \/>/.test(shell));
const app = read('src/App.tsx');
ok('PublicRoute sends a signed-in visitor to the validated next, else the dashboard',
  /const next = safeNext\(new URLSearchParams\(search\)\.get\(NEXT_PARAM\), needsAppData\);\s*return <Navigate to=\{next \?\? '\/dashboard'\} replace \/>;/.test(app));
const login = read('src/pages/Login.tsx');
ok('Login reads next through safeNext and uses it after both login steps',
  /const next = safeNext\(searchParams\.get\(NEXT_PARAM\), needsAppData\);/.test(login) && (login.match(/navigate\(afterLogin\);/g) || []).length === 2 && !/navigate\('\/dashboard'\)/.test(login));
ok('Login hands next on to Register', /<Link to=\{withNext\('\/register', next, needsAppData\)\}/.test(login));
const reg = read('src/pages/Register.tsx');
ok('Register reads next / type / state only through the validators',
  /const next = safeNext\(searchParams\.get\(NEXT_PARAM\), needsAppData\);/.test(reg) && /resolveEntryType\(searchParams\.get\('type'\)/.test(reg) && /resolveEntryState\(searchParams\.get\('state'\)/.test(reg)
  && (reg.match(/searchParams\.get\(/g) || []).length === 3);
const iRpc = reg.indexOf("rpc('register_society'"), iEvt = reg.indexOf("trackEvent('sign_up'"), iLogin = reg.indexOf('await login(adminEmail, adminPassword)');
ok('after the society is created (and counted) the admin is signed in and sent on', iRpc > 0 && iEvt > iRpc && iLogin > iEvt && /navigate\(next \?\? '\/dashboard', \{ replace: true \}\);/.test(reg));
ok('a failed sign-in or an unattached referral code still shows the success card', /if \(!referralFailed\) \{/.test(reg) && reg.indexOf('setSuccess(true);') > iLogin);
ok('the trial is stated from lib/plans, with a link to the plans', /\$\{TRIAL_DAYS\} दिन का मुफ़्त trial/.test(reg) && /priceLabel\(PLAN_CATALOG\.starter\.price\)/.test(reg) && /<Link to="\/pricing"/.test(reg));
ok('terms and privacy are linked from the form', /<Link to="\/terms"/.test(reg) && /<Link to="\/privacy"/.test(reg));
const draft = reg.slice(reg.indexOf('const d: RegisterDraft = {'), reg.indexOf('window.sessionStorage.setItem(DRAFT_KEY'));
ok('the saved draft holds society details only — never the email or the password', draft.length > 0 && !/admin(Email|Password|Name)|confirmPassword|referral/i.test(draft));
ok('the draft lives in sessionStorage (this tab only) and is removed once the society exists',
  !/localStorage\.setItem\(DRAFT_KEY/.test(reg) && reg.indexOf('sessionStorage.removeItem(DRAFT_KEY)') > iRpc);
const sw = read('src/pages/SoftwareLanding.tsx'), st = read('src/pages/StateLanding.tsx');
ok('a society-type page carries its type to Register (hero and bottom)', (sw.match(/to=\{`\/register\?type=\$\{encodeURIComponent\(data\.slug\)\}`\}/g) || []).length === 2);
ok('a state page carries its state to Register (hero and bottom)', (st.match(/to=\{`\/register\?state=\$\{encodeURIComponent\(data\.slug\)\}`\}/g) || []).length === 2);
ok('the unused guard that nothing imported is gone', !existsSync(pathResolve(ROOT, 'src/components/ProtectedRoute.tsx')));

console.log(`\nentry-context / sprint-2: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
