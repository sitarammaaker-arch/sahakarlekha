// POST /api/subscribe on Cloudflare — a port of api/subscribe.ts (Vercel). Sends ONLY the fixed welcome email via
// Resend, so it can never be used as an open relay. The key lives in Worker secrets (RESEND_API_KEY, RESEND_FROM),
// never in the browser. Fail-soft: without a key, or on a Resend error, it still answers 200 { sent: false } so the
// lead capture on the page never breaks. Keep the template identical to api/subscribe.ts (test:cloudflare-worker).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const WELCOME_SUBJECT = 'SahakarLekha में आपका स्वागत है 🙏';

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function welcomeHtml(name) {
  const hi = name && name.trim() ? ` ${escapeHtml(name.trim())}` : '';
  return `<div style="font-family:Arial,'Noto Sans Devanagari',sans-serif;line-height:1.7;color:#0f172a;max-width:560px">
    <p>नमस्ते${hi},</p>
    <p>SahakarLekha से जुड़ने के लिए धन्यवाद — सहकारी समितियों के लिए मुफ्त, आधुनिक और हिन्दी-केंद्रित लेखा प्लेटफ़ॉर्म।</p>
    <p>
      👉 <a href="https://sahakarlekha.com/register" style="color:#0F7B5A;font-weight:bold">मुफ्त रजिस्टर करें</a><br>
      📘 मुफ्त गाइड: <a href="https://sahakarlekha.com/guide" style="color:#0F7B5A">सम्पूर्ण लेखांकन कोर्स</a>
    </p>
    <p style="color:#475569">— टीम SahakarLekha · <a href="https://sahakarlekha.com" style="color:#0F7B5A">sahakarlekha.com</a></p>
  </div>`;
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function handleSubscribe(request, env, fetchFn = fetch) {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const email = String(body?.email ?? '').trim();
  const name = String(body?.name ?? '').trim();
  if (!EMAIL_RE.test(email)) return json(400, { error: 'invalid_email' });
  const KEY = env.RESEND_API_KEY, FROM = env.RESEND_FROM;
  if (!KEY || !FROM) return json(200, { ok: true, sent: false, reason: 'email_not_configured' });
  try {
    const r = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [email], subject: WELCOME_SUBJECT, html: welcomeHtml(name) }),
    });
    if (!r.ok) return json(200, { ok: true, sent: false, reason: 'resend_error', detail: (await r.text().catch(() => '')).slice(0, 200) });
    return json(200, { ok: true, sent: true });
  } catch {
    return json(200, { ok: true, sent: false, reason: 'exception' });
  }
}
