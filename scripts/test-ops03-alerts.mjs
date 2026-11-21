// OPS-03 (product audit 2026-11-17) — platform alerts: the email-health function now also checks the live site, app
// errors and backup staleness, and pg_net timeouts no longer raise false alarms (migration 192).
// Run: node scripts/test-ops03-alerts.mjs   (the SQL was also run on PGlite — scratchpad pg/t192.mjs)
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const E = await import(pathToFileURL(resolve(ROOT, 'supabase/functions/_shared/email-health.mjs')).href);
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── probeSite ──
{
  const seen = [];
  const fetchOk = async (url, init) => { seen.push({ url, mode: init.headers['Sec-Fetch-Mode'] }); return { status: 200 }; };
  const r = await E.probeSite('https://sahakarlekha.com/', fetchOk);
  ok(r.ok === true && seen.map((s) => s.url).join() === 'https://sahakarlekha.com/,https://sahakarlekha.com/login', 'probe: "/" and "/login" both 200 → ok');
  ok(seen.every((s) => s.mode === 'navigate'), 'probe sends a browser-style navigation (the Worker serves /login only to a navigation)');
  const r402 = await E.probeSite('https://sahakarlekha.com', async () => ({ status: 402 }));
  ok(r402.ok === false && r402.status === 402 && r402.url === 'https://sahakarlekha.com/', 'probe: the 2026-11-21 Vercel 402 → not ok, status 402');
  const rLogin = await E.probeSite('https://sahakarlekha.com', async (url) => ({ status: url.endsWith('/login') ? 404 : 200 }));
  ok(rLogin.ok === false && rLogin.status === 404 && rLogin.url.endsWith('/login'), 'probe: home fine but /login 404 → not ok');
  const rNet = await E.probeSite('https://sahakarlekha.com', async () => { throw new Error('getaddrinfo ENOTFOUND'); });
  ok(rNet.ok === false && rNet.status === null && /ENOTFOUND/.test(rNet.error), 'probe: network failure → not ok with the error, never throws');
}

// ── problem lines + subject ──
{
  ok(E.appProblems({}).length === 0 && E.healthProblems({ level: 'ok', http_timeouts_6h: 6 }).length === 0, 'healthy (timeouts only) → no lines: timeouts are not an alert');
  const down = E.appProblems({ site: { ok: false, status: 402, url: 'https://sahakarlekha.com/' } });
  ok(down.length === 1 && down[0].includes('वेबसाइट नहीं खुल रही') && down[0].includes('402'), 'site down → one Hindi line naming the status');
  const integ = E.appProblems({ integrity_errors_6h: 2, integrity_top: [{ source: 'voucher-post-service', n: 2, sample: 'post_voucher:unbalanced' }] });
  ok(integ.length === 1 && integ[0].includes('voucher-post-service ×2') && integ[0].includes('post_voucher:unbalanced'), 'save/posting errors → the source, count and a sample');
  ok(E.appProblems({ backup_stale_24h: 1 })[0].includes('backup'), 'stale backup → a line');
  ok(E.appProblems({ app_spike_1h: 49 }).length === 0 && E.appProblems({ app_spike_1h: 50 }).length === 1, 'browser errors alert only at 50+ in an hour (busiest hour in 7 days was 40)');
  const sub = (h) => E.buildHealthEmail('alert', h, { appUrl: 'https://sahakarlekha.com' }).subject;
  ok(sub({ site: { ok: false, status: 402 } }).includes('Website is down'), 'site down → "वेबसाइट बंद है / Website is down" subject');
  ok(sub({ integrity_errors_6h: 1 }).includes('Platform errors'), 'app errors → "Platform errors" subject');
  ok(sub({ stalled: 3 }).includes('Email system problem'), 'email-only problem keeps the 148 subject');
  const em = E.buildHealthEmail('alert', { site: { ok: false, status: 402, url: '<x>' } }, { appUrl: 'https://sahakarlekha.com' });
  ok(em.html.includes('&lt;x&gt;') && !em.html.includes('<x>'), 'the alert email escapes what it quotes');
}

