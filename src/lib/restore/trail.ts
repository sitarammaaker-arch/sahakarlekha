/**
 * Restore trail (T-34 / gap EXP-05).
 *
 * Every restore ATTEMPT leaves a record — the ones that committed, and the ones that were
 * refused. A backup that fails to restore is the single most important thing this workstream
 * can surface, and it is invisible unless the failed attempt is written down.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * DELIBERATE DEVIATION: no `restore_runs` table. The trail is `audit_log`.
 *
 * ROADMAP T-34 creates a `restore_runs` table. It should not exist yet, for the same reason
 * `export_jobs` does not (see lib/export/jobs.ts): a table lands when its columns MEAN
 * something and someone reads it, not before. Its own roadmap note says restore_runs "lands
 * with T-27, alongside backup_runs," i.e. with the server tier (decision D1), which is
 * DEFERRED. Adding it now would cost a registry declaration and a drift-gate entry for a
 * table nobody queries, and would re-open a decision already made.
 *
 * `audit_log` already carries who / when / society, is WORM (INSERT + SELECT only), and
 * already has a `restore` action. A restore attempt is precisely a custody event: someone
 * tried to rewrite the books, and here is what happened. That is what audit_log is for. The
 * structured detail — mode, source manifest, replay result, outcome, the pre-restore backup
 * to roll back to — rides in the row's `after` payload. When restore_runs lands with the
 * server tier, this reader points at it instead; nothing else changes.
 *
 * ISOLATION WARNING. audit_log's SELECT policy is `using (true)` — it does NOT isolate
 * tenants. The `.eq('society_id', …)` filter in listRestoreHistory is the ONLY thing
 * scoping the read to one society. Do not remove it.
 *
 * NEVER WRITE A TEST ROW TO audit_log. It is WORM: an inserted row can never be removed.
 * Every test in this module uses the PURE builders and shapers and a spy recorder — the
 * real `recordRestoreAttempt` is never exercised against the real table.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from '@/lib/supabase';
import { logAuditBlocking, type AuditContext } from '@/lib/auditLog';
import type { RestoreMode } from './diff';

/** Identity of the backup an operator could roll back to. Recorded, never the bytes. */
export interface PreRestoreBackup {
  filename: string;
  bytes: number;
  createdAt: string;
  manifestHash: string;
}

/** Whether the replay assertion ran, and what it decided. */
export type ReplayResult = 'passed' | 'failed' | 'not-run';

/**
 * The structured record of one restore attempt. Stored in an audit_log row's `after`.
 * Every field is something an auditor asks: which backup, what mode, did the ledger
 * reproduce, what happened, and what could I roll back to.
 */
export interface RestoreRunRecord {
  sourceManifestHash: string;
  mode: RestoreMode;
  /** Mirrors RestoreOutcome['status']. Kept as a string so the reader tolerates old rows. */
  outcome: string;
  replay: ReplayResult;
  /** Non-zero only when replay failed: how many vouchers did not reproduce the backup. */
  disagreeingVouchers: number;
  entitiesWritten: number;
  rowsWritten: number;
  entriesReplayed: number;
  /** The backup to roll back to. Null for a Fresh restore, which has nothing to undo. */
  preRestoreBackup: PreRestoreBackup | null;
  message: string | null;
}

/** One restore attempt, shaped for display. */
export interface RestoreHistoryEntry {
  id: string;
  at: string;
  actorName: string | null;
  actorRole: string | null;
  sourceManifestHash: string;
  mode: string;
  outcome: string;
  replay: ReplayResult;
  disagreeingVouchers: number;
  rowsWritten: number;
  preRestoreBackupFile: string | null;
  message: string | null;
}

