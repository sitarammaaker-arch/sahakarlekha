/**
 * Genesis backfill (T-06 / ADR-0001) — seed the append-only journal from the CURRENT vouchers, so
 * replay reproduces the EXISTING trial balance (not just events emitted after go-live). PURE: the
 * ops script (scripts/backfill-genesis-ledger.mjs) does the Supabase I/O; this decides the events.
 *
 * One `voucher.posted` event per ACTIVE voucher, carrying its posting legs (voucherPostingLines) so
 * projectTrialBalance/replayBalances reconstruct balances. Deleted vouchers are omitted (a cancelled
 * voucher already nets to zero, so leaving it out is equivalent and cleaner); pending (unapproved)
 * vouchers are omitted to match the live post path and the reports, which don't count them.
 */
import type { Voucher, LedgerAccount } from '@/types';
import { toMinor } from '@/lib/money';
import type { LedgerEvent, EventPrincipal } from './event';
import { buildEvent } from './event';
import { voucherPostingLines, voucherEventMeta } from './voucherEvent';

/** One voucher plus its tenant scoping, as the ops script reads it from Supabase. */
export interface GenesisInput {
  voucher: Voucher;
  tenantId: string;        // society_id
  jurisdiction?: string;   // T-01 tenant column (defaults to '')
}

export interface GenesisPlan {
  events: LedgerEvent[];
  seeded: number;
  skippedDeleted: number;
  skippedPending: number;
  /** no posting legs, no date, or no tenant — nothing to seed. */
  skippedEmpty: number;
}

/** Deterministic id so a re-run upserts the SAME row (idempotent) — distinct from live-path UUIDs. */
export function genesisEventId(voucherId: string): string {
  return `genesis-${voucherId}`;
}

/**
 * PURE — the genesis events for a set of vouchers. A voucher.posted event (seq 1) per active,
 * approved voucher, timestamped at the voucher's own date so as-of-date replay is correct. Skips
 * deleted / pending / legless / undated / untenanted rows with a counted reason. Deterministic ids
 * make the whole backfill idempotent under upsert-on-conflict.
 */
export function planGenesisEvents(
  inputs: readonly GenesisInput[],
  producer: EventPrincipal = { kind: 'import', id: 'genesis-backfill' },
): GenesisPlan {
  const events: LedgerEvent[] = [];
  let skippedDeleted = 0, skippedPending = 0, skippedEmpty = 0;
  for (const { voucher: v, tenantId, jurisdiction } of Array.isArray(inputs) ? inputs : []) {
    if (v.isDeleted) { skippedDeleted++; continue; }
    if (v.approvalStatus === 'pending') { skippedPending++; continue; }
    const lines = voucherPostingLines(v);
    if (lines.length === 0 || !v.date || !tenantId) { skippedEmpty++; continue; }
    events.push(
      buildEvent(
        {
          eventType: 'voucher.posted',
          tenantId,
          jurisdiction,
          aggregateType: 'voucher',
          aggregateId: v.id,
          sequence: 1,
          producer,
          payload: { lines, ...voucherEventMeta(v), genesis: true },
        },
        { eventId: genesisEventId(v.id), occurredAt: `${v.date}T00:00:00.000Z` },
      ),
    );
  }
  return { events, seeded: events.length, skippedDeleted, skippedPending, skippedEmpty };
}

/** Deterministic id for an account's opening-balance event (idempotent under upsert). */
export function openingEventId(accountId: string): string {
  return `opening-${accountId}`;
}

/**
 * PURE — genesis events for the accounts' OPENING BALANCES (T-06). getTrialBalance = opening balances
 * (account.openingBalance/Type) + voucher postings, so the journal must carry the openings too or a
 * ledger-derived trial balance is short by them. One `account.opening` event per account with a
 * non-zero opening balance: a single leg (Dr if openingBalanceType is 'debit', else Cr), dated at
 * `openingDate` so it sorts before every voucher. Deterministic ids → idempotent.
 */
export function planOpeningEvents(
  accounts: readonly LedgerAccount[],
  tenantId: string,
  opts: { openingDate: string; jurisdiction?: string; producer?: EventPrincipal },
): LedgerEvent[] {
  const producer = opts.producer ?? { kind: 'import', id: 'genesis-opening' };
  const events: LedgerEvent[] = [];
  for (const a of Array.isArray(accounts) ? accounts : []) {
    const amountMinor = toMinor(Number(a.openingBalance) || 0);
    if (amountMinor === 0 || !tenantId) continue;
    const drCr: 'Dr' | 'Cr' = a.openingBalanceType === 'debit' ? 'Dr' : 'Cr';
    events.push(
      buildEvent(
        {
          eventType: 'account.opening',
          tenantId,
          jurisdiction: opts.jurisdiction,
          aggregateType: 'account',
          aggregateId: a.id,
          sequence: 1,
          producer,
          payload: { lines: [{ accountId: a.id, drCr, amountMinor }], opening: true },
        },
        { eventId: openingEventId(a.id), occurredAt: `${opts.openingDate}T00:00:00.000Z` },
      ),
    );
  }
  return events;
}

/** The business-effective date of every opening event — before all vouchers, so any as-of window
 *  includes it (matches planOpeningEvents' genesis convention). */
export const OPENING_EVENT_DATE = '2000-01-01';

/**
 * PURE — the LIVE-path counterpart of planOpeningEvents (T-09 auto-cutover). ledger_events is WORM
 * (insert-only from the client), so when an account's opening balance CHANGES the journal cannot
 * rewrite `opening-<id>` — it appends a DELTA `account.opening` event whose single leg is the signed
 * difference (new − previous). Summing all of an account's opening events then always equals the
 * current opening, so ledger parity holds without any ops re-seed. Same eventType as genesis so the
 * split trial balance books it in the OPENING columns; dated at OPENING_EVENT_DATE so every as-of
 * window sees it. Returns null when nothing changed (no event to append).
 *
 * `prevSignedMinor` is the opening the journal currently sums to for this account (Dr-positive):
 * 0 for a brand-new account, or the account's previous signed opening on an edit. On DELETE pass the
 * account's current signed opening as prev and a zeroed account — the delta nets the journal to zero.
 */
export function planOpeningDelta(
  account: Pick<LedgerAccount, 'id' | 'openingBalance' | 'openingBalanceType'>,
  prevSignedMinor: number,
  sequence: number,
  tenantId: string,
  opts: { jurisdiction?: string; producer?: EventPrincipal } = {},
): LedgerEvent | null {
  if (!tenantId || !account?.id) return null;
  const amt = toMinor(Number(account.openingBalance) || 0);
  const newSignedMinor = account.openingBalanceType === 'debit' ? amt : -amt;
  const deltaMinor = newSignedMinor - prevSignedMinor;
  if (deltaMinor === 0) return null;
  return buildEvent(
    {
      eventType: 'account.opening',
      tenantId,
      jurisdiction: opts.jurisdiction,
      aggregateType: 'account',
      aggregateId: account.id,
      sequence,
      producer: opts.producer ?? { kind: 'human', id: null },
      payload: {
        lines: [{ accountId: account.id, drCr: deltaMinor > 0 ? 'Dr' : 'Cr', amountMinor: Math.abs(deltaMinor) }],
        opening: true,
        adjustment: true,
        prevSignedMinor,
        newSignedMinor,
      },
    },
    { eventId: `${openingEventId(account.id)}-${sequence}`, occurredAt: `${OPENING_EVENT_DATE}T00:00:00.000Z` },
  );
}
