// Member / non-member turnover (Income-tax Act 2025 s.149; HAFED Accounts Manual 1976 heads 31.10/31.11).
// Imports the REAL src/lib/memberTurnover.ts via the "@/" loader.
// Run: node scripts/test-member-turnover.mjs
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

const { buildMemberTurnover, classifyMember, memberSharePct } = await import(abs('../src/lib/memberTurnover.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

const members = [
  { id: 'M1', memberType: 'member' },
  { id: 'M2', memberType: 'nominal' },
  { id: 'M3', memberType: 'associate' },
];
const stockItems = [
  { id: 'urea', salesAccountId: '4101', purchaseAccountId: '5110' },
  { id: 'seed', salesAccountId: '4102', purchaseAccountId: '5111' },
  { id: 'wheat', salesAccountId: '4108', purchaseAccountId: '5116' },
  { id: 'loose' },                                   // no routing → 4101 / 5101, like the posting
];
const accounts = [
  { id: '4101', name: 'Fertilizer Sales', nameHi: 'उर्वरक बिक्री' },
  { id: '4102', name: 'Seed Sales' },
  { id: '5116', name: 'Govt Procurement Purchase' },
];

// 1. classifyMember
ok(classifyMember(undefined, members).cls === 'nonMember', 'no memberId → non-member');
ok(classifyMember('', members).cls === 'nonMember', 'empty memberId → non-member');
ok(classifyMember('M1', members).cls === 'member', 'regular member');
ok(classifyMember('M2', members).cls === 'nominal', 'nominal → own column');
ok(classifyMember('M3', members).cls === 'nominal', 'associate → nominal column');
{ const c = classifyMember('GONE', members); ok(c.cls === 'member' && c.unmatched, 'unknown member id → member, flagged unmatched'); }

// 2. Sales split by class and account, on the taxable value (after discount, before GST).
{
  const sales = [
    // member, two accounts; lines total 1000 but netAmount 900 (discount) → 90% of each line
    { id: 's1', date: '2026-05-01', memberId: 'M1', netAmount: 900, items: [{ itemId: 'urea', amount: 600 }, { itemId: 'seed', amount: 400 }] },
    { id: 's2', date: '2026-05-02', netAmount: 500, items: [{ itemId: 'urea', amount: 500 }] },                   // non-member
    { id: 's3', date: '2026-05-03', memberId: 'M2', netAmount: 200, items: [{ itemId: 'seed', amount: 200 }] },    // nominal
    { id: 's4', date: '2026-05-04', memberId: 'M1', netAmount: 999, isDeleted: true, items: [{ itemId: 'urea', amount: 999 }] }, // deleted → out
    { id: 's5', date: '2026-07-01', memberId: 'M1', netAmount: 70, items: [{ itemId: 'urea', amount: 70 }] },     // outside window
    { id: 's6', date: '2026-05-05', netAmount: 30, items: [{ itemId: 'loose', amount: 30 }] },                     // unrouted → 4101
  ];
  const t = buildMemberTurnover({ sales, purchases: [], members, stockItems, accounts, from: '2026-04-01', to: '2026-06-30' });
  const r4101 = t.sales.rows.find(r => r.accountId === '4101');
  const r4102 = t.sales.rows.find(r => r.accountId === '4102');
  ok(r4101 && r4101.member === 540, `4101 member = 540 (600×0.9), got ${r4101?.member}`);
  ok(r4101 && r4101.nonMember === 530, `4101 non-member = 500 + unrouted 30, got ${r4101?.nonMember}`);
  ok(r4102 && r4102.member === 360 && r4102.nominal === 200, `4102 member 360 / nominal 200, got ${r4102?.member}/${r4102?.nominal}`);
  ok(r4101 && r4101.accountName === 'Fertilizer Sales' && r4101.accountNameHi === 'उर्वरक बिक्री', 'account names carried');
  ok(t.sales.totals.total === 1630, `sales total = 900+500+200+30 = 1630, got ${t.sales.totals.total}`);
  ok(t.sales.totals.member === 900 && t.sales.totals.nominal === 200 && t.sales.totals.nonMember === 530, 'class totals');
  ok(t.sales.bills.member === 1 && t.sales.bills.nominal === 1 && t.sales.bills.nonMember === 2, 'bill counts (deleted / out-of-window excluded)');
  ok(memberSharePct(t.sales.totals) === 55.2, `member share 900/1630 = 55.2%, got ${memberSharePct(t.sales.totals)}`);
  ok(t.sales.rows.map(r => r.accountId).join() === '4101,4102', 'rows sorted by account code');
}

// 3. Exact paise: 100 split over three equal lines never loses or invents a paisa.
{
  const sales = [{ id: 'p', date: '2026-05-01', netAmount: 100, items: [{ itemId: 'urea', amount: 1 }, { itemId: 'seed', amount: 1 }, { itemId: 'wheat', amount: 1 }] }];
  const t = buildMemberTurnover({ sales, purchases: [], members, stockItems, accounts });
  const sum = t.sales.rows.reduce((s, r) => s + Math.round(r.total * 100), 0);
  ok(sum === 10000, `paise conserved: ${sum} = 10000`);
}

// 4. Returns are subtracted in the class of the original bill.
{
  const sales = [{ id: 's1', date: '2026-05-01', memberId: 'M1', netAmount: 1000, items: [{ itemId: 'urea', amount: 1000 }] }];
  const salesReturns = [
    { date: '2026-05-10', originalSaleId: 's1', netAmount: 100, items: [{ itemId: 'urea', amount: 100 }] },               // follows s1 → member
    { date: '2026-05-11', originalSaleId: 's1', netAmount: 50, isDeleted: true, items: [{ itemId: 'urea', amount: 50 }] }, // deleted → ignored
  ];
  const purchases = [
    { id: 'p1', date: '2026-05-01', memberId: 'M1', netAmount: 2000, items: [{ itemId: 'wheat', amount: 2000 }] },
    { id: 'p2', date: '2026-05-02', netAmount: 800, items: [{ itemId: 'wheat', amount: 800 }] },
  ];
  const purchaseReturns = [{ date: '2026-05-12', originalPurchaseId: 'p2', netAmount: 300, items: [{ itemId: 'wheat', amount: 300 }] }];
  const t = buildMemberTurnover({ sales, purchases, salesReturns, purchaseReturns, members, stockItems, accounts });
  ok(t.sales.totals.member === 900, `sale return reduces members: 900, got ${t.sales.totals.member}`);
  const w = t.purchases.rows.find(r => r.accountId === '5116');
  ok(w && w.member === 2000 && w.nonMember === 500, `wheat purchases member 2000 / non-member 800−300, got ${w?.member}/${w?.nonMember}`);
  ok(w && w.accountName === 'Govt Procurement Purchase', 'purchase account name');
  ok(t.purchases.bills.member === 1 && t.purchases.bills.nonMember === 1, 'purchase bill counts');
}

// 5. A sales return's own memberId wins over the original's (a return entered against the member at the counter).
{
  const sales = [{ id: 's1', date: '2026-05-01', netAmount: 400, items: [{ itemId: 'urea', amount: 400 }] }];
  const salesReturns = [{ date: '2026-05-02', originalSaleId: 's1', memberId: 'M1', netAmount: 40, items: [{ itemId: 'urea', amount: 40 }] }];
  const t = buildMemberTurnover({ sales, purchases: [], salesReturns, members, stockItems, accounts });
  ok(t.sales.totals.member === -40 && t.sales.totals.nonMember === 400, 'return memberId wins');
}

// 6. Unmatched member ids are counted and still classed as members; empty input is all zeros.
{
  const sales = [{ id: 's1', date: '2026-05-01', memberId: 'GONE', netAmount: 10, items: [{ itemId: 'urea', amount: 10 }] }];
  const t = buildMemberTurnover({ sales, purchases: [], members, stockItems, accounts });
  ok(t.unmatchedMemberBills === 1 && t.sales.totals.member === 10, 'unmatched member bill counted');
  const e = buildMemberTurnover({ sales: [], purchases: [], members, stockItems, accounts });
  ok(e.sales.rows.length === 0 && e.purchases.totals.total === 0 && memberSharePct(e.purchases.totals) === 0, 'empty → zeros');
}

console.log(`\nMember / non-member turnover (pure): ${pass} passed, ${fail} failed`);
process.exitCode = fail > 0 ? 1 : 0;
