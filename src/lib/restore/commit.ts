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

/** Identity of the backup an operator could roll back to. Recorded, never the bytes. */
export interface PreRestoreBackup {
  filename: string;
  bytes: number;
  createdAt: string;
  manifestHash: string;
}

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

/** Writes the audit `restore` event. Awaited; THROWS on failure. */
export type RecordRestore = (summary: RestoreCommitSummary) => Promise<void>;

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

  applyWrites: ApplyWrites;
  recordRestore: RecordRestore;

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
 * Run the restore. Returns an outcome; never throws.
 *
 * Every early return writes nothing. `applyWrites` is not called until every gate has
 * passed, and `voucher_entry` is never passed to it — its rows are replayed into whatever
 * `applyWrites` does for the vouchers, not inserted from the archive.
 */
export async function commitRestore(input: RestoreCommitInput): Promise<RestoreOutcome> {
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

    const summary: RestoreCommitSummary = {
      mode: input.mode,
      entitiesWritten,
      rowsWritten,
      entriesReplayed: replayed.length,
      preRestoreBackup: input.preRestoreBackup,
    };

    // ── 6. Exactly one audit event, awaited ──────────────────────────────────
    // The writes are done; this cannot un-write them. But a data-custody action that
    // could not be recorded is reported as such, never as a clean success.
    try {
      await input.recordRestore(summary);
    } catch (e) {
      return { status: 'audit-failed', message: e instanceof Error ? e.message : String(e), summary };
    }

    return { status: 'committed', summary };
  } catch (e) {
    return { status: 'failed', message: e instanceof Error ? e.message : String(e) };
  }
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
