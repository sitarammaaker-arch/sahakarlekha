// Global search ranking (ECR-25). Imports the REAL src/lib/globalSearch.ts via the '@/'
// loader — so this validates the actual code. (Was a self-contained mirror before.)
// Run: node scripts/test-global-search.mjs
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

const { matchScore, rankItems } = await import(abs('../src/lib/globalSearch.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. matchScore ordering: exact > prefix > word-start > substring > none.
ok(matchScore('cash', ['Cash']) === 100, 'exact = 100');
ok(matchScore('ca', ['Cash']) === 80, 'prefix = 80');
ok(matchScore('bank', ['Central Bank']) === 56, 'word-start (idx8): 60 − min(8,20)·0.5 = 56');
ok(matchScore('ash', ['Cash']) === 39.5, 'substring at idx1 = 40 − 0.5 = 39.5');
ok(matchScore('xyz', ['Cash']) === 0, 'no match = 0');
ok(matchScore('', ['Cash']) === 0, 'empty query = 0');

// 2. Category ordering: exact > prefix > word-start > substring > none.
ok(matchScore('cash', ['Cash']) > matchScore('ca', ['Cash']), 'exact > prefix');
ok(matchScore('ca', ['Cash']) > matchScore('bank', ['Central Bank']), 'prefix > word-start');
ok(matchScore('ledger', ['Sub Ledger']) > matchScore('ledger', ['xledgerx']), 'word-start outranks buried substring');

// 3. Multi-field: best field wins.
ok(matchScore('m001', ['Ram Kumar', 'M001', '9990001111']) === 100, 'best field (exact memberId) wins');
ok(matchScore('999', ['Ram', 'M001', '9990001111']) > 0, 'matches phone field');

// 4. rankItems: min length gate.
const accts = [
  { id: '3301', name: 'Cash' }, { id: '3302', name: 'Bank' },
  { id: '4101', name: 'Fertilizer Sales' }, { id: '4102', name: 'Cash Sales' },
];
ok(rankItems('c', accts, a => [a.name, a.id], 10).length === 0, 'single char → no results (min 2)');

// 5. rankItems: prefix "Cash" ranks above "Cash Sales" substring... both prefix vs word.
{
  const res = rankItems('cash', accts, a => [a.name, a.id], 10);
  ok(res[0].name === 'Cash', 'exact "Cash" ranks first');
  ok(res.some(r => r.name === 'Cash Sales'), '"Cash Sales" also matched');
  ok(res.length === 2, 'only the two Cash* accounts matched');
}

// 6. rankItems: limit + score ordering.
{
  const items = [
    { name: 'Sundry Debtors' }, { name: 'Debtor Ram' }, { name: 'Old Debtor' }, { name: 'Xdebtorx' },
  ];
  const res = rankItems('debtor', items, i => [i.name], 2);
  ok(res.length === 2, 'limit respected (2)');
  ok(res[0].name === 'Debtor Ram', 'prefix "Debtor Ram" ranks first');
}

// 7. rankItems: id-code search.
ok(rankItems('4101', accts, a => [a.name, a.id], 5)[0].id === '4101', 'search by account code');

console.log(`\nGlobal search (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
