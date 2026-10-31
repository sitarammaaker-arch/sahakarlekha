// Weekly digest email (email slice 5, migration 146) — ISO week, the 14-day sourced compliance count, the run
// against a fake service-role client (quiet societies skipped), the weekly_digest template (counts only), and
// source-grep guards on the migration / function.
// Imports the COMMITTED bundle (what the Edge Function runs); check:edge-bundles keeps it equal to src/.
// Run: node scripts/test-weekly-digest.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { dueWithinCount } from '../supabase/functions/_shared/compliance-core.mjs';
import { runWeeklyDigest, isoWeek, isQuiet, DIGEST_COMPLIANCE_DAYS } from '../supabase/functions/_shared/weekly-digest.mjs';
import { renderRow, TEMPLATES } from '../supabase/functions/_shared/email-outbox.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// ── 1. ISO week (must equal Postgres to_char(day, 'IYYY-"W"IW')) ────────────────
ok(isoWeek('2026-11-02') === '2026-W45', 'Mon 2 Nov 2026 → 2026-W45');
ok(isoWeek('2026-11-08') === '2026-W45', 'Sun 8 Nov 2026 → same week');
ok(isoWeek('2026-11-09') === '2026-W46', 'next Monday → W46');
ok(isoWeek('2027-01-01') === '2026-W53', '1 Jan 2027 (Fri) belongs to 2026-W53');
ok(isoWeek('2027-01-04') === '2027-W01', '4 Jan 2027 → 2027-W01');
ok(isoWeek('2025-12-29') === '2026-W01', '29 Dec 2025 (Mon) → 2026-W01');

// ── 2. Compliance count: sourced, unfiled, 0..14 days ────────────────────────────
const ALL = { hasEmployees: true, tan: true, gstin: true, state: 'hr' };
ok(DIGEST_COMPLIANCE_DAYS === 14, '14-day window');
// 26 Oct 2026: Form 138 Q2 (31 Oct, 5 d) + TDS Oct (7 Nov, 12 d). PF/ESI/GST (unsourced) never counted.
ok(dueWithinCount('2026-10-26', ALL, [], 14) === 2, `26 Oct: Form 138 Q2 + TDS Oct (got ${dueWithinCount('2026-10-26', ALL, [], 14)})`);
ok(dueWithinCount('2026-10-26', ALL, ['24q-q2-2026'], 14) === 1, 'filed item not counted');
ok(dueWithinCount('2026-10-26', { ...ALL, tan: false }, [], 14) === 0, 'no TAN → nothing sourced applies (GST/PF unsourced)');
ok(dueWithinCount('2026-09-21', ALL, [], 14) === 1, '21 Sep: Haryana audit 30 Sep only (TDS Sep 7 Oct is 16 days out)');
ok(dueWithinCount('2026-09-24', ALL, [], 14) === 2, '24 Sep: audit 30 Sep + TDS Sep 7 Oct (day 13)');
ok(dueWithinCount('2026-09-21', { ...ALL, state: 'mp' }, [], 14) === 0, 'not Haryana → audit not counted');
ok(dueWithinCount('2026-11-01', ALL, [], 14) === 1, 'overdue Form 138 (31 Oct) is not "due in 14 days"');

// ── 3. Quiet rule ────────────────────────────────────────────────────────────────
ok(isQuiet({ vouchers_week: 0, pending_approval: 0, unverified_users: 5, days_since_last: 40 }, 0), 'no activity, nothing due → quiet (unverified alone is not news)');
ok(!isQuiet({ vouchers_week: 1, pending_approval: 0 }, 0), 'a voucher this week → send');
ok(!isQuiet({ vouchers_week: 0, pending_approval: 2 }, 0), 'pending approval → send');
ok(!isQuiet({ vouchers_week: 0, pending_approval: 0 }, 1), 'compliance due → send');

