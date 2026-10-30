// The notification outbox worker (supabase/functions/_shared/email-outbox.mjs, email slice 1) driven with a FAKE
// service-role client and a FAKE Resend, plus static guards on migration 142, the send-worker function and the UI.
// Run: node scripts/test-email-outbox.mjs   (npm run test:email-outbox)
import { readFileSync } from 'node:fs';
import { runOutbox, renderRow, TEMPLATES } from '../supabase/functions/_shared/email-outbox.mjs';

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
  ok(b.subject.startsWith('अपना ईमेल सत्यापित करें'), 'Hindi-first subject');
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
  ok(Object.keys(TEMPLATES).join() === 'email_verify', 'slice 1 ships exactly one template');
  let threw = false; try { renderRow(ROW({ payload: {} })); } catch { threw = true; }
  ok(threw, 'missing token throws');
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
