/**
 * The notification outbox worker core (email slice 1, migration 142). Plain JS with an injectable fetch and
 * client, so scripts/test-email-outbox.mjs drives it with a fake service-role client and a fake Resend.
 *
 * One run = claim a batch (claim_outbox leases the rows and already marked suppressed / unverified ones), render
 * each row's template, send it through Resend with Idempotency-Key = the row's idempotency_key, and report the
 * result with complete_outbox (which owns retry/backoff/give-up). Never throws.
 *
 * Not configured (no RESEND_API_KEY / RESEND_FROM) → claims NOTHING, so the queue simply waits for the key.
 * Retryable = network error, 429 and 5xx. Any other 4xx (bad address, bad from) is permanent → failed.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const base = (appUrl) => String(appUrl || 'https://sahakarlekha.com').replace(/\/+$/, '');
const shell = (body) => `<div style="font-family:Arial,'Noto Sans Devanagari',sans-serif;line-height:1.6;color:#0f172a;max-width:600px">${body}
    <p style="color:#475569">— टीम सहकार लेखा · <a href="https://sahakarlekha.com" style="color:#0F7B5A">sahakarlekha.com</a></p>
  </div>`;

/**
 * Template registry: key → (row, { appUrl }) → { subject, html, text }. Hindi first with an English line
 * (house style, as the invoice email); locale 'en' drops the Hindi.
 */
export const TEMPLATES = {
  email_verify(row, { appUrl }) {
    const token = String(row.payload?.token ?? '');
    if (!/^[0-9a-f]{48}$/.test(token)) throw new Error('email_verify: payload has no token');
    const link = `${base(appUrl)}/verify-email?token=${token}`;
    const name = row.payload?.name ? String(row.payload.name) : '';
    const en = row.locale === 'en';
    const subject = en ? 'Verify your email — SahakarLekha' : 'अपना ईमेल सत्यापित करें — सहकार लेखा / Verify your email';
    const btn = `<p style="margin:20px 0"><a href="${esc(link)}" style="background:#0F7B5A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">${en ? 'Verify email' : 'ईमेल सत्यापित करें / Verify'}</a></p>`;
    const html = shell(en
      ? `<p>Hello${name ? ` ${esc(name)}` : ''},</p>
    <p>Please confirm that this address is yours. Until it is confirmed, SahakarLekha sends no notifications here.</p>
    ${btn}
    <p style="color:#475569;font-size:12px">The link works for 48 hours. If you did not ask for this, ignore this email.</p>`
      : `<p>नमस्ते${name ? ` ${esc(name)}` : ''},</p>
    <p>कृपया पुष्टि करें कि यह ईमेल आपका है। पुष्टि होने तक सहकार लेखा इस पते पर कोई सूचना नहीं भेजेगा।<br>
      <span style="color:#475569">Please confirm this address is yours. Until then, no notifications are sent here.</span></p>
    ${btn}
    <p style="color:#475569;font-size:12px">लिंक 48 घंटे तक चलेगा। अगर आपने यह नहीं माँगा, तो इस ईमेल को अनदेखा करें।<br>
      The link works for 48 hours. If you did not ask for this, ignore this email.</p>`);
    const text = (en
      ? [`Hello${name ? ` ${name}` : ''},`, '', 'Please confirm this address is yours:', link, '', 'The link works for 48 hours.']
      : [`नमस्ते${name ? ` ${name}` : ''},`, '', 'कृपया पुष्टि करें कि यह ईमेल आपका है:', link, '',
         'लिंक 48 घंटे तक चलेगा। / The link works for 48 hours.']).join('\n');
    return { subject, html, text };
  },
};

/** Render one outbox row. Throws on an unknown template or a bad payload (the caller marks it failed). */
export function renderRow(row, opts = {}) {
  const t = TEMPLATES[row.template_key];
  if (!t) throw new Error(`unknown template: ${row.template_key}`);
  return t(row, opts);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {*} supa  SERVICE-ROLE client
 * @param {{ apiKey?: string, from?: string, appUrl?: string, batch?: number, dailyCap?: number,
 *           gapMs?: number, fetch?: typeof fetch }} cfg
 * @returns {Promise<{ status: string, claimed?: number, sent?: number, retry?: number, failed?: number, error?: string }>}
 *   status: ok | not_configured | error
 */
export async function runOutbox(supa, cfg = {}) {
  if (!cfg.apiKey || !cfg.from) return { status: 'not_configured' };
  const out = { status: 'ok', claimed: 0, sent: 0, retry: 0, failed: 0 };
  let rows;
  try {
    const { data, error } = await supa.rpc('claim_outbox', { p_limit: cfg.batch ?? 20, p_daily_cap: cfg.dailyCap ?? 90 });
    if (error) return { status: 'error', error: `claim: ${error.message}` };
    rows = data ?? [];
  } catch (e) {
    return { status: 'error', error: `claim: ${e instanceof Error ? e.message : String(e)}` };
  }
  out.claimed = rows.length;
  const doFetch = cfg.fetch ?? fetch;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i > 0 && cfg.gapMs !== 0) await wait(cfg.gapMs ?? 600); // stay under Resend's per-second rate limit
    let result; // { ok, providerId?, error?, retryable? }
    let msg = null;
    try { msg = renderRow(row, { appUrl: cfg.appUrl }); }
    catch (e) { result = { ok: false, error: `render: ${e instanceof Error ? e.message : String(e)}`, retryable: false }; }

    if (msg) {
      try {
        const res = await doFetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': row.idempotency_key,
          },
          body: JSON.stringify({ from: cfg.from, to: [row.recipient], subject: msg.subject, html: msg.html, text: msg.text }),
        });
        if (res.ok) {
          const body = await res.json().catch(() => ({}));
          result = { ok: true, providerId: body?.id ?? null };
        } else {
          const detail = (await res.text().catch(() => '')).slice(0, 300);
          result = { ok: false, error: `resend ${res.status}${detail ? `: ${detail}` : ''}`, retryable: res.status === 429 || res.status >= 500 };
        }
      } catch (e) {
        result = { ok: false, error: `network: ${e instanceof Error ? e.message : String(e)}`, retryable: true };
      }
    }

    try {
      const { data: verdict } = await supa.rpc('complete_outbox', {
        p_id: row.id, p_ok: result.ok, p_provider_id: result.providerId ?? null,
        p_error: result.error ?? null, p_retryable: result.retryable ?? true,
      });
      if (verdict === 'sent') out.sent++;
      else if (verdict === 'retry') out.retry++;
      else if (verdict === 'failed') out.failed++;
    } catch { /* the lease expires and the row is claimed again; Idempotency-Key stops a double send */ }
  }
  return out;
}