// ── 4. The run, against a fake service-role client ──────────────────────────────
function fakeClient(targets, opts = {}) {
  const calls = [];
  return {
    calls,
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      if (fn === 'weekly_digest_targets') return opts.targetsError ? { data: null, error: { message: 'boom' } } : { data: targets, error: null };
      if (fn === 'enqueue_weekly_digest') {
        if (opts.failSoc === args.p_society_id) return { data: null, error: { message: 'nope' } };
        if (opts.throwSoc === args.p_society_id) throw new Error('network');
        return { data: 2, error: null };
      }
      return { data: null, error: { message: 'unexpected ' + fn } };
    },
  };
}
{
  const C = (o) => ({ pending_approval: 0, vouchers_week: 0, days_since_last: 3, unverified_users: 0, ...o });
  const T = [
    { society_id: 'A', state: 'hr', tan: false, gstin: true, has_employees: true, filed_ids: [], counts: C({ vouchers_week: 12 }) },
    { society_id: 'B', state: 'hr', tan: false, gstin: false, has_employees: false, filed_ids: [], counts: C({ unverified_users: 3, days_since_last: 60 }) },
    { society_id: 'C', state: 'mp', tan: true, gstin: false, has_employees: false, filed_ids: [], counts: C() },
    { society_id: 'D', state: 'hr', tan: false, gstin: false, has_employees: false, filed_ids: [], counts: C({ pending_approval: 4 }) },
  ];
  const c = fakeClient(T);
  const r = await runWeeklyDigest(c, { today: '2026-10-26' });
  ok(r.status === 'ok' && r.day === '2026-10-26' && r.week === '2026-W44' && r.societies === 4, 'run ok over 4 societies, week key');
  ok(c.calls[0].fn === 'weekly_digest_targets' && c.calls[0].args.p_day === '2026-10-26', 'targets read for the run day');
  const enq = c.calls.filter((x) => x.fn === 'enqueue_weekly_digest');
  ok(enq.map((e) => e.args.p_society_id).join() === 'A,C,D', 'A (vouchers), C (Form 138 + TDS due), D (pending) queued; B quiet');
  ok(enq.find((e) => e.args.p_society_id === 'C').args.p_compliance_due === 2, 'C: compliance count from the engine');
  ok(enq.find((e) => e.args.p_society_id === 'A').args.p_compliance_due === 0, 'A: GST/PF dates are unsourced → 0');
  ok(enq.every((e) => Object.keys(e.args).sort().join() === 'p_compliance_due,p_day,p_society_id'), 'RPC args: no counts or amounts passed from the client');
  ok(r.quiet === 1 && r.enqueued === 6, 'quiet + enqueued summed');

  const e1 = await runWeeklyDigest(fakeClient(T, { targetsError: true }), { today: '2026-10-26' });
  ok(e1.status === 'error' && e1.errors[0].includes('targets'), 'targets error → status error, no throw');
  const e2 = await runWeeklyDigest(fakeClient(T, { failSoc: 'A', throwSoc: 'C' }), { today: '2026-10-26' });
  ok(e2.status === 'error' && e2.errors.length === 2 && e2.enqueued === 2, 'failing societies do not stop the next');
}

// ── 5. Template ──────────────────────────────────────────────────────────────────
const ROW = (payload, locale = 'hi') => ({ id: 'r', template_key: 'weekly_digest', locale, recipient: 'a@x.in', payload });
const P = { name: 'Ram', society_name: 'Rania <PACS>', week: '2026-W45', period_from: '2026-10-26', period_to: '2026-11-01',
  pending_approval: 4, vouchers_week: 12, days_since_last: 1, compliance_due: 2, unverified_users: 3 };
ok(Object.keys(TEMPLATES).includes('weekly_digest'), 'weekly_digest registered');
{
  const m = renderRow(ROW(P), { appUrl: 'https://app.example/' });
  ok(m.subject === 'हफ़्ते की रिपोर्ट — Rania <PACS> / Weekly summary', `Hindi-first subject (got ${m.subject})`);
  ok(m.html.includes('इस हफ़्ते दर्ज वाउचर: 12') && m.html.includes('Vouchers entered this week: 12'), 'vouchers this week, both languages');
  ok(m.html.includes('आख़िरी वाउचर: 1 दिन पहले') && m.html.includes('1 day ago'), 'days since last');
  ok(m.html.includes('मंज़ूरी के लिए बाकी वाउचर: 4'), 'pending approval');
  ok(m.html.includes('अगले 14 दिनों में compliance की आख़िरी तारीख़ें: 2'), 'compliance due');
  ok(m.html.includes('3 यूज़र का ईमेल verify नहीं है') && m.html.includes('3 users have not verified'), 'unverified users');
  ok(m.html.includes('(26/10/2026 – 01/11/2026)'), 'period shown dd/mm/yyyy');
  ok(m.html.includes('https://app.example/dashboard'), 'button → /dashboard');
  ok(m.html.includes('Rania &lt;PACS&gt;') && !m.html.includes('<PACS>'), 'society name escaped in html');
  ok(!/₹|\bRs\.?\s?\d|amount\s*:|balance\s*:/i.test(m.html + m.text + m.subject), 'no amount in the email');
  ok(m.text.includes('इस हफ़्ते दर्ज वाउचर: 12') && m.text.includes('/dashboard'), 'text part');
  const q = renderRow(ROW({ ...P, unverified_users: 0, days_since_last: null }));
  ok(!q.html.includes('verify नहीं') && q.html.includes('अभी तक कोई वाउचर दर्ज नहीं हुआ'), 'unverified line only when > 0; no voucher ever');
  ok(renderRow(ROW({ ...P, days_since_last: 0 })).html.includes('आख़िरी वाउचर: आज'), 'last voucher today');
  const en = renderRow(ROW(P, 'en'));
  ok(en.subject === 'Weekly summary' && !en.html.includes('वाउचर') && en.html.includes('Open dashboard'), 'English locale');
  const bads = [{ ...P, amount: 5000 }, { ...P, closing_balance: 1 }, { ...P, vouchers_week: -1 }, { ...P, pending_approval: 'x' },
    { ...P, compliance_due: 1.5 }, { ...P, unverified_users: null }, { ...P, days_since_last: -2 }];
  for (const bad of bads) {
    let threw = false; try { renderRow(ROW(bad)); } catch { threw = true; }
    ok(threw, `bad payload refused: ${Object.keys(bad).filter((k) => !(k in P) || bad[k] !== P[k]).join()}`);
  }
}

