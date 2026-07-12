/**
 * Webhook signing & verification (T-25 / API Constitution EVT-6; AUTH-5).
 *
 * PURE. Webhooks are signed and verifiable, so a consumer can trust that a delivered event came
 * from SahakarLekha and was not tampered with in transit (EVT-6). This module fixes the two things
 * that must be identical on both sides:
 *
 *   • the CANONICAL serialization that is signed — a deterministic, key-sorted byte string, so the
 *     producer and the consumer compute the SAME bytes regardless of field order;
 *   • the signature ENVELOPE (algorithm, keyId, signedAt, signature) and the verification rule.
 *
 * The HMAC primitive itself is INJECTED (`hmac`), keyed by `keyId` — so no cryptographic secret
 * ever enters this layer (AUTH-5: secrets are vaulted, never in code/logs/prompts), and the module
 * stays pure and deterministic. The wire layer supplies a Web-Crypto/Node HMAC and the vaulted key;
 * `signedAt` is injected (no clock here). Signing binds `signedAt` so a signature cannot be replayed
 * with a different timestamp.
 */

/**
 * PURE — deterministic canonical serialization: key-sorted JSON with undefined properties dropped,
 * so two independent parties serialize the same value to the same string and a signature verifies
 * irrespective of property order.
 */
export function canonicalize(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

/** An injected keyed HMAC — `(message, keyId) => signature`. The vaulted secret lives behind this,
 *  never in this module (AUTH-5). Deterministic for a given (message, keyId). */
export type Hmac = (message: string, keyId: string) => string;

export interface SignedEnvelope {
  algorithm: string;
  keyId: string;
  /** ISO time the signature was made (injected) — bound into the signature; a consumer may reject
   *  a stale signature outside its replay window. */
  signedAt: string;
  signature: string;
}

/** The exact string that is signed — the event bound to the signing time, canonicalized. Both
 *  sign and verify go through this, so they can never disagree on what was signed. */
function signingInput(event: unknown, signedAt: string): string {
  return canonicalize({ event, signedAt });
}

/**
 * PURE — sign an outbound event. Produces the envelope a consumer verifies. The HMAC is injected;
 * `signedAt` is injected. The signature covers the event AND the timestamp.
 */
export function signEvent(
  event: unknown,
  keyId: string,
  signedAt: string,
  hmac: Hmac,
  algorithm = 'HMAC-SHA256',
): SignedEnvelope {
  return { algorithm, keyId, signedAt, signature: hmac(signingInput(event, signedAt), keyId) };
}

/**
 * PURE — verify a signed envelope against a recomputed signature over the SAME canonical bytes.
 * Tamper-evident: any change to the event or the signedAt breaks the match. The consumer supplies
 * the same keyed HMAC (by keyId).
 */
export function verifyEvent(event: unknown, env: SignedEnvelope, hmac: Hmac): boolean {
  if (!env || typeof env.signature !== 'string' || env.signature.length === 0) return false;
  const expected = hmac(signingInput(event, env.signedAt), env.keyId);
  return expected === env.signature;
}
