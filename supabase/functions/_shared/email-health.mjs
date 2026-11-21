/**
 * Email health alert core (migration 148). Plain JS with an injectable fetch and client, tested by
 * scripts/test-email-outbox.mjs.
 *
 * One run = claim_email_health_alert() decides (alert | recovered | none) and names the active platform admins;
 * on alert/recovered this sends ONE email straight through Resend — deliberately NOT through the outbox, because
 * the outbox is the thing being watched. Never throws.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Plain-Hindi lines for every non-zero problem in an email_health() result. */
export function healthProblems(h) {
  const out = [];
  const n = (k) => Number(h?.[k] ?? 0);
  if (n('stalled') > 0) out.push(`${n('stalled')} ईमेल 15 मिनट से ज़्यादा से भेजे जाने के इंतज़ार में रुके हैं — send-worker नहीं चल रहा।`);
  if (n('stuck') > 0) out.push(`${n('stuck')} ईमेल "भेजा जा रहा है" में अटके हैं।`);
  if (n('http_errors_6h') > 0) out.push(`पिछले 6 घंटे में cron की ${n('http_errors_6h')} HTTP call fail हुई (आख़िरी: ${h.http_last_error ?? '-'})। अक्सर वजह: secret ग़लत या function deploy नहीं।`);
  if (n('cron_failed_24h') > 0) out.push(`पिछले 24 घंटे में ${n('cron_failed_24h')} cron run fail हुए।`);
  if (Array.isArray(h?.missing_jobs) && h.missing_jobs.length) out.push(`ये cron job बंद या ग़ायब हैं: ${h.missing_jobs.join(', ')}।`);
  if (n('complained_24h') > 0) out.push(`पिछले 24 घंटे में ${n('complained_24h')} spam शिकायत आई।`);
  if (n('failed_24h') > 0) out.push(`पिछले 24 घंटे में ${n('failed_24h')} ईमेल fail हुए।`);
  if (n('bounced_24h') > 0) out.push(`पिछले 24 घंटे में ${n('bounced_24h')} ईमेल bounce हुए।`);
  out.push(...appProblems(h));
  return out;
}

/** 192 · OPS-03 — the lines for the site probe, app errors and backup staleness (empty when all is well). */
export function appProblems(h) {
  const out = [];
  const n = (k) => Number(h?.[k] ?? 0);
  if (h?.site && h.site.ok === false) out.push(`🔴 वेबसाइट नहीं खुल रही: ${h.site.url ?? ''} → ${h.site.status ?? h.site.error ?? 'कोई जवाब नहीं'}। सदस्य/स्टाफ़ login नहीं कर पा रहे होंगे।`);
  const mm = Array.isArray(h?.site?.missing_migrations) ? h.site.missing_migrations : [];
  if (mm.length) out.push(`🟠 नया code live है पर ये migration production में अभी नहीं चलीं: ${mm.join(', ')} — Supabase SQL Editor में supabase/migrations/ की वही file चलाएँ।`);
  if (n('integrity_errors_6h') > 0) {
    const top = Array.isArray(h.integrity_top) ? h.integrity_top.map((t) => `${t.source} ×${t.n}${t.sample ? ` ("${String(t.sample).slice(0, 80)}")` : ''}`).join('; ') : '';
    out.push(`पिछले 6 घंटे में ${n('integrity_errors_6h')} सेव/पोस्टिंग/सर्वर error दर्ज हुए${top ? ` — ${top}` : ''}।`);
  }
  if (n('backup_stale_24h') > 0) out.push(`पिछले 24 घंटे में ${n('backup_stale_24h')} बार किसी समिति का backup पुराना पाया गया (backup-stale)।`);
  if (n('app_spike_1h') >= 50) out.push(`पिछले 1 घंटे में browser पर ${n('app_spike_1h')} error आए (सामान्य से बहुत ज़्यादा) — किसी deploy के बाद कोई page टूट रहा हो सकता है।`);
  return out;
}

/**
 * 192 · OPS-03 — is the live site answering? A browser-style navigation to "/" and "/login" (the Cloudflare Worker
 * serves the SPA shell for /login only to a navigation — wrangler.jsonc). ok = both 200. Never throws.
 */
