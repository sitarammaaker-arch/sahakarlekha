// isClearedAsOf (audit A-07): BRS must honour the clearing date, not just the live flag.
// Run: node scripts/test-bank-clearing.mjs   (npm run test:bank-clearing)
import { isClearedAsOf } from '../src/lib/reports/bankClearing.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

ok(!isClearedAsOf({}, '2026-03-31'), 'never cleared -> uncleared');
ok(!isClearedAsOf({ isCleared: false, clearedDate: '2026-01-01' }, '2026-03-31'), 'flag false wins');
ok(isClearedAsOf({ isCleared: true, clearedDate: '2026-02-10' }, '2026-03-31'), 'cleared before as-on date');
ok(isClearedAsOf({ isCleared: true, clearedDate: '2026-03-31' }, '2026-03-31'), 'clearing date is inclusive');
ok(!isClearedAsOf({ isCleared: true, clearedDate: '2026-04-05' }, '2026-03-31'), 'cleared AFTER as-on date -> still outstanding then');
ok(isClearedAsOf({ isCleared: true }, '2026-03-31'), 'legacy cleared voucher without date stays cleared');

console.log(`\nisClearedAsOf: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
