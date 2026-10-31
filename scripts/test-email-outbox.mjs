// The notification outbox worker (supabase/functions/_shared/email-outbox.mjs, email slice 1) driven with a FAKE
// service-role client and a FAKE Resend, plus static guards on migration 142, the send-worker function and the UI.
// Run: node scripts/test-email-outbox.mjs   (npm run test:email-outbox)
import { readFileSync } from 'node:fs';
import { runOutbox, renderRow, TEMPLATES } from '../supabase/functions/_shared/email-outbox.mjs';
import { verifySvix, signSvix, handleResendEvent } from '../supabase/functions/_shared/resend-webhook.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const TOKEN = 'a'.repeat(48);
const ROW = (over = {}) => ({
  id: 'r1', society_id: 'SOC1', channel: 'email', template_key: 'email_verify', locale: 'hi',
  recipient: 'clerk@example.com', payload: { token: TOKEN, name: 'Ram <Lal>' }, idempotency_key: 'email_verify:clerk@example.com:1',
  status: 'sending', attempts: 1, ...over,
});

/** Fake client: claim_outbox returns `rows`; complete_outbox records the call and answers like migration 142. */
function fakeClient(rows, { claimError } = {}) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'claim_outbox') return claimError ? { data: null, error: { message: claimError } } : { data: rows, error: null };
      if (name === 'complete_outbox') {
        const row = rows.find((r) => r.id === args.p_id);
        const verdict = args.p_ok ? 'sent' : args.p_retryable && row.attempts < 5 ? 'retry' : 'failed';
        return { data: verdict, error: null };
      }
      return { data: null, error: { message: `unexpected rpc ${name}` } };
    },
  };
}

/** Fake Resend: `reply(n)` gives the n-th response. */
function fakeFetch(reply = () => ({ ok: true, status: 200, json: async () => ({ id: 'em_1' }), text: async () => '' })) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return reply(calls.length); };
  return { calls, f };
}
const CFG = (f, extra = {}) => ({ apiKey: 're_test', from: 'सहकार लेखा <no-reply@notify.example>', appUrl: 'https://app.example/', fetch: f, gapMs: 0, ...extra });
const completes = (c) => c.calls.filter((x) => x.name === 'complete_outbox').map((x) => x.args);

// ── 1. Not configured → claims nothing ──────────────────────────────────────
{
  const c = fakeClient([ROW()]);
  const r = fakeFetch();
  ok((await runOutbox(c, { fetch: r.f })).status === 'not_configured', 'no key → not_configured');
  ok((await runOutbox(c, { apiKey: 'k', fetch: r.f })).status === 'not_configured', 'no from → not_configured');
  ok(c.calls.length === 0 && r.calls.length === 0, 'not configured → no claim, no send (rows keep waiting)');
}

// ── 2. Happy path ───────────────────────────────────────────────────────────
{
  const c = fakeClient([ROW()]);
  const r = fakeFetch();
  const out = await runOutbox(c, CFG(r.f, { batch: 7, dailyCap: 33 }));
  ok(out.status === 'ok' && out.claimed === 1 && out.sent === 1, 'one claimed, one sent');
  ok(c.calls[0].name === 'claim_outbox' && c.calls[0].args.p_limit === 7 && c.calls[0].args.p_daily_cap === 33, 'batch + daily cap reach claim_outbox');
  const h = r.calls[0].init.headers;
  ok(h.Authorization === 'Bearer re_test' && h['Idempotency-Key'] === 'email_verify:clerk@example.com:1', 'Idempotency-Key = row key');
  const b = r.calls[0].body;
  ok(b.to.length === 1 && b.to[0] === 'clerk@example.com', 'sent only to the row recipient');
  ok(b.html.includes(`https://app.example/verify-email?token=${TOKEN}`) && b.text.includes(`https://app.example/verify-email?token=${TOKEN}`), 'verify link in html + text (trailing slash trimmed)');
  ok(b.html.includes('Ram &lt;Lal&gt;') && !b.html.includes('Ram <Lal>'), 'name is HTML-escaped');
  ok(b.subject.startsWith('अपना ईमेल verify करें'), 'Hindi-first subject');
  const done = completes(c)[0];
  ok(done.p_id === 'r1' && done.p_ok === true && done.p_provider_id === 'em_1', 'complete_outbox(ok, provider id)');
}

