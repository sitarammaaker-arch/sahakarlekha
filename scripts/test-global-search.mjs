// Global search ranking (ECR-25) — mirrors src/lib/globalSearch.ts.
// Run: node scripts/test-global-search.mjs
function matchScore(query, fields) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return 0;
  let best = 0;
  for (const raw of fields) {
    const f = (raw || '').toLowerCase();
    if (!f) continue;
    const idx = f.indexOf(q);
    if (idx < 0) continue;
    let s;
    if (f === q) s = 100;
    else if (idx === 0) s = 80;
    else if (f[idx - 1] === ' ') s = 60;
    else s = 40;
    s -= Math.min(idx, 20) * 0.5;
    if (s > best) best = s;
  }
  return best;
}
function rankItems(query, items, getFields, limit, minLen = 2) {
  const q = (query || '').trim();
  if (q.length < minLen) return [];
  const scored = [];
  items.forEach((item, idx) => { const score = matchScore(q, getFields(item)); if (score > 0) scored.push({ item, score, idx }); });
  scored.sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
  return scored.slice(0, Math.max(0, limit)).map(r => r.item);
}

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
