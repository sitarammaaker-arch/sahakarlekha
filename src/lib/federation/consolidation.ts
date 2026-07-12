/**
 * Consolidation as re-projection (T-34 / ADR-0009; ADR-0001; INV-6; ADR-0006 exact money).
 *
 * PURE. Tier consolidation rolls UP the federation graph as a RE-PROJECTION over the event log
 * (ADR-0001): each society projects its own trial balance in its own jurisdiction, and a parent
 * tier SUMS those already-projected aggregates. This is what makes cross-jurisdiction consolidation
 * lawful — data governance scopes DOWN, only totals roll UP, so a member's raw PII never crosses a
 * residency boundary (ADR-0009). Consolidation is read-only; it creates no postings.
 *
 *   consolidate         — exact-money sum per account across a set of contributions.
 *   eliminateInterEntity— net out intra-group balances (inter-entity awareness) so the consolidated
 *                         statement shows only the group's external position.
 *   isResidencySafe     — the structural guard: contributions carry only integer-minor aggregates,
 *                         never raw rows/PII — the shape that keeps roll-up residency-safe.
 *   rollUp              — end-to-end: gather a subtree (graph.ts) and consolidate it (INV-6).
 *
 * No I/O; deterministic. Exact money via money.ts.
 */
import { type Minor, addMinor, subMinor } from '../money';
import { subtree, type FederationNode } from './graph';

/** A society's projected balances: accountId → net minor amount. */
export type BalanceMap = Record<string, Minor>;

export interface SocietyContribution {
  societyId: string;
  jurisdiction: string;
  /** Already-projected aggregates (computed in the society's own jurisdiction). */
  balances: BalanceMap;
}

/**
 * PURE — consolidate contributions by summing each account across them with exact money (ADR-0006).
 * A re-projection roll-up: the inputs are aggregates, so the output is an aggregate — no raw rows,
 * no PII.
 */
export function consolidate(contributions: readonly SocietyContribution[]): BalanceMap {
  const out: BalanceMap = {};
  for (const c of contributions) {
    for (const [account, minor] of Object.entries(c.balances)) {
      out[account] = out[account] === undefined ? minor : addMinor(out[account], minor);
    }
  }
  return out;
}

/** An intra-group balance to eliminate — e.g. a loan from the district to a primary appears on both
 *  sides and must not inflate the consolidated group position. */
export interface InterEntityElimination {
  accountId: string;
  amount: Minor;
}

/**
 * PURE — eliminate intra-group (inter-entity) balances from a consolidated map. Intra-group
 * transactions net out, so the consolidated statement reflects only the group's dealings with the
 * outside — standard group-consolidation discipline, applied via exact money.
 */
export function eliminateInterEntity(consolidated: BalanceMap, eliminations: readonly InterEntityElimination[]): BalanceMap {
  const out: BalanceMap = { ...consolidated };
  for (const e of eliminations) {
    out[e.accountId] = subMinor(out[e.accountId] ?? 0, e.amount);
  }
  return out;
}

/**
 * PURE — residency guard: a set of contributions is residency-safe iff every contribution carries
 * ONLY integer-minor aggregates (no nested objects, strings, or PII). This structural check is what
 * proves a roll-up is moving totals, not raw member data, across a jurisdiction boundary (ADR-0009).
 */
export function isResidencySafe(contributions: readonly SocietyContribution[]): boolean {
  return contributions.every(
    (c) =>
      c.balances != null &&
      typeof c.balances === 'object' &&
      Object.values(c.balances).every((v) => Number.isInteger(v)),
  );
}

/**
 * PURE — end-to-end tier roll-up (INV-6): gather the subtree rooted at `rootId` from the federation
 * graph and consolidate the contributions of the societies in it. A primary→district→state roll-up
 * is just a re-projection over a larger scope. Societies with no contribution are skipped.
 */
export function rollUp(
  nodes: readonly FederationNode[],
  rootId: string,
  contributionsBySociety: Readonly<Record<string, SocietyContribution>>,
): BalanceMap {
  const scope = subtree(nodes, rootId);
  const contributions = scope
    .map((n) => contributionsBySociety[n.id])
    .filter((c): c is SocietyContribution => c != null);
  return consolidate(contributions);
}
