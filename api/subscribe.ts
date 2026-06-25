/**
 * /api/subscribe — Vercel serverless function (server-side only).
 *
 * Sends a fixed welcome email via Resend. The Resend API key lives ONLY in
 * server env (RESEND_API_KEY) and is never exposed to the browser. To avoid
 * being an open relay, this endpoint sends ONLY the pre-defined welcome
 * template to the provided recipient — the client cannot set subject/body.
 *
 * Fail-soft: if email isn't configured (or Resend errors), it still returns 200
 * with { sent: false } so lead capture in the client never breaks.
 *
 * Required Vercel env vars (set in the Vercel dashboard, NOT in code):
 *   RESEND_API_KEY  — your Resend API key
 *   RESEND_FROM     — verified sender, e.g. "SahakarLekha <hello@sahakarlekha.com>"
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function welcomeHtml(name?: string): string {
  const hi = name && name.trim() ? ` ${name.trim()}` : '';
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const email = (body?.email || '').toString().trim();
  const name = (body?.name || '').toString().trim();

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }

  const KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.RESEND_FROM;
  if (!KEY || !FROM) {
    // Not configured yet — succeed without sending so the client flow still works.
    res.status(200).json({ ok: true, sent: false, reason: 'email_not_configured' });
    return;
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        subject: 'SahakarLekha में आपका स्वागत है 🙏',
        html: welcomeHtml(name),
      }),
    });
    if (!r.ok) {
      const detail = (await r.text().catch(() => '')).slice(0, 200);
      res.status(200).json({ ok: true, sent: false, reason: 'resend_error', detail });
      return;
    }
    res.status(200).json({ ok: true, sent: true });
  } catch {
    res.status(200).json({ ok: true, sent: false, reason: 'exception' });
  }
}
