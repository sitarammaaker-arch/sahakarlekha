// Statutory appropriation of net surplus (T-20 / UCAS CM-1, FS-5; ADR-0006/0008; CL-1).
//
// Proves the appropriation is a POSTED, rule-driven, exact computation — not a spreadsheet:
//   • the mandatory order is walked (reserve → education → … → carry-forward);
//   • Reserve is ≥25% and Dividend is capped at 15% of share capital (statutory min/caps);
//   • the seven lines sum EXACTLY to the net surplus (integer paise, T-02);
//   • the posting is BALANCED (Σ Dr === Σ Cr) — verified by replaying it through projections;
//   • an over-appropriation, or a dividend over its cap, is REFUSED, never silently truncated.
//
// Run: node scripts/test-ucas-appropriation.mjs   (npm run test:ucas-appropriation)

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

let ap, money, ev, pj;
try {
  ap = await import(abs('../src/lib/rules/appropriation.ts'));
  money = await import(abs('../src/lib/money.ts'));
  ev = await import(abs('../src/lib/ledger/event.ts'));
  pj = await import(abs('../src/lib/ledger/projections.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the appropriation modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { computeAppropriation, appropriationToLines } = ap;
const { toMinor, applyPercent, sumMinor } = money;
const { buildEvent } = ev;
const { projectTrialBalance } = pj;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const AT = { asOf: '2026-06-01' };
const amt = (plan, step) => plan.lines.find((l) => l.step === step).amountMinor;

// Net surplus ₹100,000; share capital ₹200,000; proposed dividend ₹20,000, patronage ₹5,000.
const plan = computeAppropriation({
  netSurplusMinor: toMinor(100000),
  shareCapitalMinor: toMinor(200000),
  dividendMinor: toMinor(20000),
  patronageMinor: toMinor(5000),
}, AT);

// ── 1. STATUTORY RATES + MIN/CAPS ────────────────────────────────────────────
ok(amt(plan, 'reserve_fund') === applyPercent(toMinor(100000), 25).minor, 'Reserve Fund = 25% of net surplus (statutory min, UCAS-P4)');
ok(amt(plan, 'education_fund') === applyPercent(toMinor(100000), 5).minor, 'Education Fund = 5% of net surplus');
// Proposed dividend ₹20,000 > 15% of ₹200,000 (= ₹30,000)? No — cap is ₹30,000, so ₹20,000 stands.
ok(amt(plan, 'dividend') === toMinor(20000), 'a dividend within the cap is appropriated in full');
ok(plan.ok, 'a well-formed appropriation is ok');

// ── 2. MANDATORY ORDER (CM-1) ────────────────────────────────────────────────
const order = plan.lines.map((l) => l.step);
ok(order[0] === 'reserve_fund' && order[order.length - 1] === 'carry_forward', 'reserve first, carry-forward last');
ok(order.indexOf('dividend') < order.indexOf('patronage_bonus'), 'dividend before patronage bonus');

// ── 3. LINES SUM EXACTLY TO THE NET SURPLUS (T-02) ───────────────────────────
ok(sumMinor(plan.lines.map((l) => l.amountMinor)) === toMinor(100000),
  'the seven lines (incl. carry-forward) sum EXACTLY to the net surplus — nothing lost');
ok(plan.carryForwardMinor === toMinor(100000) - plan.totalAppropriatedMinor, 'carry-forward is the exact residual');

// ── 4. THE POSTING IS BALANCED (FS-5, CL-1) — verified via projection ────────
const legs = appropriationToLines(plan, {
  appropriation: 'P&L-APPROP', reserve_fund: 'RESERVE', education_fund: 'EDU', bye_law_reserves: 'BYELAW',
  dividend: 'DIV-PAYABLE', patronage_bonus: 'BONUS-PAYABLE', charitable: 'CHARITY',
});
const apprEvent = buildEvent(
  { eventType: 'appropriation.posted', tenantId: 'S', aggregateType: 'appropriation', aggregateId: 'FY26', sequence: 1, producer: { kind: 'human', id: 'u1' }, payload: { lines: legs } },
  { eventId: 'appr1', occurredAt: '2026-03-31T00:00:00Z' },
);
const tb = projectTrialBalance([apprEvent]);
ok(tb.balanced && tb.totalDrMinor === plan.totalAppropriatedMinor, 'the appropriation posts as a BALANCED voucher (Σ Dr === Σ Cr === total appropriated)');
ok(legs[0].accountId === 'P&L-APPROP' && legs[0].drCr === 'Dr', 'the P&L Appropriation A/c is debited for the total');
ok(legs.some((l) => l.accountId === 'RESERVE' && l.drCr === 'Cr'), 'the Reserve Fund is credited');

// ── 5. CAPS + OVER-APPROPRIATION are REFUSED ─────────────────────────────────
// Dividend ₹40,000 on ₹200,000 capital exceeds the 15% cap (₹30,000).
const capped = computeAppropriation({ netSurplusMinor: toMinor(100000), shareCapitalMinor: toMinor(200000), dividendMinor: toMinor(40000) }, AT);
ok(amt(capped, 'dividend') === toMinor(30000), 'a dividend over the cap is capped to 15% of share capital');
ok(!capped.ok && capped.problems.some((p) => p.includes('dividend')), 'and the over-cap proposal is REPORTED, not silently applied');

// Appropriations exceeding the surplus are refused.
const over = computeAppropriation({ netSurplusMinor: toMinor(10000), shareCapitalMinor: toMinor(1000000), dividendMinor: toMinor(80000), patronageMinor: toMinor(50000) }, AT);
ok(!over.ok && over.carryForwardMinor < 0 && over.problems.some((p) => p.includes('exceed the net surplus')),
  'appropriations exceeding the net surplus are refused (carry-forward would be negative)');

// ── 6. RECORDED RATES (auditability) ─────────────────────────────────────────
ok(plan.lines.find((l) => l.step === 'reserve_fund').ratePct === 25, 'the reserve line records the 25% rate that produced it');
ok(plan.lines.find((l) => l.step === 'dividend').basisMinor === toMinor(200000), 'the dividend line records its base (share capital)');

console.log(`\nUCAS appropriation posting: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
