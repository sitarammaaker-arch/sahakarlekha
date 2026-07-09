// Compliance calendar due-date engine (ECR-13) — mirrors src/lib/complianceCalendar.ts.
// Run: node scripts/test-compliance-calendar.mjs

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
function addMonthsYM(y, m, delta) { const t = y * 12 + (m - 1) + delta; return [Math.floor(t / 12), (t % 12) + 1]; }
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const statusOf = (dl) => dl < 0 ? 'overdue' : dl <= 7 ? 'due-soon' : 'upcoming';

function buildComplianceCalendar(asOf, app, opts = {}) {
  const back = opts.monthsBack ?? 2, fwd = opts.monthsForward ?? 3;
  const winBack = opts.windowBackDays ?? 45, winFwd = opts.windowFwdDays ?? 150;
  const [ay, am] = asOf.split('-').map(Number);
  const filed = new Set(opts.filedIds ?? []);
  const items = [];
  const push = (id, title, category, dueDate, period) => { const dl = daysBetween(asOf, dueDate); items.push({ id, title, category, dueDate, period, daysLeft: dl, status: filed.has(id) ? 'filed' : statusOf(dl) }); };
  for (let k = -back; k <= fwd; k++) {
    const [ly, lm] = addMonthsYM(ay, am, k);
    const [dy, dm] = addMonthsYM(ly, lm, 1);
    const period = `${lm} ${ly}`;
    if (app.hasEmployees) { push(`pf-${ly}-${pad(lm)}`, 'EPF payment', 'PF', iso(dy, dm, 15), period); push(`esi-${ly}-${pad(lm)}`, 'ESI payment', 'ESI', iso(dy, dm, 15), period); }
    if (app.tan) push(`tds-${ly}-${pad(lm)}`, 'TDS deposit', 'TDS', lm === 3 ? iso(dy, dm, 30) : iso(dy, dm, 7), period);
    if (app.gstin) { push(`gstr1-${ly}-${pad(lm)}`, 'GSTR-1', 'GST', iso(dy, dm, 11), period); push(`gstr3b-${ly}-${pad(lm)}`, 'GSTR-3B', 'GST', iso(dy, dm, 20), period); }
  }
  const fyStart = am >= 4 ? ay : ay - 1;
  if (app.tan) for (const fy of [fyStart - 1, fyStart, fyStart + 1]) {
    push(`24q-q1-${fy}`, '24Q Q1', 'TDS', iso(fy, 7, 31), 'q1'); push(`24q-q2-${fy}`, '24Q Q2', 'TDS', iso(fy, 10, 31), 'q2');
    push(`24q-q3-${fy}`, '24Q Q3', 'TDS', iso(fy + 1, 1, 31), 'q3'); push(`24q-q4-${fy}`, '24Q Q4', 'TDS', iso(fy + 1, 5, 31), 'q4');
  }
  for (const fy of [fyStart - 1, fyStart]) { push(`itr-${fy}`, 'ITR', 'IncomeTax', iso(fy + 1, 10, 31), 'y'); push(`audit-${fy}`, 'Audit', 'Audit', iso(fy + 1, 9, 30), 'y'); }
  return items.filter(it => it.daysLeft >= -winBack && it.daysLeft <= winFwd).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.category.localeCompare(b.category));
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const find = (items, pred) => items.find(pred);

// As-of 10 May 2024. April liability → PF/ESI 15 May, TDS 7 May, GSTR-3B 20 May, GSTR-1 11 May.
const full = buildComplianceCalendar('2024-05-10', { hasEmployees: true, tan: true, gstin: true });

// 1. PF/ESI for April due 15 May.
const pf = find(full, i => i.category === 'PF' && i.dueDate === '2024-05-15');
ok(pf && pf.daysLeft === 5 && pf.status === 'due-soon', 'April EPF due 15-May → 5 days → due-soon');
ok(find(full, i => i.category === 'ESI' && i.dueDate === '2024-05-15'), 'ESI mirrors PF date');

// 2. TDS deposit 7 May (April) already passed → overdue.
const tdsApr = find(full, i => i.category === 'TDS' && i.dueDate === '2024-05-07');
ok(tdsApr && tdsApr.daysLeft === -3 && tdsApr.status === 'overdue', 'April TDS due 7-May → overdue (3d ago)');

// 3. March-liability TDS is due 30 April (not 7th).
const marchTds = find(full, i => i.id === 'tds-2024-03');
ok(marchTds && marchTds.dueDate === '2024-04-30', 'March TDS liability → 30 April');

// 4. GST rows present with correct dates.
ok(find(full, i => i.id === 'gstr3b-2024-04' && i.dueDate === '2024-05-20'), 'GSTR-3B April due 20-May');
ok(find(full, i => i.id === 'gstr1-2024-04' && i.dueDate === '2024-05-11'), 'GSTR-1 April due 11-May');

// 5. Applicability gating.
const noneApp = buildComplianceCalendar('2024-05-10', { hasEmployees: false, tan: false, gstin: false });
ok(!noneApp.some(i => ['PF', 'ESI', 'TDS', 'GST'].includes(i.category)), 'no employees/tan/gstin → no PF/ESI/TDS/GST');
ok(noneApp.some(i => i.category === 'IncomeTax' || i.category === 'Audit'), 'annual IT/Audit always present');
const gstOnly = buildComplianceCalendar('2024-05-10', { gstin: true });
ok(gstOnly.some(i => i.category === 'GST') && !gstOnly.some(i => i.category === 'PF'), 'gstin only → GST but no PF');

// 6. 24Q quarterly: Q1 due 31-Jul-2024 shows up as upcoming.
ok(find(full, i => i.dueDate === '2024-07-31' && i.title.includes('Q1')), '24Q Q1 due 31-Jul');

// 7. Window: nothing older than 45d or beyond 150d.
ok(full.every(i => i.daysLeft >= -45 && i.daysLeft <= 150), 'items within [-45, 150] day window');

// 8. Sorted ascending by due date.
ok(full.every((it, i) => i === 0 || full[i - 1].dueDate <= it.dueDate), 'sorted by due date');

// 9. Filed tracking — a filed item shows status 'filed' (never overdue), others unaffected.
const withFiled = buildComplianceCalendar('2024-05-10', { hasEmployees: true, tan: true, gstin: true }, { filedIds: ['tds-2024-04'] });
const filedTds = find(withFiled, i => i.id === 'tds-2024-04');
ok(filedTds && filedTds.status === 'filed', 'filed TDS shows status filed (not overdue)');
ok(find(withFiled, i => i.id === 'gstr3b-2024-04').status !== 'filed', 'other items unaffected by filing');
ok(withFiled.filter(i => i.status === 'overdue').length < full.filter(i => i.status === 'overdue').length, 'filing reduces overdue count');

// 10. complianceNotifications = overdue + due-soon only (filed/upcoming excluded).
const complianceNotifications = (items) => items.filter(i => i.status === 'overdue' || i.status === 'due-soon');
const alerts = complianceNotifications(full);
ok(alerts.length > 0 && alerts.every(a => a.status === 'overdue' || a.status === 'due-soon'), 'notifications are overdue/due-soon only');
ok(complianceNotifications(withFiled).length < alerts.length, 'filing reduces notifications');
ok(complianceNotifications(full).every(a => a.status !== 'upcoming' && a.status !== 'filed'), 'upcoming/filed excluded from notifications');

console.log(`\nCompliance calendar (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
