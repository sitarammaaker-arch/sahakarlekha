// Society appropriation adapter (T-20 wiring slice 1) — imports the REAL planSocietyAppropriation and
// proves it bridges the app context (rupees, state, close date, chart heads) onto the pure statutory
// engine: correct statutory core, exact paise, effective-dated/jurisdiction rates, cap enforcement,
// balanced legs, and refusal (never mis-post) when a step has no account. Run:
//   node scripts/test-society-appropriation.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

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
        if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
        return next(spec, ctx);
      }
    `),
);

const { planSocietyAppropriation, DEFAULT_APPROPRIATION_ACCOUNTS, appropriationVoucherContent, DEFAULT_APPROPRIATION_NARRATION } = await import(abs('../src/lib/rules/societyAppropriation.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const legOf = (r, acct, drCr) => r.legs.find((l) => l.accountId === acct && l.drCr === drCr);
const sum = (legs, drCr) => legs.filter((l) => l.drCr === drCr).reduce((s, l) => s + l.amountMinor, 0);

// ── 1. Statutory core — reserve 25% + education 5% of net surplus, balanced legs ──
{ const r = planSocietyAppropriation({ netSurplus: 100000, shareCapital: 500000, asOf: '2026-03-31' });
  ok(r.ok && r.problems.length === 0, 'clean surplus ⇒ ok, no problems');
  ok(legOf(r, '1201', 'Cr').amountMinor === 2500000, 'reserve 25% of ₹1,00,000 = ₹25,000 (2500000 paise)');
  ok(legOf(r, '1203', 'Cr').amountMinor === 500000, 'education 5% = ₹5,000');
  ok(legOf(r, '1208', 'Dr').amountMinor === 3000000, 'Net Surplus (1208) debited the total appropriated ₹30,000');
  ok(sum(r.legs, 'Dr') === sum(r.legs, 'Cr'), 'legs are balanced (ΣDr === ΣCr)');
  ok(r.plan.carryForwardMinor === 7000000, 'carry-forward = ₹70,000 (residual, not a leg)');
  ok(!r.legs.some((l) => l.drCr === 'Cr' && l.accountId === '1208'), 'carry-forward is NOT posted as a leg'); }

// ── 2. Exact paise — no float drift on a fractional surplus ───────────────────
{ const r = planSocietyAppropriation({ netSurplus: 33.33, shareCapital: 0, asOf: '2026-03-31' });
  // 25% of 3333 paise = 833.25 → applyPercent rounds; assert the reserve leg is exact integer paise.
  ok(Number.isInteger(legOf(r, '1201', 'Cr').amountMinor), 'reserve leg is exact integer paise (no float)');
  ok(sum(r.legs, 'Dr') === sum(r.legs, 'Cr'), 'fractional surplus still balances'); }

// ── 3a. Dividend AT the cap (15% of share capital) posts cleanly ──────────────
{ const r = planSocietyAppropriation({ netSurplus: 200000, shareCapital: 100000, asOf: '2026-03-31', discretionary: { dividend: 15000 } });
  ok(r.ok && legOf(r, '1211', 'Cr').amountMinor === 1500000, 'dividend ₹15,000 (= 15% cap) posts to 1211');
  ok(sum(r.legs, 'Dr') === sum(r.legs, 'Cr'), 'balanced with the dividend leg'); }

// ── 3b. Dividend OVER the cap ⇒ the whole plan is refused (never post a cap breach) ──
{ const r = planSocietyAppropriation({ netSurplus: 200000, shareCapital: 100000, asOf: '2026-03-31', discretionary: { dividend: 20000 } });
  ok(!r.ok && r.problems.some((p) => /dividend exceeds/.test(p)), 'a proposed dividend over the cap is flagged (ok:false)');
  ok(r.legs.length === 0, 'a refused appropriation carries NO legs (never posts a bad plan)');
  ok(r.plan.lines.find((l) => l.step === 'dividend').amountMinor === 1500000, 'the plan still shows the capped ₹15,000 for display'); }

// ── 4. Jurisdiction resolves in one place — HR normalizes; Haryana's text-verified figures apply ──
// (Act s.87(1)(a): reserve ≥10% AND bad & doubtful debt fund ≥10%; Rules r.73: education ≤2%.)
{ const a = planSocietyAppropriation({ netSurplus: 100000, shareCapital: 0, state: 'Haryana', asOf: '2026-03-31' });
  const b = planSocietyAppropriation({ netSurplus: 100000, shareCapital: 0, state: 'HR', asOf: '2026-03-31' });
  ok(a.jurisdiction === 'hr' && b.jurisdiction === 'hr', "'Haryana' and 'HR' both resolve to jurisdiction 'hr'");
  ok(!a.ok && a.legs.length === 0 && a.problems.some((p) => /bye_law_reserves has no chart account/.test(p)),
    'HR without a Bad Debt Fund head is REFUSED (the statutory 10% is never silently dropped)');
  const c = planSocietyAppropriation({ netSurplus: 100000, shareCapital: 0, state: 'HR', asOf: '2026-03-31', accounts: { bye_law_reserves: '1205' } });
  ok(c.ok && legOf(c, '1201', 'Cr').amountMinor === 1000000, 'HR reserve = 10% (s.87(1)(a))');
  ok(legOf(c, '1205', 'Cr').amountMinor === 1000000, 'HR bad & doubtful debt fund = 10% (s.87(1)(a))');
  ok(legOf(c, '1203', 'Cr').amountMinor === 200000, 'HR education fund = 2% (r.73)');
  ok(sum(c.legs, 'Dr') === sum(c.legs, 'Cr'), 'HR plan balanced');
  const p = planSocietyAppropriation({ netSurplus: 100000, shareCapital: 0, state: 'PB', asOf: '2026-03-31' });
  ok(p.ok && legOf(p, '1201', 'Cr').amountMinor === 2500000 && !legOf(p, '1205', 'Cr'), 'a state without verified figures keeps the national 25% and no bad-debt step'); }

// ── 5. Refusal — a non-zero step with no chart head is rejected, never mis-posted ──
{ const r = planSocietyAppropriation({ netSurplus: 100000, shareCapital: 0, asOf: '2026-03-31', discretionary: { charitable: 5000 } });
  ok(!r.ok && r.problems.some((p) => /charitable has no chart account/.test(p)), 'charitable with no head ⇒ refused with a clear problem');
  ok(r.legs.length === 0, 'refused ⇒ no legs'); }

// ── 6. Charitable posts when a head IS supplied (within the 10% ceiling) ──────
{ const r = planSocietyAppropriation({ netSurplus: 100000, shareCapital: 0, asOf: '2026-03-31', discretionary: { charitable: 5000 }, accounts: { charitable: '1209' } });
  ok(r.ok && legOf(r, '1209', 'Cr').amountMinor === 500000, 'charitable ₹5,000 (≤10% ceiling) posts to the supplied head 1209');
  ok(sum(r.legs, 'Dr') === sum(r.legs, 'Cr'), 'balanced with the discretionary leg'); }

// ── 7. Zero / negative surplus ⇒ nothing to appropriate, no legs, still ok ────
{ const r0 = planSocietyAppropriation({ netSurplus: 0, shareCapital: 0, asOf: '2026-03-31' });
  ok(r0.ok && r0.legs.length === 0, 'zero surplus ⇒ ok, no legs');
  const rn = planSocietyAppropriation({ netSurplus: -5000, shareCapital: 0, asOf: '2026-03-31' });
  ok(rn.ok && rn.legs.length === 0, 'negative surplus (a loss) ⇒ clamped to 0, no legs'); }

// ── 8. Default account map exposes the standard heads ─────────────────────────
{ ok(DEFAULT_APPROPRIATION_ACCOUNTS.appropriation === '1208' && DEFAULT_APPROPRIATION_ACCOUNTS.reserve_fund === '1201' && DEFAULT_APPROPRIATION_ACCOUNTS.education_fund === '1203',
    'default heads: Net Surplus 1208, Reserve 1201, Education 1203'); }

// ── appropriationVoucherContent (slice 2 — legs → a balanced journal voucher's content) ──────────
const rupeeSum = (lines, drCr) => lines.filter((l) => l.type === drCr).reduce((s, l) => s + l.amount, 0);

// ── 9. Content of a clean appropriation — Dr Net Surplus / Cr each fund, balanced in rupees ──
{ const appr = planSocietyAppropriation({ netSurplus: 100000, shareCapital: 0, asOf: '2026-03-31' });
  const c = appropriationVoucherContent(appr);
  ok(c && c.type === 'journal', 'content is a journal voucher');
  ok(c.debitAccountId === '1208', 'debit head = Net Surplus (1208)');
  ok(c.amount === 30000, 'voucher amount = total appropriated ₹30,000');
  ok(c.lines.length === 3 && rupeeSum(c.lines, 'Dr') === rupeeSum(c.lines, 'Cr'), '3 lines, balanced in rupees (ΣDr === ΣCr)');
  ok(c.lines.find((l) => l.accountId === '1201' && l.type === 'Cr').amount === 25000, 'reserve line Cr ₹25,000');
  ok(c.lines.find((l) => l.accountId === '1208' && l.type === 'Dr').amount === 30000, 'Net Surplus line Dr ₹30,000');
  ok(['1201', '1203'].includes(c.creditAccountId), 'legacy creditAccountId is the first fund credited');
  ok(c.narration === DEFAULT_APPROPRIATION_NARRATION, 'default narration (Hindi-first) applied'); }

// ── 10. Custom narration passes through ───────────────────────────────────────
{ const appr = planSocietyAppropriation({ netSurplus: 50000, shareCapital: 0, asOf: '2026-03-31' });
  const c = appropriationVoucherContent(appr, 'FY 2025-26 विनियोजन');
  ok(c.narration === 'FY 2025-26 विनियोजन', 'custom narration used when supplied'); }

// ── 11. A refused / empty appropriation ⇒ null (post nothing, never an empty voucher) ──
{ const refused = planSocietyAppropriation({ netSurplus: 200000, shareCapital: 100000, asOf: '2026-03-31', discretionary: { dividend: 20000 } });
  ok(appropriationVoucherContent(refused) === null, 'a refused appropriation (cap breach) ⇒ null content');
  const zero = planSocietyAppropriation({ netSurplus: 0, shareCapital: 0, asOf: '2026-03-31' });
  ok(appropriationVoucherContent(zero) === null, 'a zero-surplus appropriation ⇒ null content'); }

// ── 12. Patronage is owed to MEMBERS — never 2103 (Salary Payable in every shipped chart) ──
{ ok(DEFAULT_APPROPRIATION_ACCOUNTS.patronage_bonus === '', 'no default patronage head (was 2103 Salary Payable)');
  const noHead = planSocietyAppropriation({ netSurplus: 100000, shareCapital: 0, asOf: '2026-03-31', discretionary: { patronage: 5000 } });
  ok(!noHead.ok && noHead.legs.length === 0 && noHead.problems.some((p) => /patronage_bonus has no chart account/.test(p)), 'patronage without a member-rebate head ⇒ refused, never mis-posted');
  const withHead = planSocietyAppropriation({ netSurplus: 100000, shareCapital: 0, asOf: '2026-03-31', discretionary: { patronage: 5000 }, accounts: { patronage_bonus: 'REBATE' } });
  ok(withHead.ok && legOf(withHead, 'REBATE', 'Cr').amountMinor === 500000 && !legOf(withHead, '2103', 'Cr'), 'patronage posts to the member rebate-payable head');
  const strip = (f) => readFileSync(pathResolve(HERE, '..', f), 'utf8');
  for (const f of ['src/contexts/DataContext.tsx', 'src/components/StatutoryAppropriationPanel.tsx']) {
    ok(/patronage_bonus: resolveRebatePayableAccountId\(accounts\)/.test(strip(f)), `${f}: passes the member rebate-payable head`);
  } }

console.log(`\nSociety appropriation adapter (T-20 wiring slice 1+2): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
