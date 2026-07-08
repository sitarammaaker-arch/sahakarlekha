/**
 * Append-only audit log (P0 #3 / ECR-03 / SL-01).
 *
 * One immutable, system-wide trail of WHO did WHAT to WHICH record, WHEN, and WHY —
 * replacing the scattered `console.info('[AUDIT-DELETE]')` lines. Writes to the WORM
 * `audit_log` table (INSERT + SELECT only; no UPDATE/DELETE → immutable at the DB).
 *
 * `logAudit` is STRICTLY NON-BLOCKING: it never throws into, blocks, or rolls back the
 * business write. A logging failure (e.g. table not yet migrated) is caught and warned,
 * never surfaced to the user or the caller. The pure helpers (`buildAuditEvent`, `redact`)
 * are unit-tested by scripts/test-audit-log.mjs (mirror pattern, as test-nav.mjs).
 */
import { supabase } from '@/lib/supabase';

export type AuditAction = 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'cancel' | 'restore';

export interface AuditActor {
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface AuditInput {
  entityType: string;             // 'member' | 'purchase' | 'asset' | 'auditObjection' | 'voucher' | …
  entityId: string;
  action: AuditAction;
  before?: unknown;               // prior state (redacted); omit if N/A
  after?: unknown;                // new state (redacted); omit if N/A
  reason?: string;
  source?: string;                // default 'app'
}

export interface AuditContext {
  societyId: string;
  actor: AuditActor;
  now?: string;                   // ISO timestamp; defaults to now() (injectable for tests)
}

/** Sensitive keys masked in before/after snapshots so the trail never stores raw PII. */
export const PII_KEYS: ReadonlySet<string> = new Set([
  'phone', 'nomineePhone', 'pan', 'entityPan', 'deducteePan', 'aadhaar', 'aadhaarNo', 'password',
]);

/** PURE — shallow/deep copy with PII keys masked. Arrays and nested objects handled. */
export function redact<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = PII_KEYS.has(k) ? '***' : (v && typeof v === 'object' ? redact(v) : v);
  }
  return out as T;
}

/** PURE — shapes the audit row. Deterministic given (input, ctx). */
export function buildAuditEvent(input: AuditInput, ctx: AuditContext) {
  return {
    society_id: ctx.societyId,
    actor_name: ctx.actor?.name ?? null,
    actor_email: ctx.actor?.email ?? null,
    actor_role: ctx.actor?.role ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    before: input.before === undefined ? null : redact(input.before),
    after: input.after === undefined ? null : redact(input.after),
    reason: input.reason ?? null,
    source: input.source ?? 'app',
    created_at: ctx.now ?? new Date().toISOString(),
  };
}

/**
 * Fire-and-forget audit write. NEVER awaited by callers and NEVER throws — a failure is
 * logged to the console and swallowed, so it cannot affect the business transaction.
 */
export function logAudit(input: AuditInput, ctx: AuditContext): void {
  try {
    const row = buildAuditEvent(input, ctx);
    void supabase.from('audit_log').insert(row).then(
      ({ error }) => { if (error) console.warn('[audit] write failed (run audit_log migration?):', error.message); },
      (e) => console.warn('[audit] write rejected:', e),
    );
  } catch (e) {
    console.warn('[audit] logAudit error:', e);
  }
}
