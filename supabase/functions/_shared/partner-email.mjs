/**
 * Partner portal emails (migration 168) — the login code and the welcome mail after approval. Plain JS with an
 * injectable fetch so scripts/test-partner-email.mjs can drive it with a fake Resend. Sent DIRECTLY (not through the
 * notification outbox): a login code must arrive in seconds, and the outbox runs once a minute with a daily cap.
 *
 * Hindi first with an English line (house style). Every value is escaped. Never throws: returns { ok, status, error }.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const APP_URL = 'https://sahakarlekha.com';
const shell = (body) => `<div style="font-family:Arial,'Noto Sans Devanagari',sans-serif;line-height:1.6;color:#0f172a;max-width:600px">${body}
    <p style="color:#475569">— टीम सहकार लेखा · <a href="https://sahakarlekha.com" style="color:#0F7B5A">sahakarlekha.com</a></p>
  </div>`;

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const normEmail = (s) => String(s ?? '').trim().toLowerCase();
export const CODE_RE = /^SL-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

/** { action: 'start', email } | { action: 'welcome', partner_id } → parsed, or { ok:false } */
export function parsePartnerAuthRequest(body) {
  if (!body || typeof body !== 'object') return { ok: false };
  if (body.action === 'start') {
    const email = normEmail(body.email);
    return email.length <= 254 && EMAIL_RE.test(email) ? { ok: true, action: 'start', email } : { ok: false };
  }
  if (body.action === 'welcome') {
    const id = String(body.partner_id ?? '');
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? { ok: true, action: 'welcome', partnerId: id } : { ok: false };
  }
  return { ok: false };
}

export function buildOtpEmail({ name, code }) {
  if (!/^[0-9]{6}$/.test(String(code))) throw new Error('otp: bad code');
  const n = name ? ` ${esc(name)}` : '';
  const subject = `${code} — सहकार लेखा partner login कोड / login code`;
  const html = shell(`<p>नमस्ते${n},</p>
    <p>आपका partner portal login कोड:<br><span style="color:#475569">Your partner portal login code:</span></p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:6px;font-family:monospace">${esc(code)}</p>
    <p>यह कोड 10 मिनट तक चलेगा और एक ही बार काम करेगा। इसे किसी को न बताएँ — सहकार लेखा कभी फ़ोन पर यह कोड नहीं माँगता।<br>
      <span style="color:#475569">It works once, for 10 minutes. Never share it — SahakarLekha never asks for it on a call.</span></p>
    <p style="color:#475569;font-size:12px">अगर आपने login नहीं माँगा, तो इस ईमेल को छोड़ दें। / If you did not ask to sign in, ignore this email.</p>`);
  const text = [`नमस्ते${name ? ` ${name}` : ''},`, '', `आपका partner portal login कोड / Your login code: ${code}`, '',
    'यह कोड 10 मिनट तक, एक बार चलेगा। किसी को न बताएँ। / Works once, for 10 minutes. Never share it.'].join('\n');
  return { subject, html, text };
}

export function buildWelcomeEmail({ name, code }) {
  if (!CODE_RE.test(String(code))) throw new Error('welcome: bad code');
  const login = `${APP_URL}/partner/login`;
  const ref = `${APP_URL}/?ref=${encodeURIComponent(code)}`;
  const n = name ? ` ${esc(name)}` : '';
  const subject = 'आप सहकार लेखा partner बन गए हैं / You are now a SahakarLekha partner';
  const btn = `<p style="margin:20px 0"><a href="${esc(login)}" style="background:#0F7B5A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Partner portal खोलें / Open portal</a></p>`;
  const html = shell(`<p>नमस्ते${n},</p>
    <p>आपका partner आवेदन मंज़ूर हो गया है।<br><span style="color:#475569">Your partner application has been approved.</span></p>
    <p>आपका referral code: <strong style="font-family:monospace;font-size:18px">${esc(code)}</strong><br>
      आपका referral link (समितियों को भेजें): <a href="${esc(ref)}">${esc(ref)}</a></p>
    <p>अपनी समितियाँ, commission और भुगतान देखने के लिए partner portal पर इसी ईमेल से login करें — हर बार ईमेल पर एक कोड आएगा, कोई password नहीं।<br>
      <span style="color:#475569">Sign in to the partner portal with this email to see your societies, commission and payouts — a code comes by email each time; there is no password.</span></p>
    ${btn}
    <p style="color:#475569;font-size:12px">${esc(login)}</p>`);
  const text = [`नमस्ते${name ? ` ${name}` : ''},`, '', 'आपका partner आवेदन मंज़ूर हो गया है। / Your partner application has been approved.', '',
    `Referral code: ${code}`, `Referral link: ${ref}`, '', `Partner portal (इसी ईमेल से login): ${login}`].join('\n');
  return { subject, html, text };
}

/** POST to Resend. cfg = { apiKey, from, fetch?, idempotencyKey? }. Never throws. */
export async function sendViaResend(to, mail, cfg) {
  if (!cfg?.apiKey || !cfg?.from) return { ok: false, status: 0, error: 'not_configured' };
  const doFetch = cfg.fetch ?? fetch;
  try {
    const res = await doFetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        ...(cfg.idempotencyKey ? { 'Idempotency-Key': cfg.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: cfg.from, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (res.ok) return { ok: true, status: res.status };
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    return { ok: false, status: res.status, error: `resend ${res.status}${detail ? `: ${detail}` : ''}` };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** WhatsApp text the admin can send with one tap after approval (wa.me). */
export function welcomeWhatsAppText({ name, code }) {
  return `नमस्ते ${name}, आपका सहकार लेखा partner आवेदन मंज़ूर हो गया है।\n` +
    `Referral code: ${code}\nReferral link: ${APP_URL}/?ref=${code}\n` +
    `Partner portal (आपके ईमेल से login): ${APP_URL}/partner/login`;
}
