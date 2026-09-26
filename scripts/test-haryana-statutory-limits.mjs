// H1 — Haryana's statutory appropriation / dividend limits on the Reserve Fund and Profit
// Distribution pages, from the ONE UCAS catalog (RULE 2). Only text-verified figures are law:
//   Act s.87(1)(a): reserve ≥10% and bad & doubtful debt fund ≥10%;  Rules r.73: education ≤2%;
//   Rules r.72(1): dividend ≤10% p.a. of paid-up share capital;      r.74(1): Registrar may raise reserve to 25%.
// Other states: no enforcement, unchanged behaviour.
// Run: node scripts/test-haryana-statutory-limits.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SRC = pathResolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
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
`));
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const L = await imp('src/lib/rules/statutoryLimits.ts');
const { appropriationWaterfall } = await imp('src/lib/appropriation.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const AS = '2026-09-26';

// ── 1. Resolution ──
for (const st of ['HR', 'Haryana', 'हरियाणा']) {
  const l = L.statutoryLimits(st, AS);
  ok(l.jurisdiction === 'hr' && l.reserveMin.pct === 10 && l.badDebtMin.pct === 10 && l.educationMax.pct === 2 && l.dividendCap.pct === 10, `${st}: 10 / 10 / 2 / 10`);
  ok(l.reserveMin.verified && l.badDebtMin.verified && l.educationMax.verified && l.dividendCap.verified && L.hasVerifiedLimits(l), `${st}: all four verified`);
}
const hr = L.statutoryLimits('HR', AS);
ok(/s\.87\(1\)\(a\)/.test(hr.reserveMin.cite) && /r\.74\(1\)/.test(hr.reserveMin.cite), 'reserve cite: s.87(1)(a) + r.74(1)');
ok(/r\.72\(1\)/.test(hr.dividendCap.cite) && /r\.73/.test(hr.educationMax.cite), 'dividend cite r.72(1), education cite r.73');
for (const st of ['PB', 'Maharashtra', '', null, undefined]) {
  const l = L.statutoryLimits(st, AS);
  ok(!L.hasVerifiedLimits(l) && l.reserveMin.pct === 25 && l.badDebtMin.pct === 0 && l.dividendCap.pct === 15, `${String(st)}: national guidance only, nothing verified`);
}

// ── 2. Appropriation issues (only verified figures produce issues) ──
const iss = (l, r, e, b) => L.appropriationIssues(l, { '1201': r, '1203': e, '1205': b });
ok(iss(hr, 25, 1, 10).length === 0, 'HR: reserve 25 / edu 1 / bad debt 10 → clean');
ok(iss(hr, 10, 2, 10).length === 0, 'HR: exactly at the limits → clean');
ok(iss(hr, 9.99, 1, 10).map((i) => i.accountId).join() === '1201', 'HR: reserve 9.99% → reserve issue');
ok(iss(hr, 25, 1, 0).map((i) => i.accountId).join() === '1205', 'HR: bad debt 0% → bad-debt issue');
ok(iss(hr, 25, 2.5, 10).map((i) => i.accountId).join() === '1203', 'HR: education 2.5% → education issue');
ok(iss(hr, 5, 5, 0).length === 3 && iss(hr, 5, 5, 0).every((i) => i.hi && i.en && i.cite), 'all three at once, each Hindi + English + cite');
ok(iss(L.statutoryLimits('PB', AS), 0, 50, 0).length === 0, 'PB: nothing enforced (unverified guidance)');

// ── 3. Dividend cap ──
ok(L.dividendRateIssue(hr, 10) === null && L.dividendRateIssue(hr, 9.5) === null, 'HR: 10% and below allowed');
const d = L.dividendRateIssue(hr, 10.5);
ok(d && /10%/.test(d.hi) && /r\.72\(1\)/.test(d.cite), 'HR: 10.5% refused with r.72(1)');
ok(L.dividendRateIssue(L.statutoryLimits('PB', AS), 40) === null, 'PB: unverified 15% default is NOT enforced');

// ── 4. Legacy waterfall: statutory minimum is a parameter; default value-identical ──
ok(appropriationWaterfall(100000, { reservePct: 20 }).reserveBelowStatutory === true, 'default min stays 25 (20 < 25)');
ok(appropriationWaterfall(100000, { reservePct: 20, statutoryMinPct: 10 }).reserveBelowStatutory === false, 'HR min 10 → 20% is fine');
const w = appropriationWaterfall(100000, { reservePct: 25, statutoryMinPct: 10, otherFunds: [{ accountId: '1205', label: 'Bad', pct: 10 }] });
ok(w.steps.map((s) => s.accountId).join() === '1201,1203,1205' && w.steps[2].amount === 10000, 'HR suggestion includes Bad Debt Fund 10%');

// ── 5. Pages wired to the ONE resolver ──
const strip = (f) => readFileSync(pathResolve(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const rf = strip('src/pages/ReserveFund.tsx');
ok(/statutoryLimits\(society\.state,/.test(rf) && /appropriationIssues\(limits,/.test(rf), 'ReserveFund resolves limits from society.state + checks issues');
ok(/statutoryMinPct: limits\.reserveMin\.pct/.test(rf), 'ReserveFund waterfall uses the jurisdiction minimum');
ok(!/न्यूनतम 25% होना चाहिए/.test(rf) && !/minimum 25% required/.test(rf), 'no hard-coded "minimum 25%" left');
ok(/!hasBadDebtFund/.test(rf), 'missing Bad Debt Fund account is called out');
const pd = strip('src/pages/ProfitDistribution.tsx');
ok(/dividendRateIssue\(limits, dividendRatePct\)/.test(pd), 'ProfitDistribution checks the dividend cap');
const post = pd.slice(pd.indexOf('const handlePost'), pd.indexOf('const handlePost') + 2500);
ok(/if \(dividendCapIssue\)[\s\S]*?return;/.test(post) && post.indexOf('dividendCapIssue') < post.indexOf('saveRun('), 'post refuses an over-cap dividend BEFORE anything is saved');
ok(/\|\| !!dividendCapIssue\}/.test(pd), 'post button disabled while over the cap');
for (const f of ['src/contexts/DataContext.tsx', 'src/components/StatutoryAppropriationPanel.tsx']) {
  ok(/bye_law_reserves: '1205'/.test(strip(f)), `${f}: T-20 bad-debt step posts to 1205 when the account exists`);
}

console.log(`haryana statutory limits: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
