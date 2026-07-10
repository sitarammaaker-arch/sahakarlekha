/**
 * Client-side rehearsal runner (T-35, client-side realization / gap EXP-04).
 *
 * A rehearsal proves a backup restores to the same BOOKS. T-35 as specified does that by
 * restoring into a throwaway shadow society on a server (an Edge Function + pg_cron —
 * decision D1, deferred). This runs the SAME proof entirely in the browser, with no shadow
 * society and no server tier:
 *
 *   reconstruct the books the backup represents  →  compare to the live books.
 *
 * If restoring the backup would reproduce today's trial balance and stock, the two match.
 * If the backup is behind (missing a voucher added since), or corrupt, or incomplete, they
 * diverge — and the runner names the accounts and items that differ. It is the D1-free
 * realization the user chose: it ships with the normal frontend, needs no service-role key,
 * and writes nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * IT READS, IT NEVER WRITES. Verify the archive, replay its ledger in memory, read the
 * live rows, replay theirs, compare. `loadArchive` and `fetchRows` are INJECTED so the
 * whole thing is testable without Supabase and so this module owns the SEQUENCE, not the
 * I/O. The comparison is the pure rehearsal core (rehearsal.ts); the posting rule is the
 * shared one (voucherUtils, via replay.ts) — never a second copy (RULE 2).
 *
 * A TRUNCATED READ ABORTS THE REHEARSAL. Comparing the backup against half the live books
 * would report differences that are an artefact of the read, not the backup (blueprint P7,
 * no silent caps). Better to say "could not read it all" than to fail a good backup.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import type { Voucher } from '@/types';
import type { EntityDescriptor } from '../export/registry.types';
import type { LoadedArchive } from '../restore/archive';
import { replayEntries } from '../restore/replay';
import type { Row } from '../restore/naturalKeys';
import { booksSignature, compareRehearsal, type BooksSignature, type RehearsalVerdict } from './rehearsal';
import { backupHealth, type BackupHealth } from './health';

/** The three collections a books-signature is built from. */
const VOUCHER = 'voucher';
const STOCK_ITEM = 'stock_item';
const STOCK_MOVEMENT = 'stock_movement';

/** Matches source.ts's fetchEntityRows — injected so the runner is testable without Supabase. */
export type FetchRows = (
  entity: EntityDescriptor,
  societyId: string,
) => Promise<{ rows: Row[]; truncated: boolean; error: string | null }>;

export type LoadArchive = (bytes: Uint8Array, entities: readonly EntityDescriptor[]) => Promise<LoadedArchive>;

export interface RehearsalRunInput {
  bytes: Uint8Array;
  societyId: string;
  entities: readonly EntityDescriptor[];
  loadArchive: LoadArchive;
  fetchRows: FetchRows;
  /** Injected ISO time — the rehearsal's "as of", and the health verdict's `now`. */
  now: string;
  /** When the backup was created, for the health card. Usually the archive's manifest date. */
  backupCreatedAt?: string;
}

export type RehearsalRunOutcome =
  | { status: 'passed'; verdict: RehearsalVerdict; live: BooksSignature; restored: BooksSignature; health: BackupHealth }
  | { status: 'failed'; verdict: RehearsalVerdict; live: BooksSignature; restored: BooksSignature; health: BackupHealth }
  // The archive itself did not verify — there is nothing to rehearse.
  | { status: 'archive-invalid'; problems: string[] }
  // A live table could not be read in full; comparing against a partial read would lie.
  | { status: 'read-failed'; entityKey: string; message: string }
  | { status: 'error'; message: string };

const asVouchers = (rows: readonly Row[]): Voucher[] => rows as unknown as Voucher[];

/** Build a books-signature from a set of vouchers + stock rows, through the shared posting rule. */
function signatureOf(vouchers: readonly Row[], stockItems: readonly Row[], stockMovements: readonly Row[], societyId: string): BooksSignature {
  const entries = replayEntries(asVouchers(vouchers), societyId);
  return booksSignature({ entries, stockItems, stockMovements });
}

