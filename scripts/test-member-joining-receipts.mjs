#!/usr/bin/env node
// Member joining receipts — historical members get NO cash receipt; cheque/online go to the bank;
// add / approve / import all use ONE rule. Unit tests of src/lib/members/joiningReceipts.ts plus
// static checks of the DataContext + importer wiring. CI-safe.
//
// Run: node scripts/test-member-joining-receipts.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const { planJoiningReceipts, summariseJoiningPlans, fyStartOf } = await import(pathToFileURL(pathResolve(HERE, '../src/lib/members/joiningReceipts.ts')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const FY = { financialYear: '2026-27', today: '2026-09-28', bankAccountId: '3302' };

console.log('FY start');
ok("'2026-27' starts 2026-04-01", fyStartOf('2026-27') === '2026-04-01');
ok('a non-year label has no start', fyStartOf('') === '' && fyStartOf('abc') === '');

console.log('Historical member (joined before this FY)');
const old = planJoiningReceipts({ name: 'राम', joinDate: '1972-05-10', shareCapital: 100, admissionFee: 10 }, FY);
ok('no receipt', old.mode === 'historical' && old.receipts.length === 0);
ok('amounts reported for the opening balances', old.historicalShare === 100 && old.historicalAdmission === 10);
ok('the day before the FY start is still historical', planJoiningReceipts({ name: 'x', joinDate: '2026-03-31', shareCapital: 50 }, FY).mode === 'historical');

console.log('Member joining this FY');
const cash = planJoiningReceipts({ name: 'श्याम', joinDate: '2026-04-01', shareCapital: 100, admissionFee: 10, paymentMode: 'cash' }, FY);
ok('FY start day posts receipts', cash.mode === 'post' && cash.receipts.length === 2);
ok('share → Cr 1102, admission → Cr 4407, dated the join date', cash.receipts[0].creditAccountId === '1102' && cash.receipts[1].creditAccountId === '4407' && cash.date === '2026-04-01');
ok('cash payment → Dr 3301', cash.debitAccountId === '3301');
ok('unspecified payment → Dr 3301', planJoiningReceipts({ name: 'x', joinDate: '2026-06-01', shareCapital: 50 }, FY).debitAccountId === '3301');
ok('narrations unchanged (RM-02 / diagnostics still recognise them)', cash.receipts[0].narration === 'Share Capital received from श्याम' && cash.receipts[1].narration === 'Admission Fee received from श्याम');
const chq = planJoiningReceipts({ name: 'x', joinDate: '2026-06-01', shareCapital: 50, paymentMode: 'cheque' }, FY);
ok('cheque → Dr default bank', chq.debitAccountId === '3302' && !chq.bankFallbackToCash);
const onl = planJoiningReceipts({ name: 'x', joinDate: '2026-06-01', shareCapital: 50, paymentMode: 'online' }, FY);
ok('online → Dr default bank', onl.debitAccountId === '3302');
const noBank = planJoiningReceipts({ name: 'x', joinDate: '2026-06-01', shareCapital: 50, paymentMode: 'online' }, { ...FY, bankAccountId: null });
ok('online with no bank account → cash, flagged', noBank.debitAccountId === '3301' && noBank.bankFallbackToCash);
ok('only non-zero amounts get a receipt', planJoiningReceipts({ name: 'x', joinDate: '2026-06-01', shareCapital: 50, admissionFee: 0 }, FY).receipts.length === 1);
ok('no join date → today (current FY) → posts', planJoiningReceipts({ name: 'x', shareCapital: 50 }, FY).mode === 'post' && planJoiningReceipts({ name: 'x', shareCapital: 50 }, FY).date === '2026-09-28');
ok('nothing to receive → none', planJoiningReceipts({ name: 'x', joinDate: '2026-06-01' }, FY).mode === 'none');

console.log('Batch summary (importer)');
const sum = summariseJoiningPlans([old, cash, planJoiningReceipts({ name: 'y', joinDate: '1990-01-01', shareCapital: 200 }, FY)]);
ok('historical count and totals', sum.historicalMembers === 2 && sum.historicalShare === 300 && sum.historicalAdmission === 10 && sum.postedMembers === 1);

console.log('Wiring');
const dc = readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8');
const helper = dc.slice(dc.indexOf('const postJoiningReceipts = useCallback'), dc.indexOf('const addMember = useCallback'));
ok('one helper plans with planJoiningReceipts', /planJoiningReceipts\(m, \{/.test(helper));
ok('historical → returns before creating any voucher', helper.indexOf("return 'historical'") > 0 && helper.indexOf("return 'historical'") < helper.indexOf('const v: Voucher'));
ok('a locked period posts nothing', /if \(isPeriodLocked\(plan\.date\)\)/.test(helper) && helper.indexOf("return 'locked'") < helper.indexOf('const v: Voucher'));
ok('receipts use the planned debit account (not hard-coded cash)', /debitAccountId: plan\.debitAccountId/.test(helper) && !/debitAccountId: ACCOUNT_IDS\.CASH/.test(helper));
ok('receipts persist through persistVoucher with rollback (RULE 1)', /persistVoucher\(v, \{ isUpdate: false, onBaseFail/.test(helper));
const add = dc.slice(dc.indexOf('const addMember = useCallback'), dc.indexOf('const updateMember = useCallback'));
ok('addMember uses the helper and no longer builds cash receipts itself', /postJoiningReceipts\(newMember, \{ quiet: opts\.quiet \}\)/.test(add) && !/ACCOUNT_IDS\.CASH/.test(add));
const appr = dc.slice(dc.indexOf('const approveMember = useCallback'), dc.indexOf('const rejectMember = useCallback'));
ok('approveMember uses the helper and no longer builds cash receipts itself', /postJoiningReceipts\(approved,/.test(appr) && !/ACCOUNT_IDS\.CASH/.test(appr));
ok('no other place builds a member joining receipt', (dc.match(/Share Capital received from \$\{/g) || []).length === 0);
const imp = readFileSync(pathResolve(HERE, '../src/pages/UniversalImporter.tsx'), 'utf8');
ok('importer adds quietly and plans with the same rule', /addMember\(memberData, \{ quiet: true \}\)/.test(imp) && /plans\.push\(planJoiningReceipts\(memberData, planOpts\)\)/.test(imp));
ok('importer shows one historical summary', /summariseJoiningPlans\(plans\)/.test(imp) && /पुराने सदस्य — नकद रसीद नहीं बनी/.test(imp));

console.log(`\nMember joining receipts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
