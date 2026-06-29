/**
 * Shared posting core — domain-rule-FREE accounting primitives.
 *
 * This layer holds ONLY generic, reusable infrastructure shared by every domain
 * (procurement, labour, …). It contains NO business rules — no intent enums, no
 * account bindings, no domain entities. Procurement and Labour are siblings: both
 * may import from here; neither imports from the other.
 *
 * Compile-time TYPES only (no runtime behaviour).
 */

/** Debit / Credit side of a double-entry leg. */
export type PostingSide = 'Dr' | 'Cr';

/** Currency-tagged monetary amount (never a bare number). ISO 4217; default 'INR'. */
export interface Money {
  amount: number;
  currency: string;
}

/**
 * A double-entry posting leg with a FROZEN account snapshot. `resolvedAccountId` is
 * the only field used for posting; `accountCode`/`accountName` are audit/history.
 * Identical shape to the procurement PostingLeg it was extracted from.
 */
export interface PostingLeg {
  side: PostingSide;
  accountSelector: string;          // symbolic — audit/debugging only
  resolvedAccountId?: string;
  accountCode?: string;
  accountName?: string;
  amount: Money;
}

/** A raw (unresolved) leg: side + symbolic selector, before account freezing. */
export interface RawPostingLeg {
  side: PostingSide;
  accountSelector: string;
}

/** Id-less voucher line spec produced from frozen legs (caller attaches ids). */
export interface EngineVoucherLineSpec {
  accountId: string;
  type: PostingSide;
  amount: number;
}
