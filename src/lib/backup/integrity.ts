/**
 * Backup integrity primitives (T-23 / gap EXP-04).
 *
 * PURE. No Supabase, no DOM, no filesystem. Everything here runs identically in the
 * browser, in Node, and in a future Edge Function — which matters, because the same
 * manifest will be written by a client-side export and verified by a server-side restore.
 *
 * WHAT THIS BUYS. Today the backup is plaintext JSON with no hash, no signature and no
 * way to tell a truncated download from a complete one. A society hands its books to an
 * auditor and neither of them can say whether the file is intact. Every layer below is
 * about turning "probably fine" into "verified".
 *
 * CANONICALIZATION IS THE WHOLE GAME. A hash over `JSON.stringify(obj)` is a hash over
 * whatever key order the engine happened to produce. Re-serialize the same manifest on a
 * different runtime and the hash changes, so verification fails on a file nobody touched.
 * `canonicalize` sorts object keys recursively; array order is preserved, because array
 * order is data.
 *
 * SHA-256 comes from WebCrypto (`crypto.subtle`), already used by lib/totp.ts. It is
 * async, so everything that hashes is async. That is a real constraint, not an oversight.
 */

/** The digest algorithm, named once. Recorded in the manifest so a reader need not guess. */
export const HASH_ALGORITHM = 'SHA-256' as const;

/**
 * PURE — deterministic serialization.
 *
 * Object keys sorted; arrays left alone; `undefined` dropped from objects (JSON has no
 * undefined) but preserved as `null` inside arrays, where dropping it would shift indices.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => (v === undefined ? null : canonicalValue(v)));

  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    if (source[key] === undefined) continue;   // JSON.stringify would drop it anyway
    out[key] = canonicalValue(source[key]);
  }
  return out;
}

/** PURE — lowercase hex of a byte array. */
export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** SHA-256 of raw bytes, as lowercase hex. */
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, bytes as unknown as BufferSource);
  return toHex(new Uint8Array(digest));
}

/** SHA-256 of a UTF-8 string, as lowercase hex. */
export async function sha256Text(text: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(text));
}

/** SHA-256 of any JSON value, canonicalized first so the hash is runtime-independent. */
export async function sha256Canonical(value: unknown): Promise<string> {
  return sha256Text(canonicalize(value));
}

/**
 * PURE — constant-time-ish comparison of two hex digests.
 *
 * `a === b` on strings short-circuits at the first differing character, which leaks how
 * many leading bytes an attacker guessed right. Irrelevant for a checksum a user computes
 * locally; it matters the day this compares a signature. Cheap to get right now.
 */
export function digestsEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** One file inside the archive, and what it should hash to. */
export interface FileDigest {
  path: string;
  sha256: string;
  bytes: number;
}

export interface VerificationFailure {
  path: string;
  reason: 'missing' | 'hash-mismatch' | 'size-mismatch';
  expected?: string | number;
  actual?: string | number;
}

/**
 * Verify a set of files against their recorded digests.
 *
 * Reports EVERY failure, not the first. A restore that says "file 3 is corrupt" when
 * files 3, 7 and 12 are corrupt sends the operator round the loop three times.
 *
 * An absent file is a failure, never a pass. `contents` is a lookup, so a manifest that
 * lists a file the archive does not contain must be caught here rather than surfacing as
 * an empty table after the restore.
 */
export async function verifyFiles(
  digests: readonly FileDigest[],
  contents: (path: string) => Uint8Array | undefined,
): Promise<VerificationFailure[]> {
  const failures: VerificationFailure[] = [];

  for (const digest of digests) {
    const bytes = contents(digest.path);
    if (!bytes) {
      failures.push({ path: digest.path, reason: 'missing' });
      continue;
    }
    if (bytes.length !== digest.bytes) {
      failures.push({ path: digest.path, reason: 'size-mismatch', expected: digest.bytes, actual: bytes.length });
      // Still hash it: a size mismatch plus a hash match would mean the digest itself lies.
    }
    const actual = await sha256Bytes(bytes);
    if (!digestsEqual(actual, digest.sha256)) {
      failures.push({ path: digest.path, reason: 'hash-mismatch', expected: digest.sha256, actual });
    }
  }

  return failures;
}
