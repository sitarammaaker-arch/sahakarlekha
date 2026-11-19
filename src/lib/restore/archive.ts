/**
 * Archive reader for restore (T-32 / gap EXP-03).
 *
 * Turns a `.slbak` file into rows a dry run can diff. Sits between `verify.ts` (which
 * proves the bytes are intact) and `diff.ts` (which is pure and takes rows).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * NOTHING IS PARSED UNTIL EVERYTHING IS VERIFIED
 *
 * `loadArchive` runs `verifyArchive` first and returns empty rows if it fails. Not "parses
 * what it can". Not "warns and continues". A file whose digests do not match is a file we
 * know nothing about — its NDJSON may be truncated mid-row, may contain rows from another
 * society, may have been edited by someone who wanted an extra member on the register.
 * Parsing it first and checking afterwards would mean the operator has already seen a plan
 * built from data we have no reason to trust.
 *
 * WE READ THE MANIFEST, NOT THE ZIP
 *
 * Entities are located through `manifest.entities`, never by walking the archive's file
 * list. An attacker can add `data/member.ndjson` twice, or add `data/ghost.ndjson`, and
 * every listed digest still matches — nothing was recorded for the extra file. `verify.ts`
 * already fails on unlisted files; reading via the manifest means that even if it did not,
 * a smuggled file is never opened.
 *
 * ONLY `full` ENTITIES ARE READ
 *
 * `derived/voucher_entry.ndjson` and `evidence/audit_log.ndjson` are in the archive, and
 * are deliberately never loaded here. T-33 replays the first and asserts; nothing ever
 * writes the second. A restore that can't see them can't insert them.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import { unzipSync, strFromU8 } from 'fflate';
import type { EntityDescriptor } from '../export/registry.types';
import { verifyArchive, type VerifyReport } from '../backup/verify';
import { entityPath } from '../backup/manifest';
import { parseNdjson } from '../backup/ndjson';
import { fromBackupRow } from '../export/contract';
import type { Row } from './naturalKeys';

export interface LoadedArchive {
  /** The verification report. `ok: false` ⇒ `rows` is empty and nothing was parsed. */
  report: VerifyReport;
  /**
   * Rows per entity key, for `full` entities only. An entity present in the registry but
   * absent from the archive is ABSENT from this map — not an empty array. The diff treats
   * those differently: "the archive never carried this" is not "the archive says none".
   */
  rows: Record<string, Row[]>;
  /** Entity keys the archive carries that this build cannot place. Mirrors report.unplaceable. */
  unplaceable: string[];
  /** Parse failures, one per entity. Non-empty ⇒ the archive is unusable. */
  problems: string[];
  /**
   * The archive's RECORDED voucher_entries (derived/), read for the replay assertion only —
   * NOT to be inserted. The commit saga replays entries from the archived vouchers and
   * asserts they reproduce these (T-33 / RULE 2). Empty when the archive carried none.
   */
  derivedEntries: Row[];
}

/**
 * Verify, then read. Never throws — a corrupt archive is an answer.
 *
 * `entities` should be the registry, so the report can name entities this build cannot
 * place (gap EXP-02).
 */
