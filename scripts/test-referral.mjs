// Referral partners, slice 1 (migration 164): the pure code rules, the migration's guarantees, and the wiring.
//   1. lib/referral/referralCode — code shape, ?ref= parsing, first-touch storage, 90-day expiry, never throws.
//   2. migration 164 — RLS on with no policies, table grants revoked, admin RPCs gated, anon RPCs granted,
//      declarations enforced by CHECK, the 30-minute signup window, lock after payment, a faithful down file.
//   3. the client and the SQL agree (code alphabet, categories), and App / Register / routes are wired.
// The SQL itself was run end-to-end on Postgres (PGlite) while building; this file pins what must not regress.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../src/lib/referral/referralCode.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. pure rules ────────────────────────────────────────────────────────────────────────────────────────────────
ok(R.isReferralCodeShape('SL-7KQ2MD'), 'a real code is code-shaped');
ok(R.isReferralCodeShape(' sl-7kq2md '), 'case and spaces are forgiven');
ok(!R.isReferralCodeShape('SL-7KQ2M0') && !R.isReferralCodeShape('SL-OOOOOO') && !R.isReferralCodeShape('SL-IIIIII'), '0 / O / I are not in the alphabet');
ok(!R.isReferralCodeShape('SL7KQ2MD') && !R.isReferralCodeShape('SL-7KQ2MDX') && !R.isReferralCodeShape(''), 'wrong shapes are refused');
ok(R.referralFromSearch('?ref=sl-7kq2md&utm=x') === 'SL-7KQ2MD', '?ref= is read and normalised');
ok(R.referralFromSearch('?ref=<script>') === null && R.referralFromSearch('?x=1') === null && R.referralFromSearch('') === null, 'junk or absent ?ref= → null');

const DAY = 86400000, NOW = 1_800_000_000_000;
const a = { code: 'SL-AAAAAA', at: NOW - 10 * DAY };
ok(R.nextStoredReferral(a, 'SL-BBBBBB', NOW) === a, 'first touch wins while fresh');
ok(R.nextStoredReferral({ ...a, at: NOW - 91 * DAY }, 'SL-BBBBBB', NOW)?.code === 'SL-BBBBBB', 'an expired code is replaced');
ok(R.nextStoredReferral(null, null, NOW) === null, 'nothing in, nothing stored');
ok(!R.isFresh({ code: 'SL-AAAAAA', at: NOW + DAY }, NOW), 'a future timestamp is not fresh');

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const s1 = mem();
ok(R.captureReferral('?ref=SL-AAAAAA', s1, NOW)?.code === 'SL-AAAAAA', 'capture stores the code');
ok(R.captureReferral('?ref=SL-BBBBBB', s1, NOW + DAY)?.code === 'SL-AAAAAA', 'a second link does not overwrite');
ok(R.loadReferral(s1, NOW + DAY)?.code === 'SL-AAAAAA', 'load returns the fresh code');
ok(R.loadReferral(s1, NOW + 91 * DAY) === null, 'load ignores an expired code');
const s2 = mem(); s2.m.set(R.REF_STORAGE_KEY, '{not json');
ok(R.loadReferral(s2, NOW) === null && R.captureReferral('?ref=SL-CCCCCC', s2, NOW)?.code === 'SL-CCCCCC', 'a corrupt stored value is treated as absent');
const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
ok(R.loadReferral(throwing, NOW) === null && R.captureReferral('?ref=SL-AAAAAA', throwing, NOW) === null, 'blocked storage never throws');
ok(R.loadReferral(null, NOW) === null && R.captureReferral('?ref=SL-AAAAAA', null, NOW)?.code === 'SL-AAAAAA', 'no storage at all is fine');
ok(R.referralErrorText('locked_after_payment').includes('भुगतान') && R.referralErrorText('nope').length > 0, 'error codes have Hindi text, unknown ones a fallback');

// ── 2. migration 164 ─────────────────────────────────────────────────────────────────────────────────────────────
const up = read('supabase/migrations/164_referral_partners.sql');
const down = read('supabase/migrations/164_referral_partners_down.sql');
const code = up.replace(/--.*$/gm, '');
const TABLES = ['partners', 'referral_attributions', 'referral_attribution_events'];
for (const t of TABLES) {
  ok(new RegExp(`create table if not exists public\\.${t} \\(`).test(code), `${t} is created`);
  ok(new RegExp(`alter table public\\.${t}\\s+enable row level security`).test(code), `${t} has RLS on`);
  ok(new RegExp(`revoke all on table public\\.${t}\\s+from anon, authenticated`).test(code), `${t}: client table grants revoked`);
  ok(new RegExp(`drop table if exists public\\.${t};`).test(down), `down drops ${t}`);
}
ok(!/create policy/i.test(code), 'no policy at all — the client reaches these tables only through the functions');
ok(/check \(declared_not_public_servant\)/.test(code) && /check \(declared_not_proxy\)/.test(code), 'both declarations are enforced by CHECK (founder 2026-11-14: no government officer is ever a partner)');
ok(/declaration_version\s+text not null default 'v1'/.test(code), 'the declaration wording version is stored');

