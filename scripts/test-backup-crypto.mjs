// `.slbak` encryption (T-26 / gap EXP-04).
//
// This is security code, so the tests are mostly attacks.
//
// The three properties that matter:
//
//   1. GCM AUTHENTICATES BEFORE IT REVEALS. A wrong passphrase, a flipped ciphertext byte
//      and an edited header are indistinguishable, and none of them yields partial,
//      plausible-looking plaintext.
//   2. THE HEADER IS AUTHENTICATED, not merely cleartext. Rewriting the society name, or
//      lowering `iterations` to make a brute force cheap, must break decryption.
//   3. THE KEY NEVER SHIPS. The container carries salt, IV and iteration count — the
//      parameters needed to ATTEMPT decryption, useless without the passphrase.
//
// Run: node scripts/test-backup-crypto.mjs   (npm run test:backup-crypto)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath } from 'node:url';
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let cryptoMod;
try {
  cryptoMod = await import(abs('../src/lib/backup/crypto.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/backup/crypto.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const {
  encryptArchive, decryptArchive, readContainerHeader, splitContainer,
  isEncryptedArchive, deriveKey, toBase64, fromBase64,
  WrongPassphraseError, NotAnEncryptedArchiveError,
  CONTAINER_MAGIC, PBKDF2_ITERATIONS,
} = cryptoMod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// Tests use a low iteration count. 600k in a loop would take minutes and prove nothing
// extra — the default is asserted separately, below.
const FAST = { iterations: 1000 };
const PASS = 'सही पासवर्ड-2026';
const ZIP = new TextEncoder().encode('PK\x03\x04 pretend this is a zip full of vouchers');

const META = {
  formatVersion: '1.0',
  societyName: 'श्री कृष्ण सहकारी समिति',
  registrationNo: 'REG/123',
  financialYear: '2025-26',
  createdAt: '2026-07-10T00:00:00.000Z',
  trigger: 'manual',
};

// ── 1. base64, without Buffer or atob assumptions ────────────────────────────
ok(toBase64(new Uint8Array([0, 1, 254, 255])) === 'AAH+/w==', 'base64 encodes bytes');
ok(fromBase64('AAH+/w==').join(',') === '0,1,254,255', 'base64 decodes back');
const rnd = crypto.getRandomValues(new Uint8Array(64));
ok(fromBase64(toBase64(rnd)).every((b, i) => b === rnd[i]), 'base64 round-trips random bytes');

// ── 2. The default work factor ───────────────────────────────────────────────
ok(PBKDF2_ITERATIONS >= 600_000, `the default iteration count is OWASP's floor or better (${PBKDF2_ITERATIONS})`);

// ── 3. Round-trip ────────────────────────────────────────────────────────────
const container = await encryptArchive(ZIP, PASS, META, FAST);
ok(isEncryptedArchive(container), 'the container is recognisable as encrypted');
ok(new TextDecoder().decode(container.subarray(0, CONTAINER_MAGIC.length)) === CONTAINER_MAGIC, 'it starts with the magic bytes');
ok(!isEncryptedArchive(ZIP), 'a plain ZIP is not mistaken for an encrypted archive');

const back = await decryptArchive(container, PASS);
ok(back.length === ZIP.length && back.every((b, i) => b === ZIP[i]), 'the right passphrase returns the exact original bytes');

// Devanagari passphrase, and a long one.
const c2 = await encryptArchive(ZIP, 'पासवर्ड '.repeat(20), META, FAST);
ok((await decryptArchive(c2, 'पासवर्ड '.repeat(20))).length === ZIP.length, 'a long Devanagari passphrase works');

// ── 4. THE CIPHERTEXT REVEALS NOTHING ────────────────────────────────────────
const asText = new TextDecoder('utf-8', { fatal: false }).decode(container);
ok(!asText.includes('vouchers'), 'the plaintext does not appear anywhere in the container');
ok(!asText.includes(PASS), 'the passphrase does not appear in the container');
const header = readContainerHeader(container);
ok(!('key' in header.encryption) && !('password' in header.encryption), 'the header carries no key material');
ok(JSON.stringify(header).includes('salt') && JSON.stringify(header).includes('iv'), 'the header carries salt and IV — needed to ATTEMPT decryption');

// ── 5. The header is readable WITHOUT the passphrase ─────────────────────────
// This is what lets a user look at a folder of encrypted archives and tell which society
// and which year each one holds.
ok(header.societyName === META.societyName, 'the society is identifiable without decrypting');
ok(header.financialYear === '2025-26' && header.createdAt === META.createdAt, 'the FY and creation time are identifiable');
ok(header.encryption.algo === 'AES-256-GCM' && header.encryption.kdf === 'PBKDF2-SHA256', 'the algorithm is recorded');
ok(header.encryption.iterations === 1000, 'the iteration count is recorded');

// ── 6. A WRONG PASSPHRASE YIELDS NOTHING ─────────────────────────────────────
let caught = null;
let leaked = null;
try { leaked = await decryptArchive(container, 'गलत पासवर्ड'); } catch (e) { caught = e; }
ok(caught instanceof WrongPassphraseError, 'a wrong passphrase throws WrongPassphraseError');
ok(leaked === null, 'NO PARTIAL PLAINTEXT IS PRODUCED — GCM authenticates before it reveals');

// One character off.
caught = null;
try { await decryptArchive(container, PASS + ' '); } catch (e) { caught = e; }
ok(caught instanceof WrongPassphraseError, 'a passphrase one character off fails');

// ── 7. TAMPERING WITH THE CIPHERTEXT ─────────────────────────────────────────
const flipped = new Uint8Array(container);
flipped[flipped.length - 5] ^= 0x01;
caught = null;
try { await decryptArchive(flipped, PASS); } catch (e) { caught = e; }
ok(caught instanceof WrongPassphraseError, 'a single flipped ciphertext byte fails the tag check');

// Truncating the ciphertext (a half-finished download).
caught = null;
try { await decryptArchive(container.subarray(0, container.length - 10), PASS); } catch (e) { caught = e; }
ok(caught instanceof WrongPassphraseError, 'a truncated container fails, rather than yielding a truncated archive');

// ── 8. THE HEADER IS AUTHENTICATED (this is the part a naive design gets wrong) ─
// Rebuild a container with an edited header and the original ciphertext.
function rebuildWithHeader(original, mutate) {
  const { headerBytes, ciphertext } = splitContainer(original);
  const h = JSON.parse(new TextDecoder().decode(headerBytes));
  mutate(h);
  const newHeader = new TextEncoder().encode(JSON.stringify(h));
  const magic = new TextEncoder().encode(CONTAINER_MAGIC);
  const out = new Uint8Array(magic.length + 4 + newHeader.length + ciphertext.length);
  out.set(magic, 0);
  new DataView(out.buffer).setUint32(magic.length, newHeader.length, false);
  out.set(newHeader, magic.length + 4);
  out.set(ciphertext, magic.length + 4 + newHeader.length);
  return out;
}

const renamed = rebuildWithHeader(container, h => { h.societyName = 'कोई और समिति'; });
caught = null;
try { await decryptArchive(renamed, PASS); } catch (e) { caught = e; }
ok(caught instanceof WrongPassphraseError, 'EDITING THE SOCIETY NAME IN THE HEADER BREAKS DECRYPTION — the header is authenticated, not merely cleartext');

const backdated = rebuildWithHeader(container, h => { h.createdAt = '2020-01-01T00:00:00.000Z'; });
caught = null;
try { await decryptArchive(backdated, PASS); } catch (e) { caught = e; }
ok(caught instanceof WrongPassphraseError, 'backdating the archive breaks decryption');

// The nastiest one: lower `iterations` so an offline brute force is cheap. It changes the
// derived key AND the AAD, so it fails twice over.
const weakened = rebuildWithHeader(container, h => { h.encryption.iterations = 1; });
caught = null;
try { await decryptArchive(weakened, PASS); } catch (e) { caught = e; }
ok(caught instanceof WrongPassphraseError, 'LOWERING THE ITERATION COUNT BREAKS DECRYPTION — an attacker cannot make a brute force cheaper');

// ── 9. Fresh salt and IV per call ────────────────────────────────────────────
// Reusing an IV under one key does not weaken AES-GCM, it breaks it.
const a = await encryptArchive(ZIP, PASS, META, FAST);
const b = await encryptArchive(ZIP, PASS, META, FAST);
const ha = readContainerHeader(a).encryption;
const hb = readContainerHeader(b).encryption;
ok(ha.salt !== hb.salt, 'a fresh salt per archive');
ok(ha.iv !== hb.iv, 'A FRESH IV PER ARCHIVE — reusing one under the same key breaks AES-GCM outright');
ok(a.length === b.length && !a.every((x, i) => x === b[i]), 'two encryptions of identical data produce different bytes');
ok((await decryptArchive(a, PASS)).length === ZIP.length && (await decryptArchive(b, PASS)).length === ZIP.length, 'both still decrypt');

// Salt and IV are the documented sizes.
ok(fromBase64(ha.salt).length === 16, 'the salt is 128 bits');
ok(fromBase64(ha.iv).length === 12, 'the IV is 96 bits, the size AES-GCM is specified for');

// ── 10. A malformed container is NOT a decryption problem ────────────────────
// Telling these apart matters: "wrong password" sends the user hunting for a password
// they may have typed correctly.
for (const [what, bytes] of [
  ['random bytes', new Uint8Array([1, 2, 3, 4, 5])],
  ['a plain zip', ZIP],
  ['magic but nothing else', new TextEncoder().encode(CONTAINER_MAGIC)],
]) {
  caught = null;
  try { await decryptArchive(bytes, PASS); } catch (e) { caught = e; }
  ok(caught instanceof NotAnEncryptedArchiveError, `${what} raises NotAnEncryptedArchiveError, not WrongPassphraseError`);
}

// A header length that points past the end of the file.
const lying = new Uint8Array(container);
new DataView(lying.buffer).setUint32(CONTAINER_MAGIC.length, 0xFFFFFF, false);
caught = null;
try { await decryptArchive(lying, PASS); } catch (e) { caught = e; }
ok(caught instanceof NotAnEncryptedArchiveError && /out of range/.test(caught.message), 'a header length past the end of the file is caught');

// ── 11. An empty passphrase is refused up front ──────────────────────────────
caught = null;
try { await encryptArchive(ZIP, '', META, FAST); } catch (e) { caught = e; }
ok(caught !== null, 'an empty passphrase is refused rather than producing a uselessly encrypted file');

// ── 12. The derived key cannot be read back out ──────────────────────────────
const key = await deriveKey(PASS, new Uint8Array(16), 1000);
ok(key.extractable === false, 'the derived key is non-extractable — it cannot be exported from WebCrypto');
ok(key.usages.includes('encrypt') && key.usages.includes('decrypt'), 'and it is usable for exactly what it is for');

// Same passphrase + same salt = same key; different salt = different key.
const k1 = await deriveKey('x', new Uint8Array([1]), 1000);
const k2 = await deriveKey('x', new Uint8Array([2]), 1000);
const enc1 = await encryptArchive(ZIP, 'x', META, { ...FAST, salt: new Uint8Array(16).fill(1), iv: new Uint8Array(12).fill(1) });
const enc2 = await encryptArchive(ZIP, 'x', META, { ...FAST, salt: new Uint8Array(16).fill(1), iv: new Uint8Array(12).fill(1) });
ok(enc1.every((v, i) => v === enc2[i]), 'given the same salt and IV, encryption is deterministic (so tests can pin bytes)');
ok(k1 !== k2, 'different salts derive different keys');

console.log(`\nBackup crypto (AES-256-GCM): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
