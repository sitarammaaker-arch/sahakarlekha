// Cross-tab account change (2026-10-17) + the application PDF's office block.
//   Every tab shares one Supabase session. A tab showing society A kept writing with account B's token after
//   another tab signed in as B (live: a member save refused by RLS, "PLATFORM" in error_log). The storage event
//   (fires only in OTHER tabs) now sets writeBlock.accountChanged → every mutation guard refuses + a banner asks
//   for a reload. The membership application PDF prints the recorded dates / resolution instead of blank lines.
// Run: node scripts/test-account-change-guard.mjs   (npm run test:account-change-guard)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const W = await import(pathToFileURL(resolve(ROOT, 'src/lib/connectivity/writeBlock.ts')).href);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── pure decisions ──
ok(W.decideWriteBlock({ online: true, failedParts: [], accountChanged: true }).reason === 'account', 'account change blocks entry');
ok(W.decideWriteBlock({ online: false, failedParts: [], accountChanged: true }).reason === 'account', 'account change wins over offline (reload is the fix)');
ok(!W.decideWriteBlock({ online: true, failedParts: [] }).blocked, 'no flag → no block (unchanged behaviour)');
const msg = W.blockMessage(W.decideWriteBlock({ online: true, failedParts: [], accountChanged: true }));
ok(/दूसरे tab/.test(msg.title) && /दोबारा खोलें/.test(msg.description), 'Hindi-first refusal message');

const tok = (email) => JSON.stringify({ access_token: 'x', user: { email } });
ok(W.emailFromAuthStorage('sb-abcd-auth-token', tok('A@X.com')) === 'a@x.com', 'reads the email from the shared session token');
ok(W.emailFromAuthStorage('sb-abcd-auth-token', JSON.stringify({ currentSession: { user: { email: 'b@x.com' } } })) === 'b@x.com', 'older token shape too');
ok(W.emailFromAuthStorage('sl-member-portal', tok('a@x.com')) === null, 'member-portal session (own storage key) ignored');
ok(W.emailFromAuthStorage('sb-abcd-auth-token', null) === null && W.emailFromAuthStorage('sb-abcd-auth-token', '{bad') === null, 'sign-out / junk → no email');
ok(W.isAccountMismatch('a@x.com', 'B@x.com') && !W.isAccountMismatch('A@x.com', 'a@x.com '), 'mismatch is case/space-insensitive');
ok(!W.isAccountMismatch(null, 'b@x.com') && !W.isAccountMismatch('a@x.com', null), 'unknown on either side → no block (demo users, sign-out)');

// ── store: the guard every context calls refuses while the flag is set ──
let toasted = null;
W.setAccountChanged(true);
ok(W.refuseIfWriteBlocked((t) => { toasted = t; }) === true && toasted?.variant === 'destructive', 'refuseIfWriteBlocked refuses + toasts');
W.setAccountChanged(false);
ok(W.refuseIfWriteBlocked(() => {}) === false, 'cleared → entry allowed again');

// ── wiring ──
const auth = read('src/contexts/AuthContext.tsx');
ok(/window\.addEventListener\('storage', onStorage\)/.test(auth) && /emailFromAuthStorage\(e\.key, e\.newValue\)/.test(auth) && /isAccountMismatch\(userEmailRef\.current, email\)\) setAccountChanged\(true\)/.test(auth), 'AuthContext listens to OTHER tabs writing the session');
ok(!/onAuthStateChange\([\s\S]{0,400}setAccountChanged/.test(auth), 'not from onAuthStateChange (this tab\'s own login must never trip it)');
ok(read('src/components/OfflineBanner.tsx').includes("d.reason === 'account'") && read('src/components/OfflineBanner.tsx').includes("'Page दोबारा खोलें'"), 'banner explains + reload button');

// ── application PDF office block ──
const pdf = read('src/lib/pdf.ts');
const app = pdf.slice(pdf.indexOf('export function generateMemberApplicationPDF('), pdf.indexOf('export function generateMemberApplicationPDF(') + 9000);
ok(app.includes('const received = applicationReceivedOn(member);') && app.includes('`Date of Admission: ${admitted ? fmtDate(admitted)'), 'application / admission dates from the record');
ok(app.includes('`Resolution No.: ${blank(member.admissionResolutionNo)}') && app.includes('Approved / Rejected: ${blank(decision)}') && app.includes('Share Certificate No.: ${blank(member.shareCertNo)}'), 'office block prints resolution, decision, certificate');
ok(!app.includes("doc.text('Resolution No.: _______________    Date: _______________'"), 'no hard-coded blank office lines left');

console.log(`account-change-guard: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
