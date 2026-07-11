// Backup manifest + integrity primitives (T-23 / gap EXP-04).
//
// The whole point is tamper detection, so most of this file tries to tamper.
//
// Today's backup is plaintext JSON with no hash: a society hands its books to an auditor
// and neither of them can say whether the file is intact, truncated, or edited. These are
// the primitives that turn "probably fine" into "verified".
//
// Run: node scripts/test-backup-manifest.mjs   (npm run test:backup-manifest)

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

let integrity, manifestMod, reg;
try {
  integrity = await import(abs('../src/lib/backup/integrity.ts'));
  manifestMod = await import(abs('../src/lib/backup/manifest.ts'));
  reg = await import(abs('../src/lib/export/registry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the backup modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { canonicalize, sha256Text, sha256Canonical, sha256Bytes, digestsEqual, verifyFiles, toHex } = integrity;
const {
  buildManifest, verifyManifest, computeManifestHash, registryFingerprint,
  entityPath, fileDigests, unplaceableEntities, BACKUP_FORMAT_VERSION,
  classifyFormatVersion, SUPPORTED_FORMAT_MAJOR,
} = manifestMod;
const { REGISTRY } = reg;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. SHA-256, against a published vector ───────────────────────────────────
ok(await sha256Text('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  'sha256("abc") matches the published NIST vector');
ok(await sha256Text('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'sha256("") matches the published vector for the empty string');
ok(toHex(new Uint8Array([0, 15, 255])) === '000fff', 'toHex pads each byte to two digits');
ok(await sha256Text('राजेश') === await sha256Bytes(new TextEncoder().encode('राजेश')),
  'text and byte hashing agree on Devanagari (UTF-8, not UTF-16)');

// ── 2. CANONICALIZATION — the failure that would silently break every verify ──
// A hash over JSON.stringify is a hash over whatever key order the engine produced.
ok(canonicalize({ b: 1, a: 2 }) === canonicalize({ a: 2, b: 1 }), 'key order does not change the canonical form');
ok(canonicalize({ a: { z: 1, y: 2 } }) === canonicalize({ a: { y: 2, z: 1 } }), 'nested keys are sorted too');
ok(await sha256Canonical({ b: 1, a: 2 }) === await sha256Canonical({ a: 2, b: 1 }),
  'THE SAME MANIFEST HASHES THE SAME REGARDLESS OF KEY ORDER');

// Array order IS data. Sorting it would make two different backups hash alike.
ok(canonicalize([1, 2]) !== canonicalize([2, 1]), 'array order is preserved — it is data, not layout');
ok(canonicalize({ a: undefined, b: 1 }) === canonicalize({ b: 1 }), 'undefined object values are dropped, as JSON does');
ok(canonicalize([undefined]) === '[null]', 'undefined inside an array becomes null rather than shifting indices');
ok(canonicalize(null) === 'null' && canonicalize(5) === '5' && canonicalize('x') === '"x"', 'primitives pass through');

// ── 3. digestsEqual ──────────────────────────────────────────────────────────
ok(digestsEqual('abc', 'abc'), 'identical digests compare equal');
ok(!digestsEqual('abc', 'abd'), 'a one-character difference compares unequal');
ok(!digestsEqual('abc', 'abcd'), 'different lengths compare unequal');
ok(!digestsEqual('abc', null) && !digestsEqual(undefined, 'abc'), 'non-strings compare unequal, never throw');

// ── 4. Paths encode the custody class ────────────────────────────────────────
ok(entityPath('voucher', 'full') === 'data/voucher.ndjson', 'full rows live in data/');
ok(entityPath('voucher_entry', 'replay') === 'derived/voucher_entry.ndjson', 'replayed rows live in derived/');
ok(entityPath('audit_log', 'sidecar') === 'evidence/audit_log.ndjson', 'evidence lives in evidence/');
let threw = false;
try { entityPath('user_mfa', 'exclude'); } catch { threw = true; }
ok(threw, 'an excluded entity has no path — asking for one is a programming error');

// ── 5. Registry fingerprint ──────────────────────────────────────────────────
const fp = await registryFingerprint(REGISTRY);
ok(typeof fp === 'string' && fp.length === 64, 'the fingerprint is a sha256 hex digest');
ok(await registryFingerprint([...REGISTRY].reverse()) === fp, 'the fingerprint is order-independent');

// It tracks the SHAPE — a renamed table or a changed custody policy must change it.
const mutated = REGISTRY.map(e => (e.key === 'member' ? { ...e, table: 'members_v2' } : e));
ok(await registryFingerprint(mutated) !== fp, 'renaming a table changes the fingerprint');
const repolicied = REGISTRY.map(e => (e.key === 'voucher_entry' ? { ...e, backupPolicy: 'full' } : e));
ok(await registryFingerprint(repolicied) !== fp, 'changing a custody policy changes the fingerprint');
const dropped = REGISTRY.map(e => (e.key === 'member' ? { ...e, columns: e.columns.slice(1) } : e));
ok(await registryFingerprint(dropped) !== fp, 'dropping a column changes the fingerprint');

// …but not cosmetics. A relabelled entity does not invalidate every archive ever written.
const relabelled = REGISTRY.map(e => ({ ...e, label: 'X', labelHi: 'X', minRole: 'admin' }));
ok(await registryFingerprint(relabelled) === fp, 'labels and roles do NOT change the fingerprint — they do not affect placement');

// ── 6. Building a manifest ───────────────────────────────────────────────────
const ENTITIES = [
  { key: 'member', table: 'members', policy: 'full', rowCount: 1345, bytes: 200_000, sha256: 'a'.repeat(64), columns: ['id', 'name'] },
  { key: 'voucher_entry', table: 'voucher_entries', policy: 'replay', rowCount: 8214, bytes: 900_000, sha256: 'b'.repeat(64), columns: ['id'] },
  { key: 'audit_log', table: 'audit_log', policy: 'sidecar', rowCount: 17, bytes: 4_000, sha256: 'c'.repeat(64), columns: ['id'] },
];
const INPUT = {
  appVersion: '0.0.0', schemaVersion: '93',
  societyId: 'SOC001', societyName: 'श्री कृष्ण सहकारी समिति',
  registrationNo: 'REG/123', financialYear: '2025-26',
  createdAt: '2026-07-10T00:00:00.000Z',
  createdBy: { name: 'राजेश', email: 'a@b.com', role: 'admin' },
  trigger: 'manual',
  entities: ENTITIES,
  registryFingerprint: fp,
};

const m = await buildManifest(INPUT);
ok(m.formatVersion === BACKUP_FORMAT_VERSION, 'the format version is stamped');
ok(m.totals.entityCount === 3 && m.totals.rowCount === 1345 + 8214 + 17 && m.totals.bytes === 1_104_000, 'totals are computed, not trusted from the caller');
ok(m.encryption === null, 'an unencrypted archive records encryption: null, not undefined');
ok(m.manifestHash.length === 64, 'the manifest carries its own hash');
ok((await verifyManifest(m)).ok, 'a freshly built manifest verifies');

// createdAt is an input, so the manifest is deterministic under test.
const m2 = await buildManifest(INPUT);
ok(m2.manifestHash === m.manifestHash, 'the same input yields the same manifest hash');

// ── 7. THE HASH COVERS EVERYTHING EXCEPT ITSELF ──────────────────────────────
const recomputed = await computeManifestHash(m);
ok(recomputed === m.manifestHash, 'computeManifestHash reproduces the stamped hash');
ok(await computeManifestHash({ ...m, manifestHash: 'zzz' }) === m.manifestHash,
  'the hash is computed with manifestHash REMOVED, so its own value cannot influence it');

// ── 8. TAMPERING. Every one of these must be caught. ─────────────────────────
const tampers = [
  ['a per-file hash is edited', { ...m, entities: [{ ...ENTITIES[0], sha256: 'd'.repeat(64) }, ...ENTITIES.slice(1)] }],
  ['a row count is inflated', { ...m, entities: [{ ...ENTITIES[0], rowCount: 9999 }, ...ENTITIES.slice(1)] }],
  ['an entity is removed', { ...m, entities: ENTITIES.slice(1) }],
  ['the society is swapped', { ...m, societyId: 'SOC-EVIL' }],
  ['the created-at is backdated', { ...m, createdAt: '2020-01-01T00:00:00.000Z' }],
  ['the registry fingerprint is forged', { ...m, registryFingerprint: 'e'.repeat(64) }],
  ['the trigger is rewritten', { ...m, trigger: 'scheduled' }],
];
for (const [what, tampered] of tampers) {
  const verdict = await verifyManifest(tampered);
  ok(!verdict.ok, `TAMPER DETECTED: ${what}`);
}

// The subtle one: edit an entity AND fix the totals, so the manifest is self-consistent.
// Only the hash catches this.
const sneaky = {
  ...m,
  entities: [{ ...ENTITIES[0], rowCount: 1300 }, ...ENTITIES.slice(1)],
  totals: { entityCount: 3, rowCount: 1300 + 8214 + 17, bytes: 1_104_000 },
};
ok(!(await verifyManifest(sneaky)).ok, 'TAMPER DETECTED: rows removed and totals adjusted to match — only the hash catches it');

// Removing the hash entirely is not a way to pass.
ok(!(await verifyManifest({ ...m, manifestHash: '' })).ok, 'a manifest with no hash is rejected');
ok(!(await verifyManifest({ ...m, manifestHash: undefined })).ok, 'a manifest with a missing hash is rejected');
ok(!(await verifyManifest({ ...m, formatVersion: '99.0' })).ok, 'an archive from an unknown future format is refused, not guessed at');

// A manifest whose totals lie about its own entity list is rejected even if re-hashed.
const relied = await buildManifest({ ...INPUT, entities: ENTITIES });
ok((await verifyManifest({ ...relied, totals: { ...relied.totals, rowCount: 1 } })).ok === false,
  'totals that disagree with the entity list are rejected');

// ── 8b. FORMAT-VERSION NEGOTIATION (T-04 / ADR-0004, IRR-6) ───────────────────
// A version-stamped format must EVOLVE WITHOUT BREAKING PRIOR ARCHIVES. Same major is
// tolerantly accepted (VER-2/VER-4); a newer major is refused, never guessed at (VER-1).

// The pure negotiation core.
ok(classifyFormatVersion(`${SUPPORTED_FORMAT_MAJOR}.0`).ok, 'the current major.minor is accepted');
ok(classifyFormatVersion(`${SUPPORTED_FORMAT_MAJOR}.9`).ok, 'a FUTURE MINOR of the same major is accepted (additive, tolerantly read)');
const tooNew = classifyFormatVersion(`${SUPPORTED_FORMAT_MAJOR + 1}.0`);
ok(!tooNew.ok && tooNew.kind === 'too-new' && /newer version/i.test(tooNew.reason),
  'a NEWER MAJOR is refused with an "update the app" reason (a major bump is breaking)');
ok(classifyFormatVersion('0.9').kind === 'too-old', 'an older major than this build reads is refused as too-old');
for (const bad of ['', '   ', 'abc', '1', '1.2.3', '1.x', null, undefined, 42]) {
  const v = classifyFormatVersion(bad);
  ok(!v.ok && v.kind === 'malformed', `a malformed version (${JSON.stringify(bad)}) is refused as malformed, never accepted`);
}

// End-to-end through verifyManifest, hash re-stamped so ONLY the version differs.
const futureMinor = { ...m, formatVersion: `${SUPPORTED_FORMAT_MAJOR}.9` };
futureMinor.manifestHash = await computeManifestHash(futureMinor);
ok((await verifyManifest(futureMinor)).ok, 'a VALID future-minor archive verifies end-to-end (forward compatibility, VER-4)');

const futureMajor = { ...m, formatVersion: `${SUPPORTED_FORMAT_MAJOR + 1}.0` };
futureMajor.manifestHash = await computeManifestHash(futureMajor);
const majV = await verifyManifest(futureMajor);
ok(!majV.ok && /newer version/i.test(majV.reason),
  'a hash-VALID NEWER-MAJOR archive is still refused on version — never silently mis-read');

// Negotiation never weakens integrity: a same-major archive with a bad hash still fails.
ok(!(await verifyManifest({ ...m, formatVersion: `${SUPPORTED_FORMAT_MAJOR}.9`, manifestHash: 'deadbeef' })).ok,
  'accepting a future minor does not bypass the manifest-hash check');

// ── 9. THE KEY NEVER SHIPS ───────────────────────────────────────────────────
for (const forbidden of ['key', 'password', 'passphrase', 'secret', 'derivedKey']) {
  let caught = false;
  try {
    await buildManifest({ ...INPUT, encryption: { algo: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: 600000, salt: 's', iv: 'i', [forbidden]: 'oops' } });
  } catch { caught = true; }
  ok(caught, `buildManifest refuses encryption params carrying "${forbidden}" — the key would ship with the archive`);
}
const enc = await buildManifest({ ...INPUT, encryption: { algo: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: 600000, salt: 'c2FsdA==', iv: 'aXY=' } });
ok(enc.encryption.iterations === 600000 && (await verifyManifest(enc)).ok, 'legitimate encryption params are recorded and verify');

// ── 10. File verification ────────────────────────────────────────────────────
const rows = new TextEncoder().encode('{"id":"1"}\n{"id":"2"}\n');
const rowHash = await sha256Bytes(rows);
const digests = [{ path: 'data/member.ndjson', sha256: rowHash, bytes: rows.length }];

ok((await verifyFiles(digests, () => rows)).length === 0, 'an intact file verifies');

const oneByteOff = new Uint8Array(rows);
oneByteOff[3] ^= 0x01;
const failures = await verifyFiles(digests, () => oneByteOff);
ok(failures.length === 1 && failures[0].reason === 'hash-mismatch', 'A SINGLE FLIPPED BYTE IS CAUGHT');

const missing = await verifyFiles(digests, () => undefined);
ok(missing.length === 1 && missing[0].reason === 'missing', 'a file listed in the manifest but absent from the archive is caught');

const truncated = rows.slice(0, 5);
const truncFail = await verifyFiles(digests, () => truncated);
ok(truncFail.some(f => f.reason === 'size-mismatch'), 'a truncated download is caught by size');
ok(truncFail.some(f => f.reason === 'hash-mismatch'), '…and by hash, so a lying size cannot hide it');

// Every failure is reported, not just the first — an operator should not go round the
// loop once per corrupt file.
const many = [
  { path: 'a', sha256: 'a'.repeat(64), bytes: 1 },
  { path: 'b', sha256: 'b'.repeat(64), bytes: 1 },
];
ok((await verifyFiles(many, () => new Uint8Array([0]))).length === 2, 'every corrupt file is reported, not only the first');

// ── 11. fileDigests + unplaceable entities ───────────────────────────────────
const paths = fileDigests(m).map(d => d.path);
ok(paths.join(',') === 'data/member.ndjson,derived/voucher_entry.ndjson,evidence/audit_log.ndjson',
  'fileDigests derives each path from the custody policy');

ok(unplaceableEntities(m, REGISTRY).length === 0, 'this build can place every entity in the manifest');
const ghost = { ...m, entities: [...ENTITIES, { key: 'ghost_table', table: 'ghosts', policy: 'full', rowCount: 0, bytes: 0, sha256: 'f'.repeat(64), columns: [] }] };
ok(unplaceableEntities(ghost, REGISTRY).join(',') === 'ghost_table',
  'AN ENTITY THIS BUILD DOES NOT KNOW IS NAMED — a restore must not silently drop it (gap EXP-02)');

console.log(`\nBackup manifest + integrity (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
