// Ledger lines — typed contract + JSONB→typed promotion + double-entry constraint
// (T-05 / IRR-7, CA-10; Canonical CL-1/CL-3).
//
// The point: money-material voucher lines must be CONSTRAINED, not loose JSONB. These tests
// prove the promotion rejects malformed lines (never coerces), amounts become EXACT paise,
// and the balance check is float-safe — three legs that would drift as floats tie exactly.
//
// Run: node scripts/test-ledger-lines.mjs   (npm run test:ledger-lines)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

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
      export async function resolve(spec, ctx, next) {
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
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let mod;
try {
  mod = await import(abs('../src/lib/ledgerLines.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the ledgerLines module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { toTypedLines, checkBalanced } = mod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. PROMOTION — loose JSONB → constrained typed, EXACT paise ───────────────
const good = toTypedLines([
  { accountId: '1001', type: 'Dr', amount: 100.50, narration: 'cash' },
  { accountId: '4101', type: 'Cr', amount: 100.50 },
]);
ok(good.problems.length === 0, 'well-formed lines promote with no problems');
ok(good.lines[0].amountMinor === 10050 && good.lines[1].amountMinor === 10050, 'rupee amounts become exact integer paise');
ok(good.lines[0].drCr === 'Dr' && good.lines[1].drCr === 'Cr', 'the Dr/Cr side is carried explicitly (CL-3)');
ok(good.lines[0].narration === 'cash' && good.lines[1].narration === undefined, 'narration is preserved, optional');
ok(toTypedLines([{ accountId: '1', type: 'Dr', amount: 0.1 }]).lines[0].amountMinor === 10, 'a float rupee (0.1) promotes to exact paise (10), not 9.999…');

// ── 2. PROMOTION REJECTS malformed lines — never coerces ─────────────────────
const bad = toTypedLines([
  { type: 'Dr', amount: 10 },                    // missing accountId
  { accountId: '2', type: 'X', amount: 10 },      // bad side
  { accountId: '3', type: 'Dr', amount: -5 },     // negative
  { accountId: '4', type: 'Cr', amount: 'oops' }, // non-numeric
]);
ok(bad.lines.length === 0, 'not one malformed line is promoted');
ok(bad.problems.length === 4, 'every malformed line is reported (no silent coercion)');
ok(bad.problems[0].includes('accountId') && bad.problems[1].includes('Dr') && bad.problems[3].includes('amount'),
  'the problems name what is wrong, per line');

// ── 3. DOUBLE-ENTRY CONSTRAINT — float-safe balance (CL-1) ───────────────────
ok(checkBalanced(good.lines).ok, 'a balanced Dr=Cr set passes');

// Three legs that drift as floats (33.33+33.33+33.34) tie EXACTLY as paise.
const split = toTypedLines([
  { accountId: 'a', type: 'Dr', amount: 100 },
  { accountId: 'b', type: 'Cr', amount: 33.33 },
  { accountId: 'c', type: 'Cr', amount: 33.33 },
  { accountId: 'd', type: 'Cr', amount: 33.34 },
]).lines;
const sv = checkBalanced(split);
ok(sv.ok && sv.totalDrMinor === 10000 && sv.totalCrMinor === 10000, 'a three-way split balances exactly (floats would give 99.99…)');

const unbal = checkBalanced(toTypedLines([
  { accountId: 'a', type: 'Dr', amount: 100 },
  { accountId: 'b', type: 'Cr', amount: 90 },
]).lines);
ok(!unbal.ok && unbal.reasons.some(r => r.includes('unbalanced')), 'an unbalanced set is rejected, with Dr and Cr named');

ok(!checkBalanced([]).ok, 'an empty voucher (no lines) is rejected');
ok(checkBalanced([{ accountId: 'a', drCr: 'Dr', amountMinor: 0 }]).reasons.some(r => r.includes('positive')),
  'a zero/negative amount is rejected');
ok(checkBalanced([{ accountId: 'a', drCr: 'Dr', amountMinor: 1.5 }]).reasons.some(r => r.includes('exact minor')),
  'a non-integer minor amount is rejected — floats cannot sneak into the typed form');

console.log(`\nLedger lines (typed promotion + balance): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
