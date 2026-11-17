/**
 * Which societies are DUE a scheduled backup (PURE — no I/O, no Deno). Shared by the
 * scheduled-backup Edge Function and scripts/test-backup-due.mjs.
 *
 * Why this exists (audit BKP-00 / BKP-07, 2026-11-17): the weekly cron backed up EVERY society in
 * ONE invocation. On 2026-11-15 that one invocation left nothing — no file, no audit row, no
 * failure row — and the next attempt was a week away. Now the cron runs every hour and each run
 * backs up only a few societies that are due, oldest first. A run that dies costs at most one hour
 * for at most `limit` societies; the next run picks them up again.
 *
 * A society is DUE when
 *   • its newest SUCCESSFUL scheduled backup is older than `freshDays` (or it has none), AND
 *   • it has had NO scheduled attempt (success or failure) in the last `backoffHours` —
 *     so a society that keeps failing (e.g. too large) is retried a few times a day, not every hour.
 * Order: never backed up first, then the oldest success first. At most `limit` are returned.
 *
 * Attempts come from audit_log rows written by scheduled-backup:
 *   success → after.status absent;  failure → after.status === 'failed'.
 * Retention rows (after.trigger === 'retention') are not attempts and are ignored.
 */

/** @typedef {{ societyId: string, createdAt: string, failed: boolean }} BackupAttempt */

/**
 * @param {string[]} societyIds every society that should have backups
 * @param {BackupAttempt[]} attempts recent scheduled-backup attempts (any order)
 * @param {{ now?: Date, freshDays?: number, backoffHours?: number, limit?: number }} [opts]
 * @returns {{ due: string[], dueTotal: number, fresh: number, backingOff: number }}
 */
export function pickDueSocieties(societyIds, attempts, opts = {}) {
  const now = (opts.now ?? new Date()).getTime();
  const freshMs = (opts.freshDays ?? 6) * 24 * 3600 * 1000;
  const backoffMs = (opts.backoffHours ?? 6) * 3600 * 1000;
  const limit = Math.max(1, opts.limit ?? 6);

  const lastOk = new Map();
  const lastAny = new Map();
  for (const a of attempts ?? []) {
    const t = Date.parse(a?.createdAt ?? '');
    if (!a?.societyId || Number.isNaN(t)) continue;
    if ((lastAny.get(a.societyId) ?? -Infinity) < t) lastAny.set(a.societyId, t);
    if (!a.failed && (lastOk.get(a.societyId) ?? -Infinity) < t) lastOk.set(a.societyId, t);
  }

  const candidates = [];
  let fresh = 0;
  let backingOff = 0;
  for (const sid of new Set(societyIds ?? [])) {
    if (!sid) continue;
    const ok = lastOk.get(sid);
    if (ok !== undefined && now - ok < freshMs) { fresh++; continue; }
    const any = lastAny.get(sid);
    if (any !== undefined && now - any < backoffMs) { backingOff++; continue; }
    candidates.push({ sid, ok: ok ?? -Infinity });
  }
  candidates.sort((a, b) => (a.ok - b.ok) || (a.sid < b.sid ? -1 : a.sid > b.sid ? 1 : 0));
  return { due: candidates.slice(0, limit).map((c) => c.sid), dueTotal: candidates.length, fresh, backingOff };
}

/** Turn scheduled-backup audit_log rows into attempts (drops retention rows and anything else). */
export function attemptsFromAuditRows(rows) {
  const out = [];
  for (const r of rows ?? []) {
    const after = r?.after ?? {};
    if (after.trigger !== 'scheduled') continue;
    out.push({ societyId: String(r.society_id ?? ''), createdAt: String(r.created_at ?? ''), failed: after.status === 'failed' });
  }
  return out;
}
