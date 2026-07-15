/**
 * Pigmy daily collection helpers (Deposits module — Pigmy).
 *
 * Pigmy accounts are small daily deposits gathered by a collection agent. These pure
 * helpers group accounts by agent and total a collection batch. Unit-tested by
 * scripts/test-pigmy.mjs.
 */
import type { DepositAccount } from '@/types';

/** Distinct, sorted agent names across active Pigmy accounts. */
export function pigmyAgents(accounts: Pick<DepositAccount, 'depositType' | 'status' | 'agent'>[]): string[] {
  const set = new Set<string>();
  for (const a of accounts || []) {
    if (a.depositType === 'PIGMY' && a.status === 'active' && a.agent?.trim()) set.add(a.agent.trim());
  }
  return [...set].sort();
}

/** Active Pigmy accounts assigned to a given agent. */
export function pigmyAccountsForAgent<T extends Pick<DepositAccount, 'depositType' | 'status' | 'agent'>>(accounts: T[], agent: string): T[] {
  return (accounts || []).filter(a => a.depositType === 'PIGMY' && a.status === 'active' && (a.agent ?? '').trim() === agent);
}

/** Total of a collection batch (ignores blank / non-positive entries). */
export function collectionTotal(amounts: (number | string | undefined)[]): number {
  const sum = (amounts || []).reduce<number>((s, a) => {
    const n = Number(a) || 0;
    return s + (n > 0 ? n : 0);
  }, 0);
  return Math.round(sum * 100) / 100;
}
