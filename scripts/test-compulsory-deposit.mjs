// Compulsory (thrift) deposit — depositType 'CD' (2026-11-16). Imports the REAL helpers via the '@/' loader.
//
// Guards:
//   - CD posts to the compulsory-deposit head and NEVER falls back to 2107 (it must stay apart from savings);
//   - only a chart that has the head can open one: thrift_credit yes; credit / pacs / CMS no;
//   - a look-alike name (a thrift FUND, a group) is not accepted as the head;
//   - no withdrawal while the account is open; deposit / closure post the usual way;
//   - one open CD account per member;
//   - the collection sheet suggests only what is still unpaid for the month, so posting twice collects once;
//   - arrears = months fallen due × monthly − contributions paid (interest is not a contribution).
//
// Run: node scripts/test-compulsory-deposit.mjs   (npm run test:compulsory-deposit)
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const E = await import(abs('../src/lib/depositEngine.ts'));
const H = await import(abs('../src/lib/accounting/headResolve.ts'));
const CD = await import(abs('../src/lib/compulsoryDeposit.ts'));
const S = await import(abs('../src/lib/storage.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Head: 2112 by convention, resolved by meaning, never 2107.
ok(E.depositLiabilityAccount('CD') === '2112', 'CD sits in 2112');
for (const t of ['SB', 'RD', 'PIGMY']) ok(E.depositLiabilityAccount(t) === '2107', `${t} still sits in 2107`);
ok(E.depositLiabilityAccount('FD') === '2108', 'FD still sits in 2108');

const thrift = S.fullChartForType('thrift_credit');
ok(E.resolveDepositLiabilityAccount('CD', thrift) === '2112', 'Thrift & Credit chart: CD resolves to 2112');
ok(E.resolveDepositLiabilityAccount('SB', thrift) === '2107', 'Thrift & Credit chart: SB still resolves to 2107');
for (const type of ['credit', 'pacs', 'marketing_processing', 'consumer', 'housing', 'dairy', 'multipurpose']) {
  ok(E.resolveDepositLiabilityAccount('CD', S.fullChartForType(type)) === null, `${type} chart has no compulsory-deposit head → CD cannot open`);
}
const leaf = (id, name, extra = {}) => ({ id, name, nameHi: '', type: 'liability', isGroup: false, ...extra });
ok(H.compulsoryDepositAccountId([leaf('2107', 'Member Deposits')]) === null, 'never falls back to Member Deposits (2107)');
ok(H.compulsoryDepositAccountId([leaf('2112', 'Audit Fee Payable')]) === null, 'an unrelated head at id 2112 is not accepted');
ok(H.compulsoryDepositAccountId([leaf('2190', 'Compulsory Deposit')]) === '2190', 'a head the society added under another id is found by name');
ok(H.compulsoryDepositAccountId([leaf('2190', 'Members Thrift Fund')]) === null, 'a thrift FUND is not a deposit head');
ok(H.compulsoryDepositAccountId([leaf('2112', 'Compulsory Deposits', { isGroup: true })]) === null, 'a group is not a posting head');
ok(H.compulsoryDepositAccountId([leaf('2112', 'Compulsory Deposits', { type: 'asset' })]) === null, 'an asset is not the liability head');
ok(H.compulsoryDepositAccountId([{ id: '2150', name: 'CD', nameHi: 'सदस्यों की अनिवार्य जमा', type: 'liability', isGroup: false }]) === '2150', 'the Hindi name is recognised');
ok(H.missingDepositHeadToast('CD').title !== H.missingDepositHeadToast('SB').title, 'a missing CD head has its own message');

// 2. No withdrawal while open; deposit and closure as usual.
ok(E.allowsWithdrawal('CD') === false, 'CD allows no withdrawal');
for (const t of ['SB', 'FD', 'RD', 'PIGMY']) ok(E.allowsWithdrawal(t) === true, `${t} still allows withdrawal`);
ok(E.validateDepositTxn('withdraw', 100, 5000, 'CD').ok === false, 'withdraw from CD is refused even within the balance');
ok(E.validateDepositTxn('withdraw', 100, 5000, 'SB').ok === true, 'withdraw from SB is still allowed');
ok(E.validateDepositTxn('withdraw', 100, 5000).ok === true, 'old 3-argument call behaves as before');
ok(E.validateDepositTxn('deposit', 500, 0, 'CD').ok === true, 'deposit into CD is allowed');
ok(E.validateDepositTxn('deposit', 0, 0, 'CD').ok === false, 'zero deposit is refused');
const acc = { liability: '2112', cashBank: '3301' };
const dep = E.depositPosting('deposit', acc);
ok(dep.debitAccountId === '3301' && dep.creditAccountId === '2112', 'deposit → Dr cash / Cr compulsory deposit');
const cls = E.depositPosting('closure', acc);
ok(cls.debitAccountId === '2112' && cls.creditAccountId === '3301', 'closure → Dr compulsory deposit / Cr cash (the refund)');

// The closure payout is a PAYMENT voucher (staging 2026-11-16: it was numbered as a receipt, RV/…).
ok(E.depositVoucherType('closure') === 'payment' && E.depositVoucherType('withdraw') === 'payment', 'money going out is a payment voucher');
ok(E.depositVoucherType('open') === 'receipt' && E.depositVoucherType('deposit') === 'receipt', 'money coming in is a receipt voucher');
for (const t of ['open', 'deposit', 'withdraw', 'closure']) ok((E.depositVoucherType(t) === 'payment') === (E.depositPosting(t, acc).sign === -1), `${t}: voucher type agrees with the posting direction`);

// 3. One open account per member.
const accts = [
  { id: 'a1', memberId: 'm1', depositType: 'CD', status: 'active', openDate: '2026-04-10', installmentAmount: 500 },
  { id: 'a2', memberId: 'm2', depositType: 'CD', status: 'closed', openDate: '2026-04-10', installmentAmount: 500 },
  { id: 'a3', memberId: 'm3', depositType: 'SB', status: 'active', openDate: '2026-04-10' },
  { id: 'a4', memberId: 'm4', depositType: 'CD', status: 'active', openDate: '2026-06-01', installmentAmount: 300 },
  { id: 'a5', memberId: 'm5', depositType: 'CD', status: 'active', openDate: '2026-06-01' },
];
ok(CD.hasActiveCompulsoryDeposit(accts, 'm1') === true, 'm1 has an open CD account');
ok(CD.hasActiveCompulsoryDeposit(accts, 'm2') === false, 'a closed CD account does not block a new one');
ok(CD.hasActiveCompulsoryDeposit(accts, 'm3') === false, 'a savings account is not a CD account');
ok(CD.compulsoryAccounts(accts).map((a) => a.id).join() === 'a1,a4,a5', 'only active CD accounts are on the sheet');

// 4. Paid in month, arrears, collection sheet.
const txns = [
  { depositAccountId: 'a1', date: '2026-04-10', txnType: 'open', amount: 500 },
  { depositAccountId: 'a1', date: '2026-05-07', txnType: 'deposit', amount: 500 },
  { depositAccountId: 'a1', date: '2026-06-30', txnType: 'interest', amount: 40 },
  { depositAccountId: 'a4', date: '2026-07-03', txnType: 'deposit', amount: 100 },
  { depositAccountId: 'a3', date: '2026-07-03', txnType: 'deposit', amount: 900 },
];
ok(CD.monthOf('2026-07-15') === '2026-07', 'monthOf');
ok(CD.paidInMonth(txns, 'a1', '2026-05') === 500, 'a1 paid 500 in May');
ok(CD.paidInMonth(txns, 'a1', '2026-06') === 0, 'interest credited in June is not a contribution');
ok(CD.paidInMonth(txns, 'a1', '2026-07') === 0, 'a1 paid nothing in July');

const ar = CD.compulsoryArrears(accts[0], txns, '2026-07-15');
ok(ar.monthsElapsed === 4 && ar.expected === 2000 && ar.paid === 1000 && ar.arrears === 1000 && ar.monthsBehind === 2, 'a1: Apr–Jul due 2000, paid 1000, 2 months behind');
ok(CD.compulsoryArrears(accts[0], txns, '2026-05-31').arrears === 0, 'a1 was up to date at the end of May');
ok(CD.compulsoryArrears(accts[0], txns, '2026-04-01').expected === 0, 'nothing is due before the account opened');
const ahead = CD.compulsoryArrears(accts[0], [{ depositAccountId: 'a1', date: '2026-04-10', txnType: 'open', amount: 5000 }], '2026-07-15');
ok(ahead.arrears === 0 && ahead.monthsBehind === 0, 'paying ahead is never negative arrears');
ok(CD.compulsoryArrears(accts[4], txns, '2026-07-15').arrears === 0, 'an account with no monthly amount has no arrears');
const a4 = CD.compulsoryArrears(accts[3], txns, '2026-07-15');
ok(a4.expected === 600 && a4.paid === 100 && a4.arrears === 500 && a4.monthsBehind === 1, 'a4: part payment leaves 500 owed, one whole month behind');

const sheet = CD.collectionSheet(accts, txns, '2026-07-15');
ok(sheet.length === 3, 'sheet has the three active CD accounts');
const row = (id) => sheet.find((r) => r.account.id === id);
ok(row('a1').suggested === 500 && row('a1').paidThisMonth === 0 && row('a1').arrears === 1000, 'a1: collect 500 for July, 1000 owed in all');
ok(row('a4').suggested === 200 && row('a4').paidThisMonth === 100, 'a4: 100 already paid in July → collect the remaining 200');
ok(row('a5').suggested === 0 && row('a5').monthly === 0, 'a5: no monthly amount → nothing suggested');
// Posting the sheet and opening it again in the same month suggests nothing more.
const after = [...txns, { depositAccountId: 'a1', date: '2026-07-15', txnType: 'deposit', amount: 500 }, { depositAccountId: 'a4', date: '2026-07-15', txnType: 'deposit', amount: 200 }];
ok(CD.collectionSheet(accts, after, '2026-07-20').every((r) => r.suggested === 0), 'after posting, the same month suggests nothing — no double collection');
ok(CD.collectionSheet(accts, after, '2026-08-02').find((r) => r.account.id === 'a1').suggested === 500, 'next month suggests the contribution again');

console.log(`\ncompulsory-deposit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
