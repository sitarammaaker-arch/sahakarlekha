/**
 * `.slbak` encryption (T-26 / gap EXP-04).
 *
 * AES-256-GCM over the ZIP bytes, key derived from a passphrase with PBKDF2-SHA256.
 *
 * NOT ZipCrypto, and not ZIP's AES extension. ZipCrypto is broken; the AES-ZIP extension
 * is poorly supported and leaks the file listing. So the archive is encrypted as a whole
 * and wrapped in a small container of our own.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE CONTAINER, AND WHY THE HEADER IS OUTSIDE THE CIPHERTEXT
 *
 *     "SLBAK1\n"  | u32 headerLen | header JSON (cleartext) | ciphertext (with GCM tag)
 *
 * Blueprint §5.2 lists `encryption` among the manifest's fields. It cannot live only
 * there: the manifest is inside the ZIP, the ZIP is inside the ciphertext, and you need
 * the salt and iteration count to derive the key that decrypts it. Chicken and egg.
 *
 * §5.4 already resolves this — "the manifest header stays cleartext … row counts and
 * hashes live in the encrypted body". This is that header. It carries only what is needed
 * to IDENTIFY an archive and to ATTEMPT decryption: society, FY, created-at, trigger,
 * algorithm, KDF, iterations, salt, IV. Never the key, never a row count, never a digest.
 *
 * THE HEADER IS AUTHENTICATED, not merely cleartext. It is passed to AES-GCM as
 * additional authenticated data, so editing the society name, backdating the archive, or
 * lowering `iterations` to make a brute force cheap all cause decryption to fail. Without
 * that, an attacker rewrites the header freely and the recipient trusts it.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * NO ESCROW (decision D2). The passphrase never leaves the browser, is never stored, and
 * SahakarLekha holds no master key. Lose it and the archive is unrecoverable — by anyone,
 * forever. The alternative is that we can read every society's books, which would undo
 * everything else in this workstream. The UI must say this plainly before the first
 * encrypted archive, in Hindi.
 *
 * GCM AUTHENTICATES BEFORE IT REVEALS. A wrong passphrase, a flipped ciphertext byte, or
 * an edited header all fail the tag check, and `crypto.subtle.decrypt` returns nothing at
 * all — not a partial, plausible-looking plaintext. That property is why AEAD is used
 * rather than raw AES-CBC plus a separate checksum.
 */
import { canonicalize } from './integrity';
import type { EncryptionParams } from './manifest';

/** Magic bytes. Also how a reader tells an encrypted archive from a plain ZIP. */
export const CONTAINER_MAGIC = 'SLBAK1\n';

/**
 * OWASP's floor for PBKDF2-HMAC-SHA256 (2023). Roughly half a second in a browser, which
 * is the point: it is the only thing standing between a weak passphrase and an offline
 * attacker with the file.
 */
export const PBKDF2_ITERATIONS = 600_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;   // 96 bits, the size AES-GCM is specified for

/** Cleartext, authenticated. Enough to identify an archive; not enough to learn anything. */
export interface ContainerHeader {
  formatVersion: string;
  societyName: string;
  registrationNo: string;
  financialYear: string;
  createdAt: string;
  trigger: string;
  encryption: EncryptionParams;
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('wrong passphrase, or the archive has been altered');
    this.name = 'WrongPassphraseError';
  }
}

export class NotAnEncryptedArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotAnEncryptedArchiveError';
  }
}

// ─── base64 (no Buffer, no atob/btoa — this must run in Node and the browser) ─────────

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
}

export function fromBase64(text: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(text, 'base64'));
}

// ─── Key derivation ──────────────────────────────────────────────────────────────────

/** Derive the AES key. Non-extractable: it cannot be read back out of WebCrypto. */
export async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,                       // not extractable
    ['encrypt', 'decrypt'],
  );
}

// ─── Container framing ───────────────────────────────────────────────────────────────

const MAGIC_BYTES = new TextEncoder().encode(CONTAINER_MAGIC);

/** PURE — true when these bytes look like an encrypted `.slbak`, not a plain ZIP. */
export function isEncryptedArchive(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC_BYTES.length) return false;
  for (let i = 0; i < MAGIC_BYTES.length; i++) if (bytes[i] !== MAGIC_BYTES[i]) return false;
  return true;
}

/**
 * PURE — split a container into its authenticated header bytes and its ciphertext.
 * Throws rather than guessing: a malformed container is not a decryption problem.
 */
