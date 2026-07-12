/**
 * Backup manifest (T-23 / gap EXP-04) — the spine of a `.slbak` archive.
 *
 * PURE. No Supabase, no DOM, no filesystem. It describes an archive; it does not build
 * one. The writer (T-24) fills it, the verifier (T-25) checks it, the restore (T-32)
 * refuses to proceed without it.
 *
 * THREE LAYERS OF INTEGRITY, and each answers a different question:
 *
 *   per-file sha256   "did this table's rows survive the download?"
 *   manifestHash      "did someone edit the list of per-file hashes?"
 *   registryFingerprint
 *                     "was this archive written by a build that knew the same tables?"
 *
 * The third is the anti-EXP-02 device. The audit found a backup covering 16 of 93
 * collections. A file written by a build that knew 93 tables must not be silently
 * restored by a build that knows 80 — the mismatch is detected and the unplaceable
 * entities are named. Without it, a restore quietly drops whole domains and reports
 * success, which is the original bug wearing a new hat.
 *
 * THE MANIFEST NEVER CARRIES A KEY. `encryption` records the algorithm, the KDF, the
 * iteration count, the salt and the IV — the parameters needed to *attempt* decryption,
 * none of which help without the passphrase. `buildManifest` throws if a caller tries to
 * put key material in there, because that mistake is silent and permanent: the archive
 * ships, and the key ships with it.
 */
import type { EntityDescriptor, BackupPolicy } from '../export/registry.types';
import { sha256Canonical, digestsEqual, type FileDigest } from './integrity';

/** Bumped when the archive layout changes. Independent of the app version. Written by
 *  this build; read subject to the negotiation policy below. */
export const BACKUP_FORMAT_VERSION = '1.0';

/**
 * FORMAT-VERSION NEGOTIATION (T-04 / ADR-0004, IRR-6).
 *
 * The archive format is version-stamped so it can EVOLVE WITHOUT BREAKING PRIOR ARCHIVES —
 * the whole point of a versioned contract. A reader therefore does NOT demand an exact
 * match; it negotiates:
 *
 *   • same MAJOR, any minor  → accept. Within a major, changes are additive and tolerantly
 *     read (unknown fields ignored) — ADR-0004 VER-2. So a 1.0 build reads a future 1.x
 *     archive, and a future 1.x build still reads today's 1.0 archives (VER-4).
 *   • NEWER major            → refuse, and say "update the app". A major bump is a breaking
 *     change (VER-1); guessing at a layout we do not understand is how silent corruption
 *     starts (the EXP-02 lesson). Refuse loudly, never quietly mis-read.
 *   • OLDER major / malformed → refuse with a clear reason. (No major < 1 was ever written;
 *     the policy leaves room to add dedicated old-major readers if that ever changes.)
 *
 * This build reads major SUPPORTED_FORMAT_MAJOR. The manifest hash and per-file digests are
 * checked regardless of minor version, so acceptance here never weakens integrity.
 */
export const SUPPORTED_FORMAT_MAJOR = 1;

export type FormatVersionVerdict =
  | { ok: true; major: number; minor: number; reason?: undefined }
  | { ok: false; kind: 'malformed' | 'too-old' | 'too-new'; reason: string };

/** PURE — parse "major.minor" and classify it against what this build can read. */
export function classifyFormatVersion(formatVersion: unknown): FormatVersionVerdict {
  if (typeof formatVersion !== 'string' || formatVersion.trim().length === 0) {
    return { ok: false, kind: 'malformed', reason: 'the archive carries no format version' };
  }
  const m = /^(\d+)\.(\d+)$/.exec(formatVersion.trim());
  if (!m) {
    return { ok: false, kind: 'malformed', reason: `archive format "${formatVersion}" is not a valid version` };
  }
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (major > SUPPORTED_FORMAT_MAJOR) {
    return {
      ok: false,
      kind: 'too-new',
      reason: `this archive (format ${formatVersion}) was written by a newer version of SahakarLekha — update the app to read it`,
    };
  }
  if (major < SUPPORTED_FORMAT_MAJOR) {
    return {
      ok: false,
      kind: 'too-old',
      reason: `archive format ${formatVersion} is older than this build can read (needs ${SUPPORTED_FORMAT_MAJOR}.x)`,
    };
  }
  return { ok: true, major, minor };
}

