/**
 * Opening-balance carry-forward (ECR-09).
 *
 * Turns the prior year's audited closing (society.previousYearBalances: accountId → signed
 * amount, positive = debit, negative = credit) into opening-balance entries. Pure &
 * deterministic → unit-tested by scripts/test-opening-balances.mjs.
 */
import { isLegitContraSide, naturalOpeningSide } from './accountRoles';

export interface OpeningEntry {
  accountId: string;
  amount: number;
  type: 'debit' | 'credit';
}

/** Map prior-year closing balances to opening entries (drops zeros, 2dp, sorted by account). */
export function carryForwardOpenings(previousYearBalances: Record<string, number> | undefined): OpeningEntry[] {
  return Object.entries(previousYearBalances || {})
    .filter(([, v]) => Math.abs(v || 0) > 0.005)
    .map(([accountId, v]) => ({
      accountId,
      amount: Math.round(Math.abs(v) * 100) / 100,
      type: (v >= 0 ? 'debit' : 'credit') as 'debit' | 'credit',
    }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}

// ─── One continuous ledger: when may openings be (re)filled? ─────────────────────────

/**
 * PURE — how many live vouchers sit BEFORE the current financial year.
 *
 * The ledger is continuous (Phase-2 C, D1): a year's opening = account.openingBalance + every
 * earlier-year voucher, so account.openingBalance is the GENESIS opening, never a per-year figure.
 * Once the app holds earlier-year vouchers the 31-Mar closing already becomes the 1-Apr opening by
 * itself, and writing a closing into openingBalance counts every earlier voucher twice. A non-zero
 * count therefore disables the "fill from audited closing" shortcut (first-time onboarding only).
 * Pending vouchers count (they post once approved); rejected and deleted ones never do.
 */
export function earlierYearVoucherCount(
  vouchers: { date: string; isDeleted?: boolean; approvalStatus?: string }[],
  fyStart: string | undefined,
): number {
  if (!fyStart) return 0;
  // Not isCountedVoucher (#705 excludes pending): a pending voucher still blocks — it posts once approved.
  return vouchers.filter(v => !v.isDeleted && v.approvalStatus !== 'rejected' && v.date < fyStart).length;
}

/** PURE — total Dr / Cr of opening entries in exact paise, and whether they tie. */
export function openingTotals(entries: { amount: number; type: 'debit' | 'credit' }[]): {
  debit: number; credit: number; difference: number; balanced: boolean;
} {
  let dr = 0, cr = 0;
  for (const e of entries) {
    const p = Math.round((Number(e.amount) || 0) * 100);
    if (e.type === 'debit') dr += p; else cr += p;
  }
  return { debit: dr / 100, credit: cr / 100, difference: Math.abs(dr - cr) / 100, balanced: dr === cr };
}

// ─── Universal Importer → opening balances (T-04) ────────────────────────────────────

/** The three columns the Opening Balances import template carries. */
export interface ImportedOpeningRow {
  account_name: string;
  opening_balance: string;
  balance_type: string;
}

/** Same normalisation the importer's validator uses, so preview and commit agree. */
const normName = (s: string): string => (s || '').toLowerCase().trim();

/**
 * PURE — resolve validated import rows against the live chart of accounts.
 *
 * Rows whose account name does not resolve are DROPPED and returned in `unmatched`,
 * never silently swallowed (RULE 1 / P7). The last row wins if a name repeats, which
 * mirrors the old localStorage keyed-by-accountId behaviour.
 */
export function mapImportedOpenings(
  rows: ImportedOpeningRow[],
  accounts: { id: string; name: string; isGroup?: boolean }[]
): { entries: OpeningEntry[]; unmatched: string[] } {
  // An opening can NEVER go on a GROUP account — Trial Balance / Balance Sheet count ledger (leaf) accounts only, so the money would vanish
  // (the Opening Balances page blocks it too). A row that names a group is returned as unmatched, never silently written.
  const byName = new Map<string, string>();
  for (const a of accounts) if (!a.isGroup) byName.set(normName(a.name), a.id);
  const resolved = new Map<string, OpeningEntry>();
  const unmatched: string[] = [];

  for (const row of rows) {
    const id = byName.get(normName(row.account_name));
    if (!id) { unmatched.push(row.account_name); continue; }
    const amount = Math.round((parseFloat(row.opening_balance) || 0) * 100) / 100;
    const type = normName(row.balance_type) === 'credit' ? 'credit' : 'debit';
    resolved.set(id, { accountId: id, amount, type });
  }

  return {
    entries: [...resolved.values()].sort((a, b) => a.accountId.localeCompare(b.accountId)),
    unmatched,
  };
}

// ─── Openings on the wrong side / on P&L heads (2026-10-11) ───────────────────────────
export interface OpeningWarningRow { accountId: string; name: string; type: string; side: 'debit' | 'credit'; amount: number }
export interface OpeningWarnings {
  /** A balance-sheet ledger whose opening sits on the side opposite its type (a liability in Dr, an asset in Cr) —
   *  prod: one society had 117 creditor ledgers opened in Dr (₹1.66 cr) from an import file. Legit contras are skipped. */
  wrongSide: OpeningWarningRow[];
  /** Income / expense ledgers carrying an opening — the Opening Balances list does not even show them, yet they
   *  count in its Dr/Cr totals. Right only when the society starts the app mid-year. */
  plHeads: OpeningWarningRow[];
}

/** PURE — which openings look wrong. `accounts` may be pseudo-accounts (an import row: id = name). */
export function openingWarnings(
  entries: readonly { accountId: string; amount: number; type: 'debit' | 'credit' }[],
  accounts: readonly { id: string; name: string; type: string; subtype?: string; isGroup?: boolean }[],
): OpeningWarnings {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const wrongSide: OpeningWarningRow[] = [];
  const plHeads: OpeningWarningRow[] = [];
  for (const e of entries) {
    const a = byId.get(e.accountId);
    const amount = Math.round((Number(e.amount) || 0) * 100) / 100;
    if (!a || a.isGroup || amount <= 0) continue;
    const row = { accountId: a.id, name: a.name, type: a.type, side: e.type, amount };
    if (a.type === 'income' || a.type === 'expense') { plHeads.push(row); continue; }
    if (e.type !== naturalOpeningSide(a.type) && !isLegitContraSide(a)) wrongSide.push(row);
  }
  const byAmt = (x: OpeningWarningRow, y: OpeningWarningRow) => y.amount - x.amount;
  return { wrongSide: wrongSide.sort(byAmt), plHeads: plHeads.sort(byAmt) };
}

/** PURE — the opening checks for an ACCOUNTS import file: wrong-side / P&L-head openings among the new accounts,
 *  and the rows whose account already exists (the importer skips them, so their opening would be lost). */
export function accountImportOpeningCheck(
  rows: readonly Record<string, string>[],
  existing: readonly { name: string }[],
): { warnings: OpeningWarnings; dropped: string[] } {
  const have = new Set(existing.map((a) => a.name.trim().toLowerCase()));
  const dropped: string[] = [];
  const pseudo: { id: string; name: string; type: string }[] = [];
  const entries: { accountId: string; amount: number; type: 'debit' | 'credit' }[] = [];
  rows.forEach((r, i) => {
    const name = (r.account_name || '').trim();
    const amount = parseFloat(r.opening_balance) || 0;
    if (have.has(name.toLowerCase())) { if (amount > 0) dropped.push(name); return; }
    const id = `row-${i}`;
    pseudo.push({ id, name, type: (r.account_type || '').toLowerCase() });
    entries.push({ accountId: id, amount, type: (r.balance_type || '').toLowerCase() === 'credit' ? 'credit' : 'debit' });
  });
  return { warnings: openingWarnings(entries, pseudo), dropped };
}
