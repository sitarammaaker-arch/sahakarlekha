/**
 * Detailed Audit Trail — one chronological list of who did what, when, to which record.
 *
 * PURE. Two sources the app ALREADY keeps; nothing new is recorded:
 *  1. Vouchers themselves — creation (createdAt/createdBy) and every edit (editHistory: the
 *     "before" of each edit; the "after" is the next snapshot or the live voucher).
 *  2. The append-only `audit_log` (WORM) — every other mutation the app logs (members, deposits,
 *     stock, assets, loans, approvals, cancellations, reversals, exports …).
 * A voucher approval / rejection / cancellation also lives on the voucher row (approvedAt,
 * deletedAt …). It is taken from `audit_log` when logged there (richer: role, reason) and from the
 * voucher only when the log has no such entry (older entries, before the log existed) — never twice.
 */
import type { Voucher } from '@/types';

export type TrailSource = 'voucher' | 'audit_log';
export interface TrailEvent {
  at: string;              // ISO timestamp
  actor: string;
  role?: string;
  action: string;          // create | update | cancel | approve | reject | reverse | restore | delete | export | …
  entityType: string;
  entityId: string;
  ref: string;             // human reference (voucher no., member name …)
  details: string;
  reason?: string;
  source: TrailSource;
}

export interface AuditLogRow {
  created_at: string; actor_name?: string | null; actor_email?: string | null; actor_role?: string | null;
  entity_type: string; entity_id?: string | null; action: string;
  before?: unknown; after?: unknown; reason?: string | null; source?: string | null;
}

export const ACTION_LABEL: Record<string, [string, string]> = {
  create: ['Created', 'बनाया'], update: ['Edited', 'बदला'], delete: ['Deleted', 'हटाया'], cancel: ['Cancelled', 'रद्द किया'],
  approve: ['Approved', 'स्वीकृत'], reject: ['Rejected', 'अस्वीकृत'], reverse: ['Reversed', 'उलटा (reversal)'], restore: ['Restored', 'पुनर्स्थापित'],
  export: ['Exported', 'निर्यात'], rehearse: ['Restore rehearsal', 'पुनर्स्थापना अभ्यास'],
};
export const ENTITY_LABEL: Record<string, [string, string]> = {
  voucher: ['Voucher', 'वाउचर'], member: ['Member', 'सदस्य'], deposit: ['Deposit', 'जमा'], stockMovement: ['Stock movement', 'स्टॉक आवाजाही'],
  loan: ['Loan', 'ऋण'], asset: ['Asset', 'परिसंपत्ति'], sale: ['Sale', 'बिक्री'], purchase: ['Purchase', 'खरीद'], employee: ['Employee', 'कर्मचारी'],
  compliance: ['Compliance', 'अनुपालन'], auditObjection: ['Audit objection', 'ऑडिट आपत्ति'], export: ['Export', 'निर्यात'], backup: ['Backup', 'बैकअप'], restore: ['Restore', 'पुनर्स्थापना'],
};
export const actionLabel = (a: string, hi: boolean) => (ACTION_LABEL[a] ? ACTION_LABEL[a][hi ? 1 : 0] : a);
export const entityLabel = (e: string, hi: boolean) => (ENTITY_LABEL[e] ? ENTITY_LABEL[e][hi ? 1 : 0] : e);

const EDIT_FIELDS = ['type', 'date', 'debitAccountId', 'creditAccountId', 'amount', 'narration'] as const;
const show = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** "field: old → new" for every field that changed (flat, key order stable). */
export function diffSummary(before: unknown, after: unknown, nameOf: (key: string, v: unknown) => string = (_k, v) => show(v)): string {
  const b = (before && typeof before === 'object' ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === 'object' ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => (k in b && k in a ? `${k}: ${nameOf(k, b[k])} → ${nameOf(k, a[k])}` : k in a ? `${k}: ${nameOf(k, a[k])}` : `${k}: ${nameOf(k, b[k])} → —`))
    .join('; ');
}

