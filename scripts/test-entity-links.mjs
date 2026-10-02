// K5 · computeEntityLinks (lib/entityLinks) — the delete pre-check pages show before a delete, lifted
// out of DataContext. Checks the RULE 5 orphan rules (soft-deleted vouchers / movements of deleted docs
// never block), each entity type, the asset word-boundary match, and that an account used only on a
// multi-line voucher's lines is reported (same rule as deleteAccount's guard).
//
// Run: node scripts/test-entity-links.mjs   (npm run test:entity-links)


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
      const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
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
      export async function load(url, ctx, next) {
        if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;
let computeEntityLinks;
try {
  ({ computeEntityLinks } = await import(abs('../src/lib/entityLinks.ts')));
} catch (e) {
  console.error('\nFAIL    Could not import src/lib/entityLinks.ts');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

let failed = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}    ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) failed++;
};
const empty = { vouchers: [], loans: [], sales: [], purchases: [], stockMovements: [], salaryRecords: [], suppliers: [], customers: [], assets: [] };
const links = (type, id, src) => computeEntityLinks(type, id, { ...empty, ...src });
const mods = (ls) => ls.map(l => `${l.module}:${l.count}`).join(',');

// 1. Member: vouchers and loans block.
check('member with 2 vouchers + 1 loan', mods(links('member', 'M1', {
  vouchers: [{ id: 'a', memberId: 'M1' }, { id: 'b', memberId: 'M1' }, { id: 'c', memberId: 'M2' }],
  loans: [{ id: 'L', memberId: 'M1', loanNo: 'LN/1' }],
})) === 'Vouchers:2,Loans:1');
check('member with nothing → no links', links('member', 'M9', {}).length === 0);

// 2. Customer / supplier / employee.
check('customer with a sale', mods(links('customer', 'C1', { sales: [{ id: 's', saleNo: 'SA/1', customerId: 'C1', items: [] }] })) === 'Sales:1');
check('supplier with a purchase', mods(links('supplier', 'S1', { purchases: [{ id: 'p', purchaseNo: 'PU/1', supplierId: 'S1', items: [] }] })) === 'Purchases:1');
check('employee with salary records', mods(links('employee', 'E1', { salaryRecords: [{ employeeId: 'E1' }, { employeeId: 'E1' }] })) === 'Salary Records:2');

// 3. Stock item: RULE 5 — movements of a deleted purchase/sale do not block.
{
  const src = {
    purchases: [{ id: 'p', purchaseNo: 'PU/1', supplierId: 'x', items: [{ itemId: 'I1' }] }],
    stockMovements: [{ id: 'm1', itemId: 'I1', referenceNo: 'PU/1' }, { id: 'm2', itemId: 'I1', referenceNo: 'PU/GONE' }],
  };
  check('only the live movement counts (orphan ignored)', mods(links('stockItem', 'I1', src)) === 'Stock Movements:1,Purchases:1', mods(links('stockItem', 'I1', src)));
  check('item with only orphan movements → no links', links('stockItem', 'I2', { stockMovements: [{ id: 'm', itemId: 'I2', referenceNo: 'SA/GONE' }] }).length === 0);
}

// 4. Account: legacy fields, multi-line lines, and supplier/customer sub-ledgers.
{
  const multi = { id: 'ml', lines: [{ id: 'l1', accountId: 'X', type: 'Dr', amount: 5 }, { id: 'l2', accountId: 'ACC', type: 'Cr', amount: 5 }] };
  check('account used on legacy fields', mods(links('account', 'ACC', { vouchers: [{ id: 'v', debitAccountId: 'ACC', creditAccountId: 'X' }] })) === 'Vouchers:1');
  check('account used ONLY on a multi-line voucher is reported', mods(links('account', 'ACC', { vouchers: [multi] })) === 'Vouchers:1');
  check('account is a supplier sub-ledger', mods(links('account', 'ACC', { suppliers: [{ id: 's', name: 'Ram', accountId: 'ACC' }] })) === 'Supplier:1');
  check('account is a customer sub-ledger', mods(links('account', 'ACC', { customers: [{ id: 'c', name: 'Shyam', accountId: 'ACC' }] })) === 'Customer:1');
}

// 5. Loan: narration links are a non-blocking heads-up.
{
  const l = links('loan', 'L1', { loans: [{ id: 'L1', loanNo: 'LN/7', memberId: 'm' }], vouchers: [{ id: 'v', narration: 'Repayment LN/7' }] });
  check('loan voucher found, non-blocking', mods(l) === 'Vouchers:1' && l[0].blocking === false);
}

// 6. Asset: word-boundary match + depreciation/disposal only (M14).
{
  const assets = [{ id: 'A1', assetNo: 'AST/0010' }];
  const vouchers = [
    { id: 'a', narration: 'Depreciation AST/0010 FY 2026-27' },
    { id: 'b', narration: 'Depreciation AST/00100' },        // different asset (prefix)
    { id: 'c', narration: 'AST/0010 shifted to godown' },    // a mention, not a depreciation/disposal
  ];
  check('only the real depreciation voucher blocks', mods(links('asset', 'A1', { assets, vouchers })) === 'Vouchers:1');
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll entity-link checks passed.');
process.exit(failed ? 1 : 0);
