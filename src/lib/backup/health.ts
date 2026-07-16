/**
 * Backup Health (T-35 acceptance 3 / gap EXP-04).
 *
 * PURE. `now` is injected, never read from the clock, so the verdict is deterministic and
 * testable. Date maths uses Date.parse over injected ISO strings — no `new Date()`, no
 * `Date.now()`, nothing non-deterministic.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE ONE RULE: NEVER GREEN ON MISSING DATA.
 *
 * A health card exists to answer "is this society's data safe?" The dangerous answer is a
 * green light that means "we have not checked." So green requires four POSITIVE facts, all
 * present and all fresh:
 *
 *   1. a backup was taken, and recently;
 *   2. that backup was verified;
 *   3. a rehearsal RESTORED it and the books matched — recently;
 *   4. the copies are PLACED safely — 3-2-1 / LOCKSS (T-36 / DP-P4).
 *
 * Absent any one of them, the card is amber or red, never green. In particular:
 *
 *   * A backup that was never rehearsed is UNPROVEN. It may be perfect; it may be a ZIP of
 *     nothing. Until a rehearsal restores it and the trial balance ties, "the backup works"
 *     is a hope. Amber, never green.
 *   * A rehearsal that FAILED is a known-bad backup. Red. This is worse than no backup,
 *     because it looked like safety.
 *   * A backup whose copies all sit with ONE vendor is one outage — or one ransomware event,
 *     or one vendor's bankruptcy — from total loss (placement.ts). A perfectly restorable
 *     single-vendor backup is still not safe, so it cannot be green. Amber. And a placement
 *     that was never evaluated is missing data, which by THE ONE RULE is also never green.
 *
 * This is why the roadmap says: do not ship the word "backup" in the UI until a rehearsal
 * is green. This function is what enforces that — it cannot be made to say green without a
 * passing, fresh rehearsal.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
import type { Placement321Verdict } from './placement';

export type HealthStatus = 'green' | 'amber' | 'red' | 'unknown';

export interface RehearsalOutcome {
  at: string;        // ISO
  passed: boolean;
}

export interface HealthInputs {
  /** ISO of the last SUCCESSFUL backup, or null if none was ever taken. */
  lastBackupAt: string | null;
  /** ISO of the last successful verification, or null. */
  lastVerifyAt: string | null;
  /** The last rehearsal, or null if the backup has never been rehearsed. */
  lastRehearsal: RehearsalOutcome | null;
  /** Injected current time (ISO). */
  now: string;
  /** How many days before a backup or rehearsal is considered stale. Default 7 (weekly, D6). */
  freshnessDays?: number;
  /**
   * The 3-2-1 / LOCKSS verdict for where the copies actually live (evaluate321, T-36 / DP-P4).
   * null/undefined ⇒ the placement was never evaluated — missing data, so never green.
   */
  placement?: Placement321Verdict | null;
}

export interface BackupHealth {
  status: HealthStatus;
  /** Every reason the card is not green, in priority order. Empty ⇒ green. */
  reasons: string[];
  backupAgeDays: number | null;
  rehearsalAgeDays: number | null;
  /** True only when a fresh, passing rehearsal exists — the fact that unlocks green. */
  proven: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole-day age from an ISO string to `now`, or null when either is missing/unparseable. */
function ageDays(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY_MS);
}

/**
 * PURE — the backup health verdict.
 *
 * Reasons are collected in priority order and the status is the WORST condition found, so a
 * failed rehearsal (red) is never softened to amber by also being stale.
 */
export function backupHealth(inputs: HealthInputs): BackupHealth {
  const freshnessDays = inputs.freshnessDays ?? 7;
  const now = Date.parse(inputs.now);

  if (Number.isNaN(now)) {
    return { status: 'unknown', reasons: ['the current time is unknown'], backupAgeDays: null, rehearsalAgeDays: null, proven: false };
  }

  const backupAgeDays = ageDays(inputs.lastBackupAt, now);
  const rehearsalAgeDays = ageDays(inputs.lastRehearsal?.at ?? null, now);

  const reasons: string[] = [];
  let red = false;

  // Backup existence and freshness.
  if (backupAgeDays === null) {
    reasons.push('no backup has ever been taken');
    red = true;
  } else if (backupAgeDays > freshnessDays) {
    reasons.push(`the last backup is ${backupAgeDays} days old`);
  }

  // Verification.
  if (!inputs.lastVerifyAt) {
    reasons.push('the last backup was never verified');
  }

  // Rehearsal — the fact that unlocks green.
  let proven = false;
  if (!inputs.lastRehearsal) {
    reasons.push('the backup has never been rehearsed — it is not proven restorable');
  } else if (!inputs.lastRehearsal.passed) {
    reasons.push('the last rehearsal FAILED — the backup did not reproduce the books');
    red = true;
  } else if (rehearsalAgeDays !== null && rehearsalAgeDays > freshnessDays) {
    reasons.push(`the last successful rehearsal is ${rehearsalAgeDays} days old`);
  } else {
    proven = true;
  }

  // Placement (T-36 / DP-P4) — a restorable backup whose copies all sit with one vendor is still
  // one outage from total loss. Amber, never red: the bytes do restore; they are just not durable.
  if (!inputs.placement) {
    reasons.push('the copy placement has never been evaluated — 3-2-1 is unproven');
  } else if (!inputs.placement.ok) {
    for (const d of inputs.placement.deficiencies) reasons.push(`placement: ${d}`);
  }

  let status: HealthStatus;
  if (reasons.length === 0) status = 'green';
  else if (red) status = 'red';
  else status = 'amber';

  return { status, reasons, backupAgeDays, rehearsalAgeDays, proven };
}