// ── 3. Failures: retryable vs permanent ─────────────────────────────────────
{
  const rows = [ROW({ id: 'a', idempotency_key: 'k1' }), ROW({ id: 'b', idempotency_key: 'k2' }), ROW({ id: 'c', idempotency_key: 'k3' }), ROW({ id: 'd', idempotency_key: 'k4' })];
  const replies = [
    { ok: false, status: 429, text: async () => 'rate limited' },
    { ok: false, status: 503, text: async () => '' },
    { ok: false, status: 422, text: async () => 'invalid to' },
  ];
  const r = fakeFetch((n) => { if (n === 4) throw new Error('ECONNRESET'); return replies[n - 1]; });
  const c = fakeClient(rows);
  const out = await runOutbox(c, CFG(r.f));
  const cs = completes(c);
  ok(cs[0].p_retryable === true && cs[0].p_error.startsWith('resend 429'), '429 → retryable');
  ok(cs[1].p_retryable === true, '5xx → retryable');
  ok(cs[2].p_retryable === false && cs[2].p_error.includes('invalid to'), '422 → permanent');
  ok(cs[3].p_retryable === true && cs[3].p_error.startsWith('network: ECONNRESET'), 'network error → retryable');
  ok(out.retry === 3 && out.failed === 1 && out.sent === 0, 'counts: 3 retry, 1 failed');
}

// ── 4. Render failures never reach Resend ───────────────────────────────────
{
  const c = fakeClient([ROW({ id: 'x', template_key: 'nope' }), ROW({ id: 'y', payload: { token: 'short' } })]);
  const r = fakeFetch();
  const out = await runOutbox(c, CFG(r.f));
  ok(r.calls.length === 0, 'unknown template / bad token → no send');
  const cs = completes(c);
  ok(cs.every((x) => x.p_ok === false && x.p_retryable === false), 'render failures are permanent');
  ok(cs[0].p_error.includes('unknown template') && cs[1].p_error.includes('no token'), 'render error recorded');
  ok(out.failed === 2, 'both failed');
}

// ── 5. Claim error / thrown claim → error, no send ──────────────────────────
{
  const c = fakeClient([], { claimError: 'boom' });
  const out = await runOutbox(c, CFG(fakeFetch().f));
  ok(out.status === 'error' && out.error === 'claim: boom', 'claim error surfaced');
  const thrower = { rpc: async () => { throw new Error('down'); } };
  const out2 = await runOutbox(thrower, CFG(fakeFetch().f));
  ok(out2.status === 'error' && out2.error === 'claim: down', 'thrown claim never escapes');
}

// ── 6. Templates ────────────────────────────────────────────────────────────
{
  const en = renderRow(ROW({ locale: 'en' }), { appUrl: '' });
  ok(en.subject === 'Verify your email — SahakarLekha' && !/[ऀ-ॿ]/.test(en.text), 'locale en → English only');
  ok(en.html.includes(`https://sahakarlekha.com/verify-email?token=${TOKEN}`), 'default app URL');
  ok(Object.keys(TEMPLATES).sort().join() === 'compliance_due,email_verify,fy_unlock_requested,fy_unlocked,role_changed,user_invite,weekly_digest', 'template set (slices 1–2, 4, 5)');
  let threw = false; try { renderRow(ROW({ payload: {} })); } catch { threw = true; }
  ok(threw, 'missing token throws');
}

