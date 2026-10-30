/**
 * Resend webhook core (email slice 3, migration 144). Plain JS on WebCrypto (globalThis.crypto.subtle), so the
 * same file runs in Deno and under node in scripts/test-email-outbox.mjs.
 *
 * Resend signs webhooks with Svix: headers svix-id, svix-timestamp, svix-signature ("v1,<base64> v1,<base64>"),
 * signed content `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 keyed with the base64 part of the
 * "whsec_…" secret. The RAW body must be verified — re-serialised JSON breaks the signature. Timestamps more than
 * 5 minutes off are refused (replay). Delivery is at-least-once; record_email_event is idempotent.
 */

const TOLERANCE_S = 5 * 60;

const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const bytesToB64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));

/** Constant-time compare of two base64 strings. */
function sameB64(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * @param {string} secret  "whsec_<base64>"
 * @param {{ id?: string|null, timestamp?: string|null, signature?: string|null }} h  the three svix-* headers
 * @param {string} rawBody
 * @param {number} [nowS]  current unix seconds (tests)
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function verifySvix(secret, h, rawBody, nowS = Math.floor(Date.now() / 1000)) {
  if (!secret || !secret.startsWith('whsec_')) return { ok: false, reason: 'secret_not_configured' };
  if (!h?.id || !h?.timestamp || !h?.signature) return { ok: false, reason: 'missing_headers' };
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowS - ts) > TOLERANCE_S) return { ok: false, reason: 'stale_timestamp' };
  let key;
  try {
    key = await crypto.subtle.importKey('raw', b64ToBytes(secret.slice('whsec_'.length)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  } catch {
    return { ok: false, reason: 'bad_secret' };
  }
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${h.id}.${h.timestamp}.${rawBody}`));
  const expected = bytesToB64(mac);
  const given = String(h.signature).split(' ').map((p) => p.split(',')).filter(([v]) => v === 'v1').map(([, s]) => s ?? '');
  return given.some((s) => sameB64(s, expected)) ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

/** HMAC signature header for a body — used by tests to build valid requests. */
export async function signSvix(secret, id, timestamp, rawBody) {
  const key = await crypto.subtle.importKey('raw', b64ToBytes(secret.slice('whsec_'.length)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `v1,${bytesToB64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`)))}`;
}

export const HANDLED = ['email.delivered', 'email.delivery_delayed', 'email.bounced', 'email.complained'];

/**
 * Turn a verified event into one record_email_event call. Other event types (sent, opened, clicked …) are
 * acknowledged and ignored — no tracking is stored.
 * @returns {Promise<{ status: string, matched?: number, suppressed?: number, error?: string }>}
 */
export async function handleResendEvent(supa, event) {
  const type = String(event?.type ?? '');
  if (!HANDLED.includes(type)) return { status: 'ignored' };
  const data = event?.data ?? {};
  const to = Array.isArray(data.to) ? data.to : data.to ? [data.to] : [];
  const detail = type === 'email.bounced'
    ? [data.bounce?.type, data.bounce?.subType, data.bounce?.message].filter(Boolean).join(' · ') || 'bounced'
    : type === 'email.complained' ? 'spam complaint' : null;
  const { data: res, error } = await supa.rpc('record_email_event', {
    p_provider_id: data.email_id ?? null, p_type: type, p_recipients: to.map(String), p_detail: detail,
  });
  if (error) return { status: 'error', error: error.message };
  return { status: res?.status ?? 'recorded', matched: res?.matched ?? 0, suppressed: res?.suppressed ?? 0 };
}
