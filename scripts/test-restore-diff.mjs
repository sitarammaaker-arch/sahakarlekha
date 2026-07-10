// Restore dry-run diff engine (T-31 / gap EXP-03).
//
// This is the last thing an operator reads before a restore writes anything. If it says
// "12 inserted" and the restore inserts 14, the dry run was theatre. So the tests here are
// about the cases where a diff engine lies quietly:
//
//   * a row with no natural key — inserted twice on the second run;
//   * two archived rows claiming the same key — one silently overwrites the other;
//   * `absent` vs `null` — reports a conflict on every row of every entity that grew a column;
//   * a soft-deleted row — silently resurrected, or silently forgotten;
//   * rows the DATABASE has and the archive does not — deleted by Replace, shown by nobody.
//
// Run: node scripts/test-restore-diff.mjs   (npm run test:restore-diff)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

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
        if (url === SUPABASE) {
          return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        }
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let diffMod, nkMod, dagMod, reg;
try {
  diffMod = await import(abs('../src/lib/restore/diff.ts'));
  nkMod = await import(abs('../src/lib/restore/naturalKeys.ts'));
  dagMod = await import(abs('../src/lib/restore/dag.ts'));
  reg = await import(abs('../src/lib/export/registry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the restore diff modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { diffRow, diffEntity, diffRestore, summarizeDiff } = diffMod;
const { keyOf, missingKeyFields, indexByNaturalKey, describeKey } = nkMod;
const { planRestore } = dagMod;
const { REGISTRY, getEntity } = reg;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

/** A synthetic entity with only the fields the diff reads. */
const ent = (naturalKey, extra = {}) => ({
  key: 'thing', table: 'things', naturalKey, ...extra,
});

// ── 1. NATURAL KEYS ──────────────────────────────────────────────────────────

const byId = ent(['id']);
ok(keyOf(byId, { id: 'a' }) === JSON.stringify(['a']), 'a single-column key encodes as a JSON array');
ok(keyOf(byId, { id: 7 }) === JSON.stringify(['7']), 'numbers stringify');
ok(keyOf(byId, { id: null }) === null, 'a null key component yields no key');
ok(keyOf(byId, {}) === null, 'an absent key component yields no key');
ok(keyOf(byId, { id: '' }) === null, 'an empty-string key component yields no key — it names nothing');
ok(keyOf(ent([]), { id: 'a' }) === null, 'an entity with no naturalKey can never be matched');

// A separator-joined key would collide here. A JSON array cannot.
const composite = ent(['a', 'b']);
ok(keyOf(composite, { a: 'x:y', b: 'z' }) !== keyOf(composite, { a: 'x', b: 'y:z' }),
  'composite keys do not collide across the separator — "x:y|z" vs "x|y:z"');
ok(keyOf(composite, { a: 'x', b: 'y' }) === keyOf(composite, { a: 'x', b: 'y' }), 'and are stable');

ok(keyOf(byId, { id: 'राजेश' }) === JSON.stringify(['राजेश']), 'Devanagari keys survive');
ok(keyOf(byId, { id: 'ABC ' }) !== keyOf(byId, { id: 'ABC' }),
  'keys are NOT trimmed — silently merging two rows a human kept apart is unrecoverable');

ok(missingKeyFields(composite, { a: 'x' }).join() === 'b', 'the missing key field is named');
ok(missingKeyFields(composite, { a: 'x', b: 'y' }).length === 0, 'a complete key reports nothing missing');

const idx = indexByNaturalKey(byId, [{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: null }, {}]);
ok(idx.byKey.size === 2, 'unique keys are indexed');
ok(idx.duplicates.length === 1 && describeKey(byId, idx.duplicates[0]) === 'a', 'the duplicate key is named once');
ok(idx.keyless.length === 2, 'both keyless rows are reported');
ok(idx.keyless[0].index === 3 && idx.keyless[0].missing[0] === 'id',
  'a keyless row is reported by POSITION, so a human can find the NDJSON line');

ok(describeKey(byId, keyOf(byId, { id: 'M-1' })) === 'M-1', 'a single key renders bare');
ok(describeKey(composite, keyOf(composite, { a: '1', b: '2' })) === 'a=1, b=2', 'a composite key names its fields');

// ── 2. ROW COMPARISON ────────────────────────────────────────────────────────

ok(diffRow({ a: 1 }, { a: 1 }).length === 0, 'identical rows do not differ');

// This is the one that would otherwise report a conflict on every row of every entity that
// ever gained a column: JSON drops `undefined`, so absent and null are the same fact.
ok(diffRow({ a: 1 }, { a: 1, note: null }).length === 0, 'a null column absent from the archive is NOT a difference');
ok(diffRow({ a: 1, note: null }, { a: 1 }).length === 0, 'and the reverse holds too');

ok(diffRow({ a: null }, { a: 0 }).length === 1, 'null and 0 are different');
ok(diffRow({ a: '1' }, { a: 1 })[0].archive === '"1"', 'a string 1 and a number 1 are visibly different');
ok(diffRow({ a: 1, b: 2 }, { a: 9, b: 8 }).map(f => f.field).join() === 'a,b', 'differing fields come out sorted');
ok(diffRow({ z: 1, a: 2 }, { z: 9, a: 8 }).map(f => f.field).join() === 'a,z', 'sorted regardless of key order');
ok(diffRow({ a: { x: 1 } }, { a: { x: 2 } }).length === 1, 'nested objects are compared');

// ── 3. ENTITY DIFF, PER MODE ─────────────────────────────────────────────────

const A = [{ id: '1', name: 'क' }, { id: '2', name: 'ख' }, { id: '3', name: 'ग' }];
const C = [{ id: '1', name: 'क' }, { id: '2', name: 'CHANGED' }, { id: '9', name: 'only in DB' }];

const merge = diffEntity(byId, A, C, 'merge');
ok(merge.insert === 1, 'a row only in the archive is inserted');
ok(merge.skip === 1, 'an identical row is skipped');
ok(merge.conflicts.length === 1, 'a differing row conflicts in Merge mode');
ok(merge.update === 0, 'Merge never updates without a decision');
ok(merge.orphan === 1, 'a row only in the database is an orphan');
ok(merge.conflicts[0].label === '2' && merge.conflicts[0].fields[0].field === 'name',
  'the conflict names the row and the field');
ok(merge.conflicts[0].fields[0].archive === '"ख"' && merge.conflicts[0].fields[0].current === '"CHANGED"',
  'and shows both sides');
ok(merge.blocked.length === 0, 'a clean merge is not blocked');

const replace = diffEntity(byId, A, C, 'replace');
ok(replace.update === 1 && replace.conflicts.length === 0,
  'Replace mode overwrites rather than asking — the archive is authoritative');
ok(replace.insert === 1 && replace.skip === 1, 'inserts and skips are unchanged by mode');
ok(replace.orphan === 1, 'Replace still reports the row it is about to DELETE');

const freshEmpty = diffEntity(byId, A, [], 'fresh');
ok(freshEmpty.insert === 3 && freshEmpty.blocked.length === 0, 'Fresh into an empty table inserts everything');
const freshDirty = diffEntity(byId, A, C, 'fresh');
ok(freshDirty.blocked.length === 1 && freshDirty.blocked[0].includes('3 row(s)'),
  'Fresh into a non-empty table is BLOCKED, not quietly downgraded to a Merge');

// A blocked entity still reports its numbers, so the operator sees the size of the refusal.
ok(freshDirty.insert === 1 && freshDirty.orphan === 1, 'a blocked entity still counts what it would have done');

// ── 4. THE BLOCKING CONDITIONS ───────────────────────────────────────────────

const keyless = diffEntity(byId, [{ id: 'a' }, { name: 'no key' }], [], 'merge');
ok(keyless.blocked.length === 1 && keyless.blocked[0].includes('row 2'),
  'a keyless ARCHIVE row blocks the entity, naming its 1-based position');
ok(keyless.blocked[0].includes('not recoverable'), 'and says why: inserting it twice cannot be undone');
ok(keyless.insert === 1, 'the keyed rows are still counted');

const dupArchive = diffEntity(byId, [{ id: 'a', v: 1 }, { id: 'a', v: 2 }], [], 'merge');
ok(dupArchive.blocked.length === 1 && dupArchive.blocked[0].includes('the archive has two rows'),
  'two archived rows with the same key block the entity — "last one wins" would be a coin flip');

const dupCurrent = diffEntity(byId, [{ id: 'a' }], [{ id: 'a' }, { id: 'a' }], 'merge');
ok(dupCurrent.blocked.some(b => b.includes('cannot tell which one to update')),
  'two DATABASE rows with the same key block the entity too');

// A keyless row already in the database does not block — the restore never touches it.
const keylessCurrent = diffEntity(byId, [{ id: 'a' }], [{ id: 'a' }, { name: 'junk' }], 'merge');
ok(keylessCurrent.blocked.length === 0, 'a keyless row already in the database does not block a restore');
ok(keylessCurrent.orphan === 1, 'but it is counted as an orphan — Replace would delete it');

// ── 5. SOFT DELETE (RULE 5) ──────────────────────────────────────────────────
//
// An archived row marked deleted is INSERTED, as deleted. Skipping it would quietly forget
// that a member was struck off; ignoring the flag would quietly resurrect them.

const softEnt = ent(['id'], { softDeleteField: 'isDeleted' });
const softInsert = diffEntity(softEnt, [{ id: 'x', isDeleted: true }], [], 'merge');
ok(softInsert.insert === 1, 'a soft-deleted archived row is inserted, not skipped — the deletion is part of the books');

const softConflict = diffEntity(softEnt, [{ id: 'x', isDeleted: true }], [{ id: 'x', isDeleted: false }], 'merge');
ok(softConflict.conflicts.length === 1 && softConflict.conflicts[0].fields[0].field === 'isDeleted',
  'a row deleted in the archive but live in the database is a conflict, not a silent resurrection');

// ── 6. THE WHOLE RESTORE ─────────────────────────────────────────────────────

const member = getEntity('member');
const voucher = getEntity('voucher');
ok(!!member && !!voucher, 'the real registry provides member and voucher');

const whole = diffRestore(
  [member, voucher],
  { member: [{ memberId: 'M-1', name: 'क' }] },              // voucher absent from the archive
  { voucher: [{ voucherNo: 'V-1' }] },
  'merge',
);
ok(whole.ok === true, 'a clean restore is ok');
ok(whole.totals.insert === 1 && whole.totals.orphan === 1, 'totals aggregate across entities');
ok(whole.entities[1].absentFromArchive === true, 'an entity missing from the archive is flagged, not assumed empty');
ok(whole.entities[1].insert === 0, 'and inserts nothing');

const blockedWhole = diffRestore([member], { member: [{ name: 'no id' }] }, {}, 'merge');
ok(blockedWhole.ok === false, 'one blocked entity fails the whole dry run');
ok(blockedWhole.problems[0].startsWith('member: '), 'and the problem is prefixed with its entity');

// The diff must never describe rows that will never be written. `voucher_entry` is not in
// the insert plan, so it must not reach the diff — the plan is the only legitimate input.
const plan = planRestore(REGISTRY);
ok(!plan.insert.some(e => e.key === 'voucher_entry'), 'the plan excludes voucher_entry (T-30)');
const empty = diffRestore(plan.insert, {}, {}, 'merge');
ok(empty.ok === true && empty.entities.length === 84, 'the full plan diffs against nothing without error');
ok(empty.totals.insert === 0 && empty.totals.orphan === 0, 'and proposes no writes');
ok(empty.entities.every(e => e.absentFromArchive), 'every entity is reported absent from an empty archive');
ok(!empty.entities.some(e => e.key === 'voucher_entry'), 'voucher_entry never appears in a diff');

// ── 7. SUMMARY ───────────────────────────────────────────────────────────────

ok(summarizeDiff(whole, false).includes('1 inserted'), 'the summary counts inserts');
ok(summarizeDiff(blockedWhole, false).includes('cannot run'), 'a blocked restore says so first');
ok(summarizeDiff(diffRestore([byId], { thing: A }, { thing: C }, 'merge'), false).includes('conflict'),
  'conflicts take precedence over counts in the summary');
const rep = diffRestore([byId], { thing: A }, { thing: C }, 'replace');
ok(summarizeDiff(rep, false).includes('1 deleted'), 'Replace mode SAYS how many rows it will delete');
ok(!summarizeDiff(diffRestore([byId], { thing: A }, { thing: C }, 'merge'), false).includes('deleted'),
  'Merge mode deletes nothing and says nothing about deleting');
ok(summarizeDiff(rep, true).includes('मिटाई'), 'and says it in Hindi (RULE 7)');

// ── 8. PURITY ────────────────────────────────────────────────────────────────

for (const file of ['diff.ts', 'naturalKeys.ts']) {
  const source = readFileSync(pathResolve(SRC, 'lib', 'restore', file), 'utf8');
  for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random', '.insert(', '.update(', '.delete(']) {
    ok(!source.includes(forbidden), `${file} is pure and read-only (found "${forbidden}")`);
  }
}

console.log(`\nRestore diff: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
