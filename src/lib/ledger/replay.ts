/**
 * Replay — derive state from the event log (T-06 / ADR-0001; Canonical CL-4).
 *
 * PURE. The event log is the source of record; ALL state is a PROJECTION derived by folding
 * the events. Replay is deterministic and order-independent in input (it sorts by the
 * per-aggregate sequence), so the same events always reproduce the same state — the property
 * that lets a projection be dropped and rebuilt, and history be reconstructed as-of any point.
 *
 * The concrete `replayBalances` projection demonstrates the ledger property that matters most:
 * a REVERSING event nets out its original EXACTLY (CL-2), and BOTH events remain in the log —
 * a correction is never a mutation or a delete. Amounts are exact integer paise (T-02), so no
 * float drift decides a balance.
 */
import type { LedgerEvent } from './event';
import { isValidMinor } from '../money';

/** PURE — replay events for an aggregate through a reducer to derive state. Input order does
 *  not matter; events are applied in `sequence` order. */
export function replay<S>(
  events: readonly LedgerEvent[],
  reducer: (state: S, event: LedgerEvent) => S,
  initial: S,
): S {
  return [...events].sort((a, b) => a.sequence - b.sequence).reduce(reducer, initial);
}

/** A posting event's payload: a Dr/Cr amount in exact minor units against an account. A
 *  reversing event carries the SAME account/amount with the Dr/Cr side flipped. */
export interface PostingPayload {
  accountId: string;
  drCr: 'Dr' | 'Cr';
  amountMinor: number;
}

function asPosting(payload: unknown): PostingPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.accountId !== 'string') return null;
  if (p.drCr !== 'Dr' && p.drCr !== 'Cr') return null;
  if (!isValidMinor(p.amountMinor)) return null;
  return { accountId: p.accountId, drCr: p.drCr, amountMinor: p.amountMinor as number };
}

/**
 * PURE — replay posting + reversing events into per-account net balances (minor units, Dr − Cr).
 *
 * Dr adds, Cr subtracts; because a reversal is the original with the side flipped, it nets the
 * original to zero — WITHOUT the original ever leaving the log. Events whose payload is not a
 * posting are ignored (a mixed log replays cleanly through this projection).
 */
export function replayBalances(events: readonly LedgerEvent[]): Record<string, number> {
  const net: Record<string, number> = {};
  for (const e of [...events].sort((a, b) => a.sequence - b.sequence)) {
    const p = asPosting(e.payload);
    if (!p) continue;
    const delta = p.drCr === 'Dr' ? p.amountMinor : -p.amountMinor;
    net[p.accountId] = (net[p.accountId] ?? 0) + delta;
  }
  return net;
}
