/**
 * `.slbak` archive writer (T-24 / gaps EXP-01, EXP-02).
 *
 * Turns the 93 declared collections into a verifiable archive:
 *
 *   manifest.json          the spine — hashed, lists every file and its digest
 *   data/<key>.ndjson      `full`    authoritative rows, restored verbatim
 *   derived/<key>.ndjson   `replay`  regenerated on restore, kept as a checksum
 *   evidence/<key>.ndjson  `sidecar` exported for custody, never written back
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * TWO REFUSALS, BOTH LOUD.
 *
 * 1. NOTHING IS SILENTLY MISSING (blueprint P7, gap EXP-02). `planArchive` accounts for
 *    EVERY registry entity — each is either written or skipped with a written reason —
 *    and throws if the two lists do not add up. The old backup covered 16 of 93
 *    collections and said nothing; that cannot happen here by construction.
 *
 * 2. A TRUNCATED OR UNREADABLE TABLE ABORTS THE WHOLE ARCHIVE. There is no partial
 *    backup. A file missing a third of the vouchers, that verifies cleanly and restores
 *    without complaint, is worse than no file: it ends the search for the real data.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * MEMORY, HONESTLY. Rows are fetched, serialized and hashed one entity at a time, so all
 * 93 tables are never resident together. But `zipSync` assembles the finished archive in
 * memory, because a browser download needs a Blob. This is NOT a streaming writer in the
 * strict sense, and calling it one would be a lie. Real streaming needs either the server
 * tier (decision D1) or the File System Access API. For an ordinary society the archive
 * is a few MB; for a large one, the row-count preflight (T-17) is what stands in the way.
 *
 * fflate is declared as a direct dependency even though jspdf already pulls it in.
 * Depending on a transitive package means a jspdf upgrade can break backups.
 */
import { zipSync, strToU8 } from 'fflate';
import type { EntityDescriptor } from '../export/registry.types';
import { sha256Bytes } from './integrity';
import {
  buildManifest, entityPath, registryFingerprint,
  type BackupManifest, type EntityManifest, type ManifestInput,
} from './manifest';
import { toNdjson, type Row } from './ndjson';

/** Where the manifest lives inside the archive. Not itself hashed — it holds the hashes. */
export const MANIFEST_PATH = 'manifest.json';

/** The earliest timestamp the ZIP format can represent. Used to make archives reproducible. */
const ZIP_EPOCH = Date.UTC(1980, 0, 1);

export type SkipReason = 'exclude' | 'global';

export interface ArchivePlan {
  written: { entity: EntityDescriptor; path: string }[];
  skipped: { key: string; reason: SkipReason }[];
}

export class BackupIncompleteError extends Error {
  /** Which entity aborted the archive. */
  readonly entityKey: string;

  // Not a parameter property: Node's type stripping is strip-only, and scripts/ imports
  // this module directly. See the same note in ndjson.ts.
  constructor(entityKey: string, message: string) {
    super(`backup aborted at "${entityKey}": ${message}`);
    this.name = 'BackupIncompleteError';
    this.entityKey = entityKey;
  }
}

/**
 * PURE — decide what goes in and what stays out, and prove nothing fell between.
 *
 * `exclude`  secrets, credentials, entitlement, cross-tenant registries
 * `global`   shared reference data that is not one society's to carry
 *
 * Everything else is written. If `written.length + skipped.length` ever disagrees with
 * the registry size, an entity has been silently dropped and we refuse to build.
 */
