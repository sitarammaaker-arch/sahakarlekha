/**
 * The weekly digest run (email slice 5, migration 146). Plain JS with an injectable client, so
 * scripts/test-weekly-digest.mjs drives it with a fake service-role client.
 *
 * One run = read every society that has an active admin plus its counts (weekly_digest_targets — computed in
 * SQL, counts only), add how many sourced compliance items fall due in the next 14 days with the app's own
 * engine (dueWithinCount), skip a society with no voucher this week, nothing pending and nothing due, and
 * queue the rest (enqueue_weekly_digest — the database recomputes the counts, picks the recipients and keys
 * the row per ISO week). send-worker sends them. Never throws; one society's error does not stop the others.
 */
import { dueWithinCount, istDate } from './compliance-core.mjs';

export const DIGEST_COMPLIANCE_DAYS = 14;

/** Nothing worth a Monday email: no voucher this week, none pending, no compliance item due. */
export const isQuiet = (counts, complianceDue) =>
  !(Number(counts?.vouchers_week) > 0) && !(Number(counts?.pending_approval) > 0) && !(complianceDue > 0);

/** ISO-8601 week of a YYYY-MM-DD day, e.g. 2026-11-02 → 2026-W45 (same as Postgres to_char 'IYYY-"W"IW'). */
export function isoWeek(day) {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow); // the Thursday of this week decides the year
  const y = d.getUTCFullYear();
  const wk = Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(wk).padStart(2, '0')}`;
}

/**
 * @param {*} supa  SERVICE-ROLE client
 * @param {{ today?: string }} [opts]  today = YYYY-MM-DD (India); default = now in IST
 * @returns {Promise<{ status: 'ok'|'error', day: string, week: string, societies: number, quiet: number,
 *   enqueued: number, errors: string[] }>}
 */
export async function runWeeklyDigest(supa, opts = {}) {
  const day = opts.today ?? istDate();
  const out = { status: 'ok', day, week: isoWeek(day), societies: 0, quiet: 0, enqueued: 0, errors: [] };
  let targets;
  try {
    const { data, error } = await supa.rpc('weekly_digest_targets', { p_day: day });
    if (error) return { ...out, status: 'error', errors: [`targets: ${error.message}`] };
    targets = data ?? [];
  } catch (e) {
    return { ...out, status: 'error', errors: [`targets: ${e instanceof Error ? e.message : String(e)}`] };
  }
  out.societies = targets.length;

  for (const t of targets) {
    const complianceDue = dueWithinCount(day, {
      hasEmployees: !!t.has_employees, tan: !!t.tan, gstin: !!t.gstin, state: t.state,
    }, t.filed_ids ?? [], DIGEST_COMPLIANCE_DAYS);
    if (isQuiet(t.counts, complianceDue)) { out.quiet++; continue; }
    try {
      const { data, error } = await supa.rpc('enqueue_weekly_digest', {
        p_society_id: t.society_id, p_day: day, p_compliance_due: complianceDue,
      });
      if (error) out.errors.push(`${t.society_id}: ${error.message}`);
      else out.enqueued += Number(data) || 0;
    } catch (e) {
      out.errors.push(`${t.society_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (out.errors.length) out.status = 'error';
  return out;
}
