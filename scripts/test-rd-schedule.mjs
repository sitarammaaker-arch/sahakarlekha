// RD installment schedule (Deposits module) — mirrors src/lib/rdSchedule.ts.
// Run: node scripts/test-rd-schedule.mjs

function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(ny, nm, 0).getDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}
function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by * 12 + bm) - (ay * 12 + am);
}
function buildRdSchedule({ openDate, installmentAmount, maturityDate, totalPaid, asOf }) {
  if (!maturityDate || !(installmentAmount > 0)) return [];
  const n = Math.max(0, monthsBetween(openDate, maturityDate));
  const paidCount = Math.floor((totalPaid || 0) / installmentAmount + 1e-9);
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const dueDate = addMonths(openDate, i - 1);
    const status = i <= paidCount ? 'paid' : (dueDate < asOf ? 'missed' : 'due');
    rows.push({ installmentNo: i, dueDate, amount: installmentAmount, status });
  }
  return rows;
}
const missedCount = (s) => s.filter(x => x.status === 'missed').length;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. addMonths — month/year rollover + day clamp.
ok(addMonths('2024-04-15', 1) === '2024-05-15', 'add 1 month');
ok(addMonths('2024-12-10', 1) === '2025-01-10', 'rolls over the year');
ok(addMonths('2024-01-31', 1) === '2024-02-29', 'clamps to Feb (leap year)');
ok(addMonths('2025-01-31', 1) === '2025-02-28', 'clamps to Feb (non-leap)');

// 2. monthsBetween.
ok(monthsBetween('2024-04-01', '2025-04-01') === 12, '12-month term');
ok(monthsBetween('2024-04-01', '2024-10-01') === 6, '6-month term');

// 3. A 12-month RD, 6 installments paid → 6 paid, then missed/due by as-of.
const sch = buildRdSchedule({ openDate: '2024-04-01', installmentAmount: 1000, maturityDate: '2025-04-01', totalPaid: 6000, asOf: '2024-11-15' });
ok(sch.length === 12, '12 installments generated');
ok(sch.filter(s => s.status === 'paid').length === 6, '6 installments paid (6000/1000)');
ok(sch[0].dueDate === '2024-04-01' && sch[11].dueDate === '2025-03-01', 'due dates run monthly from openDate');
// installment 7 due 2024-10-01 (< asOf 2024-11-15) → missed; installment 8 due 2024-11-01 (< asOf) → missed; 9 due 2024-12-01 → due.
ok(sch[6].status === 'missed' && sch[7].status === 'missed', 'unpaid past-due installments are missed');
ok(sch[8].status === 'due', 'unpaid future installment is due');
ok(missedCount(sch) === 2, 'exactly 2 missed');

// 4. Fully paid → none missed.
const paid = buildRdSchedule({ openDate: '2024-04-01', installmentAmount: 1000, maturityDate: '2025-04-01', totalPaid: 12000, asOf: '2025-05-01' });
ok(paid.every(s => s.status === 'paid') && missedCount(paid) === 0, 'all paid → none missed');

// 5. Missing config → empty schedule.
ok(buildRdSchedule({ openDate: '2024-04-01', installmentAmount: 0, maturityDate: '2025-04-01', totalPaid: 0, asOf: '2024-05-01' }).length === 0, 'no installment amount → empty');
ok(buildRdSchedule({ openDate: '2024-04-01', installmentAmount: 1000, maturityDate: undefined, totalPaid: 0, asOf: '2024-05-01' }).length === 0, 'no maturity date → empty');

console.log(`\nRD schedule (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