export async function loadArchive(
  bytes: Uint8Array,
  entities: readonly EntityDescriptor[],
): Promise<LoadedArchive> {
  const report = await verifyArchive(bytes, { entities });
  if (!report.ok || !report.manifest) {
    return { report, rows: {}, unplaceable: report.unplaceable, problems: [], derivedEntries: [] };
  }

  const byKey = new Map(entities.map(e => [e.key, e]));
  const rows: Record<string, Row[]> = {};
  const problems: string[] = [];

  // Safe: verifyArchive has already unzipped these bytes and checked every digest.
  const files = unzipSync(bytes);

  for (const listed of report.manifest.entities) {
    const entity = byKey.get(listed.key);
    if (!entity) continue;                       // unplaceable — already named in the report
    if (entity.backupPolicy !== 'full') continue; // replay / sidecar are never loaded

    const path = entityPath(listed.key, 'full');
    const file = files[path];
    if (!file) {
      // verifyArchive would already have failed on a missing file. Belt to that braces:
      // an entity we cannot read must not silently become "zero rows to restore".
      problems.push(`${listed.key}: listed in the manifest but ${path} is not in the archive`);
      continue;
    }

    try {
      // T-04: read the archive through the export CONTRACT (inverse of the writer's toBackupRow).
      // Lossless and identity until a storageColumn override exists — so pre-contract archives read
      // back unchanged.
      rows[listed.key] = parseNdjson(strFromU8(file)).map(r => fromBackupRow(entity, r) as Row);
    } catch (e) {
      problems.push(`${listed.key}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    // The manifest said how many rows it wrote. If the file parses to a different number,
    // the digest matched but our reading of it does not — refuse rather than restore a
    // count nobody predicted.
    if (rows[listed.key].length !== listed.rowCount) {
      problems.push(
        `${listed.key}: the manifest promised ${listed.rowCount} row(s) but the file holds ${rows[listed.key].length}`,
      );
    }
  }

  // A parse problem invalidates the whole load. Returning "the entities that worked" would
  // let a restore proceed against a partial archive.
  if (problems.length) return { report, rows: {}, unplaceable: report.unplaceable, problems, derivedEntries: [] };

  // The archive's recorded voucher_entries, for the replay assertion (NOT for insertion).
  // These live in derived/ and are the one collection a restore regenerates rather than
  // writes; the commit saga asserts the regeneration reproduces them.
  let derivedEntries: Row[] = [];
  const derivedPath = entityPath('voucher_entry', 'replay');
  const derivedFile = files[derivedPath];
  if (derivedFile) {
    try {
      derivedEntries = parseNdjson(strFromU8(derivedFile));
    } catch (e) {
      return {
        report, rows: {}, unplaceable: report.unplaceable, derivedEntries: [],
        problems: [`voucher_entry: ${e instanceof Error ? e.message : String(e)}`],
      };
    }
  }

  return { report, rows, unplaceable: report.unplaceable, problems: [], derivedEntries };
}

/** The three ways an archive can fail to belong to the society trying to restore it. */
export type CompatibilityStatus = 'same-society' | 'different-society' | 'different-fy';

export interface Compatibility {
  status: CompatibilityStatus;
  /** True when the restore may proceed without an explicit override. */
  safe: boolean;
  archiveSociety: string;
  archiveFy: string;
  /** The archive's own society id (BKP-02: what the rows are moved FROM in a cross-society restore). */
  archiveSocietyId?: string;
}

/**
 * PURE — does this archive belong here?
 *
 * A different society is the dangerous one: restoring society A's members into society B
 * is not a mistake anyone notices until an audit. It is reported, never auto-allowed.
 *
 * A different financial year is compared but NOT treated as unsafe on its own: restoring
 * last year's archive into this year's books is a legitimate thing an auditor does. The
 * mode (Fresh / Merge / Replace) is what makes that safe or not, and the operator chooses it.
 */
export function checkCompatibility(
  manifest: { societyId: string; societyName: string; financialYear: string },
  current: { id: string; financialYear: string },
): Compatibility {
  if (manifest.societyId !== current.id) {
    return {
      status: 'different-society',
      safe: false,
      archiveSociety: manifest.societyName,
      archiveFy: manifest.financialYear,
      archiveSocietyId: manifest.societyId,
    };
  }
  const sameFy = manifest.financialYear === current.financialYear;
  return {
    status: sameFy ? 'same-society' : 'different-fy',
    safe: true,
    archiveSociety: manifest.societyName,
    archiveFy: manifest.financialYear,
  };
}

// ── BKP-02: restoring into a RE-CREATED society ─────────────────────────────────────────────────────────────────
// After a project loss the society is registered again and gets a NEW id, so every archive reads "different
// society" and gate 1 refused all of them — the one moment a backup is needed most. A cross-society restore is
// allowed only into a society whose books are still EMPTY (no live voucher, no member) and only after the operator
// types the archive's society name. The server still stamps every written row with the caller's society and refuses
// any row that belongs to another society (178 restore_commit), so a live society can never be overwritten this way.

export type CrossSocietyRefusal = 'not-different-society' | 'books-not-empty' | 'name-not-typed';

/** PURE — may this different-society archive be restored here? */
export function crossSocietyGate(input: {
  compat: Compatibility | null;
  liveVouchers: number;
  liveMembers: number;
  typedName: string;
}): { allowed: boolean; reason?: CrossSocietyRefusal } {
  if (!input.compat || input.compat.status !== 'different-society' || !input.compat.archiveSocietyId) {
    return { allowed: false, reason: 'not-different-society' };
  }
  if (input.liveVouchers > 0 || input.liveMembers > 0) return { allowed: false, reason: 'books-not-empty' };
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!norm(input.typedName) || norm(input.typedName) !== norm(input.compat.archiveSociety)) {
    return { allowed: false, reason: 'name-not-typed' };
  }
  return { allowed: true };
}

/**
 * PURE — the archive's rows moved onto the new society id. Every string value EXACTLY equal to the old society id
 * becomes the new one, at any depth (society_id, society_settings.id — the settings row is keyed by the society id —
 * and any reference inside JSON). Nothing else changes. Returns new objects; the input is untouched.
 */
export function rebaseArchiveRows(rows: Record<string, readonly Row[]>, fromId: string, toId: string): Record<string, Row[]> {
  const swap = (v: unknown): unknown => {
    if (typeof v === 'string') return v === fromId ? toId : v;
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, swap(x)]));
    return v;
  };
  const out: Record<string, Row[]> = {};
  for (const [key, list] of Object.entries(rows)) out[key] = list.map((r) => swap(r) as Row);
  return out;
}
