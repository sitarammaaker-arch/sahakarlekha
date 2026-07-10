/**
 * Restore rehearsal — the assertion core (T-35 / gap EXP-04).
 *
 * PURE. No Supabase, no DOM, no clock, no shadow society, no server.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT A REHEARSAL PROVES, AND WHY IT IS THE HIGHEST-VALUE CHECK IN THIS WORKSTREAM
 *
 * Every other guarantee is about the archive as a FILE — its digests match, its manifest
 * agrees with itself, it decrypts. None of that proves the archive would restore to the
 * same BOOKS. A rehearsal does: it derives the trial balance and the stock position the
 * archive represents, and asserts they equal the live ones. "The backup verified" becomes
 * "the backup reproduces this society's books."
 *
 * THE HONEST LIMIT OF THIS FILE, STATED UP FRONT.
 *
 * T-35 as specified restores the latest backup into a throwaway SHADOW SOCIETY on a weekly
 * schedule (an Edge Function + pg_cron — decision D1, DEFERRED). That server orchestration
 * is NOT built: it needs a linked project, a service-role key, and a deploy, none of which
 * exist in this workspace. Writing it here and calling it done would be the exact
 * unverified claim this workstream exists to prevent.
 *
 * What IS built is the part the whole rehearsal turns on: the equality assertions. They are
 * pure, so they run identically in a future Edge Function, in a client-side rehearsal that
 * compares the archive to the live books with no shadow society at all, and in a test. The
 * comparison is the proof; where it runs is a deployment detail.
 *
 * TRIAL BALANCE FROM voucher_entries, NOT FROM A CACHED FIELD (RULE 2).
 * The signature sums dr and cr straight from the ledger entries — the same rows the posting
 * engine produces and a restore replays. It never reads a stored `currentStock` or a cached
 * balance, because the bug those cause is precisely what a rehearsal must catch.
 *
 * STOCK FROM THE CANONICAL FORMULA (RULE 2, the ₹1,12,500 phantom).
 * openingStock + movements, clamped at zero — the one formula CLAUDE.md pins. A negative
 * pre-clamp result is itself a finding: the movements do not support the stock claimed.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import type { Row } from '../restore/naturalKeys';

/** A voucher_entries row as it travels in the archive / comes back from the ledger. */
export interface EntryLike {
  accountId?: unknown;
  dr?: unknown;
  cr?: unknown;
}

/** The fields of the stock signature the rehearsal reads. */
export interface StockItemLike {
  id?: unknown;
  openingStock?: unknown;
}
export interface StockMovementLike {
  itemId?: unknown;
  type?: unknown;
  qty?: unknown;
}

export interface BooksSignature {
  entryCount: number;
  /** Rounded to paise. Floating sums of thousands of legs drift in the last digit. */
  totalDr: number;
  totalCr: number;
  /** The double-entry invariant. A backup whose ledger does not balance is not restorable. */
  balanced: boolean;
  /** accountId → net (dr − cr), rounded. The trial balance, as a comparable map. */
  perAccount: Record<string, number>;
  stockItemCount: number;
  totalStockQty: number;
  /** itemId → closing quantity, by the canonical formula. */
  perItem: Record<string, number>;
  /** Items whose movements drove the quantity below zero before clamping — a data-integrity finding. */
  negativeStockItems: string[];
}

export interface RehearsalInput {
  entries: readonly EntryLike[];
  stockItems: readonly StockItemLike[];
  stockMovements: readonly StockMovementLike[];
}

/** Paise-precision rounding, so two arithmetically-equal sums compare equal. */
const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** A map with keys in sorted order, so the signature serializes canonically regardless of
 *  the order rows were fetched in. compareRehearsal is key-based and does not need this;
 *  a STORED signature (or a JSON equality check) does. */
const sortedMap = (m: Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const k of Object.keys(m).sort()) out[k] = m[k];
  return out;
};

/**
 * PURE — the trial balance and stock position a set of rows represents.
 *
 * Deterministic: the same rows in any order produce the same signature (sums and keyed
 * maps, never arrays that depend on fetch order).
 */
