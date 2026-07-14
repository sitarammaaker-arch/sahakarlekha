/**
 * Ledger parity (T-07 / ADR-0001, MR-1) — does replaying the JOURNAL reproduce the balances computed
 * directly from the current vouchers? PURE. This is the empty-diff gate for the T-09 cut: a tenant is
 * only made ledger-authoritative once its journal and its vouchers agree, so nothing shifts at cutover.
 *
 * NOTE the journal side uses projectTrialBalance (which reads `payload.lines`, the multi-leg shape our
 * events carry) — NOT replayBalances, whose single-leg PostingPayload shape our events do not use.
 */
import type { Voucher, LedgerAccount } from '@/types';
import { toMinor } from '@/lib/money';
import type { LedgerEvent } from './event';
import { projectTrialBalance } from './projections';
import { voucherPostingLines } from './voucherEvent';

/** PURE — per-account net opening balances (minor units, Dr − Cr) from the accounts' openingBalance/
 *  openingBalanceType. getTrialBalance adds these to the voucher postings, so parity must too. */
export function openingBalances(accounts: readonly LedgerAccount[]): Record<string, number> {
  const net: Record<string, number> = {};
  for (const a of Array.isArray(accounts) ? accounts : []) {
    const amt = toMinor(Number(a.openingBalance) || 0);
    if (amt === 0) continue;
    net[a.id] = (net[a.id] ?? 0) + (a.openingBalanceType === 'debit' ? amt : -amt);
  }
  return net;
}

/**
 * PURE — per-account net balances (minor units, Dr − Cr) computed DIRECTLY from the current active,
 * approved vouchers: the exact population the journal is seeded from (genesis + live-path both skip
 * deleted and pending). This is the reference the journal must reproduce.
 */
export function balancesFromVouchers(vouchers: readonly Voucher[]): Record<string, number> {
  const net: Record<string, number> = {};
  for (const v of Array.isArray(vouchers) ? vouchers : []) {
    if (v.isDeleted || v.approvalStatus === 'pending') continue;
    for (const l of voucherPostingLines(v)) {
      net[l.accountId] = (net[l.accountId] ?? 0) + (l.drCr === 'Dr' ? l.amountMinor : -l.amountMinor);
    }
  }
  return net;
}

/** PURE — per-account net balances (minor units) derived by replaying the journal events. */
export function balancesFromJournal(events: readonly LedgerEvent[]): Record<string, number> {
  const net: Record<string, number> = {};
  for (const l of projectTrialBalance(events).lines) net[l.accountId] = l.netMinor;
  return net;
}

export interface ParityDiff {
  accountId: string;
  /** balance the vouchers imply (minor units, Dr − Cr). */
  expected: number;
  /** balance the journal replays to. */
  actual: number;
}

export interface LedgerParity {
  /** true ⇒ journal and vouchers agree on every account — safe to cut this tenant to the ledger. */
  matches: boolean;
  diffs: ParityDiff[];
  accountsChecked: number;
}

/**
 * PURE — the T-09 cutover gate: does the journal replay to the same per-account balances as the
 * vouchers? Compares every account in either side; a non-zero difference is a diff. Accounts that net
 * to the same value (including both-zero, e.g. a cancelled voucher) agree.
 */
export function ledgerParity(
  events: readonly LedgerEvent[],
  vouchers: readonly Voucher[],
  accounts: readonly LedgerAccount[] = [],
): LedgerParity {
  // Expected = voucher postings + account opening balances (the two halves getTrialBalance sums).
  const expected = balancesFromVouchers(vouchers);
  for (const [a, v] of Object.entries(openingBalances(accounts))) expected[a] = (expected[a] ?? 0) + v;
  // Actual = the journal, which now carries account.opening events alongside voucher events.
  const actual = balancesFromJournal(events);
  const accountIds = new Set<string>([...Object.keys(expected), ...Object.keys(actual)]);
  const diffs: ParityDiff[] = [];
  for (const a of accountIds) {
    const e = expected[a] ?? 0;
    const ac = actual[a] ?? 0;
    if (e !== ac) diffs.push({ accountId: a, expected: e, actual: ac });
  }
  return { matches: diffs.length === 0, diffs, accountsChecked: accountIds.size };
}