type VoucherLike = Pick<Voucher, 'id' | 'voucherNo' | 'type' | 'date' | 'amount' | 'narration' | 'debitAccountId' | 'creditAccountId' | 'createdAt' | 'createdBy'
  | 'editHistory' | 'isDeleted' | 'deletedAt' | 'deletedBy' | 'deletedReason' | 'approvalStatus' | 'approvedBy' | 'approvedAt' | 'approvalRemarks'>;

export function voucherEvents(vouchers: readonly VoucherLike[], accountName: (id: string) => string = (id) => id): TrailEvent[] {
  const nameOf = (k: string, v: unknown) => ((k === 'debitAccountId' || k === 'creditAccountId') && typeof v === 'string' ? accountName(v) : show(v));
  const out: TrailEvent[] = [];
  for (const v of vouchers) {
    const ref = v.voucherNo || v.id;
    out.push({ at: v.createdAt || v.date, actor: v.createdBy || '—', action: 'create', entityType: 'voucher', entityId: v.id, ref, source: 'voucher',
      details: `${v.type} · ${v.date} · ${v.amount}${v.narration ? ` · ${v.narration}` : ''}` });
    const hist = v.editHistory ?? [];
    hist.forEach((h, i) => {
      const next = i + 1 < hist.length ? hist[i + 1].before : Object.fromEntries(EDIT_FIELDS.map((f) => [f, v[f]]));
      const before = Object.fromEntries(EDIT_FIELDS.filter((f) => f in (h.before ?? {})).map((f) => [f, (h.before as Record<string, unknown>)[f]]));
      const after = Object.fromEntries(Object.keys(before).map((f) => [f, (next as Record<string, unknown>)[f]]));
      out.push({ at: h.editedAt, actor: h.editedBy || '—', action: 'update', entityType: 'voucher', entityId: v.id, ref, source: 'voucher',
        details: diffSummary(before, after, nameOf) || 'no field change recorded' });
    });
    if ((v.approvalStatus === 'approved' || v.approvalStatus === 'rejected') && v.approvedAt) {
      out.push({ at: v.approvedAt, actor: v.approvedBy || '—', action: v.approvalStatus === 'approved' ? 'approve' : 'reject', entityType: 'voucher', entityId: v.id, ref, source: 'voucher',
        details: '', reason: v.approvalRemarks || undefined });
    }
    if (v.isDeleted) {
      out.push({ at: v.deletedAt || v.createdAt || v.date, actor: v.deletedBy || '—', action: 'cancel', entityType: 'voucher', entityId: v.id, ref, source: 'voucher',
        details: '', reason: v.deletedReason || undefined });
    }
  }
  return out;
}

export function auditRowEvents(rows: readonly AuditLogRow[], refOf: (entityType: string, entityId: string) => string = (_t, id) => id): TrailEvent[] {
  return rows.map((r) => {
    const id = r.entity_id ?? '';
    return {
      at: r.created_at, actor: r.actor_name || r.actor_email || '—', role: r.actor_role || undefined, action: r.action,
      entityType: r.entity_type, entityId: id, ref: id ? refOf(r.entity_type, id) : '—',
      details: diffSummary(r.before, r.after), reason: r.reason || undefined, source: 'audit_log' as const,
    };
  });
}

/** Merge both sources; a voucher approve/reject/cancel already in the log is not repeated from the voucher row. Newest first. */
export function mergeTrail(fromVouchers: readonly TrailEvent[], fromLog: readonly TrailEvent[]): TrailEvent[] {
  const logged = new Set(fromLog.filter((e) => e.entityType === 'voucher').map((e) => `${e.entityId}|${e.action}`));
  const keep = fromVouchers.filter((e) => e.action === 'create' || e.action === 'update' || !logged.has(`${e.entityId}|${e.action}`));
  return [...keep, ...fromLog].sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export interface TrailFilter { from?: string; to?: string; entityType?: string; actor?: string; q?: string }
export function filterTrail(events: readonly TrailEvent[], f: TrailFilter): TrailEvent[] {
  const q = (f.q || '').trim().toLowerCase();
  return events.filter((e) => {
    const d = (e.at || '').slice(0, 10);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    if (f.entityType && e.entityType !== f.entityType) return false;
    if (f.actor && e.actor !== f.actor) return false;
    if (q && !`${e.ref} ${e.details} ${e.reason ?? ''} ${e.actor}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
