/**
 * The backup runner (T-24b).
 *
 * plan → fetch → build → RECORD → deliver. Same order, same reason, as the export runner:
 * a full-society archive is the largest custody action this app performs, and an untraced
 * one is worse than a failed one (gap EXP-05).
 *
 * `deliver` IS INJECTED, so this module stays free of the DOM and the ordering stays
 * testable. The page passes `triggerDownload`; the test passes a spy and asserts it is
 * never called when the audit write fails. Putting the download inline would make the
 * guarantee unobservable — and a guarantee nobody can observe is a comment, not a
 * safeguard.
 *
 * IT RETURNS AN OUTCOME, IT DOES NOT THROW. Each failure needs its own sentence:
 *
 *   incomplete    a table was truncated or unreadable. NO PARTIAL ARCHIVE was written.
 *                 This is the safeguard, not a bug — say which table.
 *   audit-failed  the trail could not be written, so no bytes left.
 *   failed        anything else.
 *
 * None of them may be reported as "backed up 0 rows".
 */
import type { EntityDescriptor } from '../export/registry.types';
import type { AuditContext } from '@/lib/auditLog';
import { AuditWriteError } from '@/lib/auditLog';
import { recordExport } from '../export/audit';
import { sha256Bytes } from './integrity';
import { buildArchive, archiveFileName, BackupIncompleteError, type ArchivePlan, type FetchRows } from './writer';
import { encryptArchive } from './crypto';
import { BACKUP_FORMAT_VERSION, type BackupManifest, type BackupTrigger, type BackupActor } from './manifest';

export type BackupOutcome =
  | { status: 'created'; manifest: BackupManifest; plan: ArchivePlan; filename: string; bytes: number; encrypted: boolean }
  | { status: 'incomplete'; entityKey: string; message: string }
  | { status: 'audit-failed'; message: string }
  | { status: 'failed'; message: string };

/** Hands the finished archive to the user. The page passes exportUtils' triggerDownload. */
export type Deliver = (archive: Uint8Array, filename: string) => void;

export interface RunBackupInput {
  entities: readonly EntityDescriptor[];
  societyId: string;
  fetchRows: FetchRows;
  deliver: Deliver;

  appVersion: string;
  schemaVersion: string;
  societyName: string;
  registrationNo: string;
  financialYear: string;
  createdAt: string;
  createdBy: BackupActor;
  trigger: BackupTrigger;

  /** Actor + society, for the audit row. */
  auditContext: AuditContext;

  onProgress?: (done: number, total: number, entityKey: string) => void;

  /**
   * When supplied, the archive is encrypted (AES-256-GCM) before it is hashed, recorded
   * and delivered. There is NO ESCROW (decision D2): lose this and the archive is
   * unrecoverable, by anyone, forever.
   */
  passphrase?: string;

  /** Injected in tests. */
  record?: typeof recordExport;
}

export async function runBackup(input: RunBackupInput): Promise<BackupOutcome> {
  const record = input.record ?? recordExport;

  let archive: Uint8Array;
  let manifest: BackupManifest;
  let plan: ArchivePlan;

  try {
    ({ archive, manifest, plan } = await buildArchive({
      entities: input.entities,
      societyId: input.societyId,
      fetchRows: input.fetchRows,
      onProgress: input.onProgress,
      meta: {
        appVersion: input.appVersion,
        schemaVersion: input.schemaVersion,
        societyId: input.societyId,
        societyName: input.societyName,
        registrationNo: input.registrationNo,
        financialYear: input.financialYear,
        createdAt: input.createdAt,
        createdBy: input.createdBy,
        trigger: input.trigger,
      },
    }));
  } catch (e) {
    if (e instanceof BackupIncompleteError) {
      return { status: 'incomplete', entityKey: e.entityKey, message: e.message };
    }
    return { status: 'failed', message: e instanceof Error ? e.message : String(e) };
  }

  const filename = archiveFileName(input.societyName, input.financialYear, input.createdAt);

  // Encrypt BEFORE hashing and recording. The audit row must describe the bytes the user
  // actually received; hashing the plaintext zip would record a digest of a file that
  // never existed outside this function.
  let delivered = archive;
  if (input.passphrase) {
    try {
      delivered = await encryptArchive(archive, input.passphrase, {
        formatVersion: BACKUP_FORMAT_VERSION,
        societyName: input.societyName,
        registrationNo: input.registrationNo,
        financialYear: input.financialYear,
        createdAt: input.createdAt,
        trigger: input.trigger,
      });
    } catch (e) {
      return { status: 'failed', message: e instanceof Error ? e.message : String(e) };
    }
  }

  // STEP 1 — the trail. Awaited. Throws on failure. Nothing below runs if it does.
  // The artifact hash is recorded here, so the audit row can later prove which bytes left.
  try {
    await record(
      {
        entities: plan.written.map(w => w.entity.key),
        format: 'zip',
        mode: 'full',
        rowCount: manifest.totals.rowCount,
        artifactSha256: await sha256Bytes(delivered),
        byteSize: delivered.length,
        filters: {
          trigger: input.trigger,
          skipped: plan.skipped.map(s => s.key),
          encrypted: !!input.passphrase,   // never the passphrase itself
        },
      },
      input.auditContext,
    );
  } catch (e) {
    if (e instanceof AuditWriteError) return { status: 'audit-failed', message: e.message };
    return { status: 'failed', message: e instanceof Error ? e.message : String(e) };
  }

  // STEP 2 — only now do bytes leave.
  input.deliver(delivered, filename);

  return { status: 'created', manifest, plan, filename, bytes: delivered.length, encrypted: !!input.passphrase };
}
