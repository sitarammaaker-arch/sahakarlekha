// Split trial balance (T-09) — imports the REAL projectSplitTrialBalance via the '@/' loader and
// proves it reproduces getTrialBalance's opening/transaction split from the journal: account.opening
// events feed the OPENING columns, voucher events the TRANSACTION columns, totals/net exact in paise,
// with as-of-date filtering. Run: node scripts/test-ledger-split-tb.mjs
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

const { projectSplitTrialBalance } = await import(abs('../src/lib/ledger/projections.ts'));
const { buildEvent } = await import(abs('../src/lib/ledger/event.ts'));
const { planOpeningEvents, planGenesisEvents } = await import(abs('../src/lib/ledger/genesis.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const line = (tb, id) => tb.lines.find((l) => l.accountId === id);
const v = (id, over = {}) => ({ id, type: 'journal', date: '2025-06-01', debitAccountId: '1001', creditAccountId: '4101', amount: 1000, ...over });

// Openings: 1001 Dr ₹5000, 4101 Cr ₹5000. Posting: 1001 Dr ₹1000 / 4101 Cr ₹1000.
const openings = planOpeningEvents(
  [{ id: '1001', openingBalance: 5000, openingBalanceType: 'debit' }, { id: '4101', openingBalance: 5000, openingBalanceType: 'credit' }],
  'SOC001', { openingDate: '2000-01-01' },
);
const posting = planGenesisEvents([{ voucher: v('a'), tenantId: 'SOC001', jurisdiction: 'hr' }]).events;
const tb = projectSplitTrialBalance([...openings, ...posting]);

// 1. Opening columns come ONLY from account.opening events.
ok(line(tb, '1001').openingDrMinor === 500000 && line(tb, '1001').openingCrMinor === 0, '1001 opening Dr 500000 (from opening event only)');
ok(line(tb, '4101').openingCrMinor === 500000 && line(tb, '4101').openingDrMinor === 0, '4101 opening Cr 500000');

// 2. Transaction columns come ONLY from voucher events.
ok(line(tb, '1001').txnDrMinor === 100000 && line(tb, '4101').txnCrMinor === 100000, 'transaction columns from the voucher posting');
ok(line(tb, '1001').openingDrMinor !== line(tb, '1001').txnDrMinor, 'opening and transaction are kept separate (not merged)');

// 3. Totals = opening + txn; net = totalDr − totalCr; overall balanced.
ok(line(tb, '1001').totalDrMinor === 600000 && line(tb, '1001').netMinor === 600000, '1001 total Dr 600000 (5000 + 1000)');
ok(line(tb, '4101').totalCrMinor === 600000 && line(tb, '4101').netMinor === -600000, '4101 total Cr 600000');
ok(tb.balanced && tb.totalDrMinor === 600000 && tb.totalCrMinor === 600000, 'split TB is balanced (ΣDr === ΣCr)');
ok(tb.lines.map((l) => l.accountId).join(',') === '1001,4101', 'lines sorted by accountId (canonical)');

// 4. As-of-date — a later voucher is excluded; openings (dated 2000) always count.
const later = planGenesisEvents([{ voucher: v('b', { date: '2025-09-01' }), tenantId: 'SOC001' }]).events;
const asOf = projectSplitTrialBalance([...openings, ...posting, ...later], '2025-06-30');
ok(line(asOf, '1001').txnDrMinor === 100000, 'as-of 2025-06-30 excludes the 2025-09 voucher (txn still 100000)');
ok(line(asOf, '1001').openingDrMinor === 500000, 'openings (dated 2000) are always included in an as-of view');

// 5. Fractional paise stay exact through the split.
const frac = projectSplitTrialBalance(planOpeningEvents([{ id: '5', openingBalance: 33.33, openingBalanceType: 'debit' }], 'SOC001', { openingDate: '2000-01-01' }));
ok(line(frac, '5').openingDrMinor === 3333, '₹33.33 opening → 3333 paise exactly');

console.log(`\nSplit trial balance (T-09): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
