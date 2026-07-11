/**
 * Live restore entry point (T-33 wiring / gap EXP-01).
 *
 * The ONE place the restore commit meets the real database. It exists so that RestoreCenter
 * can trigger a restore WITHOUT importing the Supabase client or holding a raw write call:
 * the page passes data and an audit context; this wires the real writer and the real trail
 * recorder into the saga. The dangerous machinery — the society-scoped writer, the replay
 * assertion, the mandatory pre-restore backup gate — all lives behind here, tested.
 *
 * `client` and `recordAttempt` are INJECTABLE (defaulting to the real Supabase-backed ones)
 * for exactly one reason: so the most destructive operation in the product can be exercised
 * end-to-end — plan, write, replay, record — against spies, in a test and in the browser,
 * without a live session and without touching a real society. The page uses the defaults.
 *
 * This function adds NO new safety of its own. Every gate is the saga's (FY-lock, dry-run,
 * mandatory backup, replay assertion) or the writer's (society scoping). It only wires them.
 */
import { supabase } from '@/lib/supabase';
import type { Voucher } from '@/types';
import type { AuditContext } from '@/lib/auditLog';
import { REGISTRY } from '../export/registry';
import type { Row } from './naturalKeys';
import type { RestoreMode } from './diff';
import { commitRestore, type RestoreOutcome } from './commit';
import { makeRestoreWriter, type WriteClient } from './rowWriter';
import { recordRestoreAttempt, type PreRestoreBackup } from './trail';

export interface CommitRestoreLiveInput {
  mode: RestoreMode;
  fyLocked: boolean;
  /** Archive rows per entity key (full entities), from loadArchive. */
  archiveRows: Record<string, readonly Row[]>;
  /** The society's current rows, from the dry run — reused so the writer and preview agree. */
  currentRows: Record<string, Row[]>;
  /** The archive's recorded voucher_entries, for the replay assertion (loadArchive.derivedEntries). */
  archivedEntries: readonly Row[];
  societyId: string;
  sourceManifestHash: string;
  /** The freshly-created safety backup. The saga refuses Merge/Replace without it. */
  preRestoreBackup?: PreRestoreBackup;
  /** Actor + society, for the trail row. */
  auditContext: AuditContext;
  onProgress?: (done: number, total: number, entityKey: string) => void;

  /** Injected in tests / the browser probe. Production uses the real Supabase client. */
  client?: WriteClient;
  /** Injected in tests. Production records into audit_log. */
  recordAttempt?: (record: Parameters<typeof recordRestoreAttempt>[0]) => Promise<void>;
}

/**
 * Run a real restore. Returns an outcome; never throws (the saga catches).
 *
 * The archived vouchers drive the replay assertion; they are cast from the archive rows.
 */
export async function commitRestoreLive(input: CommitRestoreLiveInput): Promise<RestoreOutcome> {
  const client = input.client ?? (supabase as unknown as WriteClient);
  const record = input.recordAttempt ?? ((r) => recordRestoreAttempt(r, input.auditContext));

  return commitRestore({
    entities: REGISTRY,
    mode: input.mode,
    fyLocked: input.fyLocked,
    archiveRows: input.archiveRows,
    currentRows: input.currentRows,
    vouchers: (input.archiveRows['voucher'] ?? []) as unknown as Voucher[],
    archivedEntries: input.archivedEntries,
    societyId: input.societyId,
    sourceManifestHash: input.sourceManifestHash,
    preRestoreBackup: input.preRestoreBackup,
    applyWrites: makeRestoreWriter(client, input.societyId, input.currentRows),
    recordAttempt: record,
    onProgress: input.onProgress,
  });
}
