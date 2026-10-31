// Compliance reminder emails (email slice 4, migration 145) — the sourced filter, the 7/2/0 schedule, the
// daily run against a fake service-role client, the compliance_due template, and source-grep guards.
// Imports the COMMITTED bundle (what the Edge Function runs); check:edge-bundles keeps it equal to src/.
// Run: node scripts/test-compliance-reminders.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { COMPLIANCE_SOURCES, REMINDER_OFFSETS, dueReminders, istDate, ruleKeyOf, buildComplianceCalendar } from '../supabase/functions/_shared/compliance-core.mjs';
import { runComplianceReminders } from '../supabase/functions/_shared/compliance-reminders.mjs';
import { renderRow, TEMPLATES } from '../supabase/functions/_shared/email-outbox.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const ids = (r) => r.items.map((i) => i.id).sort().join();

// ── 1. Sources: only sourced rules, each with a URL ─────────────────────────────
ok(Object.keys(COMPLIANCE_SOURCES).sort().join() === '24q,audit,tds', 'sourced rules = tds, 24q, audit (pf/esi/gst/itr unsourced)');
for (const [k, s] of Object.entries(COMPLIANCE_SOURCES)) {
  ok(/https:\/\/\S+/.test(s.cite), `${k}: cite has a URL`);
  ok(s.titleHi && /[ऀ-ॿ]/.test(s.titleHi), `${k}: Hindi title`);
}
ok(COMPLIANCE_SOURCES.audit.state === 'hr' && !COMPLIANCE_SOURCES.tds.state, 'audit is Haryana-only; TDS is central');
ok(REMINDER_OFFSETS.join() === '7,2,0', 'offsets 7/2/0');
ok(ruleKeyOf('24q-q2-2026') === '24q' && ruleKeyOf('tds-2026-03') === 'tds' && ruleKeyOf('gstr3b-2026-01') === 'gstr3b', 'ruleKeyOf');

// ── 2. Schedule ──────────────────────────────────────────────────────────────────
const ALL = { hasEmployees: true, tan: true, gstin: true, state: 'hr' };
// Sept 2026 TDS → 7 Oct 2026. 30 Sep = 7 days before; 5 Oct = 2 days; 7 Oct = due.
ok(dueReminders('2026-09-30', ALL).items.some((i) => i.id === 'tds-2026-09' && i.daysLeft === 7), 'TDS: 7 days before');
ok(dueReminders('2026-10-05', ALL).items.some((i) => i.id === 'tds-2026-09' && i.daysLeft === 2), 'TDS: 2 days before');
ok(dueReminders('2026-10-07', ALL).items.some((i) => i.id === 'tds-2026-09' && i.daysLeft === 0), 'TDS: on the due date');
ok(!dueReminders('2026-10-06', ALL).items.some((i) => i.id === 'tds-2026-09'), 'TDS: no reminder 1 day before');
ok(!dueReminders('2026-10-08', ALL).items.some((i) => i.id === 'tds-2026-09'), 'TDS: no reminder after the due date (overdue is the calendar\'s job)');
// r.218(2)(a): March → 30 April.
ok(dueReminders('2027-04-23', ALL).items.some((i) => i.id === 'tds-2027-03' && i.dueDate === '2027-04-30'), 'TDS March → 30 April (r.218(2)(a))');
// r.219(4): Q2 → 31 Oct; Q4 → 31 May of the next year.
ok(dueReminders('2026-10-24', ALL).items.some((i) => i.id === '24q-q2-2026' && i.dueDate === '2026-10-31'), 'Form 138 Q2 → 31 Oct');
ok(dueReminders('2027-05-31', ALL).items.some((i) => i.id === '24q-q4-2026' && i.daysLeft === 0), 'Form 138 Q4 → 31 May next year');
// Haryana audit: 30 Sep.
ok(dueReminders('2026-09-23', ALL).items.some((i) => i.id === 'audit-2025' && i.dueDate === '2026-09-30'), 'audit FY2025-26 → 30 Sep 2026 (Haryana)');

