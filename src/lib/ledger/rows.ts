/**
 * `ledger_events` rows (snake_case) → the camelCase `LedgerEvent` the projections read. PURE.
 *
 * Extracted from DataContext, which held it as a local const with the comment "One mapper,
 * shared by the society-load journal fetch and the on-demand diagnostic load (RULE 2)".
 * That was true for the two CLIENT readers — but the CAIOS D-lane needs to read the same
 * journal from the Edge Function, and a local const cannot be imported there. Writing a
 * second mapper server-side is exactly the drift RULE 2 forbids: the day the row shape
 * changes, the assistant and the Cash Book page would disagree in front of a user, and
 * the assistant would be the one nobody could explain.
 *
 * So: one mapper, now shared by three readers. No I/O, no React, no Supabase — the shape
 * translation only.
 */
import type { LedgerEvent } from './event';

/**
 * PURE — map raw `ledger_events` rows to LedgerEvent.
 *
 * The optional-field handling is deliberate and load-bearing: `reversalOf` and
 * `onBehalfOf` are OMITTED when null rather than set to null, because the projections
 * test for their presence. Setting them to null would make every event look like a
 * reversal-of-nothing.
 */
export const mapLedgerEventRows = (rows: readonly Record<string, unknown>[]): LedgerEvent[] =>
  rows.map((r) => ({
    eventId: r.event_id as string,
    eventType: r.event_type as string,
    schemaVersion: (r.schema_version as number) ?? 1,
    tenantId: r.society_id as string,
    jurisdiction: (r.jurisdiction as string | null) ?? '',
    aggregateType: r.aggregate_type as string,
    aggregateId: r.aggregate_id as string,
    sequence: r.sequence as number,
    occurredAt: r.occurred_at as string,
    producer: { kind: r.producer_kind as LedgerEvent['producer']['kind'], id: (r.producer_id as string | null) ?? null, ...(r.on_behalf_of ? { onBehalfOf: r.on_behalf_of as string } : {}) },
    ...(r.reversal_of ? { reversalOf: r.reversal_of as string } : {}),
    payload: r.payload,
  })) as LedgerEvent[];
