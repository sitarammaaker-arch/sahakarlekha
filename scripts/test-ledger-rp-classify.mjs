// Receipts & Payments classifier (T-09) — imports the REAL accountNature/accountGlType via the '@/'
// loader and proves the Capital/Revenue + GL-head rules (NCDC Annexure VII) the R&P statement shares
// between its current compute and the future ledger projection. Run: node scripts/test-ledger-rp-classify.mjs
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

const { accountNature, accountGlType, CAPITAL_PARENTS, CAPITAL_SUBTYPES } = await import(abs('../src/lib/ledger/receiptsPaymentsClassify.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. Equity is capital.
ok(accountNature({ type: 'equity' }) === 'capital', 'equity account → capital');

// 2. A capital SUBTYPE is capital (whatever the type).
ok(accountNature({ type: 'asset', subtype: 'fixed_asset' }) === 'capital', 'fixed_asset subtype → capital');
ok(accountNature({ type: 'liability', subtype: 'long_term_loan' }) === 'capital', 'long_term_loan subtype → capital');
ok(accountNature({ type: 'liability', subtype: 'reserve' }) === 'capital', 'reserve subtype → capital');
ok(accountNature({ type: 'asset', subtype: 'investment' }) === 'capital', 'investment subtype → capital');

// 3. A capital PARENT is capital.
ok(accountNature({ type: 'asset', parentId: '3100' }) === 'capital', 'parent 3100 (fixed assets) → capital');
ok(accountNature({ type: 'liability', parentId: '1100' }) === 'capital', 'parent 1100 (share capital) → capital');

// 4. Ordinary income/expense/current accounts → revenue.
ok(accountNature({ type: 'income', parentId: '4100' }) === 'revenue', 'trading income → revenue');
ok(accountNature({ type: 'expense', subtype: 'operating_expense', parentId: '5100' }) === 'revenue', 'operating expense → revenue');
ok(accountNature({ type: 'asset', subtype: 'current_asset', parentId: '1300' }) === 'revenue', 'trade debtor (current) → revenue');

// 5. Unknown account → revenue (the safe default).
ok(accountNature(undefined) === 'revenue', 'undefined account → revenue');

// 6. GL type + defaults.
ok(accountGlType({ type: 'income' }) === 'income', 'glType returns the account type');
ok(accountGlType(undefined) === 'asset', 'glType defaults to asset when unknown');

// 7. The rule sets are what R&P expects.
ok(CAPITAL_PARENTS.has('1100') && CAPITAL_PARENTS.has('3200') && !CAPITAL_PARENTS.has('4100'), 'CAPITAL_PARENTS holds the capital heads, not trading');
ok(CAPITAL_SUBTYPES.has('share_capital') && CAPITAL_SUBTYPES.has('deposit') && !CAPITAL_SUBTYPES.has('current_asset'), 'CAPITAL_SUBTYPES holds the capital subtypes');

console.log(`\nR&P classifier (T-09): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
