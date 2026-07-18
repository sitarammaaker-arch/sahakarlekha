// D-lane tool — trial balance check (CAIOS Slice 4).
//
// Same law as the cash tool: the assistant must give the figure the Trial Balance page
// gives, not a similar one. So the tool calls the EXACT builder the ledger read-cut uses
// (ledgerTrialBalance) and only sums it — in PAISE, because adding rupee floats and testing
// the total for equality is the drift the money primitive exists to retire.
//
// These pin the two things that would break quietly:
//   • a valid double-entry journal must tie out (difference = 0), and an unbalanced one must
//     be CAUGHT, not smoothed over — a wrong "मिलता है ✓" is worse than no answer;
//   • the tool's totals must equal a sum over ledgerTrialBalance's own rows (RULE 2) — the
//     assistant and the Trial Balance page cannot disagree.
// Plus the seam route: "मेरा ट्रायल बैलेंस" reaches lane D and the tool, through the DEPLOYED
// bundle (a mini drift check, per PR #237).
//
// Run: node scripts/test-tool-trial-balance.mjs   (npm run test:tool-trial-balance)

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { trialBalanceCheck } =
  await loadViteModule(ROOT, resolve(ROOT, 'src/lib/ask/tools/trialBalance.ts'), 'eval');
const { ledgerTrialBalance } =
  await loadViteModule(ROOT, resolve(ROOT, 'src/lib/ledger/trialBalance.ts'), 'eval');
const { toMinor } =
  await loadViteModule(ROOT, resolve(ROOT, 'src/lib/money.ts'), 'eval');

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
};

// Same event fixture shape the cash-balance test pins: legs are { accountId, drCr, amountMinor }
// — drCr NOT type, amountMinor in PAISE. Getting it wrong yields an empty projection that
// looks like a plausible ₹0, which is why this shape is copied, not re-guessed.
const ev = (id, date, lines) => ({
  eventId: 'e-' + id, eventType: 'voucher.posted', schemaVersion: 1,
  tenantId: 'SOC001', jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: id,
  sequence: 1, occurredAt: date + 'T10:00:00Z', producer: { kind: 'human', id: 'u1' },
  payload: { id, date, voucherNo: 'V-' + id, narration: 'test', createdAt: date + 'T10:00:00Z', lines },
});

const accounts = [
  { id: '3301', name: 'Cash in Hand', openingBalance: 0, openingBalanceType: 'debit' },
  { id: '4101', name: 'Sales',        openingBalance: 0, openingBalanceType: 'credit' },
];

console.log('\n  D-lane tool — trial balance check\n');

// A balanced sale: Dr cash 1,00,000 / Cr sales 1,00,000 (paise).
const balancedEvents = [
  ev('v1', '2026-04-10', [
    { accountId: '3301', drCr: 'Dr', amountMinor: 10000000 },
    { accountId: '4101', drCr: 'Cr', amountMinor: 10000000 },
  ]),
];

{
  const tb = trialBalanceCheck({ events: balancedEvents, accounts });
  ok('empty chart ⇒ null, never "₹0 = ₹0 ✓"',
    trialBalanceCheck({ events: [], accounts: [] }) === null);
  ok('balanced journal ties out (difference = 0)', tb && tb.balanced && tb.differenceMinor === 0, JSON.stringify(tb));
  ok('totals are exact paise', tb.totalDebitMinor === 10000000 && tb.totalCreditMinor === 10000000);
  ok('formatted is the human string the model may quote', tb.formattedDebit === '₹1,00,000.00');

  // RULE 2: the tool's totals == a sum over ledgerTrialBalance's OWN rows, in minor.
  const rows = ledgerTrialBalance(balancedEvents, accounts);
  let dr = 0, cr = 0;
  for (const r of rows) { dr += toMinor(r.totalDebit); cr += toMinor(r.totalCredit); }
  ok('parity: tool totals equal a sum over the Trial Balance page builder',
    tb.totalDebitMinor === dr && tb.totalCreditMinor === cr);
}

// An UNBALANCED journal — a stray Dr leg with no matching Cr (a corrupt entry). The tool
// must CATCH it, not smooth it: a false "मिलता है" would hide a real integrity problem.
{
  const bad = [...balancedEvents, ev('v2', '2026-04-11', [
    { accountId: '3301', drCr: 'Dr', amountMinor: 5000 }, // ₹50, no Cr
  ])];
  const tb = trialBalanceCheck({ events: bad, accounts });
  ok('unbalanced journal is CAUGHT (balanced = false)', tb && tb.balanced === false);
  ok('the difference is surfaced exactly (₹50)', tb.differenceMinor === 5000 && tb.formattedDifference === '₹50.00');
}

// The seam route, through the DEPLOYED bundle: "मेरा ट्रायल बैलेंस मिलता है?" → lane D → tool.
{
  const B = await import(pathToFileURL(resolve(ROOT, 'supabase/functions/_shared/ask-core.mjs')).href);
  const flags = B.resolveAiFlags({ AI_ENABLED: 'true' });
  const society = { events: balancedEvents, accounts, activeBranchId: '' };
  const r = B.ask({ text: 'मेरा ट्रायल बैलेंस मिलता है?', channel: 'web', societyId: 'SOC001', userId: 'u@x.com' },
    B.CORPUS, flags, '2026-07-18', 8, society);
  ok('bundle route: a possessive trial-balance question lands in lane D', r.lane === 'D', JSON.stringify(r.trace));
  /* D-LANE FIGURES ARE DISABLED IN core.ts (RULE 2): the seam reads the raw journal, which
     over-counts when it has drifted from the vouchers (cancelled-but-still-in-journal). Until
     the seam matches the app's parity-gated source, ask() refuses rather than state a wrong
     balance. The TOOL is still correct (asserted above); this checks the SEAM withholds it. */
  ok('bundle route: the seam WITHHOLDS the figure while the D-lane is disabled (RULE 2)',
    !r.answer && (r.unanswered || '').includes('सटीक आँकड़ा नहीं'), r.answer || r.unanswered);
  ok('bundle route: the trace says the D-lane is disabled', (r.trace?.guard || '').includes('disabled'));

  // Anonymous must still be refused — no token, no books (AI-N5).
  const anon = B.ask({ text: 'मेरा ट्रायल बैलेंस मिलता है?', channel: 'web' }, B.CORPUS, flags, '2026-07-18', 8);
  ok('bundle route: anonymous is refused (needs login), never answered from documents',
    anon.lane === 'D' && !!anon.unanswered && !anon.answer);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
