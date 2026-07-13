// Typed money columns (T-05 slice 1) — the JSONB {amount,currency} → typed
// <field>AmountMinor + <field>Currency mapping the settlement dual-write uses.
// Imports the REAL src/lib/typedMoney.ts (which imports @/lib/money) via the '@/' loader.
//
// Run: node scripts/test-typed-money.mjs   (npm run test:typed-money)

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

const { moneyColumns, settlementTypedColumns } = await import(abs('../src/lib/typedMoney.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── moneyColumns: rupees → exact paise + currency ────────────────────────────
ok(eq(moneyColumns('gross', { amount: 1234.56, currency: 'INR' }), { grossAmountMinor: 123456, grossCurrency: 'INR' }), 'gross ₹1234.56 → grossAmountMinor 123456, grossCurrency INR');
ok(eq(moneyColumns('gross', { amount: 33.33 }), { grossAmountMinor: 3333, grossCurrency: 'INR' }), 'missing currency defaults to INR; ₹33.33 → 3333 paise');
ok(eq(moneyColumns('amountPaid', null), { amountPaidAmountMinor: 0, amountPaidCurrency: 'INR' }), 'null money → 0 paise, INR');
ok(eq(moneyColumns('gross', { amount: 'nope' }), { grossAmountMinor: 0, grossCurrency: 'INR' }), 'non-numeric amount → 0');

// ── settlementTypedColumns: all three money objects at once ───────────────────
const cols = settlementTypedColumns({
  gross: { amount: 1000, currency: 'INR' },
  netPayable: { amount: 900.5, currency: 'INR' },
  amountPaid: { amount: 100, currency: 'INR' },
});
ok(cols.grossAmountMinor === 100000, 'gross ₹1000 → 100000 paise');
ok(cols.netPayableAmountMinor === 90050, 'netPayable ₹900.50 → 90050 paise');
ok(cols.amountPaidAmountMinor === 10000, 'amountPaid ₹100 → 10000 paise');
ok(cols.grossCurrency === 'INR' && cols.netPayableCurrency === 'INR' && cols.amountPaidCurrency === 'INR', 'all currencies present');
ok(Object.keys(cols).length === 6, 'exactly 6 typed columns (3 money objects × amount+currency)');
// A draft settlement with only gross set → the others degrade to 0/INR (never throw).
ok(settlementTypedColumns({ gross: { amount: 500, currency: 'INR' } }).netPayableAmountMinor === 0, 'unset netPayable → 0 paise');

console.log(`\nTyped money columns: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
