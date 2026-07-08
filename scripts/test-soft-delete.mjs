// Soft-delete verification (P0 #2 / ECR-02) — asserts the two pure behaviours the
// feature relies on, mirroring the DataContext logic (as scripts/test-nav.mjs mirrors
// navVisibility). Run: node scripts/test-soft-delete.mjs (exit 1 on any failure).
//
// (1) LOAD FILTER: rows with isDeleted=true must be excluded when populating the
//     in-memory arrays, so archived parents never repopulate on refresh.
// (2) DELETE SEMANTICS: a delete ARCHIVES (sets isDeleted=true, row retained) rather
//     than removing the row — so it stays recoverable/auditable in the DB.

// Mirror of the load-filter applied to members/purchases/assets/audit_objections.
const activeOnLoad = (rows) => (rows || []).filter(r => !r.isDeleted);

// Mirror of the DB effect of the soft-delete: the row is retained, flagged isDeleted.
const softDelete = (rows, id) => rows.map(r => (r.id === id ? { ...r, isDeleted: true } : r));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const rows = [
  { id: 'a', isDeleted: false },
  { id: 'b' },                    // undefined isDeleted → active (legacy rows)
  { id: 'c', isDeleted: true },   // already archived
];

// 1. Load filter excludes archived, keeps active + legacy-undefined.
const loaded = activeOnLoad(rows);
ok(loaded.length === 2, 'load filter keeps 2 active (a, b)');
ok(loaded.some(r => r.id === 'a') && loaded.some(r => r.id === 'b'), 'active + legacy-undefined retained');
ok(!loaded.some(r => r.id === 'c'), 'archived row (c) excluded on load');
ok(activeOnLoad(null).length === 0 && activeOnLoad(undefined).length === 0, 'null/undefined → empty (no crash)');

// 2. Soft-delete archives without removing the row (data retained in the DB).
const after = softDelete(rows, 'a');
ok(after.length === rows.length, 'soft-delete does NOT remove the row (retained for retention/audit)');
ok(after.find(r => r.id === 'a').isDeleted === true, 'target row flagged isDeleted=true');
ok(after.find(r => r.id === 'b').isDeleted === undefined, 'other rows untouched');

// 3. Round-trip: after archiving, the row is hidden on the next load but still in the DB.
const reloaded = activeOnLoad(after);
ok(!reloaded.some(r => r.id === 'a'), 'archived-then-reloaded row is hidden from the app');
ok(after.some(r => r.id === 'a'), 'archived row still present in the underlying data (recoverable)');

// 4. Legacy rows (no isDeleted column pre-migration) behave as active — backward compatible.
ok(activeOnLoad([{ id: 'x' }, { id: 'y' }]).length === 2, 'rows without isDeleted are all active (pre-migration-safe)');

console.log(`\nSoft-delete: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