// ── runHealthCheck passes the probe to the claim ──
{
  const calls = [];
  const supa = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { action: 'alert', health: { level: 'alert', site: args?.p_site }, recipients: ['a@b.co'] }, error: null }; } };
  let sent;
  const fetchFn = async (url, init) => { if (url.startsWith('https://api.resend.com')) { sent = JSON.parse(init.body); return { ok: true, text: async () => '' }; } return { status: 402 }; };
  const r = await E.runHealthCheck(supa, { apiKey: 'k', from: 'f@x', appUrl: 'https://sahakarlekha.com', fetch: fetchFn, probe: true });
  ok(calls.length === 1 && calls[0].name === 'claim_email_health_alert' && calls[0].args?.p_site?.ok === false && calls[0].args.p_site.status === 402, 'probe: true → claim_email_health_alert({ p_site }) with the site result');
  ok(r.status === 'ok' && r.sent === 1 && sent.subject.includes('Website is down') && sent.to[0] === 'a@b.co', 'a down site → one "Website is down" email to the platform admin');
  const calls2 = [];
  await E.runHealthCheck({ rpc: async (name, args) => { calls2.push(args); return { data: { action: 'none' }, error: null }; } }, { fetch: async () => { throw new Error('must not fetch'); } });
  ok(calls2.length === 1 && calls2[0] === undefined, 'without probe (148 behaviour) → no site fetch, claim called with no arguments');
  ok(read('supabase/functions/email-health/index.ts').includes('probe: true,'), 'the deployed email-health function turns the probe on');
}

// ── migration 192 ──
{
  const m = read('supabase/migrations/192_platform_health_alerts.sql');
  ok(m.includes("coalesce(error_msg, '') not ilike 'timeout%'") && m.includes("'http_timeouts_6h', v_http_to"), 'pg_net timeouts are counted apart and are not an HTTP failure (the 6-hourly false alarm)');
  ok(m.includes("c_noise      constant text[] := array['error-boundary', 'window.error', 'chunk-load', 'unhandledrejection'];"), 'browser-noise sources are named once');
  ok(m.includes("or coalesce(v_spike, 0) >= 50 or coalesce(v_integrity, 0) > 0 or coalesce(v_backup, 0) > 0 then 'alert'"), 'alert on a browser spike (50/h), any save/server error in 6 h, any stale backup');
  ok(m.includes('drop function if exists public.claim_email_health_alert();') && m.includes('create or replace function public.claim_email_health_alert(p_site jsonb default null)'), 'claim takes an optional site probe (the old function keeps working — no-arg call)');
  ok(m.includes(`if coalesce((p_site ->> 'ok')::boolean, true) = false then`) && m.includes(`v_h := jsonb_set(v_h, '{level}', '"alert"');`), 'site ok = false forces level alert');
  ok(m.includes('grant execute on function public.claim_email_health_alert(jsonb) to service_role;') && m.includes('revoke execute on function public.claim_email_health_alert(jsonb) from public, anon, authenticated;'), 'claim stays service-role only');
  ok(/values \('192', 'platform_health_alerts'\)/.test(m), '192 registers itself');
  const d = read('supabase/migrations/192_platform_health_alerts_down.sql');
  ok(d.includes('drop function if exists public.claim_email_health_alert(jsonb);') && d.includes('create or replace function public.claim_email_health_alert()') && d.includes("delete from public.app_migrations where version = '192'"), 'down restores the 148 functions');
}

// ── SuperAdmin card ──
{
  const ui = read('src/pages/SuperAdminEmails.tsx');
  ok(ui.includes('integrity_errors_6h?: number | null;') && ui.includes("if ((h.integrity_errors_6h ?? 0) > 0)") && ui.includes("if ((h.backup_stale_24h ?? 0) > 0)") && ui.includes("if ((h.app_spike_1h ?? 0) >= 50)"), 'the SuperAdmin health card shows the new signals');
  ok(ui.includes('(जानकारी)') && ui.includes('not an alert'), 'timeouts show as information, not as a problem');
}

console.log(`OPS-03 alerts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
