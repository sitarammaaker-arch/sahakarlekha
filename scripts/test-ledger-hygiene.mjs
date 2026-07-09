// Ledger Hygiene (ECR-28) — mirrors src/lib/ledgerHygiene.ts.
// Run: node scripts/test-ledger-hygiene.mjs
const DELETED_MARKERS = ['[Supplier deleted]', '[Customer deleted]', '[Department deleted]', '[Deleted]', '[हटाया'];
const ZERO = 0.005;
const norm = (s) => (s || '').trim().toLowerCase();
const hasDeletedMarker = (...names) => names.some(n => DELETED_MARKERS.some(m => (n || '').includes(m)));

function analyzeLedgerHygiene(accounts, usage) {
  const findings = [];
  const accountIds = new Set(accounts.map(a => a.id));
  const refCount = (id) => usage.voucherRefCount[id] || 0;
  const bal = (id) => Math.abs(usage.balance[id] || 0);
  const linked = (id) => usage.linkedParty[id];

  const dangling = Object.keys(usage.voucherRefCount).filter(id => refCount(id) > 0 && !accountIds.has(id))
    .map(id => ({ id, name: `[Deleted] ${id.slice(0, 8)}…`, detail: `${refCount(id)} voucher ref(s)` }));
  if (dangling.length) findings.push({ category: 'dangling-reference', severity: 'error', accounts: dangling });

  const removable = [], retained = [];
  for (const a of accounts) {
    if (!hasDeletedMarker(a.name, a.nameHi)) continue;
    if (refCount(a.id) === 0 && bal(a.id) < ZERO) removable.push({ id: a.id, name: a.name });
    else retained.push({ id: a.id, name: a.name, detail: refCount(a.id) > 0 ? `${refCount(a.id)} voucher ref(s)` : 'non-zero balance' });
  }
  if (removable.length) findings.push({ category: 'deleted-removable', severity: 'cleanup', accounts: removable });
  if (retained.length) findings.push({ category: 'deleted-retained', severity: 'info', accounts: retained });

  const unused = [];
  for (const a of accounts) {
    if (a.isGroup || a.isSystem) continue;
    if (hasDeletedMarker(a.name, a.nameHi)) continue;
    if (linked(a.id)) continue;
    const openingZero = Math.abs(a.openingBalance || 0) < ZERO;
    if (refCount(a.id) === 0 && bal(a.id) < ZERO && openingZero) unused.push({ id: a.id, name: a.name });
  }
  if (unused.length) findings.push({ category: 'unused-head', severity: 'warning', accounts: unused });

  const byName = new Map();
  for (const a of accounts) {
    if (hasDeletedMarker(a.name, a.nameHi)) continue;
    const key = norm(a.name); if (!key) continue;
    const g = byName.get(key); if (g) g.push(a); else byName.set(key, [a]);
  }
  const dupes = [];
  for (const group of byName.values()) if (group.length > 1) for (const a of group) dupes.push({ id: a.id, name: a.name, detail: `${group.length}× "${a.name}"` });
  if (dupes.length) findings.push({ category: 'duplicate-name', severity: 'warning', accounts: dupes });

  const parentIds = new Set(accounts.map(a => a.parentId).filter(Boolean));
  const emptyGroups = accounts.filter(a => a.isGroup && !parentIds.has(a.id)).map(a => ({ id: a.id, name: a.name }));
  if (emptyGroups.length) findings.push({ category: 'empty-group', severity: 'info', accounts: emptyGroups });

  const blanks = accounts.filter(a => !norm(a.name) || !norm(a.nameHi)).map(a => ({ id: a.id, name: a.name || a.nameHi || a.id, detail: 'missing name' }));
  if (blanks.length) findings.push({ category: 'blank-name', severity: 'warning', accounts: blanks });

  return findings;
}
const hygieneSummary = (findings) => {
  const bySev = (s) => findings.filter(f => f.severity === s).reduce((n, f) => n + f.accounts.length, 0);
  return { total: findings.reduce((n, f) => n + f.accounts.length, 0), errors: bySev('error'), warnings: bySev('warning'), cleanups: bySev('cleanup'), infos: bySev('info') };
};

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

console.log(`\nLedger hygiene (pure): ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
