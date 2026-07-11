/**
 * Append-only audit log (P0 #3 / ECR-03 / SL-01).
 *
 * One immutable, system-wide trail of WHO did WHAT to WHICH record, WHEN, and WHY —
 * replacing the scattered `console.info('[AUDIT-DELETE]')` lines. Writes to the WORM
 * `audit_log` table (INSERT + SELECT only; no UPDATE/DELETE → immutable at the DB).
 *
 * ── TWO CONTRACTS. Pick the right one; they fail in OPPOSITE directions. ─────────────
 *
 * 1. `logAudit` — BUSINESS MUTATIONS (create/update/delete/approve/…).
 *    STRICTLY NON-BLOCKING: never throws into, blocks, or rolls back the business write.
 *    A logging failure (e.g. table not yet migrated) is caught and warned, never surfaced.
 *    Rationale: an audit-log outage must NEVER prevent a society from saving a voucher.
 *
 * 2. `logAuditBlocking` / `logExportAudit` — DATA CUSTODY (export/restore).
 *    STRICTLY BLOCKING: awaited, and THROWS on failure. The caller MUST abort the
 *    operation and deliver no bytes.
 *    Rationale: an untraced bulk export of member PII is worse than a failed one. Under
 *    the DPDP Act, "who took the member list, and when" must always be answerable.
 *
 * DO NOT "simplify" (2) by reusing (1). Swallowing the error there silently reopens the
 * compliance gap that this module exists to close. See ROADMAP-DATA-PORTABILITY T-02.
 *
 * The pure helpers (`buildAuditEvent`, `buildExportAuditEvent`, `redact`,
 * `throwIfAuditFailed`) are unit-tested by scripts/test-audit-log.mjs (mirror pattern,
 * as test-nav.mjs). The side-effecting inserts are not.
 */
import { supabase } from '@/lib/supabase';

/**
 * `export` and `restore` (T-02) are DATA-CUSTODY actions, not business mutations.
 * They MUST be written with `logAuditBlocking` / `logExportAudit`, never `logAudit`.
 * See "Two contracts" above.
 */
export type AuditAction =
  | 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'cancel' | 'restore' | 'reverse'
  | 'export' | 'rehearse';

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

// ─── CONTRACT 2: data custody (export / restore) — BLOCKING, THROWS ──────────────────

/** Thrown when a custody-action audit row could not be written. Callers MUST abort. */
export class AuditWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditWriteError';
  }
}

/** What an export delivered. Goes into the event's `after` snapshot (PII-redacted). */
export interface ExportAuditInput {
  exportId: string;                    // job id, or a generated id for an inline export
  entities: string[];                  // registry entity keys included
  format: 'csv' | 'xlsx' | 'pdf' | 'json' | 'zip';
  mode: 'standard' | 'full' | 'redacted' | 'statutory';
  rowCount: number;
  filters?: Record<string, unknown>;   // date range, includeDeleted, etc.
  artifactSha256?: string;
  byteSize?: number;
}

/**
 * PURE — throw if the audit insert reported an error. Isolated so the inverted
 * failure semantics are unit-testable without mocking Supabase.
 */
export function throwIfAuditFailed(error: { message: string } | null | undefined): void {
  if (error) throw new AuditWriteError(`Audit write failed: ${error.message}`);
}

/** PURE — shapes an export event. Deterministic given (input, ctx). */
export function buildExportAuditEvent(input: ExportAuditInput, ctx: AuditContext) {
  return buildAuditEvent({
    entityType: 'export',
    entityId: input.exportId,
    action: 'export',
    after: {
      entities: input.entities,
      format: input.format,
      mode: input.mode,
      rowCount: input.rowCount,
      filters: input.filters ?? null,
      artifactSha256: input.artifactSha256 ?? null,
      byteSize: input.byteSize ?? null,
    },
  }, ctx);
}

