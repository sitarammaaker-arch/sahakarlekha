/**
 * Statutory compliance calendar / due-date engine (ECR-13).
 *
 * Generates upcoming (and recently-passed) statutory due dates for a society based on the
 * as-of date and what applies (employees → PF/ESI/24Q; TAN → TDS; GSTIN → GST). Pure &
 * deterministic → unit-tested by scripts/test-compliance-calendar.mjs.
 *
 * Slice 1 is the engine + an in-app calendar. Notification channels (SMS/WhatsApp/email),
 * role-routed alerts + escalation, and per-item "filed" tracking are later slices.
 */
export interface ComplianceApplicability {
  hasEmployees?: boolean;
  tan?: boolean;    // TDS/24Q applicable
  gstin?: boolean;  // GST returns applicable
}
export type ComplianceCategory = 'PF' | 'ESI' | 'TDS' | 'GST' | 'IncomeTax' | 'Audit';
export type ComplianceStatus = 'overdue' | 'due-soon' | 'upcoming' | 'filed';

export interface ComplianceItem {
  id: string;
  title: string;
  category: ComplianceCategory;
  dueDate: string;   // YYYY-MM-DD
  period: string;    // human label of the period/return
  daysLeft: number;  // dueDate − asOf, in days (negative = past)
  status: ComplianceStatus;
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const MON = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** [year, month(1-12)] after adding `delta` months. */
function addMonthsYM(y: number, m: number, delta: number): [number, number] {
  const t = y * 12 + (m - 1) + delta;
  return [Math.floor(t / 12), (t % 12) + 1];
}
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
function statusOf(daysLeft: number): ComplianceStatus {
  return daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'due-soon' : 'upcoming';
}

export interface CalendarOptions {
  monthsBack?: number;     // recurring months to generate before asOf (default 2)
  monthsForward?: number;  // recurring months after asOf (default 3)
  windowBackDays?: number; // keep items no older than this (default 45)
  windowFwdDays?: number;  // keep items no further than this (default 150)
  filedIds?: string[];     // item ids already filed → status 'filed' (never overdue/due-soon)
}

/** Build the compliance calendar around `asOf` (YYYY-MM-DD) for the applicable heads. */
export function buildComplianceCalendar(asOf: string, app: ComplianceApplicability, opts: CalendarOptions = {}): ComplianceItem[] {
  const back = opts.monthsBack ?? 2, fwd = opts.monthsForward ?? 3;
  const winBack = opts.windowBackDays ?? 45, winFwd = opts.windowFwdDays ?? 150;
  const [ay, am] = asOf.split('-').map(Number);
  const filed = new Set(opts.filedIds ?? []);
  const items: ComplianceItem[] = [];
  const push = (id: string, title: string, category: ComplianceCategory, dueDate: string, period: string) => {
    const daysLeft = daysBetween(asOf, dueDate);
    items.push({ id, title, category, dueDate, period, daysLeft, status: filed.has(id) ? 'filed' : statusOf(daysLeft) });
  };

  // Monthly heads — month L's liability is due in month L+1.
  for (let k = -back; k <= fwd; k++) {
    const [ly, lm] = addMonthsYM(ay, am, k);
    const [dy, dm] = addMonthsYM(ly, lm, 1);
    const period = `${MON[lm]} ${ly}`;
    if (app.hasEmployees) {
      push(`pf-${ly}-${pad(lm)}`, 'EPF payment', 'PF', iso(dy, dm, 15), period);
      push(`esi-${ly}-${pad(lm)}`, 'ESI payment', 'ESI', iso(dy, dm, 15), period);
    }
    if (app.tan) {
      // TDS deposit: 7th of next month; for March liability → 30 April.
      push(`tds-${ly}-${pad(lm)}`, 'TDS deposit', 'TDS', lm === 3 ? iso(dy, dm, 30) : iso(dy, dm, 7), period);
    }
    if (app.gstin) {
      push(`gstr1-${ly}-${pad(lm)}`, 'GSTR-1', 'GST', iso(dy, dm, 11), period);
      push(`gstr3b-${ly}-${pad(lm)}`, 'GSTR-3B', 'GST', iso(dy, dm, 20), period);
    }
  }

  const fyStart = am >= 4 ? ay : ay - 1;   // FY (Apr–Mar) containing asOf
  // Quarterly 24Q return (Q1 31-Jul, Q2 31-Oct, Q3 31-Jan, Q4 31-May of next FY).
  if (app.tan) {
    for (const fy of [fyStart - 1, fyStart, fyStart + 1]) {
      const label = `FY${fy}-${pad((fy + 1) % 100)}`;
      push(`24q-q1-${fy}`, '24Q — Q1 return', 'TDS', iso(fy, 7, 31), `Q1 ${label}`);
      push(`24q-q2-${fy}`, '24Q — Q2 return', 'TDS', iso(fy, 10, 31), `Q2 ${label}`);
      push(`24q-q3-${fy}`, '24Q — Q3 return', 'TDS', iso(fy + 1, 1, 31), `Q3 ${label}`);
      push(`24q-q4-${fy}`, '24Q — Q4 return', 'TDS', iso(fy + 1, 5, 31), `Q4 ${label}`);
    }
  }
  // Annual — Income-tax return (31 Oct) + cooperative statutory audit (30 Sep).
  for (const fy of [fyStart - 1, fyStart]) {
    const label = `FY${fy}-${pad((fy + 1) % 100)}`;
    push(`itr-${fy}`, 'Income Tax Return', 'IncomeTax', iso(fy + 1, 10, 31), label);
    push(`audit-${fy}`, 'Cooperative statutory audit', 'Audit', iso(fy + 1, 9, 30), label);
  }

  return items
    .filter(it => it.daysLeft >= -winBack && it.daysLeft <= winFwd)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.category.localeCompare(b.category));
}

/** Items that need attention now — overdue + due-soon (filed items are already excluded). */
export function complianceNotifications(items: ComplianceItem[]): ComplianceItem[] {
  return items.filter(i => i.status === 'overdue' || i.status === 'due-soon');
}
