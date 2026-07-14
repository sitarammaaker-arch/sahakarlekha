// Export Contract v1 — storage↔contract mapping (T-04 / ADR-0004).
// Imports the REAL src/lib/export/contract.ts (type-only deps → loads via Node's native TS
// stripping, no '@/' loader needed). Proves DECOUPLING (wire keys ≠ storage keys) and LOSSLESS
// bidirectional round-trip, without touching the live writer/restore path. Mirror pattern per
// test-money.mjs. Run: node scripts/test-export-contract.mjs   (npm run test:export-contract)
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (p) => pathToFileURL(pathResolve(HERE, p)).href;

let C;
try {
  C = await import(abs('../src/lib/export/contract.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the contract module.\n', e);
  process.exit(1);
}
const { toContractRow, fromContractRow, contractShape, storageKey, EXPORT_CONTRACT_VERSION } = C;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error('  ✗', name); } };

// Order-insensitive deep-equal (round-trip identity is about VALUES, not key order).
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) { if (!Object.prototype.hasOwnProperty.call(b, k)) return false; if (!deepEqual(a[k], b[k])) return false; }
  return true;
}

// Synthetic entities — the mappers only read entity.columns[].{key, storageColumn}.
const identity = { key: 'x', columns: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] };
const mapped = { key: 'y', columns: [
  { key: 'memberId' },                            // identity
  { key: 'displayName', storageColumn: 'name' },  // contract key ≠ storage column
  { key: 'joinedOn', storageColumn: 'join_date' },
] };

// 1. Identity mapping: contract shape == row, round-trip exact.
{
  const row = { a: 1, b: 'हिंदी', c: null };
  const contract = toContractRow(identity, row);
  ok('identity: contract equals row', deepEqual(contract, row));
  ok('identity: round-trip reproduces row', deepEqual(fromContractRow(identity, contract), row));
}

// 2. Decoupling: contract keys are the CONTRACT keys, not storage columns; round-trips to storage.
{
  const storageRow = { memberId: 'M1', name: 'राम', join_date: '2026-01-01' };
  const contract = toContractRow(mapped, storageRow);
  ok('decoupled: contract uses contract keys', deepEqual(contract, { memberId: 'M1', displayName: 'राम', joinedOn: '2026-01-01' }));
  ok('decoupled: storage column names are NOT on the wire', !('name' in contract) && !('join_date' in contract));
  ok('decoupled: round-trip restores storage shape', deepEqual(fromContractRow(mapped, contract), storageRow));
}

// 3. Contract is a deliberate SELECTION: undeclared storage columns never cross the boundary.
{
  const row = { a: 1, b: 2, c: 3, secret_token: 'x', internal_id: 99 };
  ok('selection: undeclared columns dropped', deepEqual(toContractRow(identity, row), { a: 1, b: 2, c: 3 }));
}

// 4. Presence-exact: a declared column absent from the row is omitted, not emitted as undefined.
{
  const contract = toContractRow(identity, { a: 1 });
  ok('presence: absent columns omitted (not undefined)', deepEqual(Object.keys(contract), ['a']));
  ok('presence: round-trip preserves absence', deepEqual(fromContractRow(identity, contract), { a: 1 }));
}

// 5. Value fidelity: falsy, null, nested objects/arrays, Devanagari all survive the round-trip.
{
  const row = { a: 0, b: false, c: { lines: [{ n: 1 }, { n: 2 }], note: 'ठीक' } };
  ok('fidelity: falsy + null + nested preserved', deepEqual(fromContractRow(identity, toContractRow(identity, row)), row));
}

// 6. contractShape = the ordered contract keys (the wire shape).
ok('contractShape returns ordered contract keys', deepEqual([...contractShape(mapped)], ['memberId', 'displayName', 'joinedOn']));

// 7. storageKey helper.
ok('storageKey: identity when no override', storageKey({ key: 'a' }) === 'a');
ok('storageKey: override wins', storageKey({ key: 'a', storageColumn: 'db_a' }) === 'db_a');

// 8. Contract carries its own version.
ok('EXPORT_CONTRACT_VERSION is a non-empty string', typeof EXPORT_CONTRACT_VERSION === 'string' && EXPORT_CONTRACT_VERSION.length > 0);

console.log(`\nExport contract v1 (storage↔contract mapping): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
