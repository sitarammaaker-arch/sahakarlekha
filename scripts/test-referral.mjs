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
const portalPage = read('src/pages/PartnerPortal.tsx');
ok(/p\.status === 'approved' && <PartnerSocieties/.test(portalPage), 'the portal shows societies only to an approved partner');
ok(/data\.dashboard\?\.ok \? \(data\.dashboard\.societies \?\? \[\]\) : 'error'/.test(portalPage) && /सूची लोड नहीं हो सकी/.test(page), 'a dashboard load failure is shown, never shown as "0 societies"');
ok(/timeZone: 'Asia\/Kolkata'/.test(page), 'dates on the dashboard are IST calendar dates');
ok(/उस partner को आपकी समिति का नाम, ज़िला और plan की स्थिति दिखेगी/.test(reg), 'Register tells the society what the partner will see');
const privacy = read('src/pages/PrivacyPolicy.tsx');
ok(/Referral partner — Partner Program/.test(privacy) && /नाम, ज़िला,\s*जुड़ने की तारीख़ और plan की स्थिति/.test(privacy), 'Privacy Policy discloses what partners see');
const admin = read('src/pages/SuperAdminPartners.tsx');
ok(/rpc\('admin_referral_events'/.test(admin) && /downloadCSV\(/.test(admin), 'admin page wires history and CSV export');

// ── 5. slice 3: commission accrual (migration 166) ──────────────────────────────────────────────────────────────
ok(R.formatPaise(59980) === '₹599.80' && R.formatPaise(12345678) === '₹1,23,456.78' && R.formatPaise(0) === '₹0.00' && R.formatPaise(5) === '₹0.05', 'paise format, Indian grouping');
ok(R.formatPaise('34995') === '₹349.95' && R.formatPaise(null) === '₹0.00' && R.formatPaise(-100) === '−₹1.00', 'string / null / negative paise');
const C = (status, eligible, basis, paise) => ({ status, eligible, basis, commission_paise: paise });
ok(R.commissionStage(C('pending', true, 'first_year', 1)) === 'eligible' && R.commissionStage(C('pending', false, 'renewal', 1)) === 'hold', 'eligible vs hold');
ok(R.commissionStage(C('no_rule', false, 'first_year', 0)) === 'no_rule' && R.commissionStage(C('cancelled', true, 'first_year', 9)) === 'cancelled' && R.commissionStage(C('pending', true, 'none', 0)) === 'none', 'no_rule / cancelled / none');
const cs = R.summarizeCommissions([C('pending', true, 'first_year', 59980), C('pending', false, 'renewal', 69990), C('no_rule', false, 'first_year', 0), C('cancelled', true, 'first_year', 10000), C('pending', true, 'none', 0)]);
ok(cs.eligible === 59980 && cs.hold === 69990 && cs.noRuleCount === 1 && cs.cancelled === 10000, 'totals in paise; cancelled never counts as owed');

const up166 = read('supabase/migrations/166_partner_commissions.sql');
const down166 = read('supabase/migrations/166_partner_commissions_down.sql');
const c166 = up166.replace(/--.*$/gm, '');
for (const t of ['partner_commission_rules', 'partner_commissions']) {
  ok(new RegExp(`alter table public\\.${t}\\s+enable row level security`).test(c166) && new RegExp(`revoke all on table public\\.${t}\\s+from anon, authenticated`).test(c166), `${t}: RLS on, client grants revoked`);
  ok(new RegExp(`drop table if exists public\\.${t};`).test(down166), `down drops ${t}`);
}
ok(!/create policy/i.test(c166), '166 adds no policy');
ok(/invoice_id\s+uuid not null unique references public\.invoices\(id\)/.test(c166), 'one commission per invoice (unique), tied to a real invoice — so only live, paid orders earn');
ok(/create trigger trg_invoice_partner_commission\s+after insert on public\.invoices/.test(c166), 'commission is recorded when an invoice is issued');
const trg = c166.slice(c166.indexOf('function public.tg_invoice_partner_commission('), c166.indexOf('$$;', c166.indexOf('function public.tg_invoice_partner_commission(')));
ok(/exception when others then/.test(trg) && /return new;/.test(trg), 'the trigger can never block the tax invoice');
ok(/drop trigger if exists trg_invoice_partner_commission on public\.invoices;/.test(down166), 'down removes the trigger (invoices keep working)');
const price = c166.slice(c166.indexOf('function public._partner_commission_price('));
ok(/i\.taxable_paise \* v_rate \/ 100/.test(price), 'commission = taxable value (GST excluded) × rate');
ok(/interval '12 months'/.test(price) && /make_interval\(years => 1 \+ r\.renewal_years\)/.test(price), 'first year = 12 months from the first invoice; renewals for renewal_years after');
ok(/effective_from <= i\.invoice_date order by cr\.effective_from desc limit 1/.test(price), 'the rule in force on the invoice date applies');
ok(/'no_rule'::text/.test(price), 'no rule → recorded as no_rule, not dropped');
ok(/check \(first_year_pct between 0 and 50\)/.test(c166) && /check \(hold_days between 0 and 90\)/.test(c166), 'rates and hold are bounded in the table too');
ok(!/update public\.partner_commission_rules/.test(c166) && !/delete from public\.partner_commission_rules/.test(c166), 'rules are append-only (no function edits or deletes one)');
for (const f of ['admin_commission_rules_list()', 'admin_commissions_list()', 'admin_commission_cancel(bigint, text)', 'admin_commission_sync()', 'admin_commission_rule_add(date, numeric, numeric, integer, integer, text)']) {
  const name = f.split('(')[0];
  const body = c166.slice(c166.indexOf(`function public.${name}(`), c166.indexOf('$$;', c166.indexOf(`function public.${name}(`)));
  ok(/if not public\.is_platform_admin\(\) then\s+raise exception 'not authorized'/.test(body) && /security definer/.test(body), `${name} refuses a non-admin`);
  ok(new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\)\\s+from public, anon;`).test(c166), `${name}: anon cannot execute`);
  ok(new RegExp(`drop function if exists public\\.${name}\\(`).test(down166), `down drops ${name}`);
}
ok(/'reason_required'/.test(c166.slice(c166.indexOf('function public.admin_commission_cancel('))), 'cancelling needs a reason');
ok(/grant execute on function public\.partner_commissions\(uuid\) to anon, authenticated;/.test(c166) && /--\s*anon-exec:\s*partner_commissions\b/.test(up166), 'partner view is anon-callable with its reason recorded');
const pview = c166.slice(c166.indexOf('function public.partner_commissions('), c166.indexOf('$$;', c166.indexOf('function public.partner_commissions(')));
ok(/c\.partner_id = v\.id/.test(pview) && !/invoice_no|society_id\s*,/.test(pview.replace(/s\.id::text = c\.society_id/, '')), 'partner sees only own rows, no invoice number or society id');
ok(/values \('166', 'partner_commissions'\)/.test(c166) && /where version = '166'/.test(down166), 'app_migrations 166 added and removed');

const page3 = read('src/pages/PartnerProgram.tsx');
ok(/data\.commissions\?\.ok \? \(data\.commissions\.rows \?\? \[\]\) : 'error'/.test(portalPage) && /Commission का हिसाब लोड नहीं हो सका/.test(page3), 'the portal shows commissions and a load failure');
const panel = read('src/components/partners/AdminCommissionsPanel.tsx');
ok(['admin_commission_rules_list', 'admin_commissions_list', 'admin_commission_rule_add', 'admin_commission_cancel', 'admin_commission_sync'].every((f) => panel.includes(`rpc('${f}'`)), 'admin panel wires every commission RPC');
ok(/AdminCommissionsPanel/.test(read('src/pages/SuperAdminPartners.tsx')), 'Commission tab is on the partners admin page');

// ── 6. slice 4: payouts, TDS, clawback (migration 167) ──────────────────────────────────────────────────────────
ok(R.financialYearOf('2026-11-14') === '2026-27' && R.financialYearOf('2027-03-31') === '2026-27' && R.financialYearOf('2027-04-01') === '2027-28' && R.financialYearOf('2099-12-31') === '2099-00', 'FY label (mirrors _partner_fy)');
ok(R.rupeesToPaise('20,000') === 2000000 && R.rupeesToPaise('₹ 15000.5') === 1500050 && R.rupeesToPaise('0') === 0 && R.rupeesToPaise('12.345') === null && R.rupeesToPaise('abc') === null && R.rupeesToPaise('') === null, 'rupees → paise, no float drift, junk refused');
ok(R.commissionStage(C('paid', false, 'first_year', 5)) === 'paid' && R.summarizeCommissions([C('paid', false, 'first_year', 700)]).paid === 700, 'paid stage and total');
ok(R.payoutErrorText('stale_preview').includes('preview') && R.payoutErrorText('no_tds_rule').includes('TDS') && R.payoutErrorText('zzz').length > 0, 'payout error text');

const up167 = read('supabase/migrations/167_partner_payouts.sql');
const down167 = read('supabase/migrations/167_partner_payouts_down.sql');
const c167 = up167.replace(/--.*$/gm, '');
const T167 = ['partner_payment_details', 'partner_tds_rules', 'partner_payouts', 'partner_payout_items', 'partner_clawbacks'];
for (const t of T167) {
  ok(new RegExp(`alter table public\\.${t}\\s+enable row level security`).test(c167) && new RegExp(`revoke all on table public\\.${t}\\s+from anon, authenticated`).test(c167), `${t}: RLS on, client grants revoked`);
  ok(new RegExp(`drop table if exists public\\.${t};`).test(down167), `down drops ${t}`);
}
ok(!/create policy/i.test(c167), '167 adds no policy');
ok(/section_ref\s+text not null check/.test(c167) && /source_ref\s+text not null check/.test(c167), 'a TDS rule cannot exist without its section and source');
ok(!/\b(194H|2\.00|20000|2000000)\b/.test(c167.replace(/check \(rate_pct between 0 and 30\)|check \(no_pan_rate_pct between 0 and 40\)/g, '')), 'no statutory rate or threshold is hard-coded in the migration');
ok(/utr\s+text not null check \(char_length\(btrim\(utr\)\) >= 6\)/.test(c167), 'every payout carries a UTR');
ok(/commission_id\s+bigint not null unique references public\.partner_commissions/.test(c167), 'a commission is paid at most once');
ok(/check \(base_paise = credit_paise - clawback_paise\)/.test(c167) && /check \(net_paise = base_paise - tds_paise\)/.test(c167), 'payout arithmetic is enforced by the table');
const calc = c167.slice(c167.indexOf('function public._partner_payout_calc('), c167.indexOf('$$;', c167.indexOf('function public._partner_payout_calc(')));
ok(/when v_pan is null then r\.no_pan_rate_pct else r\.rate_pct/.test(calc), 'no PAN on file → the no-PAN rate');
ok(/v_fy_base \+ v_base > r\.fy_threshold_paise/.test(calc) && /\(v_fy_base \+ v_base\) \* v_rate \/ 100\)::bigint - v_fy_tds/.test(calc), 'threshold on the FY aggregate; TDS on the whole FY base less TDS already deducted');
ok(/'no_tds_rule'/.test(calc) && /'nothing_payable'/.test(calc) && /'future_date'/.test(calc) && /'commission_not_payable'/.test(calc), 'refuses: no TDS rule, nothing payable, future date, unpayable commission');
ok(/c\.hold_until > p_payout_date/.test(calc), 'a commission still inside its refund hold cannot be paid');
const recd = c167.slice(c167.indexOf('function public.admin_payout_record('), c167.indexOf('$$;', c167.indexOf('function public.admin_payout_record(')));
ok(/'stale_preview'/.test(recd) && /p_expected_net_paise/.test(recd), 'recording re-computes and refuses a stale preview');
ok(/for update/.test(recd), 'recording locks the partner\'s rows (no double payout)');
const canc = c167.slice(c167.indexOf('function public.admin_commission_cancel('), c167.indexOf('$$;', c167.indexOf('function public.admin_commission_cancel(')));
ok(/c\.status = 'paid'/.test(canc) && /insert into public\.partner_clawbacks/.test(canc), 'cancelling a PAID commission creates a clawback');
for (const f of ['admin_partner_payment_details_get(uuid)', 'admin_partner_payment_details_set(uuid, text, text, text, text, text, text, text)', 'admin_tds_rules_list()',
  'admin_tds_rule_add(date, numeric, numeric, bigint, text, text, text)', 'admin_payout_preview(uuid, date)', 'admin_payout_record(uuid, date, bigint[], bigint, text, text, text)',
  'admin_payouts_list()', 'admin_commission_cancel(bigint, text)']) {
  const name = f.split('(')[0];
  const body = c167.slice(c167.indexOf(`function public.${name}(`), c167.indexOf('$$;', c167.indexOf(`function public.${name}(`)));
  ok(/if not public\.is_platform_admin\(\) then\s+raise exception 'not authorized'/.test(body) && /security definer/.test(body), `${name} refuses a non-admin`);
  ok(new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\)\\s+from public, anon;`).test(c167), `${name}: anon cannot execute`);
}
const pp = c167.slice(c167.indexOf('function public.partner_payouts('), c167.indexOf('$$;', c167.indexOf('function public.partner_payouts(')));
ok(/'pan_on_file', exists/.test(pp) && !/'pan',|account_no|ifsc|upi_id/.test(pp), 'partner view: "PAN on file" only — never the PAN or bank details');
ok(/grant execute on function public\.partner_payouts\(uuid\) to anon, authenticated;/.test(c167) && /--\s*anon-exec:\s*partner_payouts\b/.test(up167), 'partner payouts view is anon-callable with its reason');
ok(/check \(status in \('no_rule','pending','cancelled'\)\)/.test(down167) && /166's cancel, verbatim/.test(down167), 'down restores 166 (and refuses while paid rows exist)');
ok(/values \('167', 'partner_payouts'\)/.test(c167) && /where version = '167'/.test(down167), 'app_migrations 167 added and removed');

const payPanel = read('src/components/partners/AdminPayoutsPanel.tsx');
ok(['admin_tds_rules_list', 'admin_tds_rule_add', 'admin_payout_preview', 'admin_payout_record', 'admin_payouts_list', 'admin_partner_payment_details_get', 'admin_partner_payment_details_set'].every((f) => payPanel.includes(`rpc('${f}'`)), 'payouts panel wires every payout RPC');
ok(/TDS_RULES\[key\]/.test(payPanel) && /tds\.194h\.rate_pct/.test(payPanel) && /tds\.194h\.threshold/.test(payPanel), 'the TDS form is pre-filled from the source-verified rule file, not a new literal');
ok(/const \[tNoPan, setTNoPan\] = useState\(sug\.noPan\)/.test(payPanel) && /export const NO_PAN_RATE_PCT = 20;/.test(payPanel), 'the no-PAN rate is pre-filled at 20%');
ok(/s\.397\(2\)\(b\)\(i\)/.test(payPanel) && /section-397-5 \(read 2026-11-14\)/.test(payPanel) && /20% in any other case/.test(payPanel), 'the no-PAN rate carries its section, the quoted words and the source page');
ok(/402\(37\)/.test(payPanel) && /₹1 करोड़/.test(payPanel), 'the TDS dialog states the s.402(37) applicability test for a proprietor payer');
ok(/p_expected_net_paise: preview\.net_paise/.test(payPanel), 'the admin records exactly the previewed net');
const page4 = read('src/pages/PartnerProgram.tsx');
ok(/data\.payouts\?\.ok \? data\.payouts : 'error'/.test(portalPage) && /भुगतान का हिसाब लोड नहीं हो सका/.test(page4), 'the portal shows payouts and a load failure');
ok(/AdminPayoutsPanel/.test(read('src/pages/SuperAdminPartners.tsx')), 'Payouts tab is on the partners admin page');
ok(/PAN, बैंक खाता \/ UPI और GSTIN/.test(read('src/pages/PrivacyPolicy.tsx')), 'Privacy Policy discloses PAN/bank collection for payouts');

// ── 7. partner portal: email OTP login, own session, change requests (migration 168) ───────────────────────────
const S = await import('../src/lib/referral/partnerSession.ts');
const E = await import('../supabase/functions/_shared/partner-email.mjs');
const TOKEN = 'a'.repeat(64);
const st = mem();
ok(S.savePartnerSession(st, TOKEN) && S.loadPartnerSession(st) === TOKEN, 'session saved and read back');
ok(!S.savePartnerSession(st, 'short') && S.loadPartnerSession({ getItem: () => 'not-a-token' }) === null, 'only a 64-hex session is accepted');
ok(S.loadPartnerSession(throwing) === null && S.savePartnerSession({ setItem: () => { throw new Error('x'); } }, TOKEN) === false, 'blocked storage never throws');
S.clearPartnerSession({ removeItem: (k) => st.m.delete(k) });
ok(S.loadPartnerSession(st) === null, 'logout clears the session');
ok(S.isLoginEmail(' A@B.co ') && !S.isLoginEmail('a@b') && S.isLoginCode('012345') && !S.isLoginCode('12345'), 'email / code shapes');
ok(S.loginErrorText('too_many_attempts').includes('नया कोड') && S.loginErrorText('zzz').length > 0, 'login error text');

ok(E.parsePartnerAuthRequest({ action: 'start', email: ' A@B.Co ' }).email === 'a@b.co', 'function: start parses + normalises the email');
ok(!E.parsePartnerAuthRequest({ action: 'start', email: 'nope' }).ok && !E.parsePartnerAuthRequest(null).ok && !E.parsePartnerAuthRequest({ action: 'drop' }).ok, 'function: junk refused');
ok(E.parsePartnerAuthRequest({ action: 'welcome', partner_id: '11111111-2222-3333-4444-555555555555' }).ok && !E.parsePartnerAuthRequest({ action: 'welcome', partner_id: 'x' }).ok, 'function: welcome needs a uuid');
const otp = E.buildOtpEmail({ name: '<b>Ram</b>', code: '012345' });
ok(otp.subject.startsWith('012345') && otp.html.includes('012345') && otp.text.includes('012345') && !otp.html.includes('<b>Ram</b>') && otp.html.includes('&lt;b&gt;'), 'OTP email carries the code and escapes the name');
ok((() => { try { E.buildOtpEmail({ code: '12ab56' }); return false; } catch { return true; } })(), 'OTP email refuses a malformed code');
const wel = E.buildWelcomeEmail({ name: 'Ramesh', code: 'SL-7KQ2MD' });
ok(wel.html.includes('https://sahakarlekha.com/?ref=SL-7KQ2MD') && wel.html.includes('https://sahakarlekha.com/partner/login') && wel.text.includes('SL-7KQ2MD'), 'welcome email: code, referral link, portal');
ok(E.welcomeWhatsAppText({ name: 'Ramesh', code: 'SL-7KQ2MD' }) === R.partnerWelcomeWhatsAppText('Ramesh', 'SL-7KQ2MD'), 'WhatsApp text: Edge Function and app agree');
ok(R.partnerWelcomeWhatsAppUrl('9876543210', 'R', 'SL-7KQ2MD').startsWith('https://wa.me/919876543210?text=') && R.partnerWelcomeWhatsAppUrl('123', 'R', 'SL-7KQ2MD').startsWith('https://wa.me/?text='), 'wa.me goes to the partner\'s own number');
{
  const calls = [];
  const fakeFetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, text: async () => '' }; };
  const r1 = await E.sendViaResend('a@b.co', otp, { apiKey: 'k', from: 'SahakarLekha <noreply@sahakarlekha.com>', fetch: fakeFetch });
  ok(r1.ok && calls[0].url === 'https://api.resend.com/emails' && JSON.parse(calls[0].init.body).to[0] === 'a@b.co', 'Resend call shape');
  ok((await E.sendViaResend('a@b.co', otp, { apiKey: '', from: '' })).error === 'not_configured', 'no key → not_configured, no call');
  const r3 = await E.sendViaResend('a@b.co', otp, { apiKey: 'k', from: 'f', fetch: async () => { throw new Error('net down'); } });
  ok(!r3.ok && /net down/.test(r3.error), 'a network failure never throws');
}
const fn = read('supabase/functions/partner-auth/index.ts');
ok(/rpc\('partner_login_issue'/.test(fn) && /createClient\(url, svcKey/.test(fn), 'function issues the code with the service role');
ok((fn.match(/return json\(\{ ok: true \}\)/g) || []).length >= 2 && !/no_partner/.test(fn), 'start answers the same for every email (no enumeration)');
ok(/rpc\('admin_partner_welcome_info'/.test(fn) && /Authorization: `Bearer \$\{bearer\}`/.test(fn), 'welcome runs as the calling admin (RPC checks is_platform_admin)');

const up168 = read('supabase/migrations/168_partner_portal_otp.sql');
const down168 = read('supabase/migrations/168_partner_portal_otp_down.sql');
const c168 = up168.replace(/--.*$/gm, '');
for (const t of ['partner_login_codes', 'partner_sessions', 'partner_detail_requests']) {
  ok(new RegExp(`alter table public\\.${t}\\s+enable row level security`).test(c168) && new RegExp(`revoke all on table public\\.${t}\\s+from anon, authenticated`).test(c168), `${t}: RLS on, client grants revoked`);
  ok(new RegExp(`drop table if exists public\\.${t};`).test(down168), `down drops ${t}`);
}
ok(!/create policy/i.test(c168), '168 adds no policy');
ok(/revoke execute on function public\.partner_login_issue\(text\) from public, anon, authenticated;/.test(c168) && /grant execute on function public\.partner_login_issue\(text\) to service_role;/.test(c168), 'only the service role can issue a code');
const issue = c168.slice(c168.indexOf('function public.partner_login_issue('), c168.indexOf('$$;', c168.indexOf('function public.partner_login_issue(')));
ok(/interval '10 minutes'/.test(issue) && /digest\(v\.id::text \|\| ':' \|\| v_code, 'sha256'\)/.test(issue), 'code: 10 minutes, stored as a hash');
ok(/>= 3/.test(issue) && />= 10/.test(issue) && />= 300/.test(issue) && /status <> 'rejected'/.test(issue), 'code: 3 per 15 min, 10 per day, 300 per hour overall; never to a rejected partner');
const ver = c168.slice(c168.indexOf('function public.partner_login_verify('), c168.indexOf('$$;', c168.indexOf('function public.partner_login_verify(')));
ok(/c\.attempts >= 5/.test(ver) && /used_at = now\(\)/.test(ver) && /interval '30 days'/.test(ver), 'verify: 5 tries, single use, 30-day session');
ok(/digest\(v_session, 'sha256'\)/.test(ver) && !/auth\.users/.test(c168), 'session stored hashed; no Supabase Auth user is created');
const det168 = c168.slice(c168.indexOf('function public.partner_details_request('), c168.indexOf('$$;', c168.indexOf('function public.partner_details_request(')));
ok(/insert into public\.partner_detail_requests/.test(det168) && !/partner_payment_details/.test(det168), 'a partner\'s request never writes payment details directly');
const portal168 = c168.slice(c168.indexOf('function public.partner_portal('), c168.indexOf('$$;', c168.indexOf('function public.partner_portal(')));
ok(/'pan_masked'/.test(portal168) && /'account_masked'/.test(portal168) && !/'pan', d\.pan|'account_no', d\.account_no/.test(portal168), 'portal returns payment details masked only');
ok(/'phone_masked'/.test(portal168) && !/'token'/.test(portal168), 'portal never returns the phone or the old token');
for (const f of ['partner_status', 'partner_dashboard', 'partner_commissions', 'partner_payouts']) {
  ok(new RegExp(`revoke execute on function public\\.${f}\\(uuid\\)\\s+from public, anon, authenticated;`).test(c168), `old status-link RPC ${f} closed to clients`);
}
ok(/'email_required'/.test(c168) && /uq_partners_email_live/.test(c168), 'email required on apply, one live partner per email');
ok(/update public\.partner_sessions set revoked_at = now\(\) where partner_id = p_id/.test(c168), 'changing the email ends open sessions');
ok(/values \('168', 'partner_portal_otp'\)/.test(c168) && /where version = '168'/.test(down168), 'app_migrations 168 added and removed');
const appTsx = read('src/App.tsx');
ok(appTsx.includes('<Route path="/partner/login" element={<PartnerLogin />} />') && appTsx.includes('<Route path="/partner/portal" element={<PartnerPortalHome />} />'), 'portal routes exist');
ok(/rpc\('partner_login_verify'/.test(portalPage) && /functions\.invoke\('partner-auth'/.test(portalPage) && /rpc\('partner_portal'/.test(portalPage) && /rpc\('partner_details_request'/.test(portalPage) && /rpc\('partner_logout'/.test(portalPage), 'portal wires login, data, change request and logout');
ok(/useNoIndex\(\)/.test(portalPage) && /autoComplete="one-time-code"/.test(portalPage), 'portal pages are noindex; the code field is one-time-code');
ok(!/rpc\('partner_status'|rpc\('partner_dashboard'|rpc\('partner_commissions'|rpc\('partner_payouts'/.test(read('src/pages/PartnerProgram.tsx') + portalPage), 'no page calls the old token RPCs');
ok(/sendWelcome\(approved\)/.test(admin) && /admin_partner_set_email/.test(admin) && /AdminDetailRequests/.test(admin), 'admin: welcome email on approval, set email, change requests');
ok(/admin_detail_request_decide/.test(read('src/components/partners/AdminDetailRequests.tsx')), 'admin can approve / reject a change request');

console.log(`referral: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
