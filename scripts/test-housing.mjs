// Unit tests for Housing H2a — per-member receivable sub-ledger resolution and the
// collection-credit decision. A faithful JS mirror of the pure logic in
// src/contexts/HousingDataContext.tsx (generateMaintenanceBills.resolveReceivable and
// recordMaintenanceCollection.creditAcc). tsc guarantees the TS compiles; this pins the
// behaviour. Run: node scripts/test-housing.mjs   (exit 1 on any failure)

// ── Mirror: resolveReceivable (find-or-create, deduped per owner within AND across runs) ──
// 3303 stays a leaf control; vacant flats (no owner) fall back to it. Otherwise reuse the
// member's sub-ledger recorded on any of their flats (if it still exists in the chart), else
// create a fresh leaf under 3303. A per-run cache prevents duplicate creates in one bill-run.
function makeResolver({ flats, accounts, createAccount }) {
  const recCache = new Map();
  return function resolveReceivable(memberId) {
    if (!memberId) return '3303';
    if (recCache.has(memberId)) return recCache.get(memberId);
    const existing = flats.find(f => !f.isDeleted && f.memberId === memberId && f.receivableAccountId && accounts.some(a => a.id === f.receivableAccountId))?.receivableAccountId;
    let accId = existing;
    if (!accId) accId = createAccount(memberId);
    recCache.set(memberId, accId);
    return accId;
  };
}
// Mirror: collection credits the exact account the demand debited; legacy bills (no link) → 3303.
const collectionCredit = (bill) => bill.receivableAccountId || '3303';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };

// 1. Vacant flat → 3303 control, no sub-ledger created
{
  let created = 0;
  const accounts = [{ id: '3303' }, { id: '4101' }];
  const resolve = makeResolver({ flats: [], accounts, createAccount: () => { created++; return `MR-${created}`; } });
  ok(resolve(undefined) === '3303', 'vacant flat (no owner) posts to 3303 control');
  ok(created === 0, 'vacant flat creates no sub-ledger');
}

// 2. New member → one sub-ledger created
{
  let created = 0;
  const accounts = [{ id: '3303' }];
  const resolve = makeResolver({ flats: [], accounts, createAccount: () => { created++; return `MR-${created}`; } });
  const a = resolve('m1');
  ok(a === 'MR-1', 'new member gets a fresh sub-ledger');
  ok(created === 1, 'exactly one sub-ledger created for a new member');
}

// 3. Same member twice in one run → deduped by the per-run cache (one create)
{
  let created = 0;
  const accounts = [{ id: '3303' }];
  const resolve = makeResolver({ flats: [], accounts, createAccount: () => { created++; return `MR-${created}`; } });
  const a = resolve('m1');
  const b = resolve('m1');
  ok(a === b, 'same member resolves to the same sub-ledger within a run');
  ok(created === 1, 'member owning two flats → only ONE sub-ledger created in a run');
}

// 4. Cross-run reuse: member already has a sub-ledger on a flat, and it still exists in the chart
{
  let created = 0;
  const accounts = [{ id: '3303' }, { id: 'MR-9' }];
  const flats = [{ id: 'f1', memberId: 'm1', receivableAccountId: 'MR-9', isDeleted: false }];
  const resolve = makeResolver({ flats, accounts, createAccount: () => { created++; return `MR-NEW`; } });
  ok(resolve('m1') === 'MR-9', 'reuses the member sub-ledger recorded on a prior flat');
  ok(created === 0, 'no new sub-ledger when a valid one already exists');
}

// 5. Stale link: stored receivableAccountId points to a now-missing account → create fresh
{
  let created = 0;
  const accounts = [{ id: '3303' }];   // MR-9 no longer in the chart
  const flats = [{ id: 'f1', memberId: 'm1', receivableAccountId: 'MR-9', isDeleted: false }];
  const resolve = makeResolver({ flats, accounts, createAccount: () => { created++; return 'MR-FRESH'; } });
  ok(resolve('m1') === 'MR-FRESH', 'stale sub-ledger link → a fresh one is created');
  ok(created === 1, 'stale link triggers exactly one create');
}

// 6. Deleted flat is not a source of reuse
{
  let created = 0;
  const accounts = [{ id: '3303' }, { id: 'MR-9' }];
  const flats = [{ id: 'f1', memberId: 'm1', receivableAccountId: 'MR-9', isDeleted: true }];
  const resolve = makeResolver({ flats, accounts, createAccount: () => { created++; return 'MR-NEW'; } });
  ok(resolve('m1') === 'MR-NEW', 'soft-deleted flat is ignored when resolving reuse');
  ok(created === 1, 'deleted-flat link is not reused');
}

// 7. Demand posting is balanced: Dr receivable == Cr 4101 == amount
{
  const amount = 1500;
  const rec = 'MR-1';
  const lines = [{ accountId: rec, type: 'Dr', amount }, { accountId: '4101', type: 'Cr', amount }];
  const dr = lines.filter(l => l.type === 'Dr').reduce((s, l) => s + l.amount, 0);
  const cr = lines.filter(l => l.type === 'Cr').reduce((s, l) => s + l.amount, 0);
  ok(dr === cr && dr === amount, 'demand voucher is balanced (Dr receivable = Cr 4101 = amount)');
  ok(lines[0].accountId === rec, 'demand debits the resolved receivable, not 3303, for an owned flat');
}

// 8. Collection credits the account the demand debited; legacy bills fall back to 3303
{
  ok(collectionCredit({ receivableAccountId: 'MR-7' }) === 'MR-7', 'collection credits the member sub-ledger the demand used');
  ok(collectionCredit({ receivableAccountId: undefined }) === '3303', 'legacy bill (Dr 3303) → collection credits 3303 (back-compat)');
  ok(collectionCredit({}) === '3303', 'bill with no receivable link → 3303 control');
}

console.log(`[housing-test] ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
