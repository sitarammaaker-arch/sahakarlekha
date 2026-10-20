// Member import: OLD vs NEW member (2026-10-20, founder request).
//
// join_date decides it, with ONE rule shared by the receipt plan and the importer preview
// (members/joiningReceipts.isHistoricalJoin): before the current FY starts → old (no receipt, share to the
// opening balances); in the FY → new (receipt). Guards the rule, the preview label, the FY-aware template
// (an old AND a new example), and that join_date is mandatory, a real date and not in the future.
//
// Run: node scripts/test-member-import-old-new.mjs   (npm run test:member-import-old-new)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as pathResolve } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const base = pathResolve(SRC, spec.slice(2));
          for (const cand of [base + '.ts', base + '.tsx', base + '/index.ts', base]) {
            if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
          }
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
            const u = new URL(cand, ctx.parentURL);
            if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
          }
        }
        return next(spec, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;


const J = await import(abs('../src/lib/members/joiningReceipts.ts'));
const T = await import(abs('../src/lib/importTemplates.ts'));
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const FY = '2026-27', FY_START = '2026-04-01';
const opts = { financialYear: FY, today: '2026-10-20', bankAccountId: '3302-01' };

ok(J.isHistoricalJoin('2026-03-31', FY) && !J.isHistoricalJoin('2026-04-01', FY) && !J.isHistoricalJoin('2026-10-20', FY), 'boundary: 31 Mar = old, 1 Apr = new');
ok(!J.isHistoricalJoin('', FY) && !J.isHistoricalJoin('2020-01-01', 'bad'), 'no date / no FY → not old');

const oldPlan = J.planJoiningReceipts({ name: 'A', joinDate: '2020-04-01', shareCapital: 5000, admissionFee: 100 }, opts);
const newPlan = J.planJoiningReceipts({ name: 'B', joinDate: '2026-05-01', shareCapital: 1000, admissionFee: 100, paymentMode: 'cash' }, opts);
const newBank = J.planJoiningReceipts({ name: 'C', joinDate: '2026-05-01', shareCapital: 1000, paymentMode: 'online' }, opts);
ok(oldPlan.mode === 'historical' && newPlan.mode === 'post', 'receipt plan uses the same rule');
ok(J.joiningKindLabel(oldPlan, '2020-04-01', FY).startsWith('पुराना') && J.joiningKindLabel(oldPlan, '2020-04-01', FY).includes('₹5,100'), 'old label: no receipt, amount to opening');
ok(J.joiningKindLabel(newPlan, '2026-05-01', FY).startsWith('नया') && J.joiningKindLabel(newPlan, '2026-05-01', FY).includes('नकद') && J.joiningKindLabel(newPlan, '2026-05-01', FY).includes('₹1,100'), 'new label: cash receipt ₹1,100');
ok(J.joiningKindLabel(newBank, '2026-05-01', FY).includes('बैंक'), 'new + online → bank');
const zeroOld = J.planJoiningReceipts({ name: 'D', joinDate: '2019-01-01' }, opts);
const zeroNew = J.planJoiningReceipts({ name: 'E', joinDate: '2026-06-01' }, opts);
ok(J.joiningKindLabel(zeroOld, '2019-01-01', FY) === 'पुराना — राशि नहीं' && J.joiningKindLabel(zeroNew, '2026-06-01', FY) === 'नया — राशि नहीं', 'no amount → still old / new by date');

// Template: FY-aware, with an old AND a new example, and the rule in the join_date hint.
const csv = T.membersTemplate(FY_START);
const rows = T.parseCSV(csv);
const hdr = rows[0];
const ji = hdr.indexOf('join_date');
ok(rows.every(r => r.length === hdr.length), `every template line has ${hdr.length} cells`);
ok(rows[1][ji].includes('पुराना') && rows[1][ji].includes('नया'), 'join_date hint explains old vs new');
const ex = rows.slice(2);
ok(ex.some(r => J.isHistoricalJoin(r[ji], FY)) && ex.some(r => !J.isHistoricalJoin(r[ji], FY)), 'examples include an old and a new member for this FY');
ok(ex.some(r => r[0].includes('M003') && r[ji] === FY_START), 'M003 is the new member, dated the FY start');
ok(T.parseCSV(T.membersTemplate('2027-04-01')).slice(2).some(r => r[ji] === '2027-04-01'), 'the new example follows the FY');

// join_date: mandatory, real, not future.
const base = { member_id: 'M9', name: 'X', father_name: 'Y', member_type: 'member', status: 'active', share_capital: '0' };
const errs = (d) => T.validateMemberRow({ ...base, join_date: d }, 3, '2026-10-20').filter(e => e.field === 'join_date');
ok(errs('').length === 1 && errs('').length && errs(undefined).length === 1, 'empty join_date is refused');
ok(errs('2022-02-30').length === 1 && errs('2023-13-01').length === 1, 'impossible dates are refused');
ok(errs('2026-10-21').length === 1 && errs('2026-10-20').length === 0, 'future date refused, today allowed');
ok(errs('2020-04-01').length === 0, 'a valid old date passes');

console.log(`\nmember-import-old-new: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
