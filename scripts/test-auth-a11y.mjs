#!/usr/bin/env node
// Audit 2026-11-16, Sprint 4 (docs/audits/SAHAKARLEKHA-USER-JOURNEY-CONVERSION-AUDIT.md, section 9) — guards for
// the login / register / reset-password forms on a phone and with assistive technology:
//   M-3   the show/hide password button has a name, a state and a tappable size
//   M-5   every field declares what it is (autocomplete) — password managers and browser autofill
//   M-6   every label is tied to its field (WCAG 1.3.1 / 4.1.2)
//   M-7   the phone field brings up the number keypad
//   M-10  a landing-page button is ONE control, not a <button> inside an <a>
//   M-12  a validation error puts the cursor in the field it is about
//   M-13  changing step on Register moves focus to the step heading
// Static (source) checks — the same things were measured in a browser at 320px when this was written.
// Run: node scripts/test-auth-a11y.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const read = (p) => readFileSync(pathResolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

console.log('Password show / hide');
const toggle = read('src/components/PasswordToggle.tsx');
ok('it has a name that says what it will do, in both languages', /aria-label=\{shown \? \(hi \? 'पासवर्ड छिपाएँ' : 'Hide password'\) : \(hi \? 'पासवर्ड दिखाएँ' : 'Show password'\)\}/.test(toggle));
ok('it reports its state', /aria-pressed=\{shown\}/.test(toggle));
ok('it is at least 40×44px (it was a bare 16px icon)', /h-10 w-11/.test(toggle));
ok('it never submits the form', /type="button"/.test(toggle));
ok('keyboard focus is visible', /focus-visible:ring-2/.test(toggle));
const PAGES = ['src/pages/Login.tsx', 'src/pages/Register.tsx', 'src/pages/ResetPassword.tsx'];
for (const p of PAGES) {
  const s = read(p);
  ok(`${p} uses it, and has no unnamed icon button of its own`, /<PasswordToggle shown=\{showPassword\}/.test(s) && !/absolute right-3 top-1\/2 -translate-y-1\/2 text-muted-foreground/.test(s.replace(/<(Mail|Lock)[^>]*>/g, '')));
  ok(`${p}: the field leaves room for the button`, /pr-12/.test(s) && !/className="(pl-10 )?pr-10"/.test(s));
}

console.log('Login');
const login = read('src/pages/Login.tsx');
ok('email is the username for password managers', /id="email"\s+name="email"\s+type="email"\s+autoComplete="username"/.test(login));
ok('password is the current password', /id="password"\s+name="password"\s+autoComplete="current-password"/.test(login));
ok('the 2FA code field keeps one-time-code', (login.match(/autoComplete="one-time-code"/g) || []).length === 2);
ok('the forgot-password dialog label names its field', /<Label htmlFor="fp-email">/.test(login) && /id="fp-email"/.test(login));
ok('a wrong email / password returns the cursor to the password field', /Invalid email or password'\);\s*document\.getElementById\('password'\)\?\.focus\(\);/.test(login));
ok('the e2e helpers still find the fields (placeholders unchanged)', login.includes('placeholder="your@email.com"') && login.includes('placeholder="••••••••"'));

console.log('Reset password');
const reset = read('src/pages/ResetPassword.tsx');
ok('both fields are a NEW password (so a manager offers to save it)', (reset.match(/autoComplete="new-password"/g) || []).length === 2);

console.log('Register');
const reg = read('src/pages/Register.tsx');
const labels = [...reg.matchAll(/<Label([^>]*)>/g)].map((m) => m[1]);
ok(`every label (${labels.length}) is tied to a field`, labels.length >= 15 && labels.every((a) => /htmlFor="[a-z-]+"/.test(a)));
const ids = labels.map((a) => a.match(/htmlFor="([a-z-]+)"/)?.[1]).filter(Boolean);
ok('and every one of those fields exists', ids.every((id) => new RegExp(`id="${id}"`).test(reg)));
ok('label targets are unique', new Set(ids).size === ids.length);
const AC = { 'reg-society-name': 'organization', 'reg-district': 'address-level2', 'reg-phone': 'tel', 'reg-address': 'street-address',
  'reg-admin-name': 'name', 'reg-email': 'email', 'reg-password': 'new-password', 'reg-confirm-password': 'new-password' };
for (const [id, ac] of Object.entries(AC)) ok(`${id} → autocomplete "${ac}"`, new RegExp(`id="${id}"[^\\n]*autoComplete="${ac}"`).test(reg));
ok('the phone field asks for the number keypad', /id="reg-phone"[^\n]*type="tel"[^\n]*inputMode="tel"/.test(reg));
ok('required fields say so to assistive technology, and the * is explained', (reg.match(/aria-required="true"/g) || []).length >= 9 && /वाले खाने भरना ज़रूरी है।/.test(reg));
ok('step 1: the first empty required field gets the cursor', /document\.getElementById\(missing\[0\]\)\?\.focus\(\);/.test(reg));
ok('step 2: each refusal puts the cursor in its field', ['reg-email', 'reg-confirm-password', 'reg-password'].every((id) => new RegExp(`getElementById\\('${id}'\\)\\?\\.focus\\(\\)`).test(reg)));
ok('the form validates itself (noValidate) and therefore checks the email format itself', (reg.match(/className="space-y-4" noValidate>/g) || []).length === 2 && /\.test\(adminEmail\.trim\(\)\)\) \{/.test(reg));
const iEmail = reg.indexOf("getElementById('reg-email')?.focus()"), iRpc = reg.indexOf("rpc('register_society'");
ok('every check runs BEFORE the society is created', iEmail > 0 && iEmail < iRpc && reg.indexOf("getElementById('reg-password')?.focus()") < iRpc);
ok('changing step moves focus to the step heading (not on first paint)', /id="reg-step-title" tabIndex=\{-1\}/.test(reg) && /if \(!stepMounted\.current\) \{ stepMounted\.current = true; return; \}/.test(reg));
ok('the saved draft still never holds the email or password', !/admin(Email|Password)|confirmPassword/.test(reg.slice(reg.indexOf('const d: RegisterDraft = {'), reg.indexOf('window.sessionStorage.setItem(DRAFT_KEY'))));

console.log('Landing page and shell');
const landing = read('src/pages/LandingPage.tsx');
ok('no register / demo button is a <button> nested in a link', !/<Link to="\/register"[^>]*>\s*<Button/.test(landing) && !/<a href="#demo">\s*<Button/.test(landing));
ok('they are single controls (Button asChild) and still three register buttons', (landing.match(/<Button asChild[^>]*>\s*<Link to="\/register"/g) || []).length === 3);
const shell = read('src/AppDataShell.tsx');
ok('the data-loading line follows the language and is announced', /role="status">\{language === 'hi' \? 'डेटा लोड हो रहा है\.\.\.' : 'Loading your data\.\.\.'\}/.test(shell));
const sheet = read('src/components/ui/sheet.tsx'), layout = read('src/components/PublicLayout.tsx');
ok('the drawer close button is named in the page language', /closeLabel = "Close"/.test(sheet) && /<span className="sr-only">\{closeLabel\}<\/span>/.test(sheet) && /closeLabel=\{L\('मेन्यू बंद करें', 'Close menu'\)\}/.test(layout));

console.log(`\nauth-a11y / sprint-4: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