// ── 6b. Slice 2 templates (migration 143 payloads) ──────────────────────────
{
  const soc = 'किसान <PACS>';
  const inv = renderRow(ROW({ template_key: 'user_invite', payload: { token: TOKEN, name: 'Sita', role: 'accountant', society_name: soc, by: 'admin@x.in' } }), { appUrl: 'https://app.example' });
  ok(inv.html.includes(`https://app.example/verify-email?token=${TOKEN}`) && inv.text.includes(`/verify-email?token=${TOKEN}`), 'invite with token → verify link');
  ok(inv.html.includes('लेखाकार (accountant)') && inv.html.includes('किसान &lt;PACS&gt;') && !inv.html.includes('<PACS>'), 'invite: Hindi role label, society escaped');
  ok(inv.subject.startsWith('किसान <PACS> — सहकार लेखा में आपका स्वागत है'), 'invite subject names the society');
  const inv2 = renderRow(ROW({ template_key: 'user_invite', payload: { name: 'Sita', role: 'storeKeeper', society_name: 'S', by: 'system' } }), { appUrl: 'https://app.example' });
  ok(inv2.html.includes('https://app.example/login') && !inv2.html.includes('verify-email'), 'invite to a verified address → login link, no token');
  let bad = false; try { renderRow(ROW({ template_key: 'user_invite', payload: { token: 'zz' } })); } catch { bad = true; }
  ok(bad, 'invite with a malformed token throws');

  const rc = renderRow(ROW({ template_key: 'role_changed', payload: { name: 'Sita', old_role: 'viewer', new_role: 'admin', society_name: 'S', by: 'a@x.in' } }), {});
  ok(rc.html.includes('व्यूअर (viewer)') && rc.html.includes('एडमिन (admin)') && rc.html.includes('a@x.in'), 'role change: old → new + actor');
  ok(rc.text.includes('If you did not expect this change'), 'role change carries the security footnote');
  const rcEn = renderRow(ROW({ template_key: 'role_changed', locale: 'en', payload: { old_role: 'viewer', new_role: 'mystery', society_name: 'S', by: 'b' } }), {});
  ok(rcEn.subject === 'Your role was changed — SahakarLekha' && rcEn.html.includes('from viewer to mystery') && !/[ऀ-ॿ]/.test(rcEn.text), 'role change en: raw roles, no Hindi');

  const req = renderRow(ROW({ template_key: 'fy_unlock_requested', payload: { name: 'B', society_name: 'S', by: 'a@x.in', financial_year: '2025-26' } }), { appUrl: 'https://app.example' });
  ok(req.html.includes('(2025-26)') && req.html.includes('https://app.example/society-setup') && req.subject.includes('मंज़ूरी'), 'unlock request: FY, approve link');
  const unl = renderRow(ROW({ template_key: 'fy_unlocked', payload: { society_name: 'S', by: 'system' } }), {});
  ok(unl.html.includes('अनलॉक करने वाले: system') && !unl.html.includes('()'), 'unlocked: actor, no empty FY brackets');
  ok([inv, rc, req, unl].every((m) => !/undefined|null/.test(m.text)), 'no "undefined"/"null" leaks into any text');
}

// ── 7. Static guards: migration 142 ─────────────────────────────────────────
{
  const m = read('supabase/migrations/142_notification_outbox.sql');
  const sqlOnly = m.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  ok(!/create policy/i.test(sqlOnly), 'no client policies on outbox / suppression / verifications');
  ok((sqlOnly.match(/enable row level security/g) ?? []).length === 3, 'RLS on all three tables');
  for (const fn of ['enqueue_notification', 'claim_outbox', 'complete_outbox']) {
    ok(new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`).test(sqlOnly)
      && new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`).test(sqlOnly), `${fn} is service-role only`);
  }
  ok(/grant execute on function public\.request_email_verification\(text\) to authenticated;/.test(sqlOnly), 'request: authenticated only');
  ok(/grant execute on function public\.confirm_email_verification\(text\) to anon, authenticated;/.test(sqlOnly), 'confirm: anon + authenticated');
  ok(/template_key <> 'email_verify'/.test(sqlOnly) && /verified_at is not null/.test(sqlOnly), 'claim skips unverified recipients except email_verify');
  ok(/from public\.email_suppression s/.test(sqlOnly), 'claim checks the suppression list');
  ok(/for update skip locked/.test(sqlOnly) && /interval '5 minutes'/.test(sqlOnly), 'lease claim with skip locked');
  ok(/payload = payload - 'token'/.test(sqlOnly), 'token stripped from payload once sent');
  ok(/auth\.jwt\(\) ->> 'email'/.test(sqlOnly) && !/p_recipient/.test(sqlOnly.split('request_email_verification')[1] ?? ''), 'verification recipient comes from the JWT');
  ok(/encode\(digest\(v_token, 'sha256'\), 'hex'\)/.test(sqlOnly) && /interval '48 hours'/.test(sqlOnly), 'token stored hashed, 48 h expiry');
  ok(/insert into public\.app_migrations \(version, name\) values \('142', 'notification_outbox'\)/.test(sqlOnly), 'migration registered');
  const down = read('supabase/migrations/142_notification_outbox_down.sql');
  ok(/drop table if exists public\.notification_outbox/.test(down) && /delete from public\.app_migrations where version = '142'/.test(down), 'down file undoes it');
}