export function planArchive(entities: readonly EntityDescriptor[]): ArchivePlan {
  const written: ArchivePlan['written'] = [];
  const skipped: ArchivePlan['skipped'] = [];

  for (const entity of entities) {
    if (entity.backupPolicy === 'exclude') { skipped.push({ key: entity.key, reason: 'exclude' }); continue; }
    if (entity.scope === 'global') { skipped.push({ key: entity.key, reason: 'global' }); continue; }
    written.push({ entity, path: entityPath(entity.key, entity.backupPolicy) });
  }

  // Defensive, and honestly: unreachable while every entity is either skipped or written.
  // Kept because the classification above is exactly the code most likely to grow a third
  // branch, and a branch that falls through would drop entities silently. No test can
  // trigger it today, and pretending otherwise would be worse than saying so.
  if (written.length + skipped.length !== entities.length) {
    throw new Error(
      `archive plan lost entities: ${entities.length} declared, ` +
      `${written.length} written + ${skipped.length} skipped`,
    );
  }

  // THIS one can actually happen: two entities on the same key, or a future path scheme
  // that collides. The second file would silently overwrite the first inside the zip, and
  // one whole table would vanish from a backup that verifies cleanly.
  const seen = new Set<string>();
  for (const { path } of written) {
    if (seen.has(path)) throw new Error(`two entities map to the same archive path "${path}"`);
    seen.add(path);
  }

  return { written, skipped };
}

/** What the writer needs to read one entity. Matches source.ts's fetchEntityRows. */
export type FetchRows = (
  entity: EntityDescriptor,
  societyId: string,
) => Promise<{ rows: Row[]; truncated: boolean; fetched: number; error: string | null }>;

export interface ArchiveInput {
  entities: readonly EntityDescriptor[];
  societyId: string;
  fetchRows: FetchRows;
  /** Everything the manifest needs except `entities` and `registryFingerprint`. */
  meta: Omit<ManifestInput, 'entities' | 'registryFingerprint'>;
  /** Reported after each entity, so a UI can show progress on a long backup. */
  onProgress?: (done: number, total: number, entityKey: string) => void;
}

export interface ArchiveResult {
  archive: Uint8Array;
  manifest: BackupManifest;
  plan: ArchivePlan;
}

/**
 * Build the archive. Throws BackupIncompleteError rather than producing a partial file.
 */
export async function buildArchive(input: ArchiveInput): Promise<ArchiveResult> {
  const plan = planArchive(input.entities);
  const files: Record<string, Uint8Array> = {};
  const entityManifests: EntityManifest[] = [];

  let done = 0;
  for (const { entity, path } of plan.written) {
    const { rows, truncated, error } = await input.fetchRows(entity, input.societyId);

    // No partial backups. Ever.
    if (error) throw new BackupIncompleteError(entity.key, `could not be read (${error})`);
    if (truncated) throw new BackupIncompleteError(entity.key, 'holds more rows than could be read in one pass');

    const text = toNdjson(rows);
    const bytes = strToU8(text);
    files[path] = bytes;

    entityManifests.push({
      key: entity.key,
      table: entity.table,
      policy: entity.backupPolicy,
      rowCount: rows.length,
      bytes: bytes.length,
      sha256: await sha256Bytes(bytes),
      columns: entity.columns.map(c => c.key),
    });

    // `rows` and `text` fall out of scope here — one entity resident at a time.
    input.onProgress?.(++done, plan.written.length, entity.key);
  }

  const manifest = await buildManifest({
    ...input.meta,
    entities: entityManifests,
    registryFingerprint: await registryFingerprint(input.entities),
  });

  files[MANIFEST_PATH] = strToU8(JSON.stringify(manifest, null, 2));

  // A FIXED mtime: two backups of identical data produce byte-identical archives. A
  // wall-clock timestamp inside the zip would make every archive unique for no reason,
  // and the creation time is already recorded — and hashed — inside the manifest.
  //
  // It is 1980-01-01, not the epoch: the ZIP format cannot represent a date before 1980,
  // and fflate rightly refuses one.
  const archive = zipSync(files, { level: 6, mtime: ZIP_EPOCH });

  return { archive, manifest, plan };
}

/** PURE — the filename a society sees. Sortable, and it names the society and the FY. */
export function archiveFileName(societyName: string, financialYear: string, createdAt: string): string {
  const slug = societyName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'society';
  const stamp = createdAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `${slug}-FY${financialYear}-${stamp}.slbak`;
}