export function splitContainer(bytes: Uint8Array): { headerBytes: Uint8Array; header: ContainerHeader; ciphertext: Uint8Array; aad: Uint8Array } {
  if (!isEncryptedArchive(bytes)) throw new NotAnEncryptedArchiveError('missing SLBAK1 magic — this is not an encrypted archive');

  const lenOffset = MAGIC_BYTES.length;
  if (bytes.length < lenOffset + 4) throw new NotAnEncryptedArchiveError('truncated container');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLen = view.getUint32(lenOffset, false);   // big-endian
  const headerStart = lenOffset + 4;
  const headerEnd = headerStart + headerLen;
  if (headerLen === 0 || headerEnd > bytes.length) throw new NotAnEncryptedArchiveError('header length is out of range');

  const headerBytes = bytes.subarray(headerStart, headerEnd);
  let header: ContainerHeader;
  try {
    header = JSON.parse(new TextDecoder().decode(headerBytes));
  } catch {
    throw new NotAnEncryptedArchiveError('header is not valid JSON');
  }
  if (!header?.encryption?.salt || !header.encryption.iv) {
    throw new NotAnEncryptedArchiveError('header carries no encryption parameters');
  }

  return {
    headerBytes,
    header,
    ciphertext: bytes.subarray(headerEnd),
    // Everything before the ciphertext is authenticated: magic, length, header.
    aad: bytes.subarray(0, headerEnd),
  };
}

// ─── Encrypt / decrypt ───────────────────────────────────────────────────────────────

export interface EncryptOptions {
  /** Injected in tests so a container is reproducible. Production uses random bytes. */
  salt?: Uint8Array;
  iv?: Uint8Array;
  iterations?: number;
}

export type HeaderMeta = Omit<ContainerHeader, 'encryption'>;

/**
 * Encrypt a ZIP archive into a `.slbak` container.
 *
 * A fresh random salt AND a fresh random IV per call. Reusing an IV under the same key
 * breaks AES-GCM completely — not "weakens", breaks — and two backups of the same society
 * with the same passphrase would otherwise collide.
 */
export async function encryptArchive(
  archive: Uint8Array,
  passphrase: string,
  meta: HeaderMeta,
  options: EncryptOptions = {},
): Promise<Uint8Array> {
  if (!passphrase) throw new Error('a passphrase is required');

  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = options.iv ?? crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const iterations = options.iterations ?? PBKDF2_ITERATIONS;

  const header: ContainerHeader = {
    ...meta,
    encryption: {
      algo: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations,
      salt: toBase64(salt),
      iv: toBase64(iv),
    },
  };

  const headerBytes = new TextEncoder().encode(canonicalize(header));
  const prefix = new Uint8Array(MAGIC_BYTES.length + 4 + headerBytes.length);
  prefix.set(MAGIC_BYTES, 0);
  new DataView(prefix.buffer).setUint32(MAGIC_BYTES.length, headerBytes.length, false);
  prefix.set(headerBytes, MAGIC_BYTES.length + 4);

  const key = await deriveKey(passphrase, salt, iterations);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, additionalData: prefix as unknown as BufferSource },
    key,
    archive as unknown as BufferSource,
  ));

  const out = new Uint8Array(prefix.length + ciphertext.length);
  out.set(prefix, 0);
  out.set(ciphertext, prefix.length);
  return out;
}

/**
 * Read the header WITHOUT the passphrase.
 *
 * This is what lets a user look at a folder of encrypted archives and tell which society
 * and which financial year each one holds. It proves nothing — the header is only
 * authenticated once decryption succeeds — so a caller must not trust it before then.
 */
export function readContainerHeader(bytes: Uint8Array): ContainerHeader {
  return splitContainer(bytes).header;
}

/**
 * Decrypt a container back into the ZIP bytes.
 *
 * A wrong passphrase, a flipped ciphertext byte, and an edited header are indistinguishable
 * here, and all three throw WrongPassphraseError. GCM authenticates before it reveals: no
 * partial plaintext is ever produced. Telling the user which of the three went wrong would
 * be a decryption oracle.
 */
export async function decryptArchive(bytes: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const { header, ciphertext, aad } = splitContainer(bytes);

  const salt = fromBase64(header.encryption.salt);
  const iv = fromBase64(header.encryption.iv);
  const key = await deriveKey(passphrase, salt, header.encryption.iterations);

  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, additionalData: aad as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource,
    );
    return new Uint8Array(plain);
  } catch {
    throw new WrongPassphraseError();
  }
}