// ── 7b. Static guards: migration 143 (triggers) ─────────────────────────────
{
  const m = read('supabase/migrations/143_notification_triggers.sql');
  const sqlOnly = m.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  ok(/template_key not in \('email_verify', 'user_invite'\)/.test(sqlOnly), 'claim exempts only email_verify + user_invite from the verified gate');
  ok(/after insert on public\.society_users/.test(sqlOnly) && /after update of role on public\.society_users/.test(sqlOnly), 'user triggers: insert + role update');
  ok(/after update on public\.society_settings/.test(sqlOnly), 'FY trigger on society_settings');
  ok((sqlOnly.match(/exception when others then\s+raise warning/g) ?? []).length === 2, 'both trigger bodies swallow errors (a save never fails on a notification)');
  ok(!/net\.http_post|http_request/.test(sqlOnly), 'triggers never call HTTP');
  ok(/lower\(su\.email\) <> lower\(new\."fyUnlockRequestedBy"\)/.test(sqlOnly), 'requester is not told about their own unlock request');
  ok(/su\.role = 'admin' and su\.is_active/.test(sqlOnly), 'FY notices go to active admins only');
  ok(/insert into public\.app_migrations \(version, name\) values \('143', 'notification_triggers'\)/.test(sqlOnly), 'migration 143 registered');
  const down = read('supabase/migrations/143_notification_triggers_down.sql');
  ok(/drop trigger if exists trg_notify_fy_unlock/.test(down) && /template_key <> 'email_verify'/.test(down), 'down drops triggers and restores the 142 claim');
}

// ── 7c. Resend webhook core (slice 3) ───────────────────────────────────────
{
  const secret = 'whsec_' + Buffer.from('a-test-signing-key-32-bytes-long!').toString('base64');
  const body = JSON.stringify({ type: 'email.bounced', data: { email_id: 'em_1', to: ['Bad@Example.com'], bounce: { type: 'Permanent', subType: 'General', message: 'no such user' } } });
  const now = 1_800_000_000;
  const sig = await signSvix(secret, 'msg_1', String(now), body);
  ok((await verifySvix(secret, { id: 'msg_1', timestamp: String(now), signature: sig }, body, now)).ok, 'valid Svix signature accepted');
  ok((await verifySvix(secret, { id: 'msg_1', timestamp: String(now), signature: `v1,bogus ${sig}` }, body, now)).ok, 'any one valid v1 signature in the list is enough');
  ok((await verifySvix(secret, { id: 'msg_1', timestamp: String(now), signature: sig }, body + ' ', now)).reason === 'bad_signature', 'changed body → bad_signature');
  ok((await verifySvix(secret, { id: 'msg_2', timestamp: String(now), signature: sig }, body, now)).reason === 'bad_signature', 'other svix-id → bad_signature');
  ok((await verifySvix(secret, { id: 'msg_1', timestamp: String(now), signature: sig }, body, now + 301)).reason === 'stale_timestamp', 'older than 5 min → stale_timestamp');
  ok((await verifySvix(secret, { id: 'msg_1', timestamp: String(now) }, body, now)).reason === 'missing_headers', 'missing signature header');
  ok((await verifySvix('', { id: 'msg_1', timestamp: String(now), signature: sig }, body, now)).reason === 'secret_not_configured', 'no secret → refused');
  ok((await verifySvix(secret, { id: 'msg_1', timestamp: String(now), signature: sig.replace('v1,', 'v2,') }, body, now)).reason === 'bad_signature', 'only v1 signatures count');

  const calls = [];
  const supa = { rpc: async (n, a) => { calls.push({ n, a }); return { data: { status: 'recorded', matched: 1, suppressed: 1 }, error: null }; } };
  const out = await handleResendEvent(supa, JSON.parse(body));
  ok(out.status === 'recorded' && out.suppressed === 1, 'bounce recorded');
  ok(calls[0].n === 'record_email_event' && calls[0].a.p_provider_id === 'em_1' && calls[0].a.p_type === 'email.bounced', 'record_email_event(provider id, type)');
  ok(calls[0].a.p_recipients[0] === 'Bad@Example.com' && calls[0].a.p_detail === 'Permanent · General · no such user', 'recipients + bounce detail passed');
  ok((await handleResendEvent(supa, { type: 'email.opened', data: {} })).status === 'ignored' && calls.length === 1, 'opens/clicks ignored (no tracking stored)');
  await handleResendEvent(supa, { type: 'email.complained', data: { email_id: 'em_2', to: 'x@y.in' } });
  ok(calls[1].a.p_detail === 'spam complaint' && calls[1].a.p_recipients[0] === 'x@y.in', 'complaint: string to → array');
  const bad = await handleResendEvent({ rpc: async () => ({ data: null, error: { message: 'db down' } }) }, { type: 'email.delivered', data: { email_id: 'e' } });
  ok(bad.status === 'error' && bad.error === 'db down', 'db error surfaced (function answers 500 → Resend retries)');
}