/** Why this archive exists. `pre-restore` is the snapshot a Replace restore takes first. */
export type BackupTrigger = 'manual' | 'scheduled' | 'pre-restore' | 'pre-migration';

/** Parameters needed to attempt decryption. Never the key. */
export interface EncryptionParams {
  algo: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256' | 'Argon2id';
  iterations: number;
  /** base64 */
  salt: string;
  /** base64 */
  iv: string;
}

export interface BackupActor {
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

/** One entity's file inside the archive. */
export interface EntityManifest {
  key: string;
  table: string;
  policy: BackupPolicy;
  rowCount: number;
  bytes: number;
  sha256: string;
  columns: string[];
}

export interface BackupManifest {
  formatVersion: string;
  appVersion: string;
  schemaVersion: string;

  societyId: string;
  societyName: string;
  registrationNo: string;
  financialYear: string;

  createdAt: string;
  createdBy: BackupActor;
  trigger: BackupTrigger;

  encryption: EncryptionParams | null;

  entities: EntityManifest[];
  registryFingerprint: string;

  totals: { entityCount: number; rowCount: number; bytes: number };

  /** SHA-256 over the canonicalized manifest with this field removed. */
  manifestHash: string;
}

// ─── Paths ───────────────────────────────────────────────────────────────────────────

/**
 * PURE — where an entity's rows live inside the archive.
 *
 * The directory IS the custody class, visible to anyone who unzips the file:
 *
 *   data/       full     authoritative rows, restored verbatim
 *   derived/    replay   regenerated on restore, kept only as a checksum
 *   evidence/   sidecar  exported for custody, NEVER written back
 *
 * `exclude` entities have no path because they are never written. Asking for one is a
 * programming error, not a runtime condition.
 */
export function entityPath(key: string, policy: BackupPolicy): string {
  switch (policy) {
    case 'full': return `data/${key}.ndjson`;
    case 'replay': return `derived/${key}.ndjson`;
    case 'sidecar': return `evidence/${key}.ndjson`;
    case 'exclude': throw new Error(`"${key}" is excluded from backups and has no path`);
    default:
      // TypeScript says this is unreachable. It is reachable the day someone adds a fifth
      // policy, or hand-writes a descriptor. Without this, the entity would silently get
      // `undefined` as its path and disappear from the archive — the exact class of bug
      // this module exists to prevent (gap EXP-02). Fail closed.
      throw new Error(`"${key}" has an unrecognised backup policy "${policy}"`);
  }
}

/** PURE — the digests a verifier must check, derived from the manifest. */
export function fileDigests(manifest: BackupManifest): FileDigest[] {
  return manifest.entities.map(e => ({
    path: entityPath(e.key, e.policy),
    sha256: e.sha256,
    bytes: e.bytes,
  }));
}

// ─── Registry fingerprint ────────────────────────────────────────────────────────────

/**
 * Hash of the registry SHAPE — which entities exist, on which tables, under which custody
 * policy, with which columns. Deliberately excludes labels, PII classes and roles: those
 * change without affecting whether an archive can be placed back into the database.
 */
export async function registryFingerprint(entities: readonly EntityDescriptor[]): Promise<string> {
  const shape = [...entities]
    .map(e => ({
      key: e.key,
      table: e.table,
      policy: e.backupPolicy,
      columns: e.columns.map(c => c.key).sort(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return sha256Canonical(shape);
}

// ─── Build & verify ──────────────────────────────────────────────────────────────────

export interface ManifestInput {
  appVersion: string;
  schemaVersion: string;
  societyId: string;
  societyName: string;
  registrationNo: string;
  financialYear: string;
  createdAt: string;
  createdBy: BackupActor;
  trigger: BackupTrigger;
  encryption?: EncryptionParams | null;
  entities: EntityManifest[];
  registryFingerprint: string;
}

/** Property names that must never appear inside `encryption`. */
const FORBIDDEN_ENCRYPTION_KEYS = ['key', 'password', 'passphrase', 'secret', 'derivedKey'];

/**
 * Build a manifest and stamp its hash.
 *
 * `createdAt` is an input, not `new Date()`, so the manifest is deterministic under test
 * and so a server-side writer can stamp the time it actually started.
 */
export async function buildManifest(input: ManifestInput): Promise<BackupManifest> {
  if (input.encryption) {
    for (const forbidden of FORBIDDEN_ENCRYPTION_KEYS) {
      if (forbidden in (input.encryption as unknown as Record<string, unknown>)) {
        throw new Error(`encryption params must never carry "${forbidden}" — the key would ship with the archive`);
      }
    }
  }

  const totals = {
    entityCount: input.entities.length,
    rowCount: input.entities.reduce((sum, e) => sum + e.rowCount, 0),
    bytes: input.entities.reduce((sum, e) => sum + e.bytes, 0),
  };

  const unsigned: Omit<BackupManifest, 'manifestHash'> = {
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: input.appVersion,
    schemaVersion: input.schemaVersion,
    societyId: input.societyId,
    societyName: input.societyName,
    registrationNo: input.registrationNo,
    financialYear: input.financialYear,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    trigger: input.trigger,
    encryption: input.encryption ?? null,
    entities: input.entities,
    registryFingerprint: input.registryFingerprint,
    totals,
  };

  return { ...unsigned, manifestHash: await sha256Canonical(unsigned) };
}

/**
 * PURE-ish — recompute the manifest hash over everything except the hash itself.
 *
 * Removing the field rather than blanking it matters: `manifestHash: ''` and a missing
 * key canonicalize differently, so a manifest hashed one way would never verify the other.
 */
export async function computeManifestHash(manifest: BackupManifest): Promise<string> {
  const { manifestHash: _ignored, ...rest } = manifest;
  void _ignored;
  return sha256Canonical(rest);
}

export interface ManifestVerdict {
  ok: boolean;
  /** Present when `ok` is false. Safe to show the user; names no data. */
  reason?: string;
}

/**
 * Verify the manifest against itself.
 *
 * This proves nobody edited the list of per-file hashes. It says NOTHING about whether
 * the files match those hashes — that is `verifyFiles`. Both must pass. A caller that
 * checks only this one has verified that a liar is internally consistent.
 */
export async function verifyManifest(manifest: BackupManifest): Promise<ManifestVerdict> {
  if (!manifest || typeof manifest.manifestHash !== 'string' || manifest.manifestHash.length === 0) {
    return { ok: false, reason: 'manifest carries no hash' };
  }
  const fmt = classifyFormatVersion(manifest.formatVersion);
  if (!fmt.ok) {
    return { ok: false, reason: fmt.reason };
  }

  const expected = await computeManifestHash(manifest);
  if (!digestsEqual(expected, manifest.manifestHash)) {
    return { ok: false, reason: 'manifest hash does not match its contents — the file has been altered' };
  }

  const totals = {
    entityCount: manifest.entities.length,
    rowCount: manifest.entities.reduce((sum, e) => sum + e.rowCount, 0),
    bytes: manifest.entities.reduce((sum, e) => sum + e.bytes, 0),
  };
  if (totals.entityCount !== manifest.totals.entityCount
    || totals.rowCount !== manifest.totals.rowCount
    || totals.bytes !== manifest.totals.bytes) {
    return { ok: false, reason: 'manifest totals disagree with its own entity list' };
  }

  return { ok: true };
}

/**
 * Compare the archive's registry fingerprint with this build's.
 *
 * A mismatch is not fatal by itself — an archive may legitimately be older. What matters
 * is which entities this build cannot place. That list is what the restore shows the
 * operator (blueprint §6.2, gate 4).
 */
export function unplaceableEntities(
  manifest: BackupManifest,
  entities: readonly EntityDescriptor[],
): string[] {
  const known = new Set(entities.map(e => e.key));
  return manifest.entities.map(e => e.key).filter(k => !known.has(k)).sort();
}