// ── 6. Source guards: migration, function, label ─────────────────────────────────
{
  const sql = read('supabase/migrations/146_weekly_digest.sql');
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  for (const fn of ['weekly_digest_targets(date)', 'enqueue_weekly_digest(text, date, integer)']) {
    ok(code.includes(`revoke execute on function public.${fn} from public, anon, authenticated`), `${fn}: revoked from clients`);
    ok(code.includes(`grant execute on function public.${fn} to service_role`), `${fn}: service_role only`);
  }
  ok(code.includes('revoke execute on function public.weekly_digest_counts(text, date) from public, anon, authenticated')
    && !code.includes('grant execute on function public.weekly_digest_counts'), 'weekly_digest_counts: internal (no grant)');
  ok((code.match(/not coalesce\(vo\."isDeleted", false\)/g) ?? []).length === 1 && /from v where v\.st = 'pending'/.test(code), 'soft-deleted vouchers excluded once at the source CTE; pending = approvalStatus pending');
  ok(/su\.role = 'admin' and su\.is_active/.test(code) && /lower\(su\.email\) as email/.test(code), 'recipients = active admins by lower(email), resolved in SQL');
  ok(/'weekly_digest:' \|\| p_society_id \|\| ':' \|\| v_admin\.email \|\| ':' \|\| v_week/.test(code) && /to_char\(p_day, 'IYYY-"W"IW'\)/.test(code), 'idempotency key = society + recipient + ISO week');
  ok(/v_c := public\.weekly_digest_counts\(p_society_id, p_day\)/.test(code) && /p_compliance_due = 0 then\s+return 0;/.test(code), 'enqueue recomputes counts and skips a quiet society server-side');
  ok(!/amount|balance|total/i.test(code), 'no amount column touched');
  ok(/values \('146', 'weekly_digest'\)/.test(code), 'app_migrations row');
  const keys = [...code.matchAll(/'([a-z_]+)', (?:v_admin|v_name|v_week|\(p_day|\(v_c|p_compliance_due)/g)].map((m) => m[1]).filter((k) => k !== 'weekly_digest').sort().join();
  ok(keys === 'compliance_due,days_since_last,name,pending_approval,period_from,period_to,society_name,unverified_users,vouchers_week,week', `payload keys = template whitelist (got ${keys})`);
  const down = read('supabase/migrations/146_weekly_digest_down.sql');
  ok(['enqueue_weekly_digest', 'weekly_digest_targets', 'weekly_digest_counts'].every((f) => down.includes(`drop function if exists public.${f}`)), 'down drops all three');

  const fn = read('supabase/functions/weekly-digest/index.ts');
  ok(/if \(!secret\) return json\(\{ ok: false, error: 'OUTBOX_CRON_SECRET not configured' \}, 500\)/.test(fn), 'fails closed without a secret');
  ok(/req\.headers\.get\('x-outbox-secret'\) !== secret/.test(fn), 'checks x-outbox-secret');
  const readme = read('supabase/functions/weekly-digest/README.md');
  ok(readme.includes('--no-verify-jwt') && readme.includes("'30 1 * * 1'") && readme.includes("replace((select command from cron.job where jobid = 10), '/send-worker', '/weekly-digest')"), 'README: --no-verify-jwt, Monday 01:30 UTC, cron copied from job 10 (no secret pasted)');
  ok(/weekly_digest: 'हफ़्ते की रिपोर्ट'/.test(read('src/components/email/EmailLogTable.tsx')), 'email log label');
}

console.log(`\nweekly digest: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