// ── 7d. Static guards: migration 144 + webhook function ─────────────────────
{
  const m = read('supabase/migrations/144_email_events_and_log.sql');
  const sqlOnly = m.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  ok(/revoke execute on function public\.record_email_event\(text, text, text\[\], text\) from public, anon, authenticated;/.test(sqlOnly)
    && /grant execute on function public\.record_email_event\(text, text, text\[\], text\) to service_role;/.test(sqlOnly), 'record_email_event is service-role only');
  ok((sqlOnly.match(/if not public\.is_platform_admin\(\) then/g) ?? []).length === 3, 'three admin RPCs gated on is_platform_admin');
  ok(/not public\.is_society_admin\(v_society\)/.test(sqlOnly) && /where o\.society_id = v_society/.test(sqlOnly), 'society log: admin of, and only, the caller society');
  ok(!/o\.payload/.test(sqlOnly), 'no log RPC returns the payload (tokens)');
  ok(/case when v_status = 'bounced' then 'bounce' else 'complaint' end/.test(sqlOnly), 'bounce/complaint → suppression');
  ok(/insert into public\.app_migrations \(version, name\) values \('144', 'email_events_and_log'\)/.test(sqlOnly), 'migration 144 registered');
  const w = read('supabase/functions/resend-webhook/index.ts');
  ok(/await req\.text\(\)/.test(w) && w.indexOf('verifySvix(') < w.indexOf('JSON.parse(raw)'), 'webhook verifies the RAW body before parsing');
  ok(/RESEND_WEBHOOK_SECRET/.test(w) && /--no-verify-jwt/.test(w), 'webhook secret + deploy note');
  const app = read('src/App.tsx');
  ok(/path="\/super-admin\/emails" element=\{<SuperAdminRoute>/.test(app), '/super-admin/emails behind SuperAdminRoute');
  ok(read('src/pages/UserManagement.tsx').includes("currentUser?.role === 'admin' && <SocietyEmailLog"), 'society email log only for admins');
}

// ── 7e. Digest opt-out + unsubscribe (migration 147) ────────────────────────
{
  const UT = 'b'.repeat(48);
  const P = { name: 'A', society_name: 'S', week: '2026-W45', period_from: '2026-10-26', period_to: '2026-11-01',
    pending_approval: 1, vouchers_week: 2, days_since_last: 0, compliance_due: 0, unverified_users: 0 };
  const dg = (payload, locale = 'hi') => ({ id: 'd1', template_key: 'weekly_digest', locale, recipient: 'a@x.in', payload, idempotency_key: 'wd:1' });
  const m = renderRow(dg({ ...P, unsubscribe_token: UT }), { appUrl: 'https://app.example/' });
  const link = `https://app.example/email-unsubscribe?t=${UT}`;
  ok(m.html.includes(link) && m.text.includes(link), 'digest carries the unsubscribe link (html + text)');
  ok(m.html.includes('हफ़्ते की रिपोर्ट बंद करें') && m.headers?.['List-Unsubscribe'] === `<${link}>`, 'Hindi label + List-Unsubscribe header');
  const old = renderRow(dg(P), { appUrl: 'https://app.example' });
  ok(!old.html.includes('email-unsubscribe') && !old.headers, 'a row queued before 147 (no token) renders without a link, never a broken one');
  let bad = false; try { renderRow(dg({ ...P, unsubscribe_token: 'xyz' })); } catch { bad = true; }
  ok(bad, 'malformed unsubscribe token → render fails');
  ok(!renderRow(ROW()).headers, 'other templates send no List-Unsubscribe header');

  const c = fakeClient([{ ...dg({ ...P, unsubscribe_token: UT }), status: 'sending', attempts: 1 }]);
  const r = fakeFetch();
  await runOutbox(c, CFG(r.f));
  ok(r.calls[0].body.headers?.['List-Unsubscribe'] === `<https://app.example/email-unsubscribe?t=${UT}>`, 'worker passes the header to Resend');
  const c2 = fakeClient([ROW({ status: 'sending' })]);
  const r2 = fakeFetch();
  await runOutbox(c2, CFG(r2.f));
  ok(!('headers' in r2.calls[0].body), 'no headers key when the template has none');

  const sql = read('supabase/migrations/147_email_preferences.sql');
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  ok(!/create policy/i.test(code) && /alter table public\.email_preferences enable row level security/.test(code), 'email_preferences: RLS on, no client policy');
  ok(/and not exists \(select 1 from public\.email_preferences ep\s+where ep\.email = lower\(su\.email\) and not ep\.weekly_digest\)/.test(code), 'digest skips admins who opted out');
  ok(/'unsubscribe_token', public\.email_unsubscribe_token\(v_admin\.email\)/.test(code), 'digest payload carries the token');
  ok(/'weekly_digest:' \|\| p_society_id \|\| ':' \|\| v_admin\.email \|\| ':' \|\| v_week/.test(code), 'idempotency key unchanged from 146');
  ok(/revoke execute on function public\.email_unsubscribe_token\(text\) from public, anon, authenticated;/.test(code)
    && !/grant execute on function public\.email_unsubscribe_token/.test(code), 'token helper is internal');
  ok(/grant execute on function public\.enqueue_weekly_digest\(text, date, integer\) to service_role;/.test(code), 'enqueue stays service-role');
  ok(/grant execute on function public\.unsubscribe_by_token\(text\) to anon, authenticated;/.test(code)
    && /anon-exec: unsubscribe_by_token/.test(sql), 'unsubscribe_by_token: anon, with the anon-exec reason');
  ok(/set weekly_digest = false/.test(code) && !/set weekly_digest = true/.test(code.split('unsubscribe_by_token')[1].split('my_email_preferences')[0]),
    'the token can only turn the digest OFF');
  ok(/v_email text := lower\(trim\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)\)/.test(code.split('set_my_weekly_digest')[1] ?? ''), 'set_my_weekly_digest: own JWT address only');
  ok(/values \('147', 'email_preferences'\)/.test(code), 'migration 147 registered');
  const down = read('supabase/migrations/147_email_preferences_down.sql');
  ok(/drop table if exists public\.email_preferences/.test(down) && down.includes('create or replace function public.enqueue_weekly_digest')
    && !down.includes('email_preferences ep'), 'down restores 146 enqueue (no opt-out) and drops the table');

  ok(/path="\/email-unsubscribe" element=\{<EmailUnsubscribe \/>\}/.test(read('src/App.tsx')), '/email-unsubscribe is a public route');
  const page = read('src/pages/EmailUnsubscribe.tsx');
  ok(page.includes("rpc('unsubscribe_by_token'") && !/useEffect/.test(page), 'unsubscribe needs a button press — nothing runs on page load (mail scanners)');
  const banner = read('src/components/EmailVerifyBanner.tsx');
  ok(banner.includes("rpc('my_email_verification')") && /try \{ return Number\(localStorage/.test(banner) && /catch \{ \/\* per-session only \*\/ \}/.test(banner), 'banner: server status, storage wrapped in try/catch');
  ok(read('src/components/layout/MainLayout.tsx').includes('<EmailVerifyBanner />'), 'banner mounted in MainLayout');
  ok(/if \(!user\?\.societyId \|\| isSuperAdmin \|\| snoozed\(\)\)/.test(banner), 'banner hidden for a platform admin viewing a society (nothing to verify)');
  ok(/\{!verified && !isSuperAdmin && \(/.test(read('src/components/security/EmailVerifyDialog.tsx')), 'dialog: no "send link" button for a platform admin');
  const dlg = read('src/components/security/EmailVerifyDialog.tsx');
  ok(dlg.includes("rpc('set_my_weekly_digest'") && dlg.includes("user?.role !== 'admin' ? null"), 'dialog: digest switch for admins only');
}

// ── 7f. Email health + language preference (migration 148) ──────────────────
{
  const { runHealthCheck, buildHealthEmail, healthProblems } = await import('../supabase/functions/_shared/email-health.mjs');
  const H = { level: 'alert', stalled: 2, stuck: 0, failed_24h: 1, bounced_24h: 0, complained_24h: 0,
    http_errors_6h: 3, http_last_error: '401 {"ok":false,"error":"unauthorized"}', cron_failed_24h: 0, missing_jobs: ['weekly-digest-monday'] };
  const lines = healthProblems(H);
  ok(lines.length === 4 && lines[0].includes('2 ईमेल') && lines.some((l) => l.includes('unauthorized')) && lines.some((l) => l.includes('weekly-digest-monday')), 'problems: stalled, http (with last error), missing job, failed');
  ok(healthProblems({ level: 'ok' }).length === 0, 'healthy → no lines');
  const m = buildHealthEmail('alert', H, { appUrl: 'https://app.example/' });
  ok(m.subject.startsWith('ALERT') && m.html.includes('https://app.example/super-admin/emails') && m.text.includes('2 ईमेल'), 'alert email: subject, link, problems');
  ok(m.html.includes('&quot;ok&quot;') && !m.html.includes('{"ok"'), 'error text escaped in html');
  ok(buildHealthEmail('recovered', {}, {}).subject.startsWith('ठीक हो गया'), 'recovery email');

  const client = (data, error = null) => { const calls = []; return { calls, rpc: async (n) => { calls.push(n); return { data, error }; } }; };
  const send = fakeFetch();
  const cfg = { apiKey: 're_t', from: 'SahakarLekha <noreply@x.in>', appUrl: 'https://app.example', fetch: send.f };
  const none = await runHealthCheck(client({ action: 'none', health: { level: 'ok' }, recipients: ['a@x.in'] }), cfg);
  ok(none.status === 'ok' && none.sent === 0 && send.calls.length === 0, 'action none → nothing sent');
  const alert = await runHealthCheck(client({ action: 'alert', health: H, recipients: ['a@x.in', 'bad', 'b@x.in'] }), cfg);
  ok(alert.status === 'ok' && alert.sent === 2 && send.calls.length === 1, 'alert → one Resend call');
  ok(send.calls[0].url === 'https://api.resend.com/emails' && send.calls[0].body.to.join() === 'a@x.in,b@x.in', 'sent straight to Resend (not the outbox), invalid recipient dropped');
  ok((await runHealthCheck(client({ action: 'alert', health: H, recipients: [] }), cfg)).status === 'no_recipient', 'no platform admin → no_recipient');
  ok((await runHealthCheck(client({ action: 'alert', health: H, recipients: ['a@x.in'] }), { fetch: send.f })).status === 'not_configured', 'no key → not_configured');
  ok((await runHealthCheck(client(null, { message: 'boom' }), cfg)).error === 'claim: boom', 'claim error surfaced');
  const bad = await runHealthCheck(client({ action: 'alert', health: H, recipients: ['a@x.in'] }),
    { ...cfg, fetch: async () => ({ ok: false, status: 422, text: async () => 'bad from' }) });
  ok(bad.status === 'error' && bad.error.startsWith('resend 422'), 'Resend error surfaced, no throw');

  const sql = read('supabase/migrations/148_email_health_and_locale.sql');
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  ok(/select ep\.locale into v_locale from public\.email_preferences ep where ep\.email = v_to;\s+v_locale := coalesce\(v_locale, p_locale, 'hi'\);/.test(code), 'enqueue: recipient choice → caller → Hindi');
  ok(/grant execute on function public\.enqueue_notification\(text, text, text, jsonb, text, text, timestamptz\) to service_role;/.test(code)
    && /revoke execute on function public\.enqueue_notification\(text, text, text, jsonb, text, text, timestamptz\) from public, anon, authenticated;/.test(code), 'enqueue stays service-role only');
  ok(/locale text check \(locale in \('hi', 'en'\)\)/.test(code) && !/locale text not null/.test(code), 'locale nullable = not chosen');
  ok(/p_locale not in \('hi', 'en'\)/.test(code) && /lower\(trim\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)\)/.test(code.split('set_my_email_locale')[1] ?? ''), 'set_my_email_locale: own address, hi/en only');
  ok(/revoke execute on function public\.email_health\(\) from public, anon, authenticated;/.test(code) && !/grant execute on function public\.email_health\(\)/.test(code), 'email_health is internal');
  ok(/grant execute on function public\.claim_email_health_alert\(\) to service_role;/.test(code), 'claim: service role');
  ok(/if not public\.is_platform_admin\(\) then/.test(code.split('admin_email_health')[1] ?? ''), 'admin_email_health gated on platform admin');
  ok(/from net\._http_response/.test(code) && /exception when others then\s+v_http := null/.test(code), 'pg_net read is guarded (null, never an error)');
  ok(/'outbox-send-worker', 'compliance-reminders-daily', 'weekly-digest-monday'/.test(code), 'expected email cron jobs listed');
  ok(/v_open\.sent_at < now\(\) - interval '6 hours'/.test(code) && /v_action := 'recovered'/.test(code), 'alert at most every 6 h; recovery once');
  ok(/from public\.platform_admins where is_active/.test(code), 'recipients = active platform admins');
  ok(!/create policy/i.test(code) && /alter table public\.email_health_alerts enable row level security/.test(code), 'alerts table: RLS on, no policy');
  ok(/values \('148', 'email_health_and_locale'\)/.test(code), 'migration 148 registered');
  const down = read('supabase/migrations/148_email_health_and_locale_down.sql');
  ok(/drop table if exists public\.email_health_alerts/.test(down) && /coalesce\(p_locale, 'hi'\)/.test(down) && /drop column if exists locale/.test(down), 'down restores 142 enqueue + 147 prefs, drops health');

  const fn = read('supabase/functions/email-health/index.ts');
  ok(/if \(!secret\) return json\(\{ ok: false, error: 'OUTBOX_CRON_SECRET not configured' \}, 500\)/.test(fn) && /x-outbox-secret/.test(fn) && /--no-verify-jwt/.test(fn), 'email-health: fail-closed secret, deploy note');
  ok(!/runOutbox|enqueue_notification/.test(read('supabase/functions/_shared/email-health.mjs')), 'alert path never touches the outbox');
  ok(/replace\(\(select command from cron\.job where jobname = 'outbox-send-worker'\), '\/send-worker', '\/email-health'\)/.test(read('supabase/functions/email-health/README.md')), 'README cron copies the secret from send-worker (no pasting)');
  const page = read('src/pages/SuperAdminEmails.tsx');
  ok(page.includes("rpc('admin_email_health')") && page.includes('सिस्टम की सेहत'), 'SuperAdmin health card');
  const dlg2 = read('src/components/security/EmailVerifyDialog.tsx');
  ok(dlg2.includes("rpc('set_my_email_locale'") && dlg2.includes("!('locale' in p)"), 'dialog: language choice, hidden before 148');
}

// ── 8. Static guards: worker + UI ───────────────────────────────────────────
{
  const w = read('supabase/functions/send-worker/index.ts');
  ok(/if \(!secret\) return json\(\{ ok: false, error: 'OUTBOX_CRON_SECRET not configured' \}, 500\)/.test(w), 'worker fails closed without a secret');
  ok(/req\.headers\.get\('x-outbox-secret'\) !== secret/.test(w), 'worker checks x-outbox-secret');
  ok(/runOutbox\(/.test(w) && /--no-verify-jwt/.test(w), 'worker uses the shared core; deploy note present');
  const readme = read('supabase/functions/send-worker/README.md');
  ok(readme.includes('--no-verify-jwt') && readme.includes("'outbox-send-worker'"), 'README has deploy flag + cron job');
  const app = read('src/App.tsx');
  ok(/path="\/verify-email" element=\{<VerifyEmail \/>\}/.test(app), '/verify-email is a public route');
  const page = read('src/pages/VerifyEmail.tsx');
  ok(page.includes("rpc('confirm_email_verification'") && page.includes('ran.current'), 'page confirms the token once');
  const dlg = read('src/components/security/EmailVerifyDialog.tsx');
  ok(dlg.includes("rpc('request_email_verification'") && !/p_email|p_recipient/.test(dlg), 'dialog never sends an address');
  ok(read('src/components/layout/Header.tsx').includes('<EmailVerifyDialog'), 'dialog is reachable from the user menu');
}

console.log(`email-outbox: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
