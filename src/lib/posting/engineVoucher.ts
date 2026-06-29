/**
 * Shared posting core (PURE) — map frozen PostingLegs into accounting VoucherLine specs.
 *
 * Generic infrastructure ONLY. Uses solely each leg's frozen `resolvedAccountId`; no
 * selector lookup, no binding, no domain knowledge. Returns id-less line specs (caller
 * attaches ids). Returns [] if any leg lacks a frozen `resolvedAccountId`, so the caller
 * rejects rather than posting to an unresolved account. Extracted verbatim from the
 * procurement engine mapper; behaviour is identical.
 */
import type { PostingLeg, EngineVoucherLineSpec } from './types';

export type { EngineVoucherLineSpec } from './types';

export function buildEngineVoucherLines(legs: PostingLeg[]): EngineVoucherLineSpec[] {
  const lines: EngineVoucherLineSpec[] = [];
  for (const leg of legs) {
    if (!leg.resolvedAccountId) return [];   // not frozen → refuse to post
    lines.push({ accountId: leg.resolvedAccountId, type: leg.side, amount: leg.amount.amount });
  }
  return lines;
}