/**
 * Run the rehearsal. Returns an outcome; never throws.
 *
 * The order is the same read-only order as the dry run: verify the archive first (nothing
 * else matters if it is corrupt), then read the live side, aborting the whole rehearsal on
 * any truncated or failed read rather than comparing against a partial picture.
 */
export async function runRehearsal(input: RehearsalRunInput): Promise<RehearsalRunOutcome> {
  try {
    // 1. Verify + load the archive. A corrupt backup has nothing to rehearse.
    const loaded = await input.loadArchive(input.bytes, input.entities);
    if (!loaded.report.ok) {
      return { status: 'archive-invalid', problems: loaded.report.problems.length ? loaded.report.problems : ['the archive did not verify'] };
    }
    if (loaded.problems.length) {
      return { status: 'archive-invalid', problems: loaded.problems };
    }

    const restored = signatureOf(
      loaded.rows[VOUCHER] ?? [],
      loaded.rows[STOCK_ITEM] ?? [],
      loaded.rows[STOCK_MOVEMENT] ?? [],
      input.societyId,
    );

    // 2. Read the live side. Abort on any truncated/failed read.
    const byKey = new Map(input.entities.map(e => [e.key, e]));
    const liveRows: Record<string, Row[]> = {};
    for (const key of [VOUCHER, STOCK_ITEM, STOCK_MOVEMENT]) {
      const entity = byKey.get(key);
      if (!entity) return { status: 'error', message: `this build has no "${key}" entity` };
      const res = await input.fetchRows(entity, input.societyId);
      if (res.error) return { status: 'read-failed', entityKey: key, message: res.error };
      if (res.truncated) return { status: 'read-failed', entityKey: key, message: 'holds more rows than could be read in one pass' };
      liveRows[key] = res.rows;
    }

    const live = signatureOf(liveRows[VOUCHER], liveRows[STOCK_ITEM], liveRows[STOCK_MOVEMENT], input.societyId);

    // 3. Compare, and turn the verdict into a health reading for THIS backup.
    const verdict = compareRehearsal(live, restored);
    const health = backupHealth({
      lastBackupAt: input.backupCreatedAt ?? input.now,
      lastVerifyAt: input.now,                 // we just verified it, above
      lastRehearsal: { at: input.now, passed: verdict.ok },
      now: input.now,
    });

    return { status: verdict.ok ? 'passed' : 'failed', verdict, live, restored, health };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** PURE — one line for the operator. Hindi first (RULE 7). */
export function summarizeRun(outcome: RehearsalRunOutcome, hi = true): string {
  switch (outcome.status) {
    case 'passed':
      return hi
        ? 'rehearsal पास — यह बैकअप restore करने पर मौजूदा किताबें हूबहू लौटेंगी।'
        : 'Rehearsal passed — restoring this backup would reproduce the current books exactly.';
    case 'failed': {
      const n = outcome.verdict.accounts.length + outcome.verdict.items.length;
      return hi
        ? `rehearsal विफल — ${n} खाते/मद मेल नहीं खाए। यह बैकअप वर्तमान किताबें पूरी तरह नहीं लौटाता (शायद पुराना या अधूरा)।`
        : `Rehearsal failed — ${n} account(s)/item(s) did not match. This backup would not fully reproduce the current books (likely stale or incomplete).`;
    }
    case 'archive-invalid':
      return hi ? 'यह बैकअप सत्यापित नहीं हुआ — rehearsal से पहले इसे जाँचें।' : 'This backup did not verify — check it before rehearsing.';
    case 'read-failed':
      return hi
        ? `मौजूदा "${outcome.entityKey}" पूरा पढ़ा नहीं जा सका — अधूरी तुलना दिखाना ग़लत होगा।`
        : `Could not fully read live "${outcome.entityKey}" — a partial comparison would be a lie.`;
    case 'error':
      return hi ? `rehearsal में त्रुटि: ${outcome.message}` : `Rehearsal error: ${outcome.message}`;
  }
}
