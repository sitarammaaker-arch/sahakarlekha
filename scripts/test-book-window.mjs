// bookWindow (audit A-05): Cash/Bank Book opening & closing must follow the date window / branch.
// Run: node scripts/test-book-window.mjs   (npm run test:book-window)
import { bookWindow } from '../src/lib/reports/bookWindow.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const e = [
  { date: '2025-04-05', runningBalance: 1100 },   // OB 1000 + 100
  { date: '2025-05-10', runningBalance: 900 },
  { date: '2025-05-20', runningBalance: 1400 },
  { date: '2025-06-02', runningBalance: 1300 },
];
let r = bookWindow(e, undefined, 1000);
ok(r.opening === 1000 && r.closing === 1300 && r.window.length === 4, 'no filter: account opening, last running balance');

r = bookWindow(e, '2025-05-01', 1000);
ok(r.opening === 1100, 'from-date: opening = running balance before the window (was wrongly 1000)');
ok(r.closing === 1300 && r.window.length === 3, 'from-date: closing = last in window');

const upToMay = e.filter(x => x.date <= '2025-05-31');
r = bookWindow(upToMay, '2025-05-01', 1000);
ok(r.opening === 1100 && r.closing === 1400, 'to-date honoured: closing is balance as of end of window (was all-time)');

r = bookWindow(e, '2025-05-10', 1000);
ok(r.opening === 1100 && r.window[0].date === '2025-05-10', 'from-date is inclusive');

r = bookWindow(e, '2025-07-01', 1000);
ok(r.window.length === 0 && r.opening === 1300 && r.closing === 1300, 'empty window: opening = closing = carried balance');

r = bookWindow([], undefined, 0);
ok(r.opening === 0 && r.closing === 0, 'no entries, branch scope (opening 0)');
r = bookWindow([], '2025-05-01', 750);
ok(r.opening === 750 && r.closing === 750, 'no entries: opening in scope carried');

r = bookWindow(e, undefined, 0);
ok(r.opening === 0, 'branch view: opening is the in-scope opening, not the HO account opening');

console.log(`\nbookWindow: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
