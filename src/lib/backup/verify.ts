/**
 * `.slbak` verifier (T-25 / gap EXP-04).
 *
 * PURE-ish: it takes bytes and returns a report. No Supabase, no DOM, no network, no
 * society. That is the point — an auditor who has been handed an archive must be able to
 * check it without an account, and a restore must be able to check it before it parses a
 * single row.
 *
 * FOUR QUESTIONS, ASKED IN ORDER, EACH ABLE TO STOP THE REST:
 *
 *   1. Is this a ZIP with a manifest at all?
 *   2. Does the manifest agree with itself?          (manifestHash)
 *   3. Does every file match the digest recorded?    (per-file sha256)
 *   4. Does the archive contain ONLY what the manifest lists?
 *
 * (4) is the one a naive verifier forgets. Steps 2 and 3 prove that everything the
 * manifest names is intact. They say nothing about a file the manifest does NOT name.
 * Someone can drop `data/members.ndjson.bak`, or a second copy of the vouchers, into the
 * archive and both checks still pass. A restore walking the zip rather than the manifest
 * would then import it. So an unlisted file is a verification failure, not a curiosity.
 *
 * The registry comparison is OPTIONAL. Passing the current REGISTRY lets the verifier say
 * "this build cannot place `dairy_settlement`" (gap EXP-02). Omitting it — as a bare
 * offline verifier does — still answers questions 1 to 4.
 */
import { unzipSync, strFromU8 } from 'fflate';
import type { EntityDescriptor } from '../export/registry.types';
import { isEncryptedArchive, readContainerHeader, type ContainerHeader } from './crypto';
import { verifyFiles } from './integrity';
import {
  verifyManifest, fileDigests, unplaceableEntities, registryFingerprint,
  type BackupManifest,
} from './manifest';
import { MANIFEST_PATH } from './writer';

export type EntityStatus = 'ok' | 'missing' | 'hash-mismatch' | 'size-mismatch';

export interface EntityVerification {
  key: string;
  path: string;
  policy: string;
  rowCount: number;
  bytes: number;
  status: EntityStatus;
}

export interface VerifyReport {
  ok: boolean;
  /** Null when the archive could not be opened or carries no readable manifest. */
  manifest: BackupManifest | null;
  /** Every problem found, in the order the checks run. Never just the first. */
  problems: string[];
  /** Per-entity result. Empty when the manifest could not be read. */
  entities: EntityVerification[];
  /** Files present in the archive but absent from the manifest. Always a problem. */
  unlistedFiles: string[];
  /** Entities this build has no declaration for. Only computed when a registry is given. */
  unplaceable: string[];
  /** null when no registry was supplied. */
  fingerprintMatches: boolean | null;
  /**
   * True when the file is an encrypted container. Its contents cannot be verified without
   * the passphrase — but its header identifies the society, so the caller can say WHICH
   * archive it is holding rather than "unreadable file".
   */
  encrypted: boolean;
  /** The cleartext container header, when the file is encrypted. Unauthenticated until decryption. */
  encryptedHeader: ContainerHeader | null;
}

export interface VerifyOptions {
  /** The current registry. Supply it to detect archives this build cannot place. */
  entities?: readonly EntityDescriptor[];
}

const emptyReport = (problem: string): VerifyReport => ({
  ok: false,
  manifest: null,
  problems: [problem],
  entities: [],
  unlistedFiles: [],
  unplaceable: [],
  fingerprintMatches: null,
  encrypted: false,
  encryptedHeader: null,
});

/**
 * Verify an archive. Never throws: a corrupt file is an answer, not an exception.
 */