/**
 * BLOCKING audit write for custody actions. Awaited; THROWS on failure.
 * The caller must let the throw propagate and abort the operation.
 */
export async function logAuditBlocking(input: AuditInput, ctx: AuditContext): Promise<void> {
  const row = buildAuditEvent(input, ctx);
  const { error } = await supabase.from('audit_log').insert(row);
  throwIfAuditFailed(error);
}

/**
 * BLOCKING audit write for an export. Call this BEFORE delivering any bytes to the user.
 * If it throws, deliver nothing.
 */
export async function logExportAudit(input: ExportAuditInput, ctx: AuditContext): Promise<void> {
  const row = buildExportAuditEvent(input, ctx);
  const { error } = await supabase.from('audit_log').insert(row);
  throwIfAuditFailed(error);
}

// ─── CONTRACT 2 (custody): restore-rehearsal EVIDENCE — the T-35 persisted proof ─────
//
// A rehearsal proves a backup restores to the same BOOKS (see lib/backup/rehearsal.ts).
// T-35's remaining half is PERSISTING that proof, so `backupHealth` can go green across
// reloads and the UI may honestly say "backup" (Digital Preservation DP-P7; ADR-0001:
// the evidence is an append-only, attributed record, and "current health" is a projection
// over these rows — never a mutable stored flag).
//
// PRIVACY (Canonical CL-6, ADR-0007): the evidence is STATUS + COUNTS + TIMESTAMPS only —
// never a monetary figure, an account/member id, or any per-record detail. `mismatch*` are
// COUNTS of differing accounts/items, not which ones and not by how much.
//
// It reuses the WORM `audit_log` (action='rehearse'), so there is NO new table and NO
// schema change. Written blocking (awaited, throws) so a failure to record is visible; the
// caller catches it — a rehearsal is read-only, so there is nothing to roll back, only a
// note that the proof was not recorded.

/** What a rehearsal proved. STATUS + COUNTS only — no figures, no ids, no PII. */
export interface RehearsalAuditInput {
  /** The rehearsed backup's identity (manifest hash or filename), for the trail. */
  backupRef?: string | null;
  /** When the rehearsed backup was created — the freshness the health card reads. */
  backupCreatedAt: string | null;
  /** Did the restored books reproduce the live books exactly? */
  passed: boolean;
  /** Did the LIVE books themselves balance (Dr = Cr, CL-1)? A finding of its own. */
  sourceBalanced: boolean;
  entryCount: number;
  stockItemCount: number;
  /** COUNT of accounts that differed — never which, never by how much. */
  mismatchAccounts: number;
  /** COUNT of stock items that differed. */
  mismatchItems: number;
}

/** PURE — shapes a rehearsal-evidence event. Deterministic given (input, ctx). */
export function buildRehearsalAuditEvent(input: RehearsalAuditInput, ctx: AuditContext) {
  return buildAuditEvent({
    entityType: 'backup',
    entityId: input.backupRef ?? input.backupCreatedAt ?? 'unknown',
    action: 'rehearse',
    after: {
      passed: input.passed,
      backupCreatedAt: input.backupCreatedAt,
      sourceBalanced: input.sourceBalanced,
      entryCount: input.entryCount,
      stockItemCount: input.stockItemCount,
      mismatchAccounts: input.mismatchAccounts,
      mismatchItems: input.mismatchItems,
    },
  }, ctx);
}

/**
 * BLOCKING evidence write for a rehearsal. Awaited; THROWS on failure so the operator can
 * be told "the proof was not recorded". Unlike an export, there is nothing to abort — the
 * rehearsal already ran read-only — so the caller catches and surfaces, never rolls back.
 */
export async function logRehearsalAudit(input: RehearsalAuditInput, ctx: AuditContext): Promise<void> {
  const row = buildRehearsalAuditEvent(input, ctx);
  const { error } = await supabase.from('audit_log').insert(row);
  throwIfAuditFailed(error);
}
