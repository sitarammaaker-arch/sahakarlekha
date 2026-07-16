// D-lane tool — cash balance (CAIOS Slice 4, step 3).
//
// The only thing that matters: the assistant must give the figure the Cash Book page
// gives. Not a similar one. An assistant that disagrees with the screen by ₹1 is worse
// than one that says "I don't know" — the user cannot tell which is lying, so they stop
// trusting both, and the accounting was never the thing that was wrong.
//
// So these assert the two places that would break that quietly:
//   • the ECR-17 opening rule (a branch view gets ZERO opening — forget it and every
//     branch reports the society's whole opening as its own cash);
//   • exact paise (ADR-0006) — the tool takes the projection BEFORE the page rounds it
//     to rupees for the eye.
//
// Run: node scripts/test-tool-cash-balance.mjs   (npm run test:tool-cash-balance)

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { cashBalance, formatMinorInr } =
  await loadViteModule(ROOT, resolve(ROOT, 'src', 'lib', 'ask', 'tools', 'cashBalance.ts'), 'eval');
const { ACCOUNT_IDS } = await loadViteModule(ROOT, resolve(ROOT, 'src', 'lib', 'storage.ts'), 'eval');

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
};

const CASH = ACCOUNT_IDS.CASH;
const accounts = [
  { id: CASH, name: 'Cash in Hand', openingBalance: 50000, openingBalanceType: 'debit' },
  { id: '4101', name: 'Sales', openingBalance: 0, openingBalanceType: 'credit' },
];

/* A posted voucher event, in the journal's REAL shape — verified against
   aggregateState.ts's `legsOf`, not assumed. Two things I guessed wrong first:
     • the leg field is `drCr`, not `type` (that is the VOUCHER's shape, not the event's)
     • amounts are `amountMinor` — PAISE. The journal stores exact money; only the page
       converts to rupees for display.
   Both wrong guesses produced a silently EMPTY projection: legsOf skips any leg it does
   not recognise, so the balance came back as just the opening and looked plausible. That
   is the failure mode this fixture now pins. */
const ev = (id, date, lines) => ({
  eventId: 'e-' + id, eventType: 'voucher.posted', schemaVersion: 1,
  tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: id,
  sequence: 1, occurredAt: date + 'T10:00:00Z', producer: { kind: 'human', id: 'u1' },
  payload: { id, date, voucherNo: 'V-' + id, narration: 'test', createdAt: date + 'T10:00:00Z', lines },
});

console.log('\n  D-lane tool — cash balance\n');

/* 1 · THE CONSTANT IS IMPORTED, NOT RESTATED. I first hard-coded '1101' from memory; it
   is '3301'. A duplicated account id is silently wrong the day the chart moves, and the
   tool would report some other account's balance as the society's cash. */
{
  ok('account: the tool uses the SHARED cash id, not a copy', CASH === '3301');
  ok('no account ⇒ null, NOT "₹0" — an absent account is not a zero balance',
    cashBalance({ events: [], accounts: [], activeBranchId: '' }) === null);
}

/* 2 · NO MOVEMENTS ⇒ the opening IS the balance. Reading rows[last] blindly would be
   undefined and NaN its way onto the screen. */
{
  const r = cashBalance({ events: [], accounts, activeBranchId: '' });
  ok('empty journal ⇒ balance = opening', r.balanceMinor === 5000000);
  ok('empty journal ⇒ entryCount 0, no crash', r.entryCount === 0);
  ok('formatted for the model to quote', r.formatted === '₹50,000.00');
}

/* 3 · THE ARITHMETIC, in exact paise. */
{
  const events = [
    ev('v1', '2026-04-10', [{ accountId: CASH, drCr: 'Dr', amountMinor: 100000 }, { accountId: '4101', drCr: 'Cr', amountMinor: 100000 }]),
    ev('v2', '2026-05-10', [{ accountId: CASH, drCr: 'Cr', amountMinor: 25055 }, { accountId: '4101', drCr: 'Dr', amountMinor: 25055 }]),
  ];
  const r = cashBalance({ events, accounts, activeBranchId: '' });
  // 50,000 + 1,000 − 250.55 = 50,749.45
  ok('receipts add, payments subtract', r.balanceMinor === 5074945);
  ok('exact paise — no float drift (ADR-0006/T-02)', r.formatted === '₹50,749.45');
  ok('counts the movements behind it', r.entryCount === 2);

  // asOf bounds it: the May payment must not count in April.
  const apr = cashBalance({ events, accounts, activeBranchId: '', asOf: '2026-04-30' });
  ok('asOf: a later payment is excluded', apr.balanceMinor === 5100000);
  ok('asOf is echoed back', apr.asOf === '2026-04-30');
}

/* 4 · THE ECR-17 OPENING RULE — the single most likely way this tool goes quietly wrong.
   Openings carry no branchId, so they belong to the HEAD OFFICE. A branch view gets ZERO
   opening; without it every branch's book carries 100% of the society's openings and the
   branches sum to more than the consolidated. */
{
  const consolidated = cashBalance({ events: [], accounts, activeBranchId: '', headOfficeBranchId: 'HO' });
  ok('consolidated: opening included', consolidated.balanceMinor === 5000000 && consolidated.openingIncluded);

  const ho = cashBalance({ events: [], accounts, activeBranchId: 'HO', headOfficeBranchId: 'HO' });
  ok('Head Office: opening included — unbranched values are HO\'s', ho.balanceMinor === 5000000 && ho.openingIncluded);

  const branch = cashBalance({ events: [], accounts, activeBranchId: 'BR1', headOfficeBranchId: 'HO' });
  ok('a BRANCH: opening EXCLUDED — else branches sum to more than the society',
    branch.balanceMinor === 0);
  ok('...and the exclusion is REPORTED, not hidden — a user comparing to consolidated deserves the why',
    branch.openingIncluded === false);
}

/* 5 · A Cr cash balance is possible (a wrong entry), and the minus must not hide behind
   the ₹ symbol. */
{
  ok('negative renders -₹…, not ₹-…', formatMinorInr(-123456) === '-₹1,234.56');
  ok('Indian digit grouping', formatMinorInr(12345678900) === '₹12,34,56,789.00');
  ok('zero', formatMinorInr(0) === '₹0.00');
  ok('paise are never dropped', formatMinorInr(5) === '₹0.05');
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
