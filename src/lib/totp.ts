// In-app TOTP (RFC 6238) for two-factor auth (ECR-12). Pure engine — uses the
// Web Crypto API (HMAC-SHA1) only, no external dependency, no SMS/email infra.
// Secrets are base32 (RFC 4648) so any authenticator app (Google Authenticator,
// Authy, Microsoft Authenticator) can consume the otpauth:// URI.

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30; // seconds per code (authenticator-app standard)
const DIGITS = 6;

/** RFC 4648 base32 encode (no padding). */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/** RFC 4648 base32 decode; ignores spaces, padding and case. */
export function base32Decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Generate a fresh base32 secret (default 160-bit, per RFC 6238 §5.1). */
export function generateSecret(bytes = 20): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base32Encode(buf);
}

function counterBytes(counter: number): Uint8Array {
  const buf = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  return buf;
}

async function hmacSha1(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, msg));
}

/** RFC 4226 HOTP for a given counter. */
export async function hotp(secretB32: string, counter: number, digits = DIGITS): Promise<string> {
  const hs = await hmacSha1(base32Decode(secretB32), counterBytes(counter));
  const offset = hs[hs.length - 1] & 0x0f;
  const bin = ((hs[offset] & 0x7f) << 24) | ((hs[offset + 1] & 0xff) << 16)
    | ((hs[offset + 2] & 0xff) << 8) | (hs[offset + 3] & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, '0');
}

/** RFC 6238 TOTP at a point in time (ms since epoch). */
export function totp(secretB32: string, atMs = Date.now(), step = STEP, digits = DIGITS): Promise<string> {
  return hotp(secretB32, Math.floor(atMs / 1000 / step), digits);
}

/** Constant-time string compare (avoid timing side-channel on the code). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/**
 * Verify a user-entered token, accepting ±`window` steps for clock skew
 * (window=1 → the current, previous and next 30s code all pass).
 */
export async function verifyTotp(secretB32: string, token: string, atMs = Date.now(), window = 1, step = STEP, digits = DIGITS): Promise<boolean> {
  const t = (token || '').trim();
  if (!secretB32 || !new RegExp(`^\\d{${digits}}$`).test(t)) return false;
  const counter = Math.floor(atMs / 1000 / step);
  for (let w = -window; w <= window; w++) {
    const c = counter + w;
    if (c < 0) continue;
    if (safeEqual(await hotp(secretB32, c, digits), t)) return true;
  }
  return false;
}

/** otpauth:// URI to feed an authenticator app (QR or manual key entry). */
export function otpauthUri(secretB32: string, account: string, issuer = 'SahakarLekha'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretB32, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Group a base32 secret into 4-char blocks for readable manual entry. */
export function formatSecret(secretB32: string): string {
  return (secretB32.match(/.{1,4}/g) || []).join(' ');
}
