/**
 * Which ledger does an import row mean? — ONE rule for every importer (opening balances, bulk vouchers).
 *
 * A row names its account in one column. The importers used to take "the first / the last ledger with that
 * name", so a name carried by two ledgers ("Building" the asset and "Building" the depreciation expense;
 * "Rent" income and "Rent" expense) silently posted to whichever came first or last (2026-11-12 chart audit,
 * F-01 / F-02). The rule now:
 *   1. the text is an account CODE (its id, or the readable `code` of a UUID-keyed account) → that ledger;
 *   2. otherwise it is a NAME: exactly one ledger with that name → that ledger;
 *      more than one → AMBIGUOUS, the row is refused and the message lists the codes to write instead;
 *      none → MISSING (or GROUP, when only a group carries the name — a group can't be posted to).
 * Never a guess. PURE — no React, no Supabase.
 */
export interface MatchAccount { id: string; name: string; isGroup?: boolean; type?: string; code?: string }

export type AccountMatch<A extends MatchAccount = MatchAccount> =
  | { status: 'ok'; account: A }
  | { status: 'ambiguous'; candidates: A[] }
  | { status: 'group'; account: A }
  | { status: 'missing' };

const norm = (s: string | undefined | null): string => (s || '').toLowerCase().trim();

/** The code a user sees for an account: its readable `code` when it has one, else its id. */
export const displayCode = (a: MatchAccount): string => (a.code && a.code.trim()) || a.id;

export function matchImportAccount<A extends MatchAccount>(text: string | undefined | null, accounts: ReadonlyArray<A>): AccountMatch<A> {
  const t = norm(text);
  if (!t) return { status: 'missing' };

  // 1. By code — unambiguous by construction (ids are unique; a readable code is unique per society, #706).
  const byCode = accounts.filter((a) => norm(a.id) === t || norm(a.code) === t);
  if (byCode.length === 1) return byCode[0].isGroup ? { status: 'group', account: byCode[0] } : { status: 'ok', account: byCode[0] };

  // 2. By name.
  const sameName = accounts.filter((a) => norm(a.name) === t);
  const ledgers = sameName.filter((a) => !a.isGroup);
  if (ledgers.length === 1) return { status: 'ok', account: ledgers[0] };
  if (ledgers.length > 1) return { status: 'ambiguous', candidates: ledgers };
  if (sameName.length > 0) return { status: 'group', account: sameName[0] };
  return { status: 'missing' };
}

/** "3102 (asset), 5501 (expense)" — for the refusal message. */
export const candidateList = (candidates: ReadonlyArray<MatchAccount>): string =>
  candidates.map((a) => `${displayCode(a)}${a.type ? ` (${a.type})` : ''}`).join(', ');
