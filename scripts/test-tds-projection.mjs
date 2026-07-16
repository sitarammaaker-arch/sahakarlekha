// TDS u/s 192 projection (ECR-14). Imports the REAL src/lib/tdsProjection.ts via
// the '@/' loader (was a self-contained mirror before).
//
// The first 11 assertions are the ORIGINAL figures, kept byte-identical on purpose:
// moving the slabs out to rules/incomeTax.ts must not shift a single number, and these
// are the proof. The rest assert the thing that was missing — that a projection now
// knows which year's law it used, and says so when that law does not fit the date.
// Run: node scripts/test-tds-projection.mjs
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

const { annualIncomeTax, monthlyTds, suggestMonthlyTds } = await import(abs('../src/lib/tdsProjection.ts'));

const r0 = (n) => Math.round(n); // fixture rounding for expected values

// These assertions are FY 2024-25 arithmetic, so they must ASK for FY 2024-25. They
// used to pass no date and rely on the implicit default — the same latent bug the
// production code had. Adding a newer slab set is exactly what exposes it.
const FY24 = '2024-06-01';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// 1. New regime — 87A rebate: taxable ≤ 7L → nil tax.
ok(annualIncomeTax(700000, 'new', 0, FY24) === 0, 'new: gross 7L → taxable 6.25L ≤ 7L → nil (87A)');
ok(annualIncomeTax(775000, 'new', 0, FY24) === 0, 'new: gross 7.75L → taxable 7L → nil (at rebate limit)');

// 2. New regime — above rebate: gross 10L → taxable 9.25L.
// 3–7L @5% = 20000; 7–9.25L @10% = 22500; tax 42500; +4% cess = 44200.
ok(annualIncomeTax(1000000, 'new', 0, FY24) === r0(42500 * 1.04), 'new: 10L gross → ₹44,200 (incl cess)');

// 3. Old regime — 87A: taxable ≤ 5L → nil.
ok(annualIncomeTax(550000, 'old', 0, FY24) === 0, 'old: gross 5.5L → taxable 5L → nil (87A)');
// Old: gross 10L → taxable 9.5L. 2.5–5L @5% = 12500; 5–9.5L @20% = 90000; tax 102500; +cess = 106600.
ok(annualIncomeTax(1000000, 'old', 0, FY24) === r0(102500 * 1.04), 'old: 10L gross → ₹1,06,600');
// Old with 80C deductions 1.5L: gross 10L → taxable 8L. 12500 + 60000 = 72500; +cess = 75400.
ok(annualIncomeTax(1000000, 'old', 150000, FY24) === r0(72500 * 1.04), 'old: deductions reduce taxable');

// 4. Monthly TDS spreads annual tax.
ok(monthlyTds(44200, 12) === r0(44200 / 12), 'monthly = annual / 12');
ok(monthlyTds(0) === 0, 'no tax → no TDS');

// 5. suggestMonthlyTds end-to-end from a monthly gross.
ok(suggestMonthlyTds(50000, 'new', 0, 12, FY24) === monthlyTds(annualIncomeTax(600000, 'new', 0, FY24), 12), 'suggest projects 12× then taxes');
ok(suggestMonthlyTds(30000, 'new', 0, 12, FY24) === 0, 'monthly 30k (annual 3.6L) → nil TDS');

// 6. Standard deduction 75k (new): gross 8.75L → taxable 8L > 7L rebate → taxed.
// 3–7L @5% = 20000; 7–8L @10% = 10000; tax 30000; +cess = 31200.
ok(annualIncomeTax(875000, 'new', 0, FY24) === r0(30000 * 1.04), 'new: 8.75L gross → ₹31,200 (taxable 8L, no rebate)');

