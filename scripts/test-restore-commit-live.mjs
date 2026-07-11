// Live restore entry point (T-33 wiring / gap EXP-01).
//
// commitLive is the one place the restore commit meets the database. It is thin glue — every
// gate is the saga's or the writer's — but it is the glue for the most destructive operation
// in the product, so it is exercised end-to-end here: plan → write (mock client) → replay
// assertion → trail record, all against spies, with no session.
//
// Run: node scripts/test-restore-commit-live.mjs   (npm run test:restore-commit-live)

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

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

let liveMod, utilsMod;
try {
  liveMod = await import(abs('../src/lib/restore/commitLive.ts'));
  utilsMod = await import(abs('../src/lib/voucherUtils.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import commitLive.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { commitRestoreLive } = liveMod;
const { buildVoucherEntries } = utilsMod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// A balanced voucher, and the entries the posting rule produces — the archive's own entries.
const voucher = {
  id: 'V1', voucherNo: 'V-0001', isDeleted: false, amount: 0,   // voucherNo is the natural key
  lines: [
    { id: 'L1', accountId: '1101', type: 'Dr', amount: 1500 },
    { id: 'L2', accountId: '4101', type: 'Cr', amount: 1500 },
  ],
};
const archivedEntries = buildVoucherEntries(voucher, 'SOC1').map(e => ({ ...e, dr: e.dr.toFixed(2), cr: e.cr.toFixed(2) }));
const backup = { filename: 'pre.slbak', bytes: 1024, createdAt: '2026-07-10T00:00:00Z', manifestHash: 'BK' };

function mockClient() {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        async insert(rows) { calls.push({ op: 'insert', table, soc: rows[0]?.society_id, n: rows.length }); return { error: null }; },
        async upsert(rows) { calls.push({ op: 'upsert', table, soc: rows[0]?.society_id, n: rows.length }); return { error: null }; },
        delete() { const f = {}; const b = { eq(c, v) { f[c] = v; return b; }, async in(c, v) { calls.push({ op: 'delete', table, soc: f.society_id }); return { error: null }; }, async match() { calls.push({ op: 'delete', table, soc: f.society_id }); return { error: null }; } }; return b; },
      };
    },
  };
}

function baseInput(over = {}) {
  const recorded = [];
  const input = {
    mode: 'fresh',
    fyLocked: false,
    archiveRows: { voucher: [voucher], member: [{ memberId: 'M1', name: 'क' }] },
    currentRows: {},
    archivedEntries,
    societyId: 'SOC1',
    sourceManifestHash: 'HASH-1',
    preRestoreBackup: backup,
    auditContext: { societyId: 'SOC1', actor: { name: 'A' } },
    client: mockClient(),
    recordAttempt: async (r) => { recorded.push(r); },
    ...over,
  };
  return { input, recorded };
}

// ── 1. A COMMITTED RESTORE writes through the injected client ─────────────────

{
  const { input, recorded } = baseInput();
  const out = await commitRestoreLive(input);
  ok(out.status === 'committed', 'a gated restore commits');

  // The writer actually ran against the client, and every write is society-stamped.
  const writes = input.client.calls.filter(c => c.op === 'insert' || c.op === 'upsert');
  ok(writes.length > 0, 'the writer wrote through the injected client');
  ok(writes.every(c => c.soc === 'SOC1'), 'every write is stamped with the society');

  // voucher_entries is NEVER written — it is replayed.
  ok(!input.client.calls.some(c => c.table === 'voucher_entries'), 'voucher_entries are never written to the database');
  ok(input.client.calls.some(c => c.table === 'members'), 'the members table IS written');

  // Exactly one trail record, describing a committed restore with a passing replay.
  ok(recorded.length === 1 && recorded[0].outcome === 'committed' && recorded[0].replay === 'passed',
    'exactly one trail record, marking a committed restore with a passing replay');
  ok(recorded[0].sourceManifestHash === 'HASH-1', 'and it ties the attempt to the source archive');
}

// ── 2. THE GATES still hold through the live wiring ──────────────────────────

{
  // FY lock — writes nothing.
  const { input, recorded } = baseInput({ fyLocked: true });
  const out = await commitRestoreLive(input);
  ok(out.status === 'fy-locked', 'an FY-locked society is refused (RULE 6)');
  ok(input.client.calls.length === 0, 'and nothing is written');
  ok(recorded.length === 1 && recorded[0].outcome === 'fy-locked', 'but the refused attempt is still recorded');
}
{
  // No pre-restore backup on a Merge — the only undo is missing.
  const { input } = baseInput({ mode: 'merge', preRestoreBackup: undefined });
  const out = await commitRestoreLive(input);
  ok(out.status === 'no-backup', 'a Merge with no safety backup is refused');
  ok(input.client.calls.length === 0, 'and writes nothing');
}
{
  // A replay that does not reproduce the backup — nothing is written.
  const wrong = archivedEntries.map(e => (e.id === 'V1-L1' ? { ...e, cr: '1400.00' } : e));
  const { input } = baseInput({ archivedEntries: wrong });
  const out = await commitRestoreLive(input);
  ok(out.status === 'replay-failed', 'a failed replay assertion stops the restore');
  ok(input.client.calls.length === 0, 'and NOTHING is written');
}

// ── 3. A WRITE FAILURE becomes a partial restore ─────────────────────────────

{
  const failing = mockClient();
  failing.from = (table) => ({
    async insert() { return { error: { message: 'db down' } }; },
    async upsert() { return { error: { message: 'db down' } }; },
    delete() { const b = { eq() { return b; }, async in() { return { error: null }; }, async match() { return { error: null }; } }; return b; },
  });
  const { input, recorded } = baseInput({ client: failing });
  const out = await commitRestoreLive(input);
  ok(out.status === 'partial', 'a write failure yields a partial restore, not a clean success');
  ok(recorded.length === 1 && recorded[0].outcome === 'partial', 'and the partial state is recorded');
}

console.log(`\nRestore commit-live: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
