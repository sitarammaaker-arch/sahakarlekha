/**
 * Compliance reminder emails (email slice 4) — which calendar items may be emailed, and when.
 *
 * The due dates come from the SAME engine as the in-app calendar (buildComplianceCalendar, RULE 2). This
 * module only decides which of those items are allowed into an email:
 *   • the rule has a SOURCE below (Act / rule text with a URL) — an unsourced date is never emailed;
 *   • the rule's state gate passes (Haryana-only items need society.state = Haryana);
 *   • the item is not marked filed (compliance_filings);
 *   • today is exactly 7 or 2 days before the due date, or the due date itself.
 * Bundled into supabase/functions/_shared/compliance-core.mjs for the compliance-reminders Edge Function.
 *
 * Deliberately NOT emailed (the in-app calendar still shows them) — no source text read yet:
 *   pf (EPF 15th), esi (ESI 15th), gstr1 (11th), gstr3b (20th; QRMP quarterly filers are not modelled either),
 *   itr (31 Oct under the Income-tax Act 2025).
 */
import { buildComplianceCalendar, type ComplianceApplicability, type ComplianceItem } from '@/lib/complianceCalendar';

export interface ComplianceSource {
  /** Hindi title used in the email (the calendar's English title stays the English line). */
  titleHi: string;
  /** Only societies in this state (lower-case code) get the item by email. */
  state?: 'hr';
  /** The text that fixes the date — section/rule + URL + what it says + when it was read. */
  cite: string;
}

/** Rule key = the item id's prefix (`tds-2026-10` → `tds`, `24q-q2-2026` → `24q`). */
export const COMPLIANCE_SOURCES: Record<string, ComplianceSource> = {
  tds: {
    titleHi: 'TDS जमा',
    cite: 'Income-tax Rules 2026, rule 218(2) — https://www.incometaxindia.gov.in/w/rule-218-1 : a non-Government '
      + 'deductor pays "on or before 30th April, where the income or amount is credited or paid … in the month of '
      + 'March; and in any other case, on or before seven days from the end of the month" of deduction. Read '
      + '2026-10-30. (r.218(3) 30-day Form 141 cases and r.218(4) AO-permitted quarterly payment are not modelled.)',
  },
  '24q': {
    titleHi: 'Form 138 (पहले 24Q) तिमाही TDS विवरण',
    cite: 'Income-tax Rules 2026, rule 219(1) Table Sl. 1 (section 392 → Form 138) and rule 219(4) Table — '
      + 'https://www.incometaxindia.gov.in/w/rule-219-1 : quarter ending 30 June → 31 July; 30 September → '
      + '31 October; 31 December → 31 January; 31 March → 31 May of the following year. Read 2026-10-30.',
  },
  audit: {
    titleHi: 'सहकारी वैधानिक ऑडिट',
    state: 'hr',
    cite: 'Haryana Co-operative Societies Act 1984, section 95 as amended by the Haryana Co-operative Societies '
      + '(Amendment) Act 2013 (Haryana Gazette, 10 May 2013): audit within six months of the end of the '
      + 'co-operative year — https://coop.haryana.gov.in/sites/default/files/2025-12/Notification%20dated%2010%20%2C%20May%202013%20in%20Haryana%20Co-operative%20Societies%20Act%2C%201984.pdf '
      + '(all 10 pages read 2026-10-18, blog sources batch 3); co-operative year ends 31 March — Haryana '
      + 'Co-operative Societies Rules 1989, rule 2(c), https://indiankanoon.org/doc/66802510/ .',
  },
};

/** Days before the due date on which a reminder goes out (0 = the due date itself). */
export const REMINDER_OFFSETS = [7, 2, 0] as const;

export const ruleKeyOf = (itemId: string): string => itemId.split('-')[0];

const isHaryana = (state?: string | null) => ['hr', 'haryana'].includes((state || '').trim().toLowerCase());

export interface ReminderItem {
  id: string;
  ruleKey: string;
  title: string;
  titleHi: string;
  period: string;
  dueDate: string;
  daysLeft: number;
}

/** Today's date (YYYY-MM-DD) in India — the cron runs in UTC, the due dates are Indian calendar days. */
export function istDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

/**
 * The reminders to send today for one society. `pendingCount` = its sourced, unfiled items due within the
 * next 7 days (a count only — never an amount).
 */
export function dueReminders(
  asOf: string,
  app: ComplianceApplicability & { state?: string | null },
  filedIds: string[] = [],
): { items: ReminderItem[]; pendingCount: number } {
  const all = buildComplianceCalendar(asOf, app, { filedIds });
  const allowed = all.filter((it: ComplianceItem) => {
    const src = COMPLIANCE_SOURCES[ruleKeyOf(it.id)];
    if (!src || it.status === 'filed') return false;
    return src.state !== 'hr' || isHaryana(app.state);
  });
  const items = allowed
    .filter(it => (REMINDER_OFFSETS as readonly number[]).includes(it.daysLeft))
    .map(it => ({
      id: it.id, ruleKey: ruleKeyOf(it.id), title: it.title, titleHi: COMPLIANCE_SOURCES[ruleKeyOf(it.id)].titleHi,
      period: it.period, dueDate: it.dueDate, daysLeft: it.daysLeft,
    }));
  const pendingCount = allowed.filter(it => it.daysLeft >= 0 && it.daysLeft <= 7).length;
  return { items, pendingCount };
}
