/**
 * The compliance reminder run (email slice 4, migration 145). Plain JS with an injectable client, so
 * scripts/test-compliance-reminders.mjs drives it with a fake service-role client.
 *
 * One run = read every society that has an active admin (compliance_reminder_targets), work out today's
 * reminders with the app's own engine (dueReminders), and queue them (enqueue_compliance_due — the database
 * picks the recipients and skips filed items). send-worker sends them. Never throws; one society's error
 * does not stop the others. Safe to run twice a day: the outbox is idempotent per item + recipient + day.
 */
import { dueReminders, istDate } from './compliance-core.mjs';

/**
 * @param {*} supa  SERVICE-ROLE client
 * @param {{ today?: string }} [opts]  today = YYYY-MM-DD (India); default = now in IST
 * @returns {Promise<{ status: 'ok'|'error', day: string, societies: number, items: number, enqueued: number, errors: string[] }>}
 */
export async function runComplianceReminders(supa, opts = {}) {
  const day = opts.today ?? istDate();
  const out = { status: 'ok', day, societies: 0, items: 0, enqueued: 0, errors: [] };
  let targets;
  try {
    const { data, error } = await supa.rpc('compliance_reminder_targets');
    if (error) return { ...out, status: 'error', errors: [`targets: ${error.message}`] };
    targets = data ?? [];
  } catch (e) {
    return { ...out, status: 'error', errors: [`targets: ${e instanceof Error ? e.message : String(e)}`] };
  }
  out.societies = targets.length;

  for (const t of targets) {
    const { items, pendingCount } = dueReminders(day, {
      hasEmployees: !!t.has_employees, tan: !!t.tan, gstin: !!t.gstin, state: t.state,
    }, t.filed_ids ?? []);
    if (items.length === 0) continue;
    out.items += items.length;
    try {
      const { data, error } = await supa.rpc('enqueue_compliance_due', {
        p_society_id: t.society_id,
        p_day: day,
        p_items: items.map((i) => ({
          id: i.id, rule_key: i.ruleKey, title: i.title, title_hi: i.titleHi,
          period: i.period, due_date: i.dueDate, days_left: i.daysLeft,
        })),
        p_pending_count: pendingCount,
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