const ADMIN = ['admin_partners_list()', 'admin_partner_decide(uuid, text, text)', 'admin_referrals_list()', 'admin_referral_set(text, text, text)'];
for (const f of ADMIN) {
  const name = f.split('(')[0];
  const body = code.slice(code.indexOf(`function public.${name}(`), code.indexOf('$$;', code.indexOf(`function public.${name}(`)));
  ok(/if not public\.is_platform_admin\(\) then\s+raise exception 'not authorized'/.test(body), `${name} refuses a non-admin`);
  ok(/security definer/.test(body), `${name} is SECURITY DEFINER`);
  ok(code.includes(`revoke execute on function public.${f}`) && new RegExp(`revoke execute on function public\\.${name.replace(/[()]/g, '\\$&')}\\([^)]*\\)\\s+from public, anon;`).test(code), `${name}: anon cannot execute`);
  ok(new RegExp(`drop function if exists public\\.${name}\\(`).test(down), `down drops ${name}`);
}
for (const f of ['partner_apply', 'partner_status', 'referral_code_check', 'attach_referral_at_signup']) {
  ok(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\)\\s+to anon, authenticated;`).test(code), `${f} is callable by anon (public pages)`);
  ok(new RegExp(`drop function if exists public\\.${f}\\(`).test(down), `down drops ${f}`);
}
for (const f of ['_partner_norm_phone(text)', '_partner_new_code()', '_partner_norm_code(text)']) {
  ok(code.includes(`revoke all on function public.${f}`) && /from public, anon, authenticated;/.test(code), `helper ${f} is not client-callable`);
}
const attach = code.slice(code.indexOf('function public.attach_referral_at_signup('));
ok(/interval '30 minutes'/.test(attach) && /'too_late'/.test(attach), 'signup attach only within 30 minutes of the society being created');
ok(/'already_attributed'/.test(attach) && /'self_referral'/.test(attach), 'signup attach: one partner per society, never the partner\'s own society');
ok(/status = 'approved'/.test(attach), 'only an approved code attaches');
const set = code.slice(code.indexOf('function public.admin_referral_set('));
ok(/o\.status = 'paid'/.test(set) && /'locked_after_payment'/.test(set), 'admin cannot move a society to another partner after it has paid');
ok(/'reason_required'/.test(set) && /insert into public\.referral_attribution_events/.test(set), 'admin changes need a reason and are logged');
ok(/'has_societies'/.test(code), 'a partner with societies cannot be rejected (only suspended)');
ok(/insert into public\.app_migrations \(version, name\) values \('164', 'referral_partners'\)/.test(code) && /delete from public\.app_migrations where version = '164'/.test(down), 'app_migrations row added and removed');
ok(/^begin;/m.test(up) && /^commit;/m.test(up) && /^begin;/m.test(down) && /^commit;/m.test(down), 'both files are one transaction');

// ── 3. client ↔ SQL agreement, and wiring ────────────────────────────────────────────────────────────────────────
ok(code.includes(`'${R.REFERRAL_CODE_ALPHABET}'`), 'the client alphabet is the SQL code generator\'s alphabet');
const sqlCats = code.match(/category in \(([^)]*)\)/)[1].split(',').map((s) => s.trim().replace(/'/g, '')).sort().join();
ok(sqlCats === R.PARTNER_CATEGORIES.map((c) => c.value).sort().join(), `form categories = SQL CHECK categories (${sqlCats})`);
ok(!R.PARTNER_CATEGORIES.some((c) => /inspector|arcs|registrar|auditor|secretary|निरीक्षक|रजिस्ट्रार/i.test(c.value + c.label)), 'no government-officer or society-office-bearer category is offered');

const app = read('src/App.tsx');
ok(/captureReferral\(search, storage, Date\.now\(\)\)/.test(app), 'App captures ?ref= on every navigation');
ok(app.includes('<Route path="/partner" element={<PartnerApply />} />') && app.includes('<Route path="/partner/status" element={<PartnerStatus />} />'), 'public partner routes exist');
ok(/<Route path="\/super-admin\/partners" element=\{<SuperAdminRoute>/.test(app), 'admin page is behind SuperAdminRoute');
const reg = read('src/pages/Register.tsx');
const iReg = reg.indexOf("rpc('register_society'"), iAtt = reg.indexOf("rpc('attach_referral_at_signup'");
ok(iReg > 0 && iAtt > iReg, 'Register attaches the code only after register_society');
ok(/isReferralCodeShape\(refCode\)/.test(reg) && reg.indexOf('isReferralCodeShape(refCode)') < iReg, 'a mistyped code is caught BEFORE the society is created');
ok(/setReferralResult\(\{ ok: false/.test(reg), 'an attach failure is shown, not hidden (RULE 1 spirit)');
const status = read('src/pages/PartnerProgram.tsx');
ok(/useNoIndex\(\)/.test(status.slice(status.indexOf('export const PartnerStatus'))), 'the token status page is noindex');

// ── 4. slice 2: partner dashboard + admin tools (migration 165) ─────────────────────────────────────────────────
ok(R.societyStage({ plan: 'plus', subscription_status: 'expired', first_paid_at: '2026-11-10T10:00:00Z' }) === 'paid', 'a society that ever paid stays "paid" even after its plan lapses');
ok(R.societyStage({ plan: 'trial', subscription_status: 'trialing', first_paid_at: null }) === 'trial', 'trial');
ok(R.societyStage({ plan: 'trial', subscription_status: 'expired', first_paid_at: null }) === 'expired', 'expired trial');
ok(R.societyStage({ plan: 'legacy', subscription_status: 'active', first_paid_at: null }) === 'free', 'legacy = old free plan');
ok(R.societyStage({ plan: null, subscription_status: null, first_paid_at: null }) === 'joined', 'no subscription row yet');
const sum = R.summarizePartnerSocieties([
  { plan: 'plus', subscription_status: 'active', first_paid_at: 'x' },
  { plan: 'trial', subscription_status: 'trialing', first_paid_at: null },
  { plan: 'trial', subscription_status: 'expired', first_paid_at: null },
  { plan: null, subscription_status: null, first_paid_at: null },
]);
ok(sum.total === 4 && sum.paid === 1 && sum.trial === 1 && sum.expired === 1 && sum.other === 1, 'summary counts add up');

const up165 = read('supabase/migrations/165_referral_partner_dashboard.sql');
const down165 = read('supabase/migrations/165_referral_partner_dashboard_down.sql');
const c165 = up165.replace(/--.*$/gm, '');
const dash = c165.slice(c165.indexOf('function public.partner_dashboard('), c165.indexOf('$$;', c165.indexOf('function public.partner_dashboard(')));
ok(/where token = p_token/.test(dash) && /a\.partner_id = v\.id/.test(dash), 'dashboard: only the token holder\'s own societies');
ok(/if v\.status <> 'approved' then/.test(dash), 'dashboard: only an approved partner sees societies');
const dashCols = [...dash.matchAll(/\bas (\w+)/g)].map((m) => m[1]);
ok(['society_name', 'district', 'joined_at', 'plan', 'subscription_status', 'period_end', 'first_paid_at'].every((c) => dashCols.includes(c)), 'dashboard returns the agreed columns');
ok(!/s\.phone|registration_no|address|society_id\s+as|\bemail\b|amount/.test(dash), 'dashboard leaks no contact, registration, id or money field');
ok(/grant execute on function public\.partner_dashboard\(uuid\) to anon, authenticated;/.test(c165) && /--\s*anon-exec:\s*partner_dashboard\b/.test(up165), 'dashboard is anon-callable, with the reason recorded');
for (const f of ['admin_referral_events(text)', 'admin_partner_rotate_token(uuid)']) {
  const name = f.split('(')[0];
  const body = c165.slice(c165.indexOf(`function public.${name}(`), c165.indexOf('$$;', c165.indexOf(`function public.${name}(`)));
  ok(/if not public\.is_platform_admin\(\) then\s+raise exception 'not authorized'/.test(body) && /security definer/.test(body), `${name} refuses a non-admin`);
  ok(new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\)\\s+from public, anon;`).test(c165), `${name}: anon cannot execute`);
  ok(new RegExp(`drop function if exists public\\.${name}\\(`).test(down165), `down drops ${name}`);
}
ok(/drop function if exists public\.partner_dashboard\(uuid\);/.test(down165) && !/drop table/.test(down165), 'down drops only functions, never the 164 data');
ok(/values \('165', 'referral_partner_dashboard'\)/.test(c165) && /where version = '165'/.test(down165), 'app_migrations 165 added and removed');

const page = read('src/pages/PartnerProgram.tsx');
ok(page.indexOf("rpc('partner_dashboard'") > page.indexOf("st.status === 'approved'"), 'the page asks for the dashboard only once the partner is approved');
ok(/setSocieties\(dash\.error \|\| !d\.ok \? 'error'/.test(page) && /सूची लोड नहीं हो सकी/.test(page), 'a dashboard load failure is shown, never shown as "0 societies"');
ok(/timeZone: 'Asia\/Kolkata'/.test(page), 'dates on the dashboard are IST calendar dates');
ok(/उस partner को आपकी समिति का नाम, ज़िला और plan की स्थिति दिखेगी/.test(reg), 'Register tells the society what the partner will see');
const privacy = read('src/pages/PrivacyPolicy.tsx');
ok(/Referral partner — Partner Program/.test(privacy) && /नाम, ज़िला,\s*जुड़ने की तारीख़ और plan की स्थिति/.test(privacy), 'Privacy Policy discloses what partners see');
const admin = read('src/pages/SuperAdminPartners.tsx');
ok(/rpc\('admin_referral_events'/.test(admin) && /rpc\('admin_partner_rotate_token'/.test(admin) && /downloadCSV\(/.test(admin), 'admin page wires history, new link and CSV export');

console.log(`referral: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
