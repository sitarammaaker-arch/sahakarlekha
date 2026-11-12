// A ledger kept in a SUB-GROUP under a standard head must count wherever that head is summed
// (2026-11-12 chart audit, F-06). Production had share-capital and creditor ledgers in such sub-groups; the
// Dashboard / Loan Register base, the Ageing lists, the appropriable funds and the R&P capital/revenue split
// each read the direct parent only and dropped them. This pins the shared rule (lib/accounting/ancestry) and
// each reader that now uses it.
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !/\\.(ts|tsx|js|mjs|json)$/.test(spec)) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
`));
const imp = (p) => import(pathToFileURL(path.join(SRC, p)).href);
const A = await imp('lib/accounting/ancestry.ts');
const L = await imp('lib/loanExposure.ts');
const D = await imp('lib/distribution/dividendRuns.ts');
const R = await imp('lib/ledger/receiptsPaymentsClassify.ts');
const S = await imp('lib/storage.ts');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const src = (p) => readFileSync(path.join(SRC, p), 'utf8');

// A small chart with sub-groups two levels deep under several heads.
const acc = (id, parentId, extra = {}) => ({ id, name: id, parentId, isGroup: false, type: 'equity', openingBalanceType: 'credit', ...extra });
const chart = [
  acc('1000', undefined, { isGroup: true }),
  acc('1100', '1000', { isGroup: true }), acc('1102', '1100'),
  acc('1100-V', '1100', { isGroup: true }), acc('m1', '1100-V'), acc('1100-V2', '1100-V', { isGroup: true }), acc('m2', '1100-V2'),
  acc('1200', '1000', { isGroup: true }), acc('1201', '1200'), acc('1208', '1200'), acc('1211', '1200', { openingBalanceType: 'debit' }),
  acc('1200-F', '1200', { isGroup: true }), acc('f1', '1200-F'),
  acc('2101', '2000', { isGroup: true, type: 'liability' }), acc('2101-01', '2101', { type: 'liability' }),
  acc('2101-G', '2101', { isGroup: true, type: 'liability' }), acc('c1', '2101-G', { type: 'liability' }),
  acc('3100', '3000', { isGroup: true, type: 'asset' }), acc('3100-P', '3100', { isGroup: true, type: 'asset' }), acc('p1', '3100-P', { type: 'asset' }),
  acc('3300', '3000', { isGroup: true, type: 'asset' }), acc('x1', '3300', { type: 'asset' }),
];
const parentOf = A.parentMap(chart);
const by = (id) => chart.find((a) => a.id === id);

// ── The rule ─────────────────────────────────────────────────────────────────────────────────────────────────
ok(A.isUnder(by('1102'), '1100', parentOf), 'direct child is under its head');
ok(A.isUnder(by('m1'), '1100', parentOf) && A.isUnder(by('m2'), '1100', parentOf), 'a ledger one and two sub-groups down is under the head');
ok(A.isUnder(by('m2'), '1000', parentOf), '… and under the head above that');
ok(!A.isUnder(by('1100'), '1100', parentOf), 'an account is not under itself');
ok(!A.isUnder(by('1201'), '1100', parentOf) && !A.isUnder(by('x1'), '1100', parentOf), 'an account elsewhere is not under the head');
ok(!A.isUnder(undefined, '1100', parentOf), 'an unknown account is under nothing');
ok(A.headAbove(by('m2'), new Set(['1100', '1200']), parentOf) === '1100' && A.headAbove(by('x1'), new Set(['1100', '1200']), parentOf) === undefined, 'headAbove names the head, or nothing');
// A cycle in the data (a → b → a) must end, not hang.
const loop = A.parentMap([{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }]);
ok(A.isUnder({ id: 'a', parentId: 'b' }, 'zzz', loop) === false, 'a parent cycle terminates');
ok(A.ledgerIdsUnder(chart, '2101').join() === '2101-01,c1', 'ledgerIdsUnder lists postable accounts at any depth, groups left out');
ok(A.ledgerIdsUnder(chart, '1100').join() === '1102,m1,m2', 'ledgerIdsUnder for share capital');

// ── Loan-exposure base (Dashboard + Loan Register) ───────────────────────────────────────────────────────────
const tb = [['1102', -1000], ['m1', -300], ['m2', -100], ['1201', -200], ['f1', -250], ['1208', -50], ['2101-01', -999], ['x1', 999]]
  .map(([id, netBalance]) => ({ account: by(id), netBalance }));
const base = L.loanExposureBase(tb, chart);
ok(base.shareCapital === 1400, 'share capital counts the nested ledgers (1000 + 300 + 100)');
ok(base.reserves === 500, 'reserves count the nested fund (200 + 250 + 50)');
ok(base.base === 1900 && base.limit === 19000, 'base = share capital + reserves; limit = 10 × base');
// A chart with no sub-groups gives exactly what the old direct-parent sum gave.
const flatTb = tb.filter((b) => ['1102', '1201', '1208'].includes(b.account.id));
const flat = L.loanExposureBase(flatTb, chart);
const oldSum = (head) => flatTb.filter((b) => b.account.parentId === head && !b.account.isGroup).reduce((s, b) => s + Math.abs(b.netBalance), 0);
ok(flat.shareCapital === oldSum('1100') && flat.reserves === oldSum('1200'), 'without sub-groups the result equals the old direct-parent sum');
ok(L.loanExposureBase([{ account: by('1100-V'), netBalance: -77 }], chart).base === 0, 'a group row is never summed');
for (const page of ['pages/Dashboard.tsx', 'pages/LoanRegister.tsx']) {
  const t = src(page);
  ok(/loanExposureBase\(/.test(t) && !/parentId === '1100'/.test(t) && !/parentId === '1200'/.test(t), `${page} uses the one shared formula, no direct-parent sum`);
}

// ── Appropriable funds ───────────────────────────────────────────────────────────────────────────────────────
const funds = D.appropriationFunds(chart).map((a) => a.id);
ok(funds.includes('f1'), 'a fund in a sub-group under 1200 is appropriable');
ok(funds.includes('1201') && !funds.includes('1208') && !funds.includes('1211') && !funds.includes('1200-F'), 'still: credit-nature ledgers only, never 1208, never a group');
ok(!funds.includes('1102') && !funds.includes('m1'), 'share capital is not a fund');

// ── Ageing + Ledger Hygiene read the same rule ───────────────────────────────────────────────────────────────
const aging = src('pages/AgingAnalysis.tsx');
ok(/ledgerIdsUnder\(accounts, '3303'\)/.test(aging) && /ledgerIdsUnder\(accounts, '2101'\)/.test(aging) && !/parentId === '(3303|2101)'/.test(aging), 'Ageing takes debtors / creditors at any depth');
const hygiene = src('pages/LedgerHygiene.tsx');
ok(/headAbove\(a, partyHeads, parentOf\)/.test(hygiene) && !/parentId === '2101'/.test(hygiene), 'Ledger Hygiene tags party sub-ledgers at any depth');

// ── Receipts & Payments: capital vs revenue ──────────────────────────────────────────────────────────────────
ok(R.accountNature({ ...by('p1'), type: 'asset' }, parentOf) === 'capital', 'a fixed asset in a sub-group under 3100 is capital');
ok(R.accountNature({ ...by('p1'), type: 'asset' }) === 'revenue', 'without the parent map the rule is the direct parent, as before');
ok(R.accountNature({ ...by('x1'), type: 'asset' }, parentOf) === 'revenue', 'a current asset stays revenue');
ok(R.accountNature({ id: 'q', type: 'asset', parentId: '3100' }, parentOf) === 'capital' && R.accountNature({ id: 'q', type: 'equity' }, parentOf) === 'capital', 'direct parent and equity unchanged');
ok(R.accountNature(undefined, parentOf) === 'revenue', 'unknown account → revenue, as before');
ok(/accountNature\(accounts\.find\(a => a\.id === accId\), parentOf\)/.test(src('lib/reports/receiptsPayments.ts')), 'the voucher compute passes the parent map');
ok(/accountNature\(acc, parentOf\)/.test(src('lib/ledger/receiptsPayments.ts')), 'the ledger projection passes the same map (RULE 2)');

// ── The seven standard charts have no sub-groups under these heads, so nothing moves for them ────────────────
for (const t of ['marketing_processing', 'pacs', 'consumer', 'dairy', 'housing', 'sugar', 'transport']) {
  const c = S.fullChartForType(t);
  const po = A.parentMap(c);
  const same = ['1100', '1200', '2101', '3303'].every((h) => {
    const direct = c.filter((a) => !a.isGroup && a.parentId === h).map((a) => a.id).join();
    return direct === A.ledgerIdsUnder(c, h).join();
  });
  ok(same, `${t}: on the standard chart the any-depth lists equal the direct-parent lists`);
  ok(c.every((a) => R.accountNature(a, po) === R.accountNature(a)), `${t}: R&P nature unchanged on the standard chart`);
}

console.log(`Nested-group readers: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