/* ── Slab provenance (rules/incomeTax.ts) ──────────────────────────────────────
   The defect was: this file applied FY 2024-25 law with no date parameter, so in
   FY 2026-27 it silently computed on the wrong year. Two fixes, in order:
     1. the slabs became dated data, so the wrongness became REPORTABLE (amber warning);
     2. the CA confirmed FY 2026-27, so the right law is now present and the warning is
        gone — asserted below, along with the fact that an unknown year STILL warns.
   The mechanism has to survive being satisfied, or it was only ever theatre. */
const { resolveTaxBasis, describeBasis, SLAB_SETS } = await import(abs('../src/lib/rules/incomeTax.ts'));
const { annualIncomeTaxWithBasis, tdsBasisNote } = await import(abs('../src/lib/tdsProjection.ts'));

ok(SLAB_SETS[0].fy === 'FY 2026-27', 'catalog: newest set first — the stale fallback picks the closest law');
ok(SLAB_SETS.some((s) => s.fy === 'FY 2024-25'), 'catalog: older years are KEPT — a 2024 report must reproduce 2024 law');
ok(SLAB_SETS.some((s) => s.fy === 'FY 2026-27' && s.verified), 'catalog: FY 2026-27 is present AND verified (CA-confirmed 2026-07-16)');
ok(SLAB_SETS.filter((s) => !s.verified).length === 2, 'catalog: the two historical sets stay UNVERIFIED — only the CA-confirmed year is settled');

const inYear = resolveTaxBasis('2024-06-01');
ok(!inYear.stale && inYear.set.fy === 'FY 2024-25', 'basis: a date inside FY 2024-25 is not stale');

// THE BUG, now visible: today is FY 2026-27 and no slab set covers it.
const now = resolveTaxBasis('2026-07-16');
ok(now.stale === false && now.set.fy === 'FY 2026-27', 'basis: today resolves to FY 2026-27 — no longer stale');
ok(!describeBasis(now).includes('⚠️'), 'basis: the amber warning is GONE — the law now covers the date');
ok(describeBasis(now) === 'FY 2026-27 के slab से।', 'basis: verified ⇒ a plain statement, no hedge');
// A date with no law at all still degrades loudly — the mechanism is intact.
const far = resolveTaxBasis('2030-07-16');
ok(far.stale === true && describeBasis(far).includes('⚠️'), 'basis: a year we have no law for still warns');
ok(describeBasis(inYear).includes('सत्यापित नहीं'), 'basis: even in-year says it is unverified');

// The figure still computes (payroll must not stop) — but it carries its provenance.
const w = annualIncomeTaxWithBasis(1000000, 'new', 0, '2026-07-16');
ok(typeof w.tax === 'number', 'today: computes');
ok(w.basis.set.fy === 'FY 2026-27' && !w.basis.stale, 'today: uses the CURRENT law, verified');

/* WHAT THE DEFECT ACTUALLY COST — the reason this is not an academic tidy-up.
   The same ₹10L salary, under the two laws:
     FY 2024-25  taxable 9.25L, 87A rebate limit 7L  → taxed  → ₹44,200/yr deducted
     FY 2025-26  taxable 9.25L, 87A rebate limit 12L → NIL    → ₹0
   The rebate limit moved 7L → 12L. Every society still on the old slabs has been
   withholding ~₹44,200 a year from an employee who owed nothing. That is not a rounding
   difference; it is a person's money. */
ok(annualIncomeTax(1000000, 'new', 0, FY24) === 44200, 'impact: FY 2024-25 taxes a ₹10L salary ₹44,200');
ok(annualIncomeTax(1000000, 'new', 0, '2025-06-01') === 0, 'impact: FY 2025-26 taxes the SAME salary ₹0 (87A limit 7L→12L)');
// THE FIX, end to end: what a clerk processing salary TODAY actually gets.
ok(annualIncomeTax(1000000, 'new') === 0, 'impact: TODAY a ₹10L salary is taxed ₹0 — was ₹44,200 this morning');
ok(!tdsBasisNote('2026-07-16').includes('⚠️'), 'ui: the salary screen no longer warns');

console.log(`
TDS projection (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
