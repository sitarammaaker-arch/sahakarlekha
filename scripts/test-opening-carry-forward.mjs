// Opening Balances page — why "Carry Forward" and "audited fill" double-count on a continuous ledger.
//
// The trial balance is ONE continuous ledger (Phase-2 C, D1): an account's opening for a year is
// account.openingBalance + every earlier-year voucher. So account.openingBalance is the GENESIS
// opening (the day the society started in the app), never a per-year figure. Writing a year-end
// closing into it counts every earlier voucher twice. This script reproduces that with the REAL
// computeTrialBalance, using a verbatim copy of the pre-fix page formula.
//
// Run: node scripts/test-opening-carry-forward.mjs   (npm run test:opening-carry-forward)
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

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;
const { computeTrialBalance } = await import(abs('../src/lib/reports/trialBalance.ts'));
const { getVoucherLines } = await import(abs('../src/lib/voucherUtils.ts'));
const { carryForwardOpenings } = await import(abs('../src/lib/openingBalances.ts'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const acct = (id, type, openingBalance = 0, openingBalanceType = 'debit') =>
  ({ id, name: id, nameHi: id, type, openingBalance, openingBalanceType });
const v = (id, date, dr, cr, amount, extra = {}) => ({ id, date, debitAccountId: dr, creditAccountId: cr, amount, ...extra });
const row = (tb, id) => tb.find(r => r.account.id === id);

// Society started in the app in FY 2025-26 with Cash 1,000 Dr / Share capital 1,000 Cr,
// and booked one sale of 500 in that year. It is now FY 2026-27.
const accounts = [acct('CASH', 'asset', 1000, 'debit'), acct('SHARE', 'equity', 1000, 'credit'), acct('SALES', 'income', 0, 'credit')];
const vouchers = [v('v1', '2025-06-01', 'CASH', 'SALES', 500)];
const FY_START = '2026-04-01';

// 0. Baseline — the continuous ledger already brings 1,500 forward. Nothing needs carrying.
{
  const tb = computeTrialBalance({ accounts, vouchers, fyStart: FY_START, openingsInScope: true });
  ok(row(tb, 'CASH').openingDebit === 1500, `continuous ledger: FY 26-27 Cash opening = 1,500 (got ${row(tb, 'CASH').openingDebit})`);
}

// ── Verbatim copy of the PRE-FIX OpeningBalances.handleCarryForward loop body ──
function legacyCarryForward(balanceAccounts, balances, allVouchers, financialYear) {
  const fyEnd = `${parseInt(financialYear.split('-')[0]) + 1}-03-31`;
  const newBalances = {};
  for (const acct of balanceAccounts) {
    let bal = (acct.openingBalanceType === 'debit' ? 1 : -1) * (acct.openingBalance || 0);
    const existing = balances[acct.id];
    if (existing) bal += existing.type === 'debit' ? existing.amount : -existing.amount;
    allVouchers
      .filter(x => !x.isDeleted && x.date <= fyEnd && getVoucherLines(x).some(l => l.accountId === acct.id))
      .forEach(x => getVoucherLines(x).forEach(l => {
        if (l.accountId === acct.id) bal += l.type === 'Dr' ? l.amount : -l.amount;
      }));
    if (Math.abs(bal) > 0.01) newBalances[acct.id] = { accountId: acct.id, amount: Math.abs(bal), type: bal >= 0 ? 'debit' : 'credit' };
  }
  return newBalances;
}
// The page's on-screen state is initialised from the very same openingBalance.
const pageState = { CASH: { accountId: 'CASH', amount: 1000, type: 'debit' }, SHARE: { accountId: 'SHARE', amount: 1000, type: 'credit' } };
const bsAccounts = accounts.filter(a => a.type !== 'income');

// 1. Bug A — the opening is counted twice inside the formula itself.
{
  const out = legacyCarryForward(bsAccounts, pageState, vouchers, '2026-27');
  ok(out.CASH.amount === 2500, `legacy carry-forward: Cash = 1,000 + 1,000 + 500 = 2,500 (got ${out.CASH.amount})`);
  ok(out.SHARE.amount === 2000, `legacy carry-forward: Share = 1,000 + 1,000 = 2,000 (got ${out.SHARE.amount})`);

  // Bug B — save it, and the continuous ledger adds the 500 sale on top AGAIN.
  const saved = accounts.map(a => out[a.id] ? { ...a, openingBalance: out[a.id].amount, openingBalanceType: out[a.id].type } : a);
  const tb = computeTrialBalance({ accounts: saved, vouchers, fyStart: FY_START, openingsInScope: true });
  ok(row(tb, 'CASH').openingDebit === 3000, `after save: FY 26-27 Cash opening = 3,000 instead of 1,500 (got ${row(tb, 'CASH').openingDebit})`);
}

// 2. Bug C — pending / rejected vouchers are carried (the TB never counts them).
{
  const vs = [...vouchers, v('v2', '2025-07-01', 'CASH', 'SALES', 9000, { approvalStatus: 'rejected' })];
  const out = legacyCarryForward(bsAccounts, {}, vs, '2026-27');
  ok(out.CASH.amount === 10500, `legacy carry-forward counts a REJECTED 9,000 voucher (got ${out.CASH.amount})`);
}

// 3. Same double count through "लेखा-परीक्षित शेष भरें": the rollover snapshot is the TB closing,
//    which already contains every voucher; writing it into openingBalance re-adds them.
{
  const tbAtClose = computeTrialBalance({ accounts, vouchers, asOnDate: '2026-03-31', fyStart: '2025-04-01', openingsInScope: true });
  const snapshot = {};
  tbAtClose.filter(r => r.account.type !== 'income').forEach(r => { if (Math.abs(r.netBalance) > 0.01) snapshot[r.account.id] = r.netBalance; });
  const entries = carryForwardOpenings(snapshot);
  const saved = accounts.map(a => { const e = entries.find(x => x.accountId === a.id); return e ? { ...a, openingBalance: e.amount, openingBalanceType: e.type } : a; });
  const tb = computeTrialBalance({ accounts: saved, vouchers, fyStart: FY_START, openingsInScope: true });
  ok(row(tb, 'CASH').openingDebit === 2000, `audited fill after rollover: Cash opening = 2,000 instead of 1,500 (got ${row(tb, 'CASH').openingDebit})`);
}

// ── The fix (founder decision 2026-10-04, option a) ──────────────────────────────────
const { earlierYearVoucherCount, openingTotals } = await import(abs('../src/lib/openingBalances.ts'));

// 4. Earlier-year vouchers ⇒ the continuous ledger owns the opening; the fill is withheld.
ok(earlierYearVoucherCount(vouchers, FY_START) === 1, 'one live FY 25-26 voucher counts as earlier-year');
ok(earlierYearVoucherCount(vouchers, '2025-04-01') === 0, 'first-year society (nothing before its FY) → 0, onboarding fill allowed');
ok(earlierYearVoucherCount([v('d', '2025-06-01', 'CASH', 'SALES', 1, { isDeleted: true }), v('r', '2025-06-01', 'CASH', 'SALES', 1, { approvalStatus: 'rejected' })], FY_START) === 0,
  'deleted / rejected earlier vouchers do not count');
ok(earlierYearVoucherCount([v('p', '2025-06-01', 'CASH', 'SALES', 1, { approvalStatus: 'pending' })], FY_START) === 1, 'pending earlier voucher counts (posts once approved)');
ok(earlierYearVoucherCount([v('c', '2026-04-01', 'CASH', 'SALES', 1)], FY_START) === 0, '1-Apr voucher of the current FY is not earlier-year');
ok(earlierYearVoucherCount(vouchers, undefined) === 0, 'unknown FY → 0');

// 5. Dr = Cr check in exact paise.
{
  const t = openingTotals([{ amount: 1000.1, type: 'debit' }, { amount: 0.2, type: 'debit' }, { amount: 1000.3, type: 'credit' }]);
  ok(t.balanced && t.debit === 1000.3 && t.credit === 1000.3 && t.difference === 0, 'float sums tie exactly in paise (1000.1 + 0.2 = 1000.3)');
  const u = openingTotals([{ amount: 1000, type: 'debit' }, { amount: 999.5, type: 'credit' }]);
  ok(!u.balanced && u.difference === 0.5, 'a 50-paise gap is unbalanced (old check allowed < ₹1)');
  ok(openingTotals([]).balanced, 'no entries → balanced');
}

// 6. Wiring — the page and DataContext keep the fix (regex over source, comments stripped).
{
  const fs = await import('node:fs');
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const page = strip(fs.readFileSync(pathResolve(HERE, '../src/pages/OpeningBalances.tsx'), 'utf8'));
  ok(!/handleCarryForward|getVoucherLines/.test(page), 'page: the voucher-summing Carry Forward is gone');
  ok(/auditedOpenings\.length > 0 && !continuousLedger &&/.test(page), 'page: audited fill shown only without earlier-year vouchers');
  ok(/if \(continuousLedger\) return;/.test(page), 'page: audited fill handler also refuses on a continuous ledger');
  ok(/if \(!isBalanced && !opts\?\.unbalancedConfirmed\) \{ setConfirmUnbalanced\(true\); return; \}/.test(page), 'page: Dr ≠ Cr asks before saving');
  ok(/if \(society\.fyLocked\)/.test(page), 'page: FY-lock guard in handleSave (RULE 6)');
  const save = page.slice(page.indexOf('const handleSave'), page.indexOf('const fyLocked'));
  const okToast = save.indexOf("'प्रारंभिक शेष सहेजा गया'");
  ok(okToast > save.indexOf('if (settled.size < changes.length) return;') && okToast > 0, 'page: success toast only after every row settled');
  ok(/onSaved: \(\) => settle\(c, true\), onFailed: m => settle\(c, false, m\)/.test(save), 'page: each row reports its cloud result');
  ok(/saved\.forEach\(r => updateAccount\(r\.id, r\.prev\)\)/.test(save) && /variant: 'destructive', duration: 12000/.test(save), 'page: any failure reverts saved rows + destructive toast ≥10s (RULE 1)');

  const dc = strip(fs.readFileSync(pathResolve(HERE, '../src/contexts/DataContext.tsx'), 'utf8'));
  const ua = dc.slice(dc.indexOf('const updateAccount = useCallback('), dc.indexOf('const deleteAccountRow'));
  ok(/opts\?\.onFailed\?\.\(error\.message\);\s*return;\s*\}\s*opts\?\.onSaved\?\.\(\);/.test(ua), 'updateAccount: onFailed after rollback, onSaved after success');
  ok(/else opts\?\.onFailed\?\.\('account not found'\);/.test(ua), 'updateAccount: a missing account settles as failed (no hang)');
  ok(/title: 'तारीख़ चालू वित्त वर्ष से बाहर \/ Date Outside Financial Year'/.test(dc), 'out-of-FY warning is Hindi-first (RULE 7)');
}

console.log(`\nopening-carry-forward: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
