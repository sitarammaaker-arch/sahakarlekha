// src/lib/complianceCalendar.ts
var pad = (n) => String(n).padStart(2, "0");
var iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
var MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function addMonthsYM(y, m, delta) {
  const t = y * 12 + (m - 1) + delta;
  return [Math.floor(t / 12), t % 12 + 1];
}
function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
}
function statusOf(daysLeft) {
  return daysLeft < 0 ? "overdue" : daysLeft <= 7 ? "due-soon" : "upcoming";
}
function buildComplianceCalendar(asOf, app, opts = {}) {
  const back = opts.monthsBack ?? 2, fwd = opts.monthsForward ?? 3;
  const winBack = opts.windowBackDays ?? 45, winFwd = opts.windowFwdDays ?? 150;
  const [ay, am] = asOf.split("-").map(Number);
  const filed = new Set(opts.filedIds ?? []);
  const items = [];
  const push = (id, title, category, dueDate, period) => {
    const daysLeft = daysBetween(asOf, dueDate);
    items.push({ id, title, category, dueDate, period, daysLeft, status: filed.has(id) ? "filed" : statusOf(daysLeft) });
  };
  for (let k = -back; k <= fwd; k++) {
    const [ly, lm] = addMonthsYM(ay, am, k);
    const [dy, dm] = addMonthsYM(ly, lm, 1);
    const period = `${MON[lm]} ${ly}`;
    if (app.hasEmployees) {
      push(`pf-${ly}-${pad(lm)}`, "EPF payment", "PF", iso(dy, dm, 15), period);
      push(`esi-${ly}-${pad(lm)}`, "ESI payment", "ESI", iso(dy, dm, 15), period);
    }
    if (app.tan) {
      push(`tds-${ly}-${pad(lm)}`, "TDS deposit", "TDS", lm === 3 ? iso(dy, dm, 30) : iso(dy, dm, 7), period);
    }
    if (app.gstin) {
      push(`gstr1-${ly}-${pad(lm)}`, "GSTR-1", "GST", iso(dy, dm, 11), period);
      push(`gstr3b-${ly}-${pad(lm)}`, "GSTR-3B", "GST", iso(dy, dm, 20), period);
    }
  }
  const fyStart = am >= 4 ? ay : ay - 1;
  if (app.tan) {
    for (const fy of [fyStart - 1, fyStart, fyStart + 1]) {
      const label = `FY${fy}-${pad((fy + 1) % 100)}`;
      push(`24q-q1-${fy}`, "24Q \u2014 Q1 return", "TDS", iso(fy, 7, 31), `Q1 ${label}`);
      push(`24q-q2-${fy}`, "24Q \u2014 Q2 return", "TDS", iso(fy, 10, 31), `Q2 ${label}`);
      push(`24q-q3-${fy}`, "24Q \u2014 Q3 return", "TDS", iso(fy + 1, 1, 31), `Q3 ${label}`);
      push(`24q-q4-${fy}`, "24Q \u2014 Q4 return", "TDS", iso(fy + 1, 5, 31), `Q4 ${label}`);
    }
  }
  for (const fy of [fyStart - 1, fyStart]) {
    const label = `FY${fy}-${pad((fy + 1) % 100)}`;
    push(`itr-${fy}`, "Income Tax Return", "IncomeTax", iso(fy + 1, 10, 31), label);
    push(`audit-${fy}`, "Cooperative statutory audit", "Audit", iso(fy + 1, 9, 30), label);
  }
  return items.filter((it) => it.daysLeft >= -winBack && it.daysLeft <= winFwd).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.category.localeCompare(b.category));
}

