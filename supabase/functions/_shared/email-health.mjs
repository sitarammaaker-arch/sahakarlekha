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
  if (n('stalled') > 0) out.push(`${n('stalled')} ईमेल 15 मिनट से ज़्यादा से कतार में रुके हैं — send-worker नहीं चल रहा।`);
  if (n('stuck') > 0) out.push(`${n('stuck')} ईमेल "भेजा जा रहा है" में अटके हैं।`);
  if (n('http_errors_6h') > 0) out.push(`पिछले 6 घंटे में cron की ${n('http_errors_6h')} HTTP call fail हुई (आख़िरी: ${h.http_last_error ?? '-'})। अक्सर वजह: secret ग़लत या function deploy नहीं।`);
  if (n('cron_failed_24h') > 0) out.push(`पिछले 24 घंटे में ${n('cron_failed_24h')} cron run fail हुए।`);
  if (Array.isArray(h?.missing_jobs) && h.missing_jobs.length) out.push(`ये cron job बंद या ग़ायब हैं: ${h.missing_jobs.join(', ')}।`);
  if (n('complained_24h') > 0) out.push(`पिछले 24 घंटे में ${n('complained_24h')} spam शिकायत आई।`);
  if (n('failed_24h') > 0) out.push(`पिछले 24 घंटे में ${n('failed_24h')} ईमेल fail हुए।`);
  if (n('bounced_24h') > 0) out.push(`पिछले 24 घंटे में ${n('bounced_24h')} ईमेल bounce हुए।`);
  return out;
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
  const subject = 'ALERT: सहकार लेखा ईमेल सिस्टम में गड़बड़ / Email system problem';
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
 * @param {{ apiKey?: string, from?: string, appUrl?: string, fetch?: typeof fetch }} cfg
 * @returns {Promise<{ status: string, action?: string, level?: string, sent?: number, error?: string }>}
 */
export async function runHealthCheck(supa, cfg = {}) {
  let claim;
  try {
    const { data, error } = await supa.rpc('claim_email_health_alert');
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
