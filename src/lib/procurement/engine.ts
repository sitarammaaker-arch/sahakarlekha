/**
 * Procurement Phase 3.3 — Financial Engine mapper (PURE). Maps a PostingRuleResult's already-
 * resolved legs into accounting VoucherLine specs. NO React / Supabase / storage / toast / side
 * effects, and NO selector lookup or binding dependency — it uses ONLY the frozen
 * `resolvedAccountId` on each leg. accountCode / accountName exist for audit and are never used here.
 *
 * Returns id-less line specs (the caller attaches ids). Returns [] if any leg is missing its frozen
 * `resolvedAccountId`, so the caller rejects rather than posting to an unresolved account.
 */
import type { PostingLeg } from './financial';

export interface EngineVoucherLineSpec {
  accountId: string;
  type: 'Dr' | 'Cr';
  amount: number;
}

export function buildEngineVoucherLines(legs: PostingLeg[]): EngineVoucherLineSpec[] {
  const lines: EngineVoucherLineSpec[] = [];
  for (const leg of legs) {
    if (!leg.resolvedAccountId) return [];   // not frozen → refuse to post
    lines.push({ accountId: leg.resolvedAccountId, type: leg.side, amount: leg.amount.amount });
  }
  return lines;
}