export async function verifyArchive(archive: Uint8Array, options: VerifyOptions = {}): Promise<VerifyReport> {
  // 0. Is it encrypted? Checked BEFORE unzip, or an encrypted archive would be reported as
  //    "not a readable archive" — sending the holder of a perfectly good file to look for a
  //    corrupt one. The header identifies the society without the passphrase, so we can say
  //    exactly which archive this is and what it needs.
  if (isEncryptedArchive(archive)) {
    let header: ContainerHeader | null = null;
    try { header = readContainerHeader(archive); } catch { /* a malformed header is still encrypted */ }
    return {
      ok: false,
      manifest: null,
      problems: ['this archive is encrypted — decrypt it with its passphrase before verifying'],
      entities: [],
      unlistedFiles: [],
      unplaceable: [],
      fingerprintMatches: null,
      encrypted: true,
      encryptedHeader: header,
    };
  }

  // 1. Is it a ZIP?
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(archive);
  } catch (e) {
    return emptyReport(`not a readable archive (${e instanceof Error ? e.message : 'unknown error'})`);
  }

  const manifestBytes = files[MANIFEST_PATH];
  if (!manifestBytes) return emptyReport(`the archive has no ${MANIFEST_PATH}`);

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes));
  } catch {
    return emptyReport(`${MANIFEST_PATH} is not valid JSON`);
  }
  if (!manifest || !Array.isArray(manifest.entities)) {
    return emptyReport(`${MANIFEST_PATH} does not describe an archive`);
  }

  const problems: string[] = [];

  // 2. Does the manifest agree with itself?
  const verdict = await verifyManifest(manifest);
  if (!verdict.ok) problems.push(verdict.reason ?? 'manifest failed verification');

  // 3. Does every listed file match its digest?
  const digests = fileDigests(manifest);
  const failures = await verifyFiles(digests, (path) => files[path]);
  const failureByPath = new Map(failures.map(f => [f.path, f]));

  const entities: EntityVerification[] = manifest.entities.map((e, i) => {
    const path = digests[i].path;
    const failure = failureByPath.get(path);
    return {
      key: e.key,
      path,
      policy: e.policy,
      rowCount: e.rowCount,
      bytes: e.bytes,
      status: (failure?.reason ?? 'ok') as EntityStatus,
    };
  });
  for (const f of failures) problems.push(`${f.path}: ${f.reason}`);

  // 4. Does the archive contain ONLY what the manifest lists?
  const listed = new Set<string>([MANIFEST_PATH, ...digests.map(d => d.path)]);
  const unlistedFiles = Object.keys(files).filter(p => !listed.has(p)).sort();
  for (const path of unlistedFiles) {
    problems.push(`${path}: present in the archive but not listed in the manifest`);
  }

  // 5. Optional: can this build place every entity?
  let unplaceable: string[] = [];
  let fingerprintMatches: boolean | null = null;
  if (options.entities) {
    unplaceable = unplaceableEntities(manifest, options.entities);
    for (const key of unplaceable) {
      problems.push(`"${key}" is in the archive but this build has no declaration for it`);
    }
    fingerprintMatches = (await registryFingerprint(options.entities)) === manifest.registryFingerprint;
  }

  return {
    // A fingerprint mismatch alone is NOT a failure: an older archive is still valid, and
    // `unplaceable` already names what actually cannot be restored. Failing on it would
    // reject every archive written before the next entity is added.
    ok: problems.length === 0,
    manifest,
    problems,
    entities,
    unlistedFiles,
    unplaceable,
    fingerprintMatches,
    encrypted: false,
    encryptedHeader: null,
  };
}

/** PURE — a one-line summary an auditor can read without unfolding the report. */
export function summarizeVerification(report: VerifyReport, hi = true): string {
  if (report.encrypted) {
    const who = report.encryptedHeader?.societyName;
    return hi
      ? `यह आर्काइव एन्क्रिप्टेड है${who ? ` (${who})` : ''} — पहले पासवर्ड से खोलें।`
      : `This archive is encrypted${who ? ` (${who})` : ''} — decrypt it first.`;
  }
  if (!report.manifest) {
    return hi ? 'फ़ाइल पढ़ी नहीं जा सकी।' : 'The file could not be read.';
  }
  const { entityCount, rowCount } = report.manifest.totals;
  if (report.ok) {
    return hi
      ? `सत्यापित — ${entityCount} सूचियाँ, ${rowCount.toLocaleString('en-IN')} पंक्तियाँ, कोई छेड़छाड़ नहीं।`
      : `Verified — ${entityCount} collections, ${rowCount.toLocaleString('en-IN')} rows, no tampering detected.`;
  }
  return hi
    ? `सत्यापन विफल — ${report.problems.length} समस्याएँ मिलीं।`
    : `Verification failed — ${report.problems.length} problem(s) found.`;
}