export function booksSignature(input: RehearsalInput): BooksSignature {
  let totalDr = 0;
  let totalCr = 0;
  const perAccount: Record<string, number> = {};

  for (const e of input.entries) {
    const dr = Number(e.dr) || 0;
    const cr = Number(e.cr) || 0;
    totalDr += dr;
    totalCr += cr;
    const acc = e.accountId === undefined || e.accountId === null ? '(none)' : String(e.accountId);
    perAccount[acc] = (perAccount[acc] ?? 0) + dr - cr;
  }
  for (const acc of Object.keys(perAccount)) perAccount[acc] = round2(perAccount[acc]);
  totalDr = round2(totalDr);
  totalCr = round2(totalCr);

  const perItem: Record<string, number> = {};
  const negativeStockItems: string[] = [];
  let totalStockQty = 0;

  for (const item of input.stockItems) {
    const id = item.id === undefined || item.id === null ? '(none)' : String(item.id);
    // The canonical formula (CLAUDE.md). Purchases and positive adjustments add; everything
    // else subtracts its magnitude.
    let qty = Number(item.openingStock) || 0;
    for (const m of input.stockMovements) {
      if (String(m.itemId) !== id) continue;
      const mq = Number(m.qty) || 0;
      if (m.type === 'purchase' || (m.type === 'adjustment' && mq > 0)) qty += mq;
      else qty -= Math.abs(mq);
    }
    if (qty < 0) negativeStockItems.push(id);
    qty = Math.max(0, qty);
    perItem[id] = round2(qty);
    totalStockQty += perItem[id];
  }

  return {
    entryCount: input.entries.length,
    totalDr,
    totalCr,
    balanced: totalDr === totalCr,
    perAccount: sortedMap(perAccount),
    stockItemCount: input.stockItems.length,
    totalStockQty: round2(totalStockQty),
    perItem: sortedMap(perItem),
    negativeStockItems: negativeStockItems.sort(),
  };
}

export interface RehearsalDifference {
  kind: 'balance' | 'totalDr' | 'totalCr' | 'account' | 'item' | 'entryCount' | 'stockCount';
  key?: string;
  source: number | boolean;
  restored: number | boolean;
}

export interface RehearsalVerdict {
  /** True only when the restored books reproduce the source books exactly. */
  ok: boolean;
  /** True independently — a source that itself does not balance is a finding of its own. */
  sourceBalanced: boolean;
  differences: RehearsalDifference[];
  /** Accounts / items whose figure differs. Deduplicated, sorted — what an operator reads. */
  accounts: string[];
  items: string[];
}

/**
 * PURE — do the restored books reproduce the source books?
 *
 * "source" is the live society; "restored" is what the archive reconstructs. Every
 * difference is reported, not the first: an operator fixing one mismatch should not
 * discover the next only on the next run. A per-account or per-item figure present on one
 * side and absent on the other counts as a difference against zero.
 */
export function compareRehearsal(source: BooksSignature, restored: BooksSignature): RehearsalVerdict {
  const differences: RehearsalDifference[] = [];
  const accounts = new Set<string>();
  const items = new Set<string>();

  if (source.balanced !== restored.balanced) differences.push({ kind: 'balance', source: source.balanced, restored: restored.balanced });
  if (source.totalDr !== restored.totalDr) differences.push({ kind: 'totalDr', source: source.totalDr, restored: restored.totalDr });
  if (source.totalCr !== restored.totalCr) differences.push({ kind: 'totalCr', source: source.totalCr, restored: restored.totalCr });
  if (source.entryCount !== restored.entryCount) differences.push({ kind: 'entryCount', source: source.entryCount, restored: restored.entryCount });
  if (source.stockItemCount !== restored.stockItemCount) differences.push({ kind: 'stockCount', source: source.stockItemCount, restored: restored.stockItemCount });

  for (const acc of new Set([...Object.keys(source.perAccount), ...Object.keys(restored.perAccount)])) {
    const s = source.perAccount[acc] ?? 0;
    const r = restored.perAccount[acc] ?? 0;
    if (s !== r) { differences.push({ kind: 'account', key: acc, source: s, restored: r }); accounts.add(acc); }
  }
  for (const it of new Set([...Object.keys(source.perItem), ...Object.keys(restored.perItem)])) {
    const s = source.perItem[it] ?? 0;
    const r = restored.perItem[it] ?? 0;
    if (s !== r) { differences.push({ kind: 'item', key: it, source: s, restored: r }); items.add(it); }
  }

  return {
    ok: differences.length === 0,
    sourceBalanced: source.balanced,
    differences,
    accounts: [...accounts].sort(),
    items: [...items].sort(),
  };
}

/** PURE — one line an operator can read. Hindi first (RULE 7). */
export function summarizeRehearsal(verdict: RehearsalVerdict, hi = true): string {
  if (!verdict.sourceBalanced) {
    return hi
      ? 'चेतावनी — मौजूदा किताबें ही संतुलित नहीं हैं (Dr ≠ Cr)। rehearsal से पहले इसे देखें।'
      : 'Warning — the live books themselves do not balance (Dr ≠ Cr). Look at this before rehearsing.';
  }
  if (verdict.ok) {
    return hi
      ? 'rehearsal पास — बैकअप से पुनर्निर्मित किताबें मौजूदा किताबों से हूबहू मिलीं।'
      : 'Rehearsal passed — the books rebuilt from the backup match the live books exactly.';
  }
  const n = verdict.accounts.length + verdict.items.length;
  return hi
    ? `rehearsal विफल — ${n} खाते/मद मेल नहीं खाए। बैकअप वर्तमान किताबों को पूरी तरह नहीं दोहराता।`
    : `Rehearsal failed — ${n} account(s)/item(s) did not match. The backup does not fully reproduce the current books.`;
}