// ── 3. Gates: unsourced, applicability, state, filed ─────────────────────────────
// 15 Oct = PF/ESI due; 11 Oct GSTR-1; 20 Oct GSTR-3B; 31 Oct ITR — never emailed.
for (const d of ['2026-10-08', '2026-10-13', '2026-10-04', '2026-10-09', '2026-10-15', '2026-10-11', '2026-10-20', '2026-10-31']) {
  const r = dueReminders(d, ALL);
  ok(r.items.every((i) => ['tds', '24q', 'audit'].includes(i.ruleKey)), `${d}: only sourced rules`);
}
ok(buildComplianceCalendar('2026-10-15', ALL).some((i) => i.id === 'pf-2026-09' && i.daysLeft === 0), 'engine still has PF (calendar unchanged)');
ok(dueReminders('2026-09-30', { ...ALL, tan: false }).items.every((i) => i.ruleKey !== 'tds' && i.ruleKey !== '24q'), 'no TAN → no TDS / Form 138');
ok(dueReminders('2026-09-30', { ...ALL, state: 'mp' }).items.every((i) => i.ruleKey !== 'audit'), 'not Haryana → no audit');
ok(dueReminders('2026-09-30', { ...ALL, state: 'Haryana' }).items.some((i) => i.ruleKey === 'audit'), '"Haryana" (name) counts as Haryana');
ok(dueReminders('2026-09-30', { ...ALL, state: null }).items.every((i) => i.ruleKey !== 'audit'), 'no state → no audit');
ok(!dueReminders('2026-09-30', ALL, ['tds-2026-09']).items.some((i) => i.id === 'tds-2026-09'), 'filed item → no reminder');
ok(ids(dueReminders('2026-09-30', ALL)) === 'audit-2025,tds-2026-09', '30 Sep 2026: TDS (7 d) + audit (due)');
const pc = dueReminders('2026-09-30', ALL);
ok(pc.pendingCount === 2, `pendingCount counts sourced unfiled items due ≤7 days (got ${pc.pendingCount})`);
ok(dueReminders('2026-09-30', ALL, ['audit-2025']).pendingCount === 1, 'pendingCount excludes filed');

// ── 4. istDate ───────────────────────────────────────────────────────────────────
ok(istDate(new Date('2026-10-06T19:00:00Z')) === '2026-10-07', 'istDate: 19:00 UTC is the next day in India');
ok(istDate(new Date('2026-10-06T18:00:00Z')) === '2026-10-06', 'istDate: 18:00 UTC is still the same day');

// ── 5. The run, against a fake service-role client ──────────────────────────────
function fakeClient(targets, opts = {}) {
  const calls = [];
  return {
    calls,
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      if (fn === 'compliance_reminder_targets') return opts.targetsError ? { data: null, error: { message: 'boom' } } : { data: targets, error: null };
      if (fn === 'enqueue_compliance_due') {
        if (opts.failSoc === args.p_society_id) return { data: null, error: { message: 'nope' } };
        return { data: args.p_items.length * 2, error: null };
      }
      return { data: null, error: { message: 'unexpected ' + fn } };
    },
  };
}
{
  const T = [
    { society_id: 'A', state: 'hr', tan: true, gstin: false, has_employees: false, filed_ids: [] },
    { society_id: 'B', state: 'mp', tan: false, gstin: true, has_employees: true, filed_ids: [] },
    { society_id: 'C', state: 'hr', tan: true, gstin: false, has_employees: false, filed_ids: ['tds-2026-09', 'audit-2025'] },
  ];
  const c = fakeClient(T);
  const r = await runComplianceReminders(c, { today: '2026-09-30' });
  ok(r.status === 'ok' && r.day === '2026-09-30' && r.societies === 3, 'run ok over 3 societies');
  const enq = c.calls.filter((x) => x.fn === 'enqueue_compliance_due');
  ok(enq.length === 1 && enq[0].args.p_society_id === 'A', 'only A has reminders (B: nothing sourced applies; C: all filed)');
  const items = enq[0].args.p_items;
  ok(items.map((i) => i.id).sort().join() === 'audit-2025,tds-2026-09', 'A gets TDS + audit');
  ok(items.every((i) => Object.keys(i).sort().join() === 'days_left,due_date,id,period,rule_key,title,title_hi'), 'item shape (no amount field)');
  ok(enq[0].args.p_day === '2026-09-30' && enq[0].args.p_pending_count === 2, 'day + pending count passed');
  ok(r.items === 2 && r.enqueued === 4, 'counts summed from the RPC');

  const e1 = await runComplianceReminders(fakeClient(T, { targetsError: true }), { today: '2026-09-30' });
  ok(e1.status === 'error' && e1.errors[0].includes('targets'), 'targets error → status error, no throw');
  const T2 = [T[0], { ...T[0], society_id: 'A2' }];
  const c3 = fakeClient(T2, { failSoc: 'A' });
  const e2 = await runComplianceReminders(c3, { today: '2026-09-30' });
  ok(e2.status === 'error' && e2.errors.length === 1 && e2.enqueued === 4, 'one society failing does not stop the next');
  const r0 = await runComplianceReminders(fakeClient(T), { today: '2026-09-29' });
  ok(r0.status === 'ok' && r0.items === 0, 'a quiet day queues nothing');
}