// src/lib/complianceReminders.ts
var COMPLIANCE_SOURCES = {
  tds: {
    titleHi: "TDS \u091C\u092E\u093E",
    cite: 'Income-tax Rules 2026, rule 218(2) \u2014 https://www.incometaxindia.gov.in/w/rule-218-1 : a non-Government deductor pays "on or before 30th April, where the income or amount is credited or paid \u2026 in the month of March; and in any other case, on or before seven days from the end of the month" of deduction. Read 2026-10-30. (r.218(3) 30-day Form 141 cases and r.218(4) AO-permitted quarterly payment are not modelled.)'
  },
  "24q": {
    titleHi: "Form 138 (\u092A\u0939\u0932\u0947 24Q) \u0924\u093F\u092E\u093E\u0939\u0940 TDS \u0935\u093F\u0935\u0930\u0923",
    cite: "Income-tax Rules 2026, rule 219(1) Table Sl. 1 (section 392 \u2192 Form 138) and rule 219(4) Table \u2014 https://www.incometaxindia.gov.in/w/rule-219-1 : quarter ending 30 June \u2192 31 July; 30 September \u2192 31 October; 31 December \u2192 31 January; 31 March \u2192 31 May of the following year. Read 2026-10-30."
  },
  audit: {
    titleHi: "\u0938\u0939\u0915\u093E\u0930\u0940 \u0935\u0948\u0927\u093E\u0928\u093F\u0915 \u0911\u0921\u093F\u091F",
    state: "hr",
    cite: "Haryana Co-operative Societies Act 1984, section 95 as amended by the Haryana Co-operative Societies (Amendment) Act 2013 (Haryana Gazette, 10 May 2013): audit within six months of the end of the co-operative year \u2014 https://coop.haryana.gov.in/sites/default/files/2025-12/Notification%20dated%2010%20%2C%20May%202013%20in%20Haryana%20Co-operative%20Societies%20Act%2C%201984.pdf (all 10 pages read 2026-10-18, blog sources batch 3); co-operative year ends 31 March \u2014 Haryana Co-operative Societies Rules 1989, rule 2(c), https://indiankanoon.org/doc/66802510/ ."
  }
};
var REMINDER_OFFSETS = [7, 2, 0];
var ruleKeyOf = (itemId) => itemId.split("-")[0];
var isHaryana = (state) => ["hr", "haryana"].includes((state || "").trim().toLowerCase());
function istDate(now = /* @__PURE__ */ new Date()) {
  return new Date(now.getTime() + 330 * 6e4).toISOString().slice(0, 10);
}
function dueReminders(asOf, app, filedIds = []) {
  const all = buildComplianceCalendar(asOf, app, { filedIds });
  const allowed = all.filter((it) => {
    const src = COMPLIANCE_SOURCES[ruleKeyOf(it.id)];
    if (!src || it.status === "filed") return false;
    return src.state !== "hr" || isHaryana(app.state);
  });
  const items = allowed.filter((it) => REMINDER_OFFSETS.includes(it.daysLeft)).map((it) => ({
    id: it.id,
    ruleKey: ruleKeyOf(it.id),
    title: it.title,
    titleHi: COMPLIANCE_SOURCES[ruleKeyOf(it.id)].titleHi,
    period: it.period,
    dueDate: it.dueDate,
    daysLeft: it.daysLeft
  }));
  const pendingCount = allowed.filter((it) => it.daysLeft >= 0 && it.daysLeft <= 7).length;
  return { items, pendingCount };
}
function dueWithinCount(asOf, app, filedIds = [], days = 14) {
  return buildComplianceCalendar(asOf, app, { filedIds }).filter((it) => {
    const src = COMPLIANCE_SOURCES[ruleKeyOf(it.id)];
    if (!src || it.status === "filed") return false;
    if (src.state === "hr" && !isHaryana(app.state)) return false;
    return it.daysLeft >= 0 && it.daysLeft <= days;
  }).length;
}
export {
  COMPLIANCE_SOURCES,
  REMINDER_OFFSETS,
  buildComplianceCalendar,
  dueReminders,
  dueWithinCount,
  istDate,
  ruleKeyOf
};
