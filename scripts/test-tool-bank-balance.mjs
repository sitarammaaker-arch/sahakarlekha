// D-lane tool — bank balance (CAIOS Slice 4).
//
// A society has MANY bank accounts, so this sums each bank account's net balance — read from
// the SAME builder the Trial Balance page uses (ledgerTrialBalance), filtered to bank accounts.
// That is RULE 2 by construction: the total equals the sum of the bank rows on the Trial Balance.
//
// Pins: multiple banks summed exactly (incl. a Cr bank), the per-bank split, no-bank ⇒ null (never
// "₹0"), and the seam route "मेरा बैंक बैलेंस" → lane D → the bank tool, through the DEPLOYED bundle.
//
// Run: node scripts/test-tool-bank-balance.mjs   (npm run test:tool-bank-balance)

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { bankBalance } = await loadViteModule(ROOT, resolve(ROOT, 'src/lib/ask/tools/bankBalance.ts'), 'eval');
const { ACCOUNT_IDS } = await loadViteModule(ROOT, resolve(ROOT, 'src/lib/storage.ts'), 'eval');

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
};

// Two bank accounts under the BANK parent (getBankAccountIds finds them), plus a non-bank so the
// filter is exercised. Event legs: { accountId, drCr, amountMinor } — drCr NOT type, PAISE.
const HDFC = 'bank-hdfc', SIRSA = 'bank-sirsa';
const accounts = [
  { id: HDFC, name: 'HDFC Saving A/c', parentId: ACCOUNT_IDS.BANK, openingBalance: 0, openingBalanceType: 'debit' },
  { id: SIRSA, name: 'Sirsa Coop Bank A/c', parentId: ACCOUNT_IDS.BANK, openingBalance: 0, openingBalanceType: 'debit' },
  { id: '4101', name: 'Sales', openingBalance: 0, openingBalanceType: 'credit' },
];
const ev = (id, date, lines) => ({
  eventId: 'e-' + id, eventType: 'voucher.posted', schemaVersion: 1,
  tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: id,
  sequence: 1, occurredAt: date + 'T10:00:00Z', producer: { kind: 'human', id: 'u1' },
  payload: { id, date, voucherNo: 'V-' + id, narration: 't', createdAt: date + 'T10:00:00Z', lines },
});

console.log('\n  D-lane tool — bank balance\n');

// HDFC: Dr 1,00,000 (net +1,00,000). Sirsa: Cr 70,035.60 (net −70,035.60). Total = +29,964.40.
const events = [
  ev('v1', '2026-04-10', [{ accountId: HDFC, drCr: 'Dr', amountMinor: 10000000 }, { accountId: '4101', drCr: 'Cr', amountMinor: 10000000 }]),
  ev('v2', '2026-04-11', [{ accountId: '4101', drCr: 'Dr', amountMinor: 7003560 }, { accountId: SIRSA, drCr: 'Cr', amountMinor: 7003560 }]),
];

{
  const b = bankBalance({ events, accounts });
  ok('no bank account ⇒ null, never "₹0"', bankBalance({ events: [], accounts: [{ id: '4101', name: 'Sales' }] }) === null);
  ok('sums both banks, exact paise (1,00,000 − 70,035.60 = 29,964.40)', b && b.balanceMinor === 2996440, JSON.stringify(b));
  ok('formatted total is the human string', b.formatted === '₹29,964.40');
  ok('counts both banks', b.bankCount === 2);
  ok('per-bank split carries each bank (incl. the Cr one as negative)',
    b.perBank.some((x) => x.formatted === '₹1,00,000.00') && b.perBank.some((x) => x.formatted === '-₹70,035.60'));
  ok('a non-bank account is NOT counted', !b.perBank.some((x) => x.name === 'Sales'));
  // Serial order = the accounts-list order (HDFC before Sirsa here), NOT the trial balance's accountId
  // sort. Reversing the accounts must reverse the split — proving it follows the chart, not the ids.
  ok('split follows the accounts-list serial order', b.perBank[0].name === 'HDFC Saving A/c' && b.perBank[1].name === 'Sirsa Coop Bank A/c');
  const rev = bankBalance({ events, accounts: [accounts[2], accounts[1], accounts[0]] });
  ok('reversing the chart reverses the split (serial, not id-sorted)', rev.perBank[0].name === 'Sirsa Coop Bank A/c' && rev.perBank[1].name === 'HDFC Saving A/c');
}

// The seam route, through the DEPLOYED bundle: "मेरा बैंक बैलेंस कितना है" → lane D → bank tool.
{
  const B = await import(pathToFileURL(resolve(ROOT, 'supabase/functions/_shared/ask-core.mjs')).href);
  const flags = B.resolveAiFlags({ AI_ENABLED: 'true' });
  const society = { events, accounts, activeBranchId: '' };
  const r = B.ask({ text: 'मेरा बैंक बैलेंस कितना है', channel: 'web', societyId: 'SOC001', userId: 'u@x.com' },
    B.CORPUS, flags, '2026-07-20', 8, society);
  ok('bundle route: a possessive bank question lands in lane D', r.lane === 'D', JSON.stringify(r.trace));
  ok('bundle route: it answers with the bank total, not a refusal',
    !!r.answer && r.answer.includes('कुल बैंक शेष') && r.answer.includes('₹29,964.40') && !r.unanswered, r.answer || r.unanswered);
  ok('bundle route: the cite points at the Bank Book', (r.cites || []).some((c) => c.id === 'tool:bankBalance'));

  const anon = B.ask({ text: 'मेरा बैंक बैलेंस कितना है', channel: 'web' }, B.CORPUS, flags, '2026-07-20', 8);
  ok('bundle route: anonymous is refused (needs login)', anon.lane === 'D' && !!anon.unanswered && !anon.answer);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
