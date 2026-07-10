/**
 * Restore commit saga (T-33 / gap EXP-03).
 *
 * This is the one function in the product that writes a whole society's books at once. It
 * is built to refuse more readily than it proceeds.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THERE IS NO DATABASE TRANSACTION HERE, AND PRETENDING OTHERWISE WOULD BE THE BUG
 *
 * A browser cannot open a Postgres transaction across dozens of tables and hundreds of
 * `.insert()` calls. So a restore is NOT atomic, and this module does not claim it is. If
 * writing fails at table 40 of 84, tables 1–39 are already written. "Rollback" in a world
 * without a transaction can mean exactly one honest thing:
 *
 *   RESTORE THE PRE-RESTORE BACKUP.
 *
 * That is why a Replace or Merge REQUIRES a fresh, verified backup taken moments earlier,
 * and refuses to start without one. The backup is not belt-and-braces; it is the only undo
 * that exists. `preRestoreBackup` is that archive's identity, recorded in the audit trail
 * so the trail says what the operator could roll back TO.
 *
 * Fresh mode is the exception: it targets an empty society, so there is nothing to roll
 * back to and nothing to lose. It still records the audit event.
 *
 * THE ORDER IS THE SAFETY
 *
 *   0. FY lock          RULE 6 — a locked year refuses every mutation.
 *   1. compatibility    another society's archive never proceeds (T-32).
 *   2. dry run          re-run, not trusted from the UI. A blocked diff stops here.
 *   3. pre-restore      Replace/Merge without a verified backup is refused.
 *   4. REPLAY ASSERT    regenerate voucher_entries; if they do not reproduce the backup,
 *                       NOTHING is written and the disagreeing vouchers are named.
 *   5. writes           dependency-first (T-30). voucher_entries are REPLAYED, never the
 *                       archived rows. sidecar/exclude are never touched.
 *   6. audit            exactly one `restore` event, awaited and blocking.
 *
 * Steps 0–4 write nothing. The first byte a restore writes is at step 5, after four gates
 * have each had the power to stop it.
 *
 * `applyWrites` IS INJECTED. This module owns the ORDER and the GATES; it does not own the
 * Supabase calls. The page passes a real writer; the test passes a spy that records the
 * sequence and can fail on demand. An inlined writer would make the ordering — the whole
 * safety argument — impossible to observe.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import type { Voucher } from '@/types';
import type { EntityDescriptor } from '../export/registry.types';
import { planRestore } from './dag';
import { diffRestore, type RestoreMode, type RestoreDiff } from './diff';
import { replayEntries, compareReplay, type ReplayVerdict } from './replay';
import type { Row } from './naturalKeys';
import type { PreRestoreBackup, RestoreRunRecord, ReplayResult } from './trail';

export type { PreRestoreBackup } from './trail';

/**
 * The one write primitive the saga drives. Given an entity and its rows, persist them and
 * report how many landed. THROWS on failure — the saga stops at the first throw and reports
 * how far it got, because there is no transaction to unwind.
 */
export type ApplyWrites = (
  entity: EntityDescriptor,
  rows: readonly Row[],
  mode: RestoreMode,
) => Promise<{ written: number }>;

/**
 * Records ONE restore attempt (T-34). Awaited; THROWS on failure.
 *
 * Called on EVERY outcome — committed and aborted alike. A restore that was refused because
 * the backup did not replay is the most important thing to record, and it is exactly the
 * one an "only log successes" trail would lose.
 */
export type RecordAttempt = (record: RestoreRunRecord) => Promise<void>;

export interface RestoreCommitInput {
  entities: readonly EntityDescriptor[];
  mode: RestoreMode;
  fyLocked: boolean;

  /** Rows read from the archive, per entity key (full entities only). */
  archiveRows: Record<string, readonly Row[]>;
  /** The society's current rows, per entity key. The dry run is re-run against these. */
  currentRows: Record<string, readonly Row[]>;

  /** Vouchers to replay entries from — the archive's vouchers, post-insert. */
  vouchers: readonly Voucher[];
  /** The archive's voucher_entries, for the replay assertion. */
  archivedEntries: readonly Row[];
  societyId: string;

  /** Required for Replace and Merge. Absent ⇒ the saga refuses to start. */
  preRestoreBackup?: PreRestoreBackup;

  /** The source archive's manifest hash — ties the trail record to the exact bytes restored. */
  sourceManifestHash: string;

  applyWrites: ApplyWrites;
  recordAttempt: RecordAttempt;

  onProgress?: (done: number, total: number, entityKey: string) => void;
}

