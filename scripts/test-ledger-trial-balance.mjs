// Ledger-native trial balance (T-09) — imports the REAL ledgerTrialBalance via the '@/' loader and
// proves it maps the journal onto the app's AccountBalance shape (rupees, opening/txn split, account
// metadata, orphan "[Deleted]" rows) exactly as getTrialBalance does. Run: node scripts/test-ledger-trial-balance.mjs
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
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const { ledgerTrialBalance } = await import(abs('../src/lib/ledger/trialBalance.ts'));
const { planOpeningEvents, planGenesisEvents } = await import(abs('../src/lib/ledger/genesis.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const row = (tb, id) => tb.find((r) => r.account.id === id);
const acct = (id, over = {}) => ({ id, name: id, type: 'asset', openingBalance: 0, openingBalanceType: 'debit', ...over });
const v = (id, over = {}) => ({ id, type: 'journal', date: '2025-06-01', debitAccountId: '1001', creditAccountId: '4101', amount: 1000, ...over });

const accounts = [
  acct('1001', { openingBalance: 5000, openingBalanceType: 'debit' }),
  acct('4101', { openingBalance: 5000, openingBalanceType: 'credit', type: 'income' }),
  acct('9999', {}),                       // zero-activity account — shows as zeros
  acct('2100', { isGroup: true }),        // group — excluded
];
const events = [
  ...planOpeningEvents(accounts, 'SOC001', { openingDate: '2000-01-01' }),
  ...planGenesisEvents([{ voucher: v('a'), tenantId: 'SOC001' }]).events,
];
const tb = ledgerTrialBalance(events, accounts);

// 1. Shape + rupees: opening/txn/total/net per account, from the split journal.
const a1001 = row(tb, '1001');
ok(a1001.openingDebit === 5000 && a1001.transactionDebit === 1000 && a1001.totalDebit === 6000, '1001 opening ₹5000 + txn ₹1000 = total ₹6000 (rupees)');
ok(a1001.netBalance === 6000 && a1001.openingCredit === 0, '1001 net ₹6000 Dr, no credit');
ok(row(tb, '4101').totalCredit === 6000 && row(tb, '4101').netBalance === -6000, '4101 total Cr ₹6000, net −6000');
ok(a1001.account.name === '1001' && a1001.account === accounts[0], 'account metadata attached (the real LedgerAccount object)');

// 2. Group accounts excluded; zero-activity accounts present as zeros.
ok(!row(tb, '2100'), 'group account excluded (like getTrialBalance)');
const z = row(tb, '9999');
ok(z && z.totalDebit === 0 && z.totalCredit === 0 && z.netBalance === 0, 'zero-activity account shown as all zeros');

// 3. The whole trial balance balances (Σ totalDebit === Σ totalCredit).
const sumDr = tb.reduce((s, r) => s + r.totalDebit, 0);
const sumCr = tb.reduce((s, r) => s + r.totalCredit, 0);
ok(Math.round(sumDr * 100) === Math.round(sumCr * 100), 'trial balance ties out (Σ Dr === Σ Cr)');

// 4. Orphan legs (account not in the chart) → synthetic "[Deleted]" row so the TB still balances.
const orphanEvents = planGenesisEvents([{ voucher: v('b', { debitAccountId: 'GONE123456', creditAccountId: '4101', amount: 200 }), tenantId: 'SOC001' }]).events;
const tb2 = ledgerTrialBalance([...events, ...orphanEvents], accounts);
const gone = row(tb2, 'GONE123456');
ok(gone && gone.account.name.startsWith('[Deleted]') && gone.transactionDebit === 200, 'orphan leg → synthetic [Deleted] account with its ₹200 Dr');
const sumDr2 = tb2.reduce((s, r) => s + r.totalDebit, 0), sumCr2 = tb2.reduce((s, r) => s + r.totalCredit, 0);
ok(Math.round(sumDr2 * 100) === Math.round(sumCr2 * 100), 'TB with an orphan leg still ties out');

// 5. As-of-date flows through to the mapper.
const later = planGenesisEvents([{ voucher: v('c', { date: '2025-12-01' }), tenantId: 'SOC001' }]).events;
const asOf = ledgerTrialBalance([...events, ...later], accounts, '2025-06-30');
ok(row(asOf, '1001').transactionDebit === 1000, 'as-of excludes the later voucher (txn still ₹1000)');

console.log(`\nLedger trial balance (T-09): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
