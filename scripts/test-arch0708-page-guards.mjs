// ARCH-07 / ARCH-08 (product audit 2026-11-17).
//  ARCH-07: pages that write their own tables (TDS register, bank reconciliation, loan accruals, distribution runs)
//           checked only society.fyLocked — not the offline write-block, the role, an expired plan or a locked period.
//           They now call DataContext.guardPageWrite, the same refusals every DataContext save applies.
//  ARCH-08: the bulk importer said "N imported" before any save had answered. Members, opening balances and vouchers
//           now count from the cloud (lib/import/bulkTally) like the accounts import already did.
// Run: node scripts/test-arch0708-page-guards.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('./') && ctx.parentURL && ctx.parentURL.includes('/src/lib/')) { const u = new URL(spec + '.ts', ctx.parentURL); if (existsSync(u)) return { url: u.href, shortCircuit: true }; }
    return next(spec, ctx);
  }
`));
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; process.stderr.write(`  ✗ ${msg}\n`); } };

// ── 1. bulkTally ──
const { createBulkTally } = await import(pathToFileURL(resolve(SRC, 'lib/import/bulkTally.ts')).href);
{
  const got = [];
  const t = createBulkTally((x) => got.push(x));
  const a = t.item(), b = t.item(), c = t.item();
  a.ok(); t.close();
  ok(got.length === 0, 'no summary while saves are still out (the old "N imported" before any answer)');
  b.fail(); b.ok(); c.ok();
  ok(got.length === 1 && got[0].saved === 2 && got[0].failed === 1, 'summary once, after the last answer; a handle counts once (fail then ok = one failure)');
  c.fail();
  ok(got.length === 1, 'late repeats never fire a second summary');
  const e = []; const t2 = createBulkTally((x) => e.push(x)); t2.close();
  ok(e.length === 1 && e[0].saved === 0 && e[0].failed === 0, 'an empty batch finishes at close()');
  const s = []; const t3 = createBulkTally((x) => s.push(x)); t3.item().fail(); t3.item().fail();
  ok(s.length === 0, 'rows that all refused synchronously do not finish before the loop is over');
  t3.close();
  ok(s.length === 1 && s[0].failed === 2, '…and finish at close()');
}

// ── 2. guardPageWrite on the real DataProvider ──
const { mountDataProvider } = await import('./lib/provider-harness.mjs');
const qerr = console.error; console.error = () => {}; const qwarn = console.warn; console.warn = () => {};
{
  const h = await mountDataProvider();
  const c = () => h.ctx();
  ok(typeof c().guardPageWrite === 'function', 'DataContext exposes guardPageWrite');
  h.reset();
  ok(c().guardPageWrite('create', '2026-06-01') === false && h.destructive().length === 0, 'admin, open year, open period: allowed, no toast');
  await h.act(async () => { c().updateSociety({ periodLockDate: '2026-06-30' }); }); await h.settle();
  h.reset();
  ok(c().guardPageWrite('create', '2026-06-15') === true && h.destructive().length === 1, 'a date inside the locked period: refused with one destructive toast');
  h.reset();
  ok(c().guardPageWrite('delete', '2026-07-02') === false, 'a date after the lock: allowed');
  ok(c().guardPageWrite('update', '2026-07-02', '2026-06-10') === true, 'every supplied date is checked (edit cannot move into a locked period)');
  await h.act(async () => { c().updateSociety({ periodLockDate: undefined, fyLocked: true }); }); await h.settle();
  h.reset();
  ok(c().guardPageWrite('delete') === true && h.destructive().length === 1, 'FY audit-locked: refused, one toast');
}
{
  const h = await mountDataProvider({ user: { id: 'u3', name: 'Auditor', email: 'aud@harness.test', role: 'auditor', societyId: 'SOC-H' } });
  h.reset();
  ok(h.ctx().guardPageWrite('create', '2026-06-01') === true && h.destructive().length === 1, 'a role without "create" (auditor): refused — before, these pages let it write');
  h.reset();
  ok(h.ctx().guardPageWrite('delete') === true, 'auditor cannot delete either');
}
console.error = qerr; console.warn = qwarn;

// ── 3. the pages call it before writing (and no longer check fyLocked alone) ──
{
  const pages = {
    'src/pages/TdsRegister.tsx': ["guardPageWrite('update')", "guardPageWrite('create', entryForm.date)", "guardPageWrite('create', challanForm.challanDate)", "guardPageWrite('delete', entries.find(e => e.id === id)?.date)", "guardPageWrite('delete', challans.find(c => c.id === id)?.challanDate)"],
    'src/pages/BankReconciliation.tsx': ["guardPageWrite('create', asOfDate)", "guardPageWrite('delete', records.find(r => r.id === id)?.asOfDate)"],
    'src/pages/LoanInterest.tsx': ["guardPageWrite('create', toDate)"],
    'src/pages/ProfitDistribution.tsx': ["guardPageWrite('update')", "guardPageWrite('create', payDate)", "guardPageWrite('create', new Date().toISOString().split('T')[0])"],
  };
  for (const [f, calls] of Object.entries(pages)) {
    const src = read(f);
    for (const call of calls) ok(src.includes(`if (${call})`), `${f.split('/').pop()}: ${call}`);
    ok(!/if \(society\.fyLocked\)/.test(src), `${f.split('/').pop()}: no bare society.fyLocked check left`);
  }
  const li = read('src/pages/LoanInterest.tsx');
  ok(li.indexOf("guardPageWrite('create', toDate)") < li.indexOf('const saved = await saveAccruals(records);'), 'loan accrual: the guard runs BEFORE the per-loan rows are saved');
  const pd = read('src/pages/ProfitDistribution.tsx');
  ok(pd.indexOf("guardPageWrite('create', new Date()") < pd.indexOf('const saved = await saveRun(run);'), 'dividend: the guard runs BEFORE the run is saved (a refused voucher left an approved run with no voucher)');
  const dc = read('src/contexts/DataContext.tsx');
  ok(dc.includes("if (action === 'create' && guardSubscriptionExpired()) return true;"), 'an expired plan pauses NEW entries only (same as addVoucher)');
}

// ── 4. the importer counts from the cloud ──
{
  const u = read('src/pages/UniversalImporter.tsx');
  ok(u.includes("addMember(memberData, { quiet: true, onSaved: () => { plans.push(plan); h.ok(); }, onFailed: h.fail })") && u.includes('function finishMemberImport(imported: number, failed: number)'), 'members: counted on onSaved / onFailed; the summary is in finishMemberImport');
  ok(u.includes("{ onSaved: h.ok, onFailed: h.fail });\n      if (!v.id) { h.fail(); continue; }") && u.includes('function finishVoucherImport(imported: number, failed: number)'), 'vouchers: counted on the cloud answer');
  ok(u.includes("{ onSaved: h.ok, onFailed: h.fail });\n      if (!started) h.fail();") && u.includes('function finishObImport(saved: number, failed: number)'), 'opening balances: counted on the cloud answer');
  ok(!u.includes("'Saving to the cloud. If a cloud error comes, a separate warning will show."), 'the "saving… a warning may come later" success toast is gone');
  ok((u.match(/tally\.close\(\);/g) || []).length === 3, 'each of the three loops closes its tally');
}

console.log(`ARCH-07/08 page guards: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
