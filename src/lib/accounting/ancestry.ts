/**
 * "Is this account under that head?" — at ANY depth, not just the direct parent.
 *
 * A society may open a sub-group under a standard head (Ledger Heads allows it: "Members — Village A"
 * under 1100 Share Capital, a creditors' sub-group under 2101, …) and keep its ledgers inside it. A reader
 * that asks `account.parentId === '1100'` then silently drops every one of those ledgers from its total
 * (2026-11-12 audit, F-06: production had share-capital and creditor ledgers sitting in such sub-groups).
 * The Trading A/c got the same fix for 4100 / 5100 in lib/tradingAccount (tradingHeadOf); this is the
 * general form, for every other reader. PURE — no React, no Supabase.
 */
export type ParentOf = ReadonlyMap<string, string | undefined>;

/** id → parentId for a chart. Build once per computation and pass it to isUnder. */
export const parentMap = (accounts: ReadonlyArray<{ id: string; parentId?: string }>): ParentOf =>
  new Map(accounts.map((a) => [a.id, a.parentId]));

/** The first of `heads` found on the account's ancestor chain (nearest first), or undefined. Cycle-safe. */
export function headAbove(
  account: { id: string; parentId?: string } | undefined,
  heads: ReadonlySet<string>,
  parentOf: ParentOf,
): string | undefined {
  if (!account) return undefined;
  const seen = new Set<string>([account.id]);
  let p = account.parentId;
  while (p && !seen.has(p)) {
    if (heads.has(p)) return p;
    seen.add(p);
    p = parentOf.get(p);
  }
  return undefined;
}

/** true when `headId` is an ancestor of the account at any depth (the account itself does not count). */
export function isUnder(
  account: { id: string; parentId?: string } | undefined,
  headId: string,
  parentOf: ParentOf,
): boolean {
  return headAbove(account, new Set([headId]), parentOf) === headId;
}

/** Ids of the postable (non-group) accounts under `headId` at any depth, in chart order. */
export function ledgerIdsUnder(
  accounts: ReadonlyArray<{ id: string; parentId?: string; isGroup?: boolean }>,
  headId: string,
): string[] {
  const parentOf = parentMap(accounts);
  return accounts.filter((a) => !a.isGroup && isUnder(a, headId, parentOf)).map((a) => a.id);
}