export interface RestoreCommitSummary {
  mode: RestoreMode;
  entitiesWritten: number;
  rowsWritten: number;
  entriesReplayed: number;
  preRestoreBackup?: PreRestoreBackup;
}

export type RestoreOutcome =
  | { status: 'committed'; summary: RestoreCommitSummary }
  | { status: 'fy-locked' }
  | { status: 'blocked'; diff: RestoreDiff }
  | { status: 'no-backup'; message: string }
  | { status: 'replay-failed'; verdict: ReplayVerdict }
  // A write threw. Everything BEFORE `entityKey` is already written; roll back with the
  // pre-restore backup. This is the state the whole design works to make rare and legible.
  | { status: 'partial'; entityKey: string; entitiesWritten: number; rowsWritten: number; message: string; preRestoreBackup?: PreRestoreBackup }
  | { status: 'audit-failed'; message: string; summary: RestoreCommitSummary }
  | { status: 'failed'; message: string };

const VOUCHER_ENTRY_KEY = 'voucher_entry';

/**
 * The gates and the writes. Returns an outcome; never throws; NEVER records.
 *
 * Every early return writes nothing. `applyWrites` is not called until every gate has
 * passed, and `voucher_entry` is never passed to it — its rows are replayed into whatever
 * `applyWrites` does for the vouchers, not inserted from the archive.
 *
 * Recording is the OUTER function's job (T-34): the trail must capture aborted attempts
 * too, and threading a recorder through every early return here would be easy to get wrong.
 * So this stays purely about the decision, and `commitRestore` records whatever it decides.
 * `audit-failed` is therefore produced only by the outer function.
 */