/**
 * A `rehearse` row read back from `audit_log` — only the fields health needs.
 * Its `after` payload is written by `buildRehearsalAuditEvent` (lib/auditLog.ts).
 */
export interface RehearsalAuditRow {
  created_at?: string | null;
  after?: { passed?: unknown; backupCreatedAt?: unknown } | null;
}

/**
 * PURE — backup health projected from the PERSISTED rehearsal evidence (T-35).
 *
 * The append-only `audit_log` `rehearse` rows are the record; "current health" is derived
 * from the LATEST of them (ADR-0001 / CL-4 — a projection, never a stored flag). No rows ⇒
 * "never rehearsed" ⇒ amber/red, never green. Deterministic: `now` is injected, dates are
 * parsed from ISO strings, nothing reads the clock (so the purity scan stays green).
 */
export function healthFromRehearsalRows(
  rows: readonly RehearsalAuditRow[],
  now: string,
  freshnessDays?: number,
  placement?: Placement321Verdict | null,
): BackupHealth {
  let latest: RehearsalAuditRow | null = null;
  let latestMs = -Infinity;
  for (const r of rows) {
    const at = r?.created_at;
    if (!at) continue;
    const ms = Date.parse(at);
    if (Number.isNaN(ms)) continue;
    if (ms > latestMs) { latestMs = ms; latest = r; }
  }
  if (!latest) {
    return backupHealth({ lastBackupAt: null, lastVerifyAt: null, lastRehearsal: null, now, freshnessDays, placement });
  }
  const at = latest.created_at as string;
  const passed = latest.after?.passed === true;
  const backupCreatedAt =
    typeof latest.after?.backupCreatedAt === 'string' ? latest.after.backupCreatedAt : at;
  // A rehearsal verifies the archive before comparing, so a recorded rehearsal is also a
  // recorded verification at the same instant.
  return backupHealth({ lastBackupAt: backupCreatedAt, lastVerifyAt: at, lastRehearsal: { at, passed }, now, freshnessDays, placement });
}

/**
 * A `backup` `export` row read back from `audit_log` — only the field the placement gate needs.
 * Its `after` payload is written by supabase/functions/scheduled-backup (T-36 step B), which grades
 * the run's own placement with evaluate321 and records the verdict.
 */
export interface BackupAuditRow {
  created_at?: string | null;
  after?: { placement?: unknown } | null;
}

/**
 * PURE — the placement verdict recorded on the LATEST scheduled backup, or null when there is none.
 *
 * It NEVER invents a verdict. Anything that is absent, or not shaped like a real Placement321Verdict
 * (an older backup taken before T-36, a hand-run client backup, a malformed payload), reads as null —
 * which the health gate treats as "never evaluated" (amber). Guessing here would be the exact failure
 * the card exists to prevent: a green light that means "we have not checked".
 */
export function placementFromBackupRows(rows: readonly BackupAuditRow[]): Placement321Verdict | null {
  let latest: BackupAuditRow | null = null;
  let latestMs = -Infinity;
  for (const r of rows) {
    const at = r?.created_at;
    if (!at) continue;
    const ms = Date.parse(at);
    if (Number.isNaN(ms)) continue;
    if (ms > latestMs) { latestMs = ms; latest = r; }
  }
  const p = latest?.after?.placement;
  if (!p || typeof p !== 'object') return null;
  const v = p as Record<string, unknown>;
  // `ok` and `deficiencies` are the load-bearing fields — without them there is no verdict to trust.
  if (typeof v.ok !== 'boolean' || !Array.isArray(v.deficiencies)) return null;
  return {
    ok: v.ok,
    copies: typeof v.copies === 'number' ? v.copies : 0,
    providers: typeof v.providers === 'number' ? v.providers : 0,
    offProviderOffRegion: v.offProviderOffRegion === true,
    deficiencies: v.deficiencies.filter((d): d is string => typeof d === 'string'),
  };
}

/** PURE — one line for the card header. Hindi first (RULE 7). */
export function summarizeHealth(health: BackupHealth, hi = true): string {
  switch (health.status) {
    case 'green':
      return hi ? 'बैकअप सुरक्षित — जाँचा और restore करके परखा गया।' : 'Backup healthy — verified and proven by rehearsal.';
    case 'amber':
      return hi ? 'बैकअप है, पर अभी पूरी तरह सिद्ध नहीं।' : 'A backup exists, but is not yet fully proven.';
    case 'red':
      return hi ? 'बैकअप भरोसेमंद नहीं — तुरंत देखें।' : 'The backup cannot be trusted — look now.';
    case 'unknown':
      return hi ? 'बैकअप की स्थिति अज्ञात।' : 'Backup status unknown.';
  }
}
