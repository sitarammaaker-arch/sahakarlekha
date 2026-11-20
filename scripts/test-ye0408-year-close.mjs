// YE-04..YE-08 (product audit 2026-11-17) — year-end behaviour after a rollover.
//   YE-04  the closing-stock journal was found by "narration contains the CURRENT FY label" → after rollover the closed
//          year's Trading / P&L / BS lost their own journal. Now: the journal dated inside the year being reported.
//   YE-05  the year close ran from a branch view and sent the branch's stock (0) → refused unless "All branches".
//   YE-06  an income / expense account turned into a group after postings kept its balance through every close →
//          close_financial_year refuses, naming it (migration 187).
//   YE-07  the appropriation pages used the current label and today's P&L → they use the year being appropriated (the
//          oldest still-closing year) read as on its end; appropriation vouchers carry refType/refId so editing the
//          narration no longer hides them from the duplicate check.
//   YE-08  the FY dropdown "Save" re-labelled the year with no snapshot / server year → only for a society without entries.
// Run: node scripts/test-ye0408-year-close.mjs
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
  import { resolve as pathResolve } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
  export async function resolve(spec, ctx, next) {
    if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
    if (spec.startsWith('@/')) { const base = pathResolve(SRC, spec.slice(2)); for (const c of [base + '.ts', base + '.tsx', base + '/index.ts', base]) if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const c of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) { const u = new URL(c, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
    return next(url, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── YE-04: run the Trading module on a rolled-over society ──
{
  const R = await imp('src/lib/reports/tradingAndProfitLoss.ts');
  const jv = (id, date, narration, refType) => ({ id, voucherNo: id, date, type: 'journal', narration, amount: 300, isDeleted: false, refType,
    lines: [{ id: id + 'a', accountId: '3403', type: 'Dr', amount: 300 }, { id: id + 'b', accountId: '5150', type: 'Cr', amount: 300 }] });
  const vouchers = [jv('CS1', '2027-03-31', 'Closing stock FY 2026-27')];
  const run = (fy, effDate, fyStart) => R.computeTradingAccount({ tb: [], fy, effDate, vouchers, stockItems: [], movements: [], openingsInScope: true, fyStart }).closingStockPosted;
  ok(run('2027-28', '2027-03-31', '2026-04-01') === true, 'after rollover (label 2027-28) the closed year 2026-27 still finds its own closing-stock journal');
  ok(run('2027-28', '2027-06-30', '2027-04-01') === false, 'the new year 2027-28 does not borrow last year\'s journal');
  ok(run('2026-27', '2027-03-31', '2026-04-01') === true, 'before rollover it is found as before');
  ok(run('2026-27', '2027-03-31', undefined) === true && run('2027-28', '2027-03-31', undefined) === false, 'callers without fyStart keep the old narration rule');
  const yc = [jv('YC1', '2027-03-31', 'समापन माल 2026-27 (वर्ष समापन)', 'fy.close.stock')];
  ok(R.computeTradingAccount({ tb: [], fy: '2027-28', effDate: '2027-03-31', vouchers: yc, stockItems: [], movements: [], openingsInScope: true, fyStart: '2026-04-01' }).closingStockPosted === true, 'the server year-close stock journal is found the same way');
  ok(read('src/contexts/DataContext.tsx').includes('fyStart: fyStartOf(effDate),'), 'DataContext passes the reported year\'s start');
}

// ── YE-07 ──
{
  const D = await imp('src/lib/distribution/dividendRuns.ts');
  const ap = (narration, refType, refId) => ({ id: 'A', date: '2027-09-30', narration, amount: 1000, isDeleted: false, refType, refId,
    lines: [{ id: '1', accountId: '1208', type: 'Dr', amount: 1000 }, { id: '2', accountId: '1201', type: 'Cr', amount: 1000 }] });
  ok(D.postedAppropriation([ap('Reserve Fund Appropriation — FY 2026-27')], '1208', '1201', '2026-27'), 'an old (narration-only) appropriation is still recognised');
  ok(D.postedAppropriation([ap('edited text', D.APPROPRIATION_REF, '2026-27')], '1208', '1201', '2026-27'), 'a tagged one is recognised even after its narration was edited');
  ok(!D.postedAppropriation([ap('edited text', D.APPROPRIATION_REF, '2026-27')], '1208', '1201', '2027-28'), '…and only for its own year');
  ok(D.appropriatedToFunds([ap('x', D.APPROPRIATION_REF, '2026-27')], ['1201'], '2026-27') === 1000, 'the funds total counts tagged vouchers');
  const hook = read('src/hooks/useAppropriationYear.ts');
  ok(hook.includes(".eq('status', 'closing').order('start_date').limit(1)") && hook.includes('closingFy && closingFy !== society.financialYear ? closingFy : society.financialYear'), 'the year to appropriate = the oldest still-closing year, else the current one');
  for (const p of ['src/pages/ReserveFund.tsx', 'src/pages/ProfitDistribution.tsx', 'src/pages/SurplusAppropriation.tsx']) {
    const s = read(p);
    ok(s.includes('useAppropriationYear()') && !/const fy = society\.financialYear/.test(s), `${p}: uses the year being appropriated`);
    ok(/getProfitLoss\((fyEnd|fyEndDate\(fy\))\)/.test(s) && !/getProfitLoss\(\)/.test(s), `${p}: reads that year's surplus as on its own end date`);
  }
  ok(read('src/pages/ReserveFund.tsx').includes('refType: APPROPRIATION_REF, refId: fy,') && read('src/pages/ProfitDistribution.tsx').includes('refType: APPROPRIATION_REF, refId: fy,'), 'fund and dividend appropriations carry the tag');
}

// ── YE-05 / YE-08 ──
{
  const yc = read('src/components/fy/YearCloseCard.tsx');
  ok(yc.includes("const branchView = !!activeBranchId && activeBranchId !== 'all';") && yc.indexOf('if (branchView) {') < yc.indexOf("supabase.rpc('close_financial_year'"), 'the year close refuses from a branch view, before calling the server');
  const ss = read('src/pages/SocietySetup.tsx');
  const h = ss.slice(ss.indexOf('const handleSaveFY = () => {'), ss.indexOf('updateSociety({ financialYear: fyForm.financialYear, financialYearStart }'));
  ok(h.includes('if (fyForm.financialYear !== society.financialYear && vouchers.some(v => !v.isDeleted)) {') && h.includes('return;'), 'the FY dropdown no longer re-labels a year that has entries');
}

// ── YE-06: migration 187 ──
{
  const m = read('supabase/migrations/187_close_fy_group_balance.sql');
  const d = read('supabase/migrations/187_close_fy_group_balance_down.sql');
  const base = read('supabase/migrations/177_close_fy_nested_stock.sql');
  const fn = (s) => s.slice(s.indexOf('create or replace function public.close_financial_year('), s.indexOf('$fn$;', s.indexOf('create or replace function public.close_financial_year(')));
  ok(fn(m).includes(`where a.type in ('income', 'expense') and coalesce(a."isGroup", false) and b.net <> 0;`) && fn(m).includes("raise exception 'close_fy:group_has_balance"), 'the close refuses while a group income / expense account holds a balance, naming it');
  ok(fn(m).indexOf('close_fy:group_has_balance') < fn(m).indexOf('2. Year-transfer'), '…before anything is posted');
  const strip = fn(m).replace('  v_groups text;\n', '').replace(/  -- 187 \/ YE-06[\s\S]*?  end if;\n\n/, '');
  ok(strip === fn(base), '187 = 177\'s close + only the YE-06 lines');
  ok(fn(d) === fn(base) && /values \('187', 'close_fy_group_balance'\)/.test(m) && /^begin;/m.test(m) && /^commit;/m.test(m), 'down restores 177; 187 registers itself in one transaction');
  ok(/revoke execute on function public\.close_financial_year\(text, text, bigint\) from public, anon;\ngrant  execute on function public\.close_financial_year\(text, text, bigint\) to authenticated;/.test(m), 'grants unchanged');
  const F = await imp('src/lib/fyClose.ts');
  ok(F.closeFyMessage("close_fy:group_has_balance — ये group खाते अब भी राशि रखते हैं: 5301 X । ...").startsWith('ये group खाते'), 'the refusal reaches the user in plain Hindi');
}

console.log(`YE-04..08 year close: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
