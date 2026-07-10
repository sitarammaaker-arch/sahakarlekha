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
 * green light that means "we have not checked." So green requires three POSITIVE facts, all
 * present and all fresh:
 *
 *   1. a backup was taken, and recently;
 *   2. that backup was verified;
 *   3. a rehearsal RESTORED it and the books matched — recently.
 *
 * Absent any one of them, the card is amber or red, never green. In particular:
 *
 *   * A backup that was never rehearsed is UNPROVEN. It may be perfect; it may be a ZIP of
 *     nothing. Until a rehearsal restores it and the trial balance ties, "the backup works"
 *     is a hope. Amber, never green.
 *   * A rehearsal that FAILED is a known-bad backup. Red. This is worse than no backup,
 *     because it looked like safety.
 *
 * This is why the roadmap says: do not ship the word "backup" in the UI until a rehearsal
 * is green. This function is what enforces that — it cannot be made to say green without a
 * passing, fresh rehearsal.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */

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

  let status: HealthStatus;
  if (reasons.length === 0) status = 'green';
  else if (red) status = 'red';
  else status = 'amber';

  return { status, reasons, backupAgeDays, rehearsalAgeDays, proven };
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
