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

const { moneyColumns, settlementTypedColumns, moneyFromTyped, hydrateSettlement, hydrateJForm } = await import(abs('../src/lib/typedMoney.ts'));

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

// ── dual-read: prefer typed columns, fall back to JSONB (moneyFromTyped / hydrateSettlement) ──
ok(eq(moneyFromTyped(123456, 'INR', null), { amount: 1234.56, currency: 'INR' }), 'typed 123456 paise → ₹1234.56');
ok(eq(moneyFromTyped(null, null, { amount: 900, currency: 'INR' }), { amount: 900, currency: 'INR' }), 'no typed value → falls back to the JSONB object');
ok(eq(moneyFromTyped(undefined, undefined, { amount: 50, currency: 'INR' }), { amount: 50, currency: 'INR' }), 'undefined typed → JSONB fallback');
ok(eq(moneyFromTyped(0, 'INR', { amount: 999, currency: 'INR' }), { amount: 0, currency: 'INR' }), 'typed 0 is honoured (not treated as absent)');

// hydrateSettlement PREFERS the typed columns over the stale JSONB.
const hydrated = hydrateSettlement({
  id: 's1', status: 'draft',
  grossAmountMinor: 100000, grossCurrency: 'INR', gross: { amount: 999, currency: 'INR' },
  netPayableAmountMinor: 90000, netPayableCurrency: 'INR', netPayable: { amount: 111, currency: 'INR' },
  amountPaidAmountMinor: 10000, amountPaidCurrency: 'INR', amountPaid: { amount: 222, currency: 'INR' },
});
ok(hydrated.gross.amount === 1000 && hydrated.netPayable.amount === 900 && hydrated.amountPaid.amount === 100, 'hydrateSettlement reads the TYPED columns (₹1000/900/100), not the stale JSONB');
ok(hydrated.id === 's1' && hydrated.status === 'draft', 'other fields pass through untouched');
// A pre-backfill row (no typed columns) still reads from the JSONB.
const legacy = hydrateSettlement({ id: 's2', gross: { amount: 777, currency: 'INR' }, netPayable: { amount: 700, currency: 'INR' }, amountPaid: { amount: 0, currency: 'INR' } });
ok(legacy.gross.amount === 777 && legacy.amountPaid.amount === 0, 'legacy row (no typed cols) falls back to JSONB');

// ── hydrateJForm (T-05 J-Form slice): typed columns preferred, JSONB fallback ──
const jf = hydrateJForm({
  id: 'j1', documentNo: 'J0001',
  grossAmountMinor: 250000, grossCurrency: 'INR', gross: { amount: 999, currency: 'INR' },
  deductionsAmountMinor: 5000, deductionsCurrency: 'INR', deductions: { amount: 111, currency: 'INR' },
  netAmountMinor: 245000, netCurrency: 'INR', net: { amount: 222, currency: 'INR' },
});
ok(jf.gross.amount === 2500 && jf.deductions.amount === 50 && jf.net.amount === 2450, 'hydrateJForm reads the TYPED columns (₹2500/50/2450), not the stale JSONB');
ok(jf.id === 'j1' && jf.documentNo === 'J0001', 'jform passthrough fields untouched');
// A pre-042 row (no typed columns) still reads from the JSONB.
const legacyJf = hydrateJForm({ id: 'j2', gross: { amount: 1200, currency: 'INR' }, deductions: { amount: 200, currency: 'INR' }, net: { amount: 1000, currency: 'INR' } });
ok(legacyJf.gross.amount === 1200 && legacyJf.net.amount === 1000, 'legacy jform (no typed cols) falls back to JSONB');
// Typed 0 deduction is honoured (not treated as absent).
ok(hydrateJForm({ deductionsAmountMinor: 0, deductionsCurrency: 'INR', deductions: { amount: 55, currency: 'INR' } }).deductions.amount === 0, 'typed 0 deductions honoured over JSONB 55');

console.log(`\nTyped money columns: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