export async function probeSite(appUrl, fetchFn = fetch, timeoutMs = 10000) {
  const base = String(appUrl || 'https://sahakarlekha.com').replace(/\/+$/, '');
  for (const path of ['/', '/login']) {
    const url = base + path;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetchFn(url, { method: 'GET', redirect: 'manual', signal: ctrl?.signal, headers: { 'Sec-Fetch-Mode': 'navigate', Accept: 'text/html', 'User-Agent': 'sahakarlekha-health/1' } });
      if (res.status !== 200) return { ok: false, status: res.status, url };
    } catch (e) {
      return { ok: false, status: null, url, error: (e instanceof Error ? e.message : String(e)).slice(0, 120) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return { ok: true, status: 200, url: base + '/' };
}

/**
 * 194 · OPS-02 — migrations the LIVE build expects but production has not run. Reads the build's /migrations.json
 * (scripts/migration-manifest.mjs) and public.app_migrations. Only reported once the build is older than
 * `graceMs` (default 2 h), so the founder has time to run a new migration after merging. Never throws: an unreadable
 * manifest or table → [] (no alert), because a guess would be worse than silence here.
 */
export async function pendingMigrations(supa, appUrl, fetchFn = fetch, { now = Date.now(), graceMs = 2 * 3600 * 1000 } = {}) {
  try {
    const base = String(appUrl || 'https://sahakarlekha.com').replace(/\/+$/, '');
    const res = await fetchFn(`${base}/migrations.json`, { method: 'GET', headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
    if (!res || res.status !== 200) return [];
    const man = await res.json();
    const expected = Array.isArray(man?.expected) ? man.expected.map(String) : [];
    const builtAt = Date.parse(man?.builtAt ?? '');
    if (!expected.length || !Number.isFinite(builtAt) || now - builtAt < graceMs) return [];
    const { data, error } = await supa.from('app_migrations').select('version');
    if (error || !Array.isArray(data)) return [];
    const have = new Set(data.map((r) => String(r.version)));
    return expected.filter((v) => !have.has(v));
  } catch {
    return [];
  }
}

/** Subject, html, text for the alert / recovery email. */
export function buildHealthEmail(action, h, { appUrl }) {
  const link = `${String(appUrl || 'https://sahakarlekha.com').replace(/\/+$/, '')}/super-admin/emails`;
  if (action === 'recovered') {
    const subject = 'ठीक हो गया: सहकार लेखा ईमेल सिस्टम / Email system recovered';
    const text = ['ईमेल सिस्टम फिर से सामान्य है। / The email system is healthy again.', '', link].join('\n');
    const html = `<div style="font-family:Arial,'Noto Sans Devanagari',sans-serif;line-height:1.6;color:#0f172a;max-width:600px">
    <p>✅ ईमेल सिस्टम फिर से सामान्य है।<br><span style="color:#475569">The email system is healthy again.</span></p>
    <p><a href="${esc(link)}" style="color:#0F7B5A">SuperAdmin → Emails</a></p></div>`;
    return { subject, html, text };
  }
  const problems = healthProblems(h);
  const subject = h?.site && h.site.ok === false ? 'ALERT: सहकार लेखा वेबसाइट बंद है / Website is down'
    : appProblems(h).length ? 'ALERT: सहकार लेखा में error / Platform errors'
    : 'ALERT: सहकार लेखा ईमेल सिस्टम में गड़बड़ / Email system problem';
  const text = ['⚠ ईमेल सिस्टम में गड़बड़ मिली:', '', ...problems.map((p) => `• ${p}`), '', `जाँचें: ${link}`].join('\n');
  const html = `<div style="font-family:Arial,'Noto Sans Devanagari',sans-serif;line-height:1.6;color:#0f172a;max-width:600px">
    <p><b>⚠ ईमेल सिस्टम में गड़बड़ मिली</b><br><span style="color:#475569">The email system needs attention.</span></p>
    <ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    <p><a href="${esc(link)}" style="background:#0F7B5A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">SuperAdmin → Emails खोलें</a></p>
    <p style="color:#475569;font-size:12px">यह अलर्ट outbox से नहीं, सीधे भेजा गया है। गड़बड़ बनी रही तो 6 घंटे बाद फिर आएगा; ठीक होने पर एक "ठीक हो गया" ईमेल आएगा।</p></div>`;
  return { subject, html, text };
}

/**
 * @param {*} supa  SERVICE-ROLE client
 * @param {{ apiKey?: string, from?: string, appUrl?: string, fetch?: typeof fetch, probe?: boolean }} cfg
 *   probe: true (192, set by the email-health function) → check the live site first and pass it to the claim.
 * @returns {Promise<{ status: string, action?: string, level?: string, sent?: number, error?: string, site?: object }>}
 */
export async function runHealthCheck(supa, cfg = {}) {
  let claim;
  const site = cfg.probe ? await probeSite(cfg.appUrl, cfg.fetch ?? fetch) : null;
  // 194 · OPS-02: migrations the live build needs but production has not run (after a 2 h grace).
  if (site) {
    const missing = await pendingMigrations(supa, cfg.appUrl, cfg.fetch ?? fetch, { now: cfg.now ?? Date.now() });
    if (missing.length) site.missing_migrations = missing;
  }
  try {
    const { data, error } = await (site ? supa.rpc('claim_email_health_alert', { p_site: site }) : supa.rpc('claim_email_health_alert'));
    if (error) return { status: 'error', error: `claim: ${error.message}` };
    claim = data ?? {};
  } catch (e) {
    return { status: 'error', error: `claim: ${e instanceof Error ? e.message : String(e)}` };
  }
  const action = claim.action ?? 'none';
  const level = claim.health?.level;
  if (action === 'none') return { status: 'ok', action, level, sent: 0 };
  const to = (Array.isArray(claim.recipients) ? claim.recipients : []).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).slice(0, 5);
  if (!to.length) return { status: 'no_recipient', action, level, sent: 0 };
  if (!cfg.apiKey || !cfg.from) return { status: 'not_configured', action, level, sent: 0 };

  const msg = buildHealthEmail(action, claim.health ?? {}, { appUrl: cfg.appUrl });
  try {
    const res = await (cfg.fetch ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      return { status: 'error', action, level, sent: 0, error: `resend ${res.status}${detail ? `: ${detail}` : ''}` };
    }
  } catch (e) {
    return { status: 'error', action, level, sent: 0, error: `network: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { status: 'ok', action, level, sent: to.length };
}
