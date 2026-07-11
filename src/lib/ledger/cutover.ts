/**
 * Cutover gate — flipping the source of truth to the ledger, SAFELY (T-09 / ADR-0001; MR-1;
 * RULE 1).
 *
 * PURE. T-09 makes the event journal (T-06) the authoritative read source, with the existing
 * tables demoted to a projection. That flip is the highest-blast-radius change in the whole
 * roadmap, so it is GATED:
 *
 *   1. `checkParity` — the empty-diff check. Does the LEDGER projection (projectTrialBalance,
 *      T-07) reproduce the CURRENT state-derived report EXACTLY, account for account? Any
 *      difference is listed (both figures) for the operator to reconcile.
 *   2. `readSource` — the gate AND the rollback in one function. A tenant reads from the ledger
 *      ONLY when its per-tenant flag is on AND parity has passed; otherwise it reads STATE —
 *      today's behaviour. So an empty or lagging journal can NEVER become the read source, and
 *      turning the flag off is an instant rollback.
 *
 * This is what lets the RULE 1 failure class be retired only once the ledger provably equals
 * the current books — never on hope. The live flip (compute both reports, run the check, set
 * the flag per tenant) is an operated step that must be verified against real data.
 */

/** A normalized, comparable report: accountId → net balance in minor units (Dr positive).
 *  Both the ledger projection and the current state report reduce to this shape. */
export type BalanceMap = Record<string, number>;

/** PURE — reduce a trial-balance projection (or any {lines:[{accountId, netMinor}]}) to a map. */
export function trialBalanceToMap(tb: { lines: readonly { accountId: string; netMinor: number }[] }): BalanceMap {
  const map: BalanceMap = {};
  for (const l of tb.lines) map[l.accountId] = l.netMinor;
  return map;
}

export interface ParityDifference {
  accountId: string;
  ledgerMinor: number;
  stateMinor: number;
}

export interface ParityResult {
  /** True only when the ledger reproduces the state report exactly — an empty diff. */
  parity: boolean;
  /** Every account whose net differs, both figures, sorted — what the operator reconciles. */
  differences: ParityDifference[];
}

/**
 * PURE — the empty-diff parity check (T-09 / MR-1). An account present in one side and absent
 * in the other is compared against zero, so a ledger that omits or invents an account fails.
 */
export function checkParity(ledger: BalanceMap, state: BalanceMap): ParityResult {
  const accounts = [...new Set([...Object.keys(ledger), ...Object.keys(state)])].sort();
  const differences: ParityDifference[] = [];
  for (const a of accounts) {
    const l = ledger[a] ?? 0;
    const s = state[a] ?? 0;
    if (l !== s) differences.push({ accountId: a, ledgerMinor: l, stateMinor: s });
  }
  return { parity: differences.length === 0, differences };
}

export type ReadSource = 'state' | 'ledger';

/**
 * PURE — which source a tenant reads from. The ledger becomes authoritative ONLY when the
 * per-tenant flag is on AND parity has passed; in every other case (flag off, parity not yet
 * verified, verification failed) it reads STATE — today's behaviour. This single rule is both
 * the flip's gate and its rollback: flip the flag off and the tenant is instantly back on state.
 */
export function readSource(opts: { ledgerFlag: boolean; parityPassed: boolean }): ReadSource {
  return opts.ledgerFlag && opts.parityPassed ? 'ledger' : 'state';
}
