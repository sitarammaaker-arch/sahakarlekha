// A trial / paid period that has ended actually ends (migration 159).
// The rule lives twice — src/lib/plans.ts effectiveStatus (the app) and refresh_subscription_status()
// (the server job). This proves the pure rule case by case and statically ties the SQL and the wiring to it.
// Run: node scripts/test-subscription-expiry.mjs   (npm run test:subscription-expiry)
import { readFileSync } from 'node:fs';
import { GRACE_DAYS, LEGACY_NOTICE_DAYS, RENEWAL_NOTICE_DAYS, effectiveStatus, daysUntil, graceDaysLeft } from '../src/lib/plans.ts';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (sql) => sql.replace(/--[^\n]*/g, '');

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-11T10:00:00Z');
const at = (days) => new Date(NOW + days * DAY).toISOString();

// ── 1. The rule ──────────────────────────────────────────────────────────────
ok(GRACE_DAYS === 7, 'grace is 7 days');
ok(effectiveStatus('trial', 'trialing', at(5), NOW) === 'trialing', 'trial with days left → trialing');
ok(effectiveStatus('starter', 'active', at(200), NOW) === 'active', 'paid plan inside its period → active');
ok(effectiveStatus('trial', 'trialing', at(-0.001), NOW) === 'grace', 'the moment the trial ends → grace');
ok(effectiveStatus('trial', 'trialing', at(-6.99), NOW) === 'grace', 'day 6.99 after the end → still grace (writable)');
ok(effectiveStatus('trial', 'trialing', at(-7), NOW) === 'expired', 'exactly 7 days after the end → expired');
ok(effectiveStatus('plus', 'active', at(-30), NOW) === 'expired', 'a paid plan a month past its end → expired');
ok(effectiveStatus('pro', 'active', at(-3), NOW) === 'grace', 'a paid plan 3 days past its end → grace');
// No period_end never expires. A legacy row WITH an end date follows the same rule (migration 160).
ok(effectiveStatus('legacy', 'active', null, NOW) === 'active', 'legacy with no end date → active (indefinite)');
ok(effectiveStatus('legacy', 'active', at(140), NOW) === 'active', 'legacy before its end date → active');
ok(effectiveStatus('legacy', 'active', at(-3), NOW) === 'grace', 'legacy 3 days past its end date → grace');
ok(effectiveStatus('legacy', 'active', at(-7), NOW) === 'expired', 'legacy a week past its end date → expired');
{
  // The founder's dates: free until 31-03-2027 (IST), notice 1–7 April, paused from 8 April.
  const END = '2027-03-31T23:59:59+05:30';
  const on = (s) => effectiveStatus('legacy', 'active', END, Date.parse(s));
  ok(on('2027-03-31T23:00:00+05:30') === 'active', '31 March 2027, 11 pm IST → still free');
  ok(on('2027-04-01T00:30:00+05:30') === 'grace' && on('2027-04-07T23:00:00+05:30') === 'grace', '1 – 7 April 2027 → notice');
  ok(on('2027-04-08T00:30:00+05:30') === 'expired', '8 April 2027 → new entries paused');
}
ok(effectiveStatus('starter', 'active', null, NOW) === 'active', 'no period_end → the stored status');
ok(effectiveStatus(undefined, undefined, undefined, NOW) === 'active', 'no row at all → active (never stricter)');
ok(effectiveStatus('trial', 'trialing', 'not-a-date', NOW) === 'trialing', 'an unreadable date never blocks');
// Never looser than the server.
ok(effectiveStatus('trial', 'expired', at(10), NOW) === 'expired', 'server says expired → expired, whatever the date');
ok(effectiveStatus('plus', 'grace', at(10), NOW) === 'grace', 'server says grace → grace');
ok(effectiveStatus('plus', 'expired', at(-2), NOW) === 'expired', 'server expired beats a derived grace');
ok(effectiveStatus('plus', 'grace', at(-9), NOW) === 'expired', 'derived expired beats a stored grace');