/** The raw audit_log row, as Supabase returns it. */
export interface AuditLogRow {
  id?: string;
  created_at?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  after?: unknown;
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * PURE — was this attempt a clean success?
 *
 * The ONLY outcome that means the books were rewritten and the trail recorded is
 * 'committed'. Everything else — including 'partial' and 'audit-failed' — is a state a
 * human must look at. This is the flag the health card and the history list key on, so it
 * is computed from the recorded outcome, never guessed.
 */
export function wasClean(outcome: string): boolean {
  return outcome === 'committed';
}

/**
 * PURE — shape one audit row into a history entry.
 *
 * Defensive on every field: these rows are WORM and an old one may predate a field. A
 * history page that throws on a two-year-old row is one nobody can audit with.
 */
export function toRestoreHistoryEntry(row: AuditLogRow): RestoreHistoryEntry {
  const after = asRecord(row.after);
  const backup = asRecord(after.preRestoreBackup);
  const replay = after.replay;
  return {
    id: String(row.id ?? ''),
    at: String(row.created_at ?? ''),
    actorName: row.actor_name ?? null,
    actorRole: row.actor_role ?? null,
    sourceManifestHash: typeof after.sourceManifestHash === 'string' ? after.sourceManifestHash : '',
    mode: typeof after.mode === 'string' ? after.mode : 'unknown',
    outcome: typeof after.outcome === 'string' ? after.outcome : 'unknown',
    replay: replay === 'passed' || replay === 'failed' ? replay : 'not-run',
    disagreeingVouchers: typeof after.disagreeingVouchers === 'number' ? after.disagreeingVouchers : 0,
    rowsWritten: typeof after.rowsWritten === 'number' ? after.rowsWritten : 0,
    preRestoreBackupFile: typeof backup.filename === 'string' ? backup.filename : null,
    message: typeof after.message === 'string' ? after.message : null,
  };
}

/** PURE — one line for the history list. Hindi first (RULE 7). */
export function describeRestoreEntry(entry: RestoreHistoryEntry, hi = true): string {
  const verdicts: Record<string, [string, string]> = {
    committed: ['पूरा हुआ', 'committed'],
    'replay-failed': ['बैकअप मेल नहीं खाया', 'backup did not reproduce'],
    partial: ['बीच में रुका', 'stopped partway'],
    blocked: ['dry run में रुका', 'blocked at dry run'],
    'no-backup': ['बैकअप बिना रुका', 'no pre-restore backup'],
    'fy-locked': ['FY लॉक', 'FY locked'],
    'audit-failed': ['ट्रेल नहीं लिखा', 'trail not written'],
    failed: ['विफल', 'failed'],
  };
  const [hiV, enV] = verdicts[entry.outcome] ?? [entry.outcome, entry.outcome];
  return `${entry.mode.toUpperCase()} · ${hi ? hiV : enV}`;
}

/**
 * Record ONE restore attempt into the trail. Awaited; THROWS on failure.
 *
 * `entityId` is the source archive's manifest hash: it ties the attempt to the exact bytes
 * that were restored. The record is the audit row's `after`. Because audit_log is the trail,
 * this is the same blocking-write contract as recordExport — the caller must treat a throw
 * as "the attempt was not recorded".
 */
export async function recordRestoreAttempt(record: RestoreRunRecord, ctx: AuditContext): Promise<void> {
  await logAuditBlocking(
    {
      entityType: 'restore',
      entityId: record.sourceManifestHash || 'unknown',
      action: 'restore',
      after: record,
      reason: record.outcome,
    },
    ctx,
  );
}

/**
 * Read the restore history for one society, newest first.
 *
 * The society_id filter is the only tenant isolation on audit_log (see the warning above).
 * Returns `{ entries, error }` rather than throwing: an unreadable trail must not take the
 * page down, and must not silently render as "no restores ever attempted" either.
 */
export async function listRestoreHistory(
  societyId: string,
  limit = 100,
): Promise<{ entries: RestoreHistoryEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, created_at, actor_name, actor_role, after')
    .eq('society_id', societyId)      // the only tenant isolation on this table
    .eq('action', 'restore')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { entries: [], error: error.message };
  return { entries: (data ?? []).map(toRestoreHistoryEntry), error: null };
}
