/**
 * Member Portal S2b — PURE hand-out helpers (no network, no supabase import) so node tests can load
 * them: plan-gate mirror, portal URL, WhatsApp number normalisation and the Hindi-first message.
 */

/**
 * UI mirror of the server plan gate (064 RPC + Edge Function): plus/pro/enterprise/legacy/trial while
 * active/trialing/grace. Only decides what the dialog OFFERS — the server is the authority.
 */
export function portalPlanAllowed(plan: string, status: string): boolean {
  return ['plus', 'pro', 'enterprise', 'legacy', 'trial'].includes(plan) && ['active', 'trialing', 'grace'].includes(status);
}

/** Absolute portal URL for this society, e.g. https://sahakarlekha.com/member/SOC001. */
export function portalUrl(origin: string, portalPath: string): string {
  return origin.replace(/\/+$/, '') + (portalPath.startsWith('/') ? portalPath : `/${portalPath}`);
}

/**
 * Indian mobile → wa.me digits: 10 digits ⇒ 91XXXXXXXXXX; leading 0 or +91 accepted.
 * Anything else ⇒ '' (WhatsApp then asks the admin to pick the contact).
 */
export function whatsappPhone(phone: string | undefined): string {
  let d = String(phone ?? '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) return `91${d}`;
  if (d.length === 12 && d.startsWith('91') && /^[6-9]/.test(d.slice(2))) return d;
  return '';
}

/**
 * The Hindi-first hand-out message the admin sends to the member. `pin: null` leaves the PIN out — the WhatsApp link
 * carries its text IN THE URL (browser history, wa.me logs), so the PIN never goes that way (re-audit 2026-10-17, H-6);
 * it is told to the member separately (call / SMS / in person), or sent with "copy message".
 */
export function handoutMessage(p: { memberName: string; societyName?: string; memberNo: string; pin: string | null; url: string }): string {
  return [
    `नमस्ते ${p.memberName} जी,`,
    `${p.societyName ? p.societyName + ' — ' : ''}सदस्य portal पर आप अपना शेयर, ऋण और जमा का हिसाब देख सकते हैं।`,
    ``,
    `🔗 ${p.url}`,
    `सदस्य संख्या: ${p.memberNo}`,
    p.pin ? `PIN: ${p.pin}` : `PIN: समिति आपको अलग से (फ़ोन / SMS / सामने) बताएगी।`,
    ``,
    `कृपया यह PIN किसी को न बताएँ।`,
  ].join('\n');
}

export function whatsappLink(phone: string | undefined, text: string): string {
  return `https://wa.me/${whatsappPhone(phone)}?text=${encodeURIComponent(text)}`;
}