// ── 6. Template ──────────────────────────────────────────────────────────────────
const ROW = (payload, locale = 'hi') => ({ id: 'r', template_key: 'compliance_due', locale, recipient: 'a@x.in', payload });
const P = { name: 'Ram', society_name: 'Rania <PACS>', item_id: 'tds-2026-09', rule_key: 'tds', title: 'TDS deposit', title_hi: 'TDS जमा', period: 'Sep 2026', due_date: '2026-10-07', days_left: 2, pending_count: 3 };
ok(Object.keys(TEMPLATES).includes('compliance_due'), 'compliance_due registered');
{
  const m = renderRow(ROW(P), { appUrl: 'https://app.example/' });
  ok(m.subject.startsWith('रिमाइंडर: TDS जमा — 07/10/2026') && m.subject.includes('Reminder: TDS deposit due 07/10/2026'), 'Hindi-first subject with dd/mm/yyyy');
  ok(m.html.includes('2 दिन बाकी') && m.html.includes('2 days left'), 'days left in both languages');
  ok(m.html.includes('कुल 3 compliance काम'), 'count line');
  ok(m.html.includes('https://app.example/compliance-calendar'), 'button → /compliance-calendar');
  ok(m.html.includes('Rania &lt;PACS&gt;') && !m.html.includes('<PACS>'), 'society name escaped');
  ok(!/₹|\bRs\.?\s?\d/.test(m.html + m.text + m.subject), 'no amount in the email');
  ok(m.text.includes('07/10/2026') && m.text.includes('फाइल हुआ'), 'text part has date + how to stop');
  const t = renderRow(ROW({ ...P, days_left: 0, pending_count: 1 }));
  ok(t.subject.includes('— आज तक') && t.html.includes('आज अंतिम तारीख़ है') && !t.html.includes('कुल 1'), 'due-today wording; count line only when > 1');
  const en = renderRow(ROW({ ...P, days_left: 1 }, 'en'));
  ok(en.subject === 'Reminder: TDS deposit due 07/10/2026' && en.html.includes('1 day left') && !en.html.includes('बाकी') && !en.text.includes('फाइल'), 'English locale (only the shell signature stays Hindi)');
  for (const bad of [{ ...P, due_date: '7 Oct' }, { ...P, days_left: -1 }, { ...P, days_left: 'x' }]) {
    let threw = false; try { renderRow(ROW(bad)); } catch { threw = true; }
    ok(threw, `bad payload refused: ${JSON.stringify(bad).slice(90, 140)}`);
  }
}

// ── 7. Source guards: migration, function, bundle wiring ─────────────────────────
{
  const sql = read('supabase/migrations/145_compliance_reminders.sql');
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  for (const fn of ['compliance_reminder_targets()', 'enqueue_compliance_due(text, date, jsonb, integer)']) {
    ok(code.includes(`revoke execute on function public.${fn} from public, anon, authenticated`), `${fn}: revoked from clients`);
    ok(code.includes(`grant execute on function public.${fn} to service_role`), `${fn}: service_role only`);
  }
  ok(/su\.role = 'admin' and su\.is_active/.test(code) && /lower\(su\.email\)/.test(code), 'recipients = active admins by lower(email), resolved in SQL');
  ok(/compliance_filings cf\s+where cf\.society_id::text = p_society_id and cf\."itemId" = v_item ->> 'id'/.test(code), 'enqueue re-checks filed server-side');
  ok(/'compliance_due:' \|\| p_society_id \|\| ':' \|\| \(v_item ->> 'id'\) \|\| ':' \|\| v_admin\.email \|\| ':' \|\| p_day::text/.test(code), 'idempotency key = society + item + recipient + day');
  ok(!/amount|balance|total/i.test(code), 'no amount column touched');
  ok(/values \('145', 'compliance_reminders'\)/.test(code), 'app_migrations row');
  const down = read('supabase/migrations/145_compliance_reminders_down.sql');
  ok(/drop function if exists public\.enqueue_compliance_due/.test(down) && /drop function if exists public\.compliance_reminder_targets/.test(down), 'down drops both');

  const fn = read('supabase/functions/compliance-reminders/index.ts');
  ok(/if \(!secret\) return json\(\{ ok: false, error: 'OUTBOX_CRON_SECRET not configured' \}, 500\)/.test(fn), 'fails closed without a secret');
  ok(/req\.headers\.get\('x-outbox-secret'\) !== secret/.test(fn), 'checks x-outbox-secret');
  ok(read('supabase/functions/compliance-reminders/README.md').includes('--no-verify-jwt'), 'README deploys with --no-verify-jwt');
  const pkg = JSON.parse(read('package.json')).scripts;
  ok(/compliance-core\.entry\.ts .*--outfile=supabase\/functions\/_shared\/compliance-core\.mjs/.test(pkg['build:compliance-core'] ?? ''), 'bundle is in check:edge-bundles (build:compliance-core)');

  const dc = read('src/contexts/DataContext.tsx');
  const mark = dc.slice(dc.indexOf('const markComplianceFiled'), dc.indexOf('const getComplianceFiledIds'));
  ok((mark.match(/if \(guardFYLocked\(\)\) return;/g) ?? []).length === 2, 'mark + unmark both FY-lock guarded (RULE 6)');
  ok(/\.delete\(\)\.eq\('id', filing\.id\)\.select\('id'\)/.test(mark) && /variant: 'destructive', duration: 10000/.test(mark.slice(mark.indexOf('unmarkComplianceFiled'))), 'unmark checks deleted rows and rolls back with a destructive toast (RULE 1)');
}

console.log(`\ncompliance reminders: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
