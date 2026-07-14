// Ledger Hygiene (ECR-28). Imports the REAL src/lib/ledgerHygiene.ts via the '@/' loader —
// so this validates the actual code. (Was a self-contained mirror before.)
// Run: node scripts/test-ledger-hygiene.mjs
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

const { analyzeLedgerHygiene, hygieneSummary } = await import(abs('../src/lib/ledgerHygiene.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const acc = (id, name, extra = {}) => ({ id, name, nameHi: name, type: 'asset', openingBalance: 0, openingBalanceType: 'debit', ...extra });
const cat = (fs, c) => fs.find(f => f.category === c);
const noUsage = { voucherRefCount: {}, balance: {}, linkedParty: {} };

// 1. Clean COA → no findings.
{
  const accs = [acc('3301', 'Cash', { isSystem: true }), acc('4101', 'Sales', { isSystem: true })];
  const f = analyzeLedgerHygiene(accs, noUsage);
  ok(f.length === 0, 'clean system COA → no findings');
}

// 2. Dangling reference — a voucher line points at a missing account.
{
  const accs = [acc('3301', 'Cash')];
  const f = analyzeLedgerHygiene(accs, { voucherRefCount: { '3301': 5, 'ghost-uuid-123456': 2 }, balance: {}, linkedParty: {} });
  const d = cat(f, 'dangling-reference');
  ok(d && d.severity === 'error' && d.accounts.length === 1 && d.accounts[0].id === 'ghost-uuid-123456', 'dangling ref flagged for the missing id only');
}

// 3. Deleted-party marker — removable (no refs, zero balance) vs retained (still referenced).
{
  const accs = [
    acc('u1', 'Ram Traders [Supplier deleted]'),
    acc('u2', 'Shyam Store [Customer deleted]'),
  ];
  const usage = { voucherRefCount: { u2: 3 }, balance: { u1: 0, u2: 0 }, linkedParty: {} };
  const f = analyzeLedgerHygiene(accs, usage);
  const rem = cat(f, 'deleted-removable'), ret = cat(f, 'deleted-retained');
  ok(rem && rem.accounts.length === 1 && rem.accounts[0].id === 'u1', 'unreferenced deleted-supplier → removable');
  ok(ret && ret.accounts.length === 1 && ret.accounts[0].id === 'u2', 'referenced deleted-customer → retained (RULE-3)');
}

// 4. Deleted marker with a non-zero balance → retained (not removable), even with no vouchers.
{
  const accs = [acc('u1', 'Old Party [Supplier deleted]')];
  const f = analyzeLedgerHygiene(accs, { voucherRefCount: {}, balance: { u1: 250 }, linkedParty: {} });
  ok(!cat(f, 'deleted-removable') && cat(f, 'deleted-retained'), 'deleted marker with balance → retained, not removable');
}

// 5. Unused head — postable, non-system, zero everything, no party.
{
  const accs = [acc('5199', 'Misc Expense'), acc('3301', 'Cash', { isSystem: true })];
  const f = analyzeLedgerHygiene(accs, noUsage);
  const u = cat(f, 'unused-head');
  ok(u && u.accounts.length === 1 && u.accounts[0].id === '5199', 'unused postable head flagged; system Cash not');
}

// 6. Unused head NOT flagged when used, when it has opening balance, or when party-linked.
{
  const accs = [acc('a', 'Used', {}), acc('b', 'HasOpening', { openingBalance: 100 }), acc('c', 'Party')];
  const usage = { voucherRefCount: { a: 4 }, balance: { a: 100 }, linkedParty: { c: 'Supplier: Ram' } };
  const f = analyzeLedgerHygiene(accs, usage);
  ok(!cat(f, 'unused-head'), 'used / has-opening / party-linked heads are NOT unused');
}

// 7. Group account: empty group flagged; group with a child not.
{
  const accs = [acc('2100', 'Creditors', { isGroup: true }), acc('2101', 'Suppliers', { isGroup: true }), acc('u1', 'Ram', { parentId: '2101' })];
  const f = analyzeLedgerHygiene(accs, noUsage);
  const eg = cat(f, 'empty-group');
  ok(eg && eg.accounts.length === 1 && eg.accounts[0].id === '2100', 'empty group flagged; parent-of-child not');
}

// 8. Duplicate names — case/space-insensitive, markers excluded.
{
  const accs = [acc('x1', 'Sundry Debtors'), acc('x2', ' sundry debtors '), acc('x3', 'Cash'), acc('x4', 'Ram [Supplier deleted]'), acc('x5', 'Ram')];
  const f = analyzeLedgerHygiene(accs, noUsage);
  const d = cat(f, 'duplicate-name');
  ok(d && d.accounts.length === 2 && d.accounts.every(a => a.id === 'x1' || a.id === 'x2'), 'two "Sundry Debtors" flagged; deleted "Ram" excluded so single "Ram" is not a dup');
}

// 9. Blank name.
{
  const accs = [acc('z1', '', { nameHi: 'नाम' }), acc('z2', 'Ok')];
  const f = analyzeLedgerHygiene(accs, noUsage);
  const b = cat(f, 'blank-name');
  ok(b && b.accounts.length === 1 && b.accounts[0].id === 'z1', 'blank English name flagged');
}

// 10. Summary tallies by severity.
{
  const accs = [acc('u1', 'Old [Supplier deleted]'), acc('5199', 'Misc'), acc('2100', 'Grp', { isGroup: true })];
  const f = analyzeLedgerHygiene(accs, { voucherRefCount: { 'ghost1': 1 }, balance: {}, linkedParty: {} });
  const s = hygieneSummary(f);
  ok(s.errors === 1, 'summary: 1 error (dangling)');
  ok(s.cleanups === 1, 'summary: 1 cleanup (removable deleted)');
  ok(s.warnings === 1, 'summary: 1 warning (unused head)');
  ok(s.infos === 1, 'summary: 1 info (empty group)');
  ok(s.total === 4, 'summary: 4 total flagged');
}

// 11. Abnormal balance — the two real Rania cases + guards against false positives.
{
  const accs = [
    acc('3301', 'Cash', { type: 'asset', openingBalanceType: 'debit', isSystem: true }),          // negative cash (asset, Cr balance)
    acc('hafed', 'Hafed Control', { type: 'liability', openingBalanceType: 'credit' }),            // receivable in a liability (Dr balance)
    acc('3302', 'Bank', { type: 'asset', openingBalanceType: 'debit' }),                           // normal (Dr balance) → not flagged
    acc('1211', 'Dividend Distribution', { type: 'equity', openingBalanceType: 'debit' }),         // contra: opens debit → Dr balance is fine
    acc('1208', 'Net Surplus', { type: 'equity', subtype: 'surplus', openingBalanceType: 'credit' }), // deficit swing → exempt
    acc('2100', 'Liab Group', { type: 'liability', isGroup: true, openingBalanceType: 'credit' }), // group → skip
  ];
  const balance = {
    '3301': -294100,   // asset carrying a CREDIT balance → negative cash
    'hafed': 150000,   // liability carrying a DEBIT balance → misclassified receivable
    '3302': 50000,     // asset with normal debit balance → fine
    '1211': 8000,      // debit-opened equity with a debit balance → intentional, fine
    '1208': -20000,    // surplus with a debit (deficit) → exempt via subtype
  };
  const f = analyzeLedgerHygiene(accs, { voucherRefCount: {}, balance, linkedParty: {} });
  const ab = cat(f, 'abnormal-balance');
  ok(ab && ab.severity === 'error', 'abnormal-balance is an error');
  ok(ab && ab.accounts.length === 2, 'exactly 2 flagged (Cash + Hafed); Bank/Dividend/Surplus/group exempt');
  const cash = ab.accounts.find(x => x.id === '3301');
  ok(cash && cash.detail.includes('Cr') && cash.detail.includes('expected Dr'), 'cash: credit balance, expected Dr');
  const hafed = ab.accounts.find(x => x.id === 'hafed');
  ok(hafed && hafed.detail.includes('Dr') && hafed.detail.includes('expected Cr'), 'hafed: debit balance, expected Cr');
  ok(!ab.accounts.some(x => x.id === '3302' || x.id === '1211' || x.id === '1208' || x.id === '2100'), 'no false positives');
}

// 12. Zero balance is never abnormal.
{
  const accs = [acc('x', 'Zero Asset', { type: 'liability', openingBalanceType: 'credit' })];
  const f = analyzeLedgerHygiene(accs, { voucherRefCount: {}, balance: { x: 0 }, linkedParty: {} });
  ok(!cat(f, 'abnormal-balance'), 'zero balance → not abnormal');
}

console.log(`\nLedger hygiene (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
