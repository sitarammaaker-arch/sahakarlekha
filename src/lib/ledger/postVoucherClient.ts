/**
 * Client side of the S3 posting service (migration 077 `post_voucher`). PURE — no I/O.
 *
 * Builds the RPC payload from what addVoucher already has — the voucher and its `voucher.posted`
 * shadow event — so the server writes exactly the legs the app's posting rule produced
 * (getVoucherLines, RULE 2) and the journal gets the SAME event the app keeps in memory. Also turns
 * the server's refusal codes into Hindi-first messages.
 */
import type { Voucher } from '@/types';
import type { LedgerEvent } from './event';
import { getVoucherLines } from '@/lib/voucherUtils';
import { toMinor } from '@/lib/money';

export interface PostVoucherLeg { id: string; accountId: string; drCr: 'Dr' | 'Cr'; amountMinor: number; narration: string | null }

export interface PostVoucherPayload {
  p_voucher: Record<string, unknown>;
  p_lines: PostVoucherLeg[];
  p_event: Record<string, unknown>;
}

/** Local-only / audit fields that never go to the server row. */
const LOCAL_ONLY = ['editHistory'] as const;

export function buildPostVoucherPayload(v: Voucher, event: LedgerEvent): PostVoucherPayload {
  const p_voucher: Record<string, unknown> = { ...v };
  for (const k of LOCAL_ONLY) delete p_voucher[k];
  delete p_voucher.society_id;   // the server takes the society from the JWT
  const p_lines = getVoucherLines(v).map((l) => ({
    id: l.id, accountId: l.accountId, drCr: l.type, amountMinor: toMinor(Number(l.amount) || 0), narration: l.narration ?? null,
  }));
  const p_event = {
    event_id: event.eventId, event_type: event.eventType, schema_version: event.schemaVersion,
    aggregate_type: event.aggregateType, aggregate_id: event.aggregateId, sequence: event.sequence,
    occurred_at: event.occurredAt, producer_kind: event.producer.kind, producer_id: event.producer.id ?? null,
    on_behalf_of: event.producer.onBehalfOf ?? null, payload: event.payload,
  };
  return { p_voucher, p_lines, p_event };
}

/** S4-a (104) · save_pending_voucher payload: the voucher row + its legs (getVoucherLines, RULE 2) — no event,
 *  because a pending voucher is not posted until approve_voucher. */
export function buildPendingVoucherPayload(v: Voucher): { p_voucher: Record<string, unknown>; p_lines: PostVoucherLeg[] } {
  const p_voucher: Record<string, unknown> = { ...v };
  for (const k of LOCAL_ONLY) delete p_voucher[k];
  delete p_voucher.society_id;
  const p_lines = getVoucherLines(v).map((l) => ({
    id: l.id, accountId: l.accountId, drCr: l.type, amountMinor: toMinor(Number(l.amount) || 0), narration: l.narration ?? null,
  }));
  return { p_voucher, p_lines };
}

/** The fields edit_voucher (migration 078) accepts; the server ignores everything else anyway. */
const EDITABLE = ['id', 'type', 'date', 'debitAccountId', 'creditAccountId', 'amount', 'narration', 'memberId', 'lines', 'editHistory'] as const;

/** edit_voucher payload for an edited voucher: its editable fields + its legs (getVoucherLines, RULE 2). */
export function buildEditVoucherPayload(v: Voucher): { p_voucher: Record<string, unknown>; p_lines: PostVoucherLeg[] } {
  const p_voucher: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in v) p_voucher[k] = (v as unknown as Record<string, unknown>)[k];
  const p_lines = getVoucherLines(v).map((l) => ({
    id: l.id, accountId: l.accountId, drCr: l.type, amountMinor: toMinor(Number(l.amount) || 0), narration: l.narration ?? null,
  }));
  return { p_voucher, p_lines };
}

/** Routing-only / local-only document fields that are never columns (the server ignores unknown keys
 *  anyway; stripping keeps the payload honest). */
const DOC_LOCAL_ONLY = ['receivableAccountId', 'society_id'] as const;

/**
 * S3-f-1 · post_stock_document payload (migration 080): the sale/purchase row, its voucher + legs + event
 * (exactly buildPostVoucherPayload — the posting rule stays here, RULE 2) and its stock movements.
 */
export function buildStockDocumentPayload(
  kind: 'sale' | 'purchase', doc: object, voucher: Voucher, event: LedgerEvent, movements: readonly object[],
) {
  const p_doc: Record<string, unknown> = { ...(doc as Record<string, unknown>) };
  for (const k of DOC_LOCAL_ONLY) delete p_doc[k];
  const v = buildPostVoucherPayload(voucher, event);
  const p_movements = movements.map((m) => {
    const x: Record<string, unknown> = { ...(m as Record<string, unknown>) };
    if (!x.godownId) delete x.godownId;
    delete x.society_id;
    return x;
  });
  return { p_kind: kind, p_doc, p_voucher: v.p_voucher, p_lines: v.p_lines, p_event: v.p_event, p_movements };
}

// The refusal-code helpers moved to ./postVoucherMessages (dependency-free, shared with the payroll Edge Functions).
export { postVoucherErrorCode, postVoucherMessage } from './postVoucherMessages';
