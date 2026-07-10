// Restore rehearsal — the assertion core (T-35 / gap EXP-04).
//
// A rehearsal is the only check that proves a backup would restore to the SAME BOOKS, not
// just that it is a well-formed file. The server orchestration (shadow society, weekly cron,
// Edge Function) needs the deferred server tier (D1) and is not built. The assertions it
// turns on ARE built and pure — they run identically in an Edge Function, in a client-side
// rehearsal, and here.
//
// Run: node scripts/test-backup-rehearsal.mjs   (npm run test:backup-rehearsal)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

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
      const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
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
      export async function load(url, ctx, next) {
        if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let mod;
try {
  mod = await import(abs('../src/lib/backup/rehearsal.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the rehearsal module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { booksSignature, compareRehearsal, summarizeRehearsal } = mod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// A small balanced ledger: 1500 Dr to 1101, 1500 Cr to 4101.
const entries = [
  { accountId: '1101', dr: 1500, cr: 0 },
  { accountId: '4101', dr: 0, cr: 1500 },
];
const stockItems = [{ id: 'I1', openingStock: 10 }, { id: 'I2', openingStock: 0 }];
const stockMovements = [
  { itemId: 'I1', type: 'purchase', qty: 5 },
  { itemId: 'I1', type: 'sale', qty: 3 },
  { itemId: 'I2', type: 'adjustment', qty: 8 },
];

// ── 1. THE SIGNATURE ─────────────────────────────────────────────────────────

const sig = booksSignature({ entries, stockItems, stockMovements });
ok(sig.totalDr === 1500 && sig.totalCr === 1500, 'the trial balance sums are read from the entries');
ok(sig.balanced === true, 'a ledger with equal Dr and Cr balances (the double-entry invariant)');
ok(sig.perAccount['1101'] === 1500 && sig.perAccount['4101'] === -1500, 'the per-account net is the trial balance');
ok(sig.entryCount === 2, 'the entry count is recorded');
ok(sig.perItem['I1'] === 12, 'canonical stock: 10 + 5 purchase − 3 sale = 12');
ok(sig.perItem['I2'] === 8, 'a positive adjustment adds to stock');
ok(sig.totalStockQty === 20, 'total stock is the sum of closings');
ok(sig.negativeStockItems.length === 0, 'no item went negative here');

// The signature must not depend on row order — a backup fetched in a different order is the
// same backup.
const shuffled = booksSignature({ entries: [...entries].reverse(), stockItems: [...stockItems].reverse(), stockMovements: [...stockMovements].reverse() });
ok(JSON.stringify(shuffled) === JSON.stringify(sig), 'the signature is independent of row order');

// An unbalanced ledger is caught.
const bad = booksSignature({ entries: [{ accountId: 'x', dr: 100, cr: 0 }], stockItems: [], stockMovements: [] });
ok(bad.balanced === false, 'a ledger where Dr ≠ Cr does NOT balance');

// Negative stock is a finding, and the reported quantity is clamped at zero.
const neg = booksSignature({ entries: [], stockItems: [{ id: 'I3', openingStock: 2 }], stockMovements: [{ itemId: 'I3', type: 'sale', qty: 9 }] });
ok(neg.negativeStockItems.join() === 'I3', 'an item sold below its stock is flagged (RULE 2 data integrity)');
ok(neg.perItem['I3'] === 0, 'and its reported quantity is clamped at zero, never negative');

// Paise: floating sums must compare equal when they are arithmetically equal.
const a = booksSignature({ entries: [{ accountId: 'a', dr: 0.1, cr: 0 }, { accountId: 'a', dr: 0.2, cr: 0 }], stockItems: [], stockMovements: [] });
ok(a.perAccount['a'] === 0.3, '0.1 + 0.2 rounds to 0.3, not 0.30000000000000004');

// ── 2. THE COMPARISON ────────────────────────────────────────────────────────

const clean = compareRehearsal(sig, booksSignature({ entries, stockItems, stockMovements }));
ok(clean.ok === true && clean.differences.length === 0, 'identical books reproduce exactly');
ok(clean.sourceBalanced === true, 'and the source is reported as balanced');

// A restored ledger that dropped one leg — the exact failure a rehearsal exists to catch.
const restoredMissingLeg = booksSignature({ entries: [entries[0]], stockItems, stockMovements });
const legGone = compareRehearsal(sig, restoredMissingLeg);
ok(legGone.ok === false, 'a restored ledger missing a leg fails the rehearsal');
ok(legGone.differences.some(d => d.kind === 'totalCr'), 'the credit total no longer matches');
ok(legGone.differences.some(d => d.kind === 'balance'), 'and the restored books no longer balance');
ok(legGone.accounts.includes('4101'), 'the account whose figure changed is named');

// A restored stock position that differs.
const restoredStock = booksSignature({ entries, stockItems, stockMovements: [{ itemId: 'I1', type: 'purchase', qty: 5 }] });
const stockDiff = compareRehearsal(sig, restoredStock);
ok(stockDiff.ok === false && stockDiff.items.includes('I1'), 'a stock quantity that differs is caught and the item named');

// An account present on one side only is a difference against zero.
const extraAccount = compareRehearsal(sig, booksSignature({ entries: [...entries, { accountId: '9999', dr: 1, cr: 1 }], stockItems, stockMovements }));
ok(extraAccount.ok === false, 'an account the restore invented is a difference');

// A source that itself does not balance is flagged independently.
const badSource = compareRehearsal(bad, bad);
ok(badSource.ok === true && badSource.sourceBalanced === false,
  'two identical unbalanced signatures "match" — but the source is flagged as not balancing');

ok(summarizeRehearsal(clean, false).includes('match the live books exactly'), 'a clean rehearsal says so');
ok(summarizeRehearsal(legGone, false).includes('did not match'), 'a failed rehearsal counts what did not match');
ok(summarizeRehearsal(badSource, false).includes('do not balance'), 'an unbalanced source is called out first');
ok(summarizeRehearsal(legGone, true).includes('विफल'), 'and it reads in Hindi (RULE 7)');

// ── 3. PURITY ────────────────────────────────────────────────────────────────

const rawSource = readFileSync(pathResolve(SRC, 'lib', 'backup', 'rehearsal.ts'), 'utf8');
// Strip comments first: the doc comment necessarily names the non-determinism it forbids
// (see the T-32/T-33 lesson — a check that cannot survive being described gets deleted).
const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(source.includes('booksSignature') && source.length > 1500, 'the purity scan sees real code, not a blanked file');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random', '.insert(', '.update(']) {
  ok(!source.includes(forbidden), `rehearsal.ts is pure (found "${forbidden}")`);
}
// The honest limit must be written down, not hidden.
ok(rawSource.includes('SHADOW SOCIETY') && rawSource.includes('DEFERRED'),
  'the file states plainly that the server orchestration is deferred, not done');

console.log(`\nBackup rehearsal: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
