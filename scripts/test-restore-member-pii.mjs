// Restore routes member PAN/Aadhaar to member_identity (Phase 3 prerequisite #4). A restore that put
// PII back into the readable members row after Phase 3 would undo the whole split — so this proves the
// routing, the legacy fallback for an un-migrated destination, and that a failure never half-writes.
// Run: node scripts/test-restore-member-pii.mjs   (npm run test:restore-member-pii)

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
        if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' };
        return next(url, ctx);
      }
    `),
);

const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let mod, reg;
try {
  mod = await import(abs('../src/lib/restore/rowWriter.ts'));
  reg = await import(abs('../src/lib/export/registry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the restore writer.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}


const { applyMemberWrites, deriveIdentityRows, stripMemberRows, planEntityWrites, makeRestoreWriter, RestoreWriteError } = mod;
const { getEntity } = reg;
const member = getEntity('member');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

function mockClient({ identityError = null } = {}) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      const rec = (op) => async (rows) => {
        calls.push({ op, table, rows });
        if (table === 'member_identity' && identityError) return { error: { message: identityError } };
        return { error: null };
      };
      return { insert: rec('insert'), upsert: rec('upsert'), delete() { return { eq() { return this; }, async in() { return { error: null }; }, async match() { return { error: null }; } }; } };
    },
  };
  return client;
}
const missingMsg = "Could not find the table 'public.member_identity' in the schema cache";

// ── pure helpers ──────────────────────────────────────────────────────────────
const m1 = { id: 'a', memberId: 'M1', name: 'A', aadhaar: '111122223333', pan: 'ABCDE1234F' };
const m2 = { id: 'b', memberId: 'M2', name: 'B', aadhaar: '', pan: 'ZZZZZ9999Z' };
const m3 = { id: 'c', memberId: 'M3', name: 'C' };
let d = deriveIdentityRows([m1, m2, m3], []);
ok(d.length === 2 && d[0].member_id === 'a' && d[1].aadhaar === null && d[1].pan === 'ZZZZZ9999Z', 'derives identity rows only for members with PII; empty -> null');
d = deriveIdentityRows([m1, m2], [{ member_id: 'a' }]);
ok(d.length === 1 && d[0].member_id === 'b', 'members the archive identity already covers are not re-derived (archive wins)');
ok(deriveIdentityRows([m3], []).length === 0 && deriveIdentityRows([{ memberId: 'x', pan: 'P' }], []).length === 0, 'no PII, or no id -> nothing derived');
const st = stripMemberRows([m1]);
ok(!('aadhaar' in st[0]) && !('pan' in st[0]) && st[0].name === 'A' && 'aadhaar' in m1, 'strip removes PII from a copy only');

// ── 1. old archive, SPLIT destination: identity first, then stripped members ──
let c = mockClient();
let plan = planEntityWrites(member, [m1, m2, m3], [], 'fresh');
let r = await applyMemberWrites(member, plan, c, 'SOC-A', []);
ok(c.calls[0].table === 'member_identity' && c.calls[0].op === 'upsert', 'identity is written BEFORE the members rows');
ok(c.calls[0].rows.length === 2 && c.calls[0].rows.every(x => x.society_id === 'SOC-A'), 'derived identity rows are society-stamped');
const memberCalls = c.calls.filter(x => x.table === 'members');
ok(memberCalls.length === 1 && memberCalls[0].rows.every(x => !('aadhaar' in x) && !('pan' in x)), 'members are written WITHOUT aadhaar/pan');
ok(memberCalls[0].rows.length === 3 && r.written === 3, 'all three members still written');

// ── 2. old archive, UN-MIGRATED destination: legacy fallback, nothing lost ──
c = mockClient({ identityError: missingMsg });
plan = planEntityWrites(member, [m1, m2, m3], [], 'fresh');
r = await applyMemberWrites(member, plan, c, 'SOC-A', []);
const legacy = c.calls.filter(x => x.table === 'members')[0];
ok(legacy.rows[0].aadhaar === '111122223333' && legacy.rows[1].pan === 'ZZZZZ9999Z', 'missing member_identity table: members written as archived (PII preserved)');
ok(r.written === 3, 'legacy fallback still writes every member');

// ── 3. any OTHER identity failure aborts BEFORE members are touched ──
c = mockClient({ identityError: 'permission denied' });
plan = planEntityWrites(member, [m1], [], 'fresh');
let err = null;
try { await applyMemberWrites(member, plan, c, 'SOC-A', []); } catch (e) { err = e; }
ok(err instanceof RestoreWriteError && /not written|NOT written/.test(err.message), 'a real identity failure aborts with a clear message');
ok(!c.calls.some(x => x.table === 'members'), 'and NO member row was written (no half-restore, no silent PII leak)');

// ── 4. newer archive (identity rows present): strip, no derived write ──
c = mockClient();
plan = planEntityWrites(member, [m1, m2], [], 'fresh');
await applyMemberWrites(member, plan, c, 'SOC-A', [{ member_id: 'a' }, { member_id: 'b' }]);
ok(!c.calls.some(x => x.table === 'member_identity'), 'archive already carries identity: nothing derived or written here');
ok(c.calls.filter(x => x.table === 'members')[0].rows.every(x => !('pan' in x) && !('aadhaar' in x)), 'its member rows are still stripped');

// ── 5. mixed: only the uncovered member is derived ──
c = mockClient();
plan = planEntityWrites(member, [m1, m2], [], 'fresh');
await applyMemberWrites(member, plan, c, 'SOC-A', [{ member_id: 'a' }]);
ok(c.calls[0].table === 'member_identity' && c.calls[0].rows.length === 1 && c.calls[0].rows[0].member_id === 'b', 'only the member the archive does not cover is derived');

// ── 6. no PII anywhere: untouched path ──
c = mockClient();
plan = planEntityWrites(member, [m3], [], 'fresh');
await applyMemberWrites(member, plan, c, 'SOC-A', []);
ok(c.calls.length === 1 && c.calls[0].table === 'members', 'members without PII: one plain write, no identity traffic');

// ── 7. merge mode: only the rows actually being inserted are considered ──
c = mockClient();
plan = planEntityWrites(member, [m1, m2], [{ memberId: 'M1', id: 'a' }], 'merge');   // M1 exists live, M2 is new
await applyMemberWrites(member, plan, c, 'SOC-A', []);
ok(c.calls[0].table === 'member_identity' && c.calls[0].rows.length === 1 && c.calls[0].rows[0].member_id === 'b', 'merge: identity derived only for the new member, the existing one is left alone');

// ── 8. wired through makeRestoreWriter; other entities unaffected ──
c = mockClient();
const writer = makeRestoreWriter(c, 'SOC-A', {}, { member_identity: [] });
await writer(member, [m1], 'fresh');
ok(c.calls[0].table === 'member_identity', 'makeRestoreWriter routes the member entity through applyMemberWrites');
c = mockClient();
const writer2 = makeRestoreWriter(c, 'SOC-A', {});
await writer2(getEntity('voucher'), [{ id: 'v1', voucherNo: 'V1' }], 'fresh');
ok(c.calls.length === 1 && c.calls[0].table === 'vouchers', 'a non-member entity is written exactly as before');

console.log(`\nRestore member PII routing: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
