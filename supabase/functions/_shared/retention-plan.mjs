/**
 * Backup retention planner (PURE — no I/O, no Deno). Shared by the scheduled-backup
 * Edge Function and scripts/test-backup-retention.mjs, so the deletion policy is
 * unit-tested in CI before it ever touches the Storage bucket.
 *
 * Policy (conservative by design — a backup is the recovery net, so over-keep):
 *   • The newest `keepRecent` files are always kept (default 12 ≈ 3 months of weekly runs).
 *   • Beyond those, the newest file of each calendar month is kept as a monthly anchor,
 *     for months no older than `keepMonths` months before `now` (default 12).
 *   • Everything else is eligible for deletion.
 *   • FAIL-SAFE: a file whose timestamp can't be parsed is always kept, never deleted.
 *
 * The caller decides whether the plan is EXECUTED (BACKUP_RETENTION=delete) or only
 * REPORTED (dry-run, the default) — this module only computes it.
 */

/** @typedef {{ name: string, createdAt: string | null | undefined }} BackupFile */

const MONTH_MS_GUARD = 0; // months are compared by calendar key, not milliseconds

function monthKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** How many whole calendar months `a` (older) lies before `b` (newer). */
function monthsBetween(a, b) {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/**
 * Compute the retention plan for one society's backup files.
 * @param {BackupFile[]} files
 * @param {{ keepRecent?: number, keepMonths?: number, now?: Date }} opts
 * @returns {{ keep: string[], del: string[] }} file NAMES to keep / delete
 */
export function planRetention(files, opts = {}) {
  const keepRecent = Number.isFinite(opts.keepRecent) ? Math.max(1, opts.keepRecent) : 12;
  const keepMonths = Number.isFinite(opts.keepMonths) ? Math.max(0, opts.keepMonths) : 12;
  const now = opts.now instanceof Date ? opts.now : new Date();

  const dated = [];
  const keep = new Set();

  for (const f of files ?? []) {
    if (!f || typeof f.name !== 'string' || !f.name) continue;
    const t = f.createdAt ? new Date(f.createdAt) : null;
    if (!t || Number.isNaN(t.getTime())) {
      keep.add(f.name); // fail-safe: undated files are never deleted
      continue;
    }
    dated.push({ name: f.name, t });
  }

  dated.sort((a, b) => b.t.getTime() - a.t.getTime()); // newest first

  // 1. Always keep the newest `keepRecent`.
  for (const f of dated.slice(0, keepRecent)) keep.add(f.name);

  // 2. Monthly anchors beyond the recent window: the newest file per calendar month,
  //    for months within `keepMonths` of now. (dated is newest-first, so the first
  //    file seen for a month IS its newest.)
  const monthSeen = new Set();
  for (const f of dated.slice(keepRecent)) {
    const key = monthKey(f.t);
    if (monthSeen.has(key)) continue;
    monthSeen.add(key);
    if (monthsBetween(f.t, now) + MONTH_MS_GUARD <= keepMonths) keep.add(f.name);
  }

  const del = dated.filter((f) => !keep.has(f.name)).map((f) => f.name);
  return { keep: [...keep], del };
}