ok(daysUntil(at(5), NOW) === 5 && daysUntil(at(0.2), NOW) === 1 && daysUntil(at(-2), NOW) === -2 && daysUntil(null, NOW) === null, 'daysUntil rounds up; null without a date');
ok(graceDaysLeft(at(-0.5), NOW) === 7 && graceDaysLeft(at(-3), NOW) === 4 && graceDaysLeft(at(-7), NOW) === 0 && graceDaysLeft(at(-50), NOW) === 0 && graceDaysLeft(null, NOW) === null, 'graceDaysLeft counts down to 0, never negative');
ok(RENEWAL_NOTICE_DAYS > 0 && RENEWAL_NOTICE_DAYS <= 30, 'a renewal reminder window exists');

// ── 2. Migration 159 mirrors the rule ────────────────────────────────────────
{
  const up = read('supabase/migrations/159_subscription_expiry.sql');
  const down = read('supabase/migrations/159_subscription_expiry_down.sql');
  const c = code(up);
  const fnA = c.indexOf('create or replace function public.refresh_subscription_status()');
  const fn = c.slice(fnA, c.indexOf('$$;', fnA));
  const days = [...fn.matchAll(/interval '(\d+) days'/g)].map((m) => Number(m[1]));
  ok(days.length === 1 && days[0] === GRACE_DAYS, `the SQL grace (${days.join(',')} days) equals GRACE_DAYS`);
  ok(/when now\(\) >= period_end \+ interval '7 days' then 'expired' else 'grace' end/.test(fn), 'grace until period_end + 7 days, then expired');
  ok(/period_end is not null/.test(fn) && /period_end <= now\(\)/.test(fn) && /plan <> 'legacy'/.test(fn), 'only rows past period_end; never legacy; never an indefinite row');
  ok(/and status <> 'expired'/.test(fn) && !/'active'|'trialing'/.test(fn), 'forward only — the job never sets active / trialing and never re-opens an expired row');
  ok(/s\.status is distinct from n\.new_status/.test(fn) && /get diagnostics v_changed = row_count/.test(fn), 'idempotent: an unchanged row is not rewritten; returns the count');
  ok(/security definer/.test(fn) && /revoke execute on function public\.refresh_subscription_status\(\) from public, anon, authenticated;/.test(c) && /grant execute on function public\.refresh_subscription_status\(\) to service_role;/.test(c), 'service-role only');
  ok(/perform cron\.schedule\('subscription-expiry', '5 \* \* \* \*', 'select public\.refresh_subscription_status\(\)'\);/.test(c) && /cron\.unschedule\('subscription-expiry'\)/.test(c), 'hourly job, re-runnable');
  // The one-time fairness step: overdue rows get 7 days of notice from the day of roll-out.
  const one = c.slice(c.indexOf('update public.subscriptions'), fnA);
  ok(/period_end = now\(\)/.test(one) && /period_end < now\(\)/.test(one) && /plan <> 'legacy'/.test(one) && /status in \('trialing', 'active'\)/.test(one), 'already-overdue trialing/active rows restart their notice today (legacy untouched)');
  ok(/notes\s+= concat_ws\(/.test(one) && /period ended/.test(one), 'the original end date is kept in notes');
  ok(c.indexOf('update public.subscriptions') < fnA && c.indexOf('select public.refresh_subscription_status();') > fnA, 'fairness step runs BEFORE the first refresh');
  ok(!/update public\.(vouchers|members|accounts)|delete from public\.(?!app_migrations)/.test(c), '159 touches only subscriptions — no society data');
  ok(/values \('159', 'subscription_expiry'\)/.test(c) && /delete from public\.app_migrations where version = '159'/.test(down), '159 ledger insert / down delete');
  ok(/drop function if exists public\.refresh_subscription_status\(\);/.test(down) && /cron\.unschedule\('subscription-expiry'\)/.test(down), 'down drops the function and the job');
}

// ── 3. Wiring ────────────────────────────────────────────────────────────────
{
  const hook = read('src/hooks/useSubscription.ts');
  ok(/const status: SubscriptionStatus = effectiveStatus\(plan, row\?\.status, row\?\.period_end\);/.test(hook), 'useSubscription reports the derived status');
  const dc = read('src/contexts/DataContext.tsx');
  const gA = dc.indexOf('const guardSubscriptionExpired = useCallback((): boolean => {');
  const guard = dc.slice(gA, dc.indexOf('}, []);', gA));
  ok(/effectiveStatus\(row\.plan, row\.status, row\.period_end\) !== 'expired'\) return false;/.test(guard), 'the voucher guard derives "expired" at call time (a long session is paused too)');
  ok(/if \(!row \|\|/.test(guard), 'no subscription row → never blocked');
  ok(!/subExpiredRef/.test(dc), 'the login-time boolean is gone');
  ok(/डेटा सुरक्षित/.test(guard) && /User Management/.test(guard) && /variant: 'destructive'/.test(guard), 'the refusal says, in Hindi first, that data is safe and where to buy');
  ok((dc.match(/guardSubscriptionExpired\(\)/g) || []).length >= 3, 'addVoucher, guardVoucherPostable and voucherBirthBlocked all ask the guard');
  const banner = read('src/components/SubscriptionBanner.tsx');
  ok(/const PLAN_PAGE = '\/user-management';/.test(banner) && !/to="\/pricing"/.test(banner), 'the banner sends the user to where a plan is bought, not the public pricing page');
  ok(/status === 'grace'/.test(banner) && /graceDaysLeft\(periodEnd\)/.test(banner) && /status === 'expired'/.test(banner), 'grace and expired have their own notices');
  ok(/if \(plan === 'legacy' && !periodEnd\) return null;/.test(banner), 'a legacy society with NO end date sees no banner');
  ok(/const noticeDays = plan === 'legacy' \? LEGACY_NOTICE_DAYS : RENEWAL_NOTICE_DAYS;/.test(banner) && /status === 'active' && left != null && left <= noticeDays/.test(banner), 'a paid plan (15 days) and a legacy society (30 days) are reminded before the end');
  ok(/आपकी मुफ़्त अवधि समाप्त हो गई है/.test(banner) && /मुफ़्त अवधि \$\{Math\.max\(left, 0\)\} दिन में पूरी हो रही है/.test(banner), 'a legacy society is told its FREE PERIOD is ending, not a "plan"');
  ok(LEGACY_NOTICE_DAYS === 30, 'legacy notice is 30 days');
}

// ── 4. Migration 160 — legacy societies get an end date ──────────────────────
{
  const fnOf = (sql) => { const a = sql.indexOf('create or replace function public.refresh_subscription_status()'); return a < 0 ? '' : sql.slice(a, sql.indexOf('$$;', a) + 3); };
  const m159 = code(read('supabase/migrations/159_subscription_expiry.sql'));
  const up = read('supabase/migrations/160_legacy_end_date.sql');
  const down = read('supabase/migrations/160_legacy_end_date_down.sql');
  const c = code(up);
  const f159 = fnOf(m159), f160 = fnOf(c);
  ok(f160.length > 0 && f160 === f159.replace("       and plan <> 'legacy'\n", ''), '160 function = 159 body with ONLY the legacy exclusion removed');
  ok(!/legacy/.test(f160) && /period_end is not null/.test(f160), 'the rule depends on period_end alone — a null end date is still indefinite');
  ok(fnOf(code(down)) === f159, '160 down restores the 159 function byte-for-byte');
  ok(/revoke execute on function public\.refresh_subscription_status\(\) from public, anon, authenticated;/.test(c), '160 keeps the function service-role only');
  const upd = c.slice(c.indexOf('update public.subscriptions\n   set period_end = timestamptz'));
  ok(/set period_end = timestamptz '2027-03-31 23:59:59\+05:30'/.test(upd) && /where plan = 'legacy'\s+and period_end is null;/.test(upd), 'every legacy row WITHOUT an end date → 31-03-2027 end of day IST; one that has a date is left alone');
  const setClause = upd.slice(upd.indexOf('set '), upd.indexOf(' where '));
  ok(setClause.length > 0 && !/\bplan\b|\bstatus\b|seats_limit/.test(setClause), 'the plan, status and limits are NOT changed — legacy stays legacy until then');
  ok(/notes\s+= concat_ws\(/.test(upd), 'the decision is recorded in notes');
  ok(/values \('160', 'legacy_end_date'\)/.test(c) && /delete from public\.app_migrations where version = '160'/.test(down), '160 ledger insert / down delete');
  ok(/set period_end = null, status = 'active'/.test(down) && /period_end = timestamptz '2027-03-31 23:59:59\+05:30'/.test(down), 'down clears only the date this migration set');
}

console.log(`subscription-expiry: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
