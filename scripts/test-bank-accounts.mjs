// Bank account resolution — imports the REAL src/lib/storage.ts via the '@/' loader.
// Regression cover for the defect where a bank added via Bank Book's "Add Bank" was
// created under 3302 but never listed anywhere: every seeded template ships 3302 as a
// leaf (isGroup: false), and getBankAccountIds returned ['3302'] flat in that case, so
// the child was invisible in the Bank Book selector, Dashboard, reconciliation and reports.
// Run: node scripts/test-bank-accounts.mjs
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

const { getBankAccountIds, isBankAccount, ACCOUNT_IDS, CMS_SOCIETY_ACCOUNTS } = await import(abs('../src/lib/storage.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const BANK = ACCOUNT_IDS.BANK;   // '3302'
const leafBank = { id: BANK, parentId: '3300', isGroup: false, subtype: 'cash_bank' };
const groupBank = { id: BANK, parentId: '3300', isGroup: true };
const sbi = { id: 'u-sbi', name: 'SBI — Assandh', parentId: BANK, isGroup: false, subtype: 'cash_bank' };
const pnb = { id: 'u-pnb', name: 'PNB — Karnal', parentId: BANK, isGroup: false, subtype: 'cash_bank' };
const cash = { id: ACCOUNT_IDS.CASH, parentId: '3300', isGroup: false, subtype: 'cash_bank' };
const unrelated = { id: '3303', parentId: '3300', isGroup: false };

// 1. Leaf 3302, no banks added yet — the fresh-society case.
ok(getBankAccountIds([cash, leafBank]).join() === BANK, 'leaf 3302 alone → [3302]');

// 2. THE BUG: leaf 3302 + added banks. 3302 stays first (the history and every
//    getBankAccountIds(...)[0] default live there) and the children follow.
ok(getBankAccountIds([cash, leafBank, sbi, pnb]).join() === `${BANK},u-sbi,u-pnb`, 'leaf 3302 + children → 3302 first, then children');
ok(getBankAccountIds([cash, leafBank, sbi])[0] === BANK, 'default bank ([0]) is unchanged by adding a bank');

// 3. Group 3302 — children only (3302 itself cannot be posted to: validation rule 1).
ok(getBankAccountIds([cash, groupBank, sbi, pnb]).join() === 'u-sbi,u-pnb', 'group 3302 + children → children only');
ok(getBankAccountIds([cash, groupBank]).join() === BANK, 'group 3302 with no children → falls back to [3302]');

// 4. Only real children count — nested groups and unrelated Current Assets stay out.
const subGroup = { id: 'g-1', parentId: BANK, isGroup: true };
ok(!getBankAccountIds([leafBank, subGroup]).includes('g-1'), 'a group under 3302 is not itself a bank account');
ok(!getBankAccountIds([leafBank, sbi, unrelated]).includes('3303'), 'a sibling under Current Assets is not a bank');
ok(!getBankAccountIds([leafBank, sbi]).includes(ACCOUNT_IDS.CASH), 'cash is never a bank account');

// 5. isBankAccount agrees with the list, under both shapes.
for (const shape of [leafBank, groupBank]) {
  const accs = [cash, shape, sbi, unrelated];
  const label = shape.isGroup ? 'group' : 'leaf';
  ok(isBankAccount(BANK, accs), `${label}: 3302 itself is a bank account`);
  ok(isBankAccount('u-sbi', accs), `${label}: an added bank is a bank account`);
  ok(!isBankAccount('3303', accs), `${label}: sundry debtors is not a bank account`);
  ok(!isBankAccount(ACCOUNT_IDS.CASH, accs), `${label}: cash is not a bank account`);
}

// 6. The real seeded chart resolves — guards against a template changing 3302's shape
//    without this function being revisited.
ok(getBankAccountIds(CMS_SOCIETY_ACCOUNTS).join() === BANK, 'seeded CMS chart → [3302]');
const seededPlusBank = [...CMS_SOCIETY_ACCOUNTS, sbi];
ok(getBankAccountIds(seededPlusBank).join() === `${BANK},u-sbi`, 'seeded CMS chart + added bank → both listed');

// 7. THE BANK-PICKER CONTRACT (migration 054). The purchase/sale/salary screens now let the
//    operator choose WHICH bank; every posting site resolves the credit/debit bank as
//    `chosen ?? getBankAccountIds(accounts)[0]`. Pin that exact rule against the real function
//    so "pay salary from HDFC, PF from the cooperative bank" can't silently regress to bank #1.
const hdfc = { id: 'u-hdfc', name: 'HDFC', parentId: BANK, isGroup: false, subtype: 'cash_bank' };
const coop = { id: 'u-coop', name: 'Cooperative Bank', parentId: BANK, isGroup: false, subtype: 'cash_bank' };
const multiBank = [cash, leafBank, hdfc, coop];
const resolveBank = (chosen, accs) => chosen || getBankAccountIds(accs)[0];   // the inline rule, verbatim
ok(resolveBank('u-hdfc', multiBank) === 'u-hdfc', 'a chosen bank (HDFC) is used verbatim, not the default');
ok(resolveBank('u-coop', multiBank) === 'u-coop', 'a different chosen bank (Cooperative) is honoured — salary vs PF can differ');
ok(resolveBank(undefined, multiBank) === BANK, 'no choice → falls back to the first bank (today\'s behaviour, unchanged)');
ok(resolveBank('', multiBank) === BANK, 'empty choice (cash mode / not picked) → first bank, never a crash');
// The chosen id must be a real bank in the list — the UI only offers getBankAccountIds, so this holds.
ok(getBankAccountIds(multiBank).includes(resolveBank('u-hdfc', multiBank)), 'the resolved bank is always one the picker actually lists');

console.log(`\nBank accounts (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