async function runSaga(input: RestoreCommitInput): Promise<RestoreOutcome> {
  try {
    // ── 0. RULE 6 ────────────────────────────────────────────────────────────
    if (input.fyLocked) return { status: 'fy-locked' };

    const plan = planRestore(input.entities);

    // ── 2. Dry run, re-run here rather than trusted from the page ────────────
    const diff = diffRestore(plan.insert, input.archiveRows, input.currentRows, input.mode);
    if (!diff.ok) return { status: 'blocked', diff };

    // ── 3. Pre-restore backup: the only undo that exists ─────────────────────
    // Fresh targets an empty society — nothing to roll back to. Replace and Merge can
    // destroy existing rows, so they may not start without a verified backup.
    if (input.mode !== 'fresh' && !input.preRestoreBackup) {
      return {
        status: 'no-backup',
        message: 'A Replace or Merge restore requires a fresh, verified backup first — it is the only way to undo a restore that fails partway.',
      };
    }

    // ── 4. Replay assertion: regenerate, then compare. Writes NOTHING yet ────
    const replayed = replayEntries(input.vouchers, input.societyId);
    const verdict = compareReplay(replayed, input.archivedEntries);
    if (!verdict.ok) return { status: 'replay-failed', verdict };

    // ── 5. Writes, dependency-first ──────────────────────────────────────────
    let entitiesWritten = 0;
    let rowsWritten = 0;
    const total = plan.insert.length;

    for (let i = 0; i < plan.insert.length; i++) {
      const entity = plan.insert[i];
      // Defense in depth: planRestore already excludes this, but the saga must never hand
      // archived voucher_entries to a writer. They are replayed, not inserted.
      if (entity.key === VOUCHER_ENTRY_KEY) continue;

      input.onProgress?.(i, total, entity.key);
      const rows = input.archiveRows[entity.key] ?? [];

      try {
        const { written } = await input.applyWrites(entity, rows, input.mode);
        entitiesWritten++;
        rowsWritten += written;
      } catch (e) {
        // No transaction to unwind. Report exactly where it stopped so the operator can
        // roll back to the pre-restore backup rather than guess.
        return {
          status: 'partial',
          entityKey: entity.key,
          entitiesWritten,
          rowsWritten,
          message: e instanceof Error ? e.message : String(e),
          preRestoreBackup: input.preRestoreBackup,
        };
      }
    }

    return {
      status: 'committed',
      summary: {
        mode: input.mode,
        entitiesWritten,
        rowsWritten,
        entriesReplayed: replayed.length,
        preRestoreBackup: input.preRestoreBackup,
      },
    };
  } catch (e) {
    return { status: 'failed', message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * PURE — map an outcome to the trail record (T-34).
 *
 * The `replay` field is recorded EITHER WAY, which is the point of the trail: a restore
 * that was refused because its backup did not reproduce the ledger is the row an auditor
 * most needs to find. An outcome that reached the writes had a passing replay by
 * construction (the saga returns replay-failed before the first write); an outcome that
 * stopped before the replay records it as not-run, not as a silent pass.
 */
export function buildRestoreRunRecord(input: RestoreCommitInput, outcome: RestoreOutcome): RestoreRunRecord {
  const reachedWrites = outcome.status === 'committed' || outcome.status === 'partial' || outcome.status === 'audit-failed';
  const replay: ReplayResult =
    outcome.status === 'replay-failed' ? 'failed' : reachedWrites ? 'passed' : 'not-run';

  const summary = outcome.status === 'committed' || outcome.status === 'audit-failed' ? outcome.summary : null;

  return {
    sourceManifestHash: input.sourceManifestHash,
    mode: input.mode,
    outcome: outcome.status,
    replay,
    disagreeingVouchers: outcome.status === 'replay-failed' ? outcome.verdict.vouchers.length : 0,
    entitiesWritten: summary?.entitiesWritten ?? (outcome.status === 'partial' ? outcome.entitiesWritten : 0),
    rowsWritten: summary?.rowsWritten ?? (outcome.status === 'partial' ? outcome.rowsWritten : 0),
    entriesReplayed: summary?.entriesReplayed ?? 0,
    preRestoreBackup: input.preRestoreBackup ?? null,
    message: 'message' in outcome ? outcome.message : null,
  };
}

/**
 * Run the restore and RECORD the attempt — every attempt, committed or aborted (T-34).
 * Returns an outcome; never throws.
 *
 * The trail write is blocking. If it fails on a COMMITTED restore, the rows are in the
 * database but the custody record is not — that is `audit-failed`, reported so, never a
 * clean success. If it fails on an already-aborted attempt, the restore did not happen
 * anyway; the best-effort trail write is swallowed rather than masking why it was aborted.
 */
export async function commitRestore(input: RestoreCommitInput): Promise<RestoreOutcome> {
  const outcome = await runSaga(input);

  try {
    await input.recordAttempt(buildRestoreRunRecord(input, outcome));
  } catch (e) {
    if (outcome.status === 'committed') {
      return { status: 'audit-failed', message: e instanceof Error ? e.message : String(e), summary: outcome.summary };
    }
    // Aborted anyway — the recording failure does not change the outcome, and reporting it
    // instead of the real reason (e.g. replay-failed) would hide the important fact.
  }

  return outcome;
}

/** PURE — one line for the operator, per outcome. Hindi first (RULE 7). */
export function summarizeOutcome(outcome: RestoreOutcome, hi = true): string {
  switch (outcome.status) {
    case 'committed':
      return hi
        ? `Restore पूरा — ${outcome.summary.entitiesWritten} सूचियाँ, ${outcome.summary.rowsWritten} पंक्तियाँ, ${outcome.summary.entriesReplayed} लेखा-प्रविष्टियाँ दोबारा बनीं।`
        : `Restore complete — ${outcome.summary.entitiesWritten} collections, ${outcome.summary.rowsWritten} rows, ${outcome.summary.entriesReplayed} ledger entries regenerated.`;
    case 'fy-locked':
      return hi ? 'वित्तीय वर्ष ऑडिट-लॉक है — restore नहीं चल सकता (RULE 6)।' : 'The financial year is audit-locked — a restore cannot run (RULE 6).';
    case 'blocked':
      return hi ? `Dry run में ${outcome.diff.problems.length} समस्याएँ — restore रोक दिया गया।` : `The dry run found ${outcome.diff.problems.length} problem(s) — the restore was stopped.`;
    case 'no-backup':
      return hi ? 'पहले एक सत्यापित बैकअप ज़रूरी है — वही एकमात्र undo है।' : 'A verified backup is required first — it is the only undo.';
    case 'replay-failed':
      return hi
        ? `${outcome.verdict.vouchers.length} वाउचर बैकअप से नहीं मिले — कुछ भी नहीं लिखा गया।`
        : `${outcome.verdict.vouchers.length} voucher(s) did not reproduce the backup — nothing was written.`;
    case 'partial':
      return hi
        ? `Restore "${outcome.entityKey}" पर रुका। ${outcome.entitiesWritten} सूचियाँ पहले ही लिखी जा चुकी हैं — बैकअप से वापस लाएँ।`
        : `The restore stopped at "${outcome.entityKey}". ${outcome.entitiesWritten} collection(s) were already written — roll back with the backup.`;
    case 'audit-failed':
      return hi ? 'Restore हो गया, पर उसका ऑडिट-रिकॉर्ड नहीं लिखा जा सका।' : 'The restore ran, but its audit record could not be written.';
    case 'failed':
      return hi ? `Restore विफल: ${outcome.message}` : `Restore failed: ${outcome.message}`;
  }
}
