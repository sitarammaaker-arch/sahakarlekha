// Restore commit saga (T-33 / gap EXP-03).
//
// This is the one function that writes a whole society's books. There is no database
// transaction behind it, so the tests are about the ORDER of the gates and the fact that
// the first four write nothing:
//
//   * an FY-locked year writes nothing (RULE 6);
//   * a Replace/Merge without a pre-restore backup writes nothing — the backup is the ONLY
//     undo, because there is no transaction;
//   * a failed replay assertion writes nothing, and names the vouchers;
//   * voucher_entries are REPLAYED, never handed to the writer;
//   * a write that throws stops at that entity and reports how far it got — it does not
//     pretend to roll back, because it cannot;
//   * exactly one audit event, and it is awaited.
//
// applyWrites is a spy: it records the sequence of entities written, proving dependency
// order and proving what was NEVER written.
//
// Run: node scripts/test-restore-commit.mjs   (npm run test:restore-commit)

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

let commitMod, utilsMod, reg;
try {
  commitMod = await import(abs('../src/lib/restore/commit.ts'));
  utilsMod = await import(abs('../src/lib/voucherUtils.ts'));
  reg = await import(abs('../src/lib/export/registry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the commit saga.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { commitRestore, summarizeOutcome } = commitMod;
const { buildVoucherEntries } = utilsMod;
const { REGISTRY } = reg;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// A voucher and the entries the posting rule produces from it — the archive's own entries.
const voucher = {
  id: 'V1', isDeleted: false, amount: 0,
  lines: [
    { id: 'L1', accountId: '4101', type: 'Cr', amount: 1500 },
    { id: 'L2', accountId: '1101', type: 'Dr', amount: 1500 },
  ],
};
const archivedEntries = buildVoucherEntries(voucher, 'SOC1').map(e => ({ ...e, dr: e.dr.toFixed(2), cr: e.cr.toFixed(2) }));

const backup = { filename: 'pre.slbak', bytes: 1024, createdAt: '2026-07-10T00:00:00Z', manifestHash: 'abc' };

/** A spy writer that records the order of entities and can be told to throw. */
function spyWriter({ throwOn = null } = {}) {
  const order = [];
  const fn = async (entity, rows) => {
    if (entity.key === throwOn) throw new Error(`write to ${entity.table} failed`);
    order.push(entity.key);
    return { written: rows.length };
  };
  fn.order = order;
  return fn;
}

/** Sensible defaults; each test overrides what it is about. */
function baseInput(over = {}) {
  const audit = { calls: [] };
  const input = {
    entities: REGISTRY,
    mode: 'merge',
    fyLocked: false,
    archiveRows: { member: [{ memberId: 'M-1' }], voucher: [{ voucherNo: 'V1' }] },
    currentRows: {},
    vouchers: [voucher],
    archivedEntries,
    societyId: 'SOC1',
    preRestoreBackup: backup,
    applyWrites: spyWriter(),
    recordRestore: async (s) => { audit.calls.push(s); },
    ...over,
  };
  return { input, audit };
}

// ── 1. FY LOCK writes nothing (RULE 6) ───────────────────────────────────────

{
  const { input, audit } = baseInput({ fyLocked: true });
  const out = await commitRestore(input);
  ok(out.status === 'fy-locked', 'an audit-locked FY refuses the restore');
  ok(input.applyWrites.order.length === 0, 'and writes nothing');
  ok(audit.calls.length === 0, 'and records no audit event');
}

// ── 2. NO PRE-RESTORE BACKUP: the only undo is missing ───────────────────────

{
  const { input } = baseInput({ preRestoreBackup: undefined, mode: 'merge' });
  const out = await commitRestore(input);
  ok(out.status === 'no-backup', 'Merge without a verified backup is refused');
  ok(input.applyWrites.order.length === 0, 'and writes nothing — the backup is the only undo');
}
{
  const { input } = baseInput({ preRestoreBackup: undefined, mode: 'replace' });
  const out = await commitRestore(input);
  ok(out.status === 'no-backup', 'Replace without a verified backup is refused too');
}
{
  // Fresh targets an empty society: nothing to roll back to, so no backup is required.
  const { input } = baseInput({ preRestoreBackup: undefined, mode: 'fresh', currentRows: {} });
  const out = await commitRestore(input);
  ok(out.status === 'committed', 'Fresh into an empty society proceeds without a pre-restore backup');
}

// ── 3. THE DRY RUN GATE ──────────────────────────────────────────────────────

{
  // A keyless archive row blocks the diff (T-31). The saga must re-run the diff and stop.
  const { input } = baseInput({ archiveRows: { member: [{ name: 'no key' }] } });
  const out = await commitRestore(input);
  ok(out.status === 'blocked', 'a blocked dry run stops the restore');
  ok(input.applyWrites.order.length === 0, 'before any write');
}

// ── 4. THE REPLAY ASSERTION ──────────────────────────────────────────────────

{
  // The archive's entries say the Cr leg was 1400; the posting rule now produces 1500.
  const wrongEntries = archivedEntries.map(e => (e.id === 'V1-L1' ? { ...e, cr: '1400.00' } : e));
  const { input } = baseInput({ archivedEntries: wrongEntries });
  const out = await commitRestore(input);
  ok(out.status === 'replay-failed', 'a replay that does not reproduce the backup stops the restore');
  ok(out.verdict.vouchers.join() === 'V1', 'and names the disagreeing voucher');
  ok(input.applyWrites.order.length === 0, 'NOTHING is written when the replay fails');
}

// ── 5. THE HAPPY PATH, and the ORDER ─────────────────────────────────────────

{
  const { input, audit } = baseInput();
  const out = await commitRestore(input);
  ok(out.status === 'committed', 'a clean restore commits');
  ok(out.summary.entriesReplayed === 2, 'and reports the replayed entry count');

  const order = input.applyWrites.order;
  // voucher_entry is NEVER handed to the writer — it is replayed.
  //
  // The saga's `if (entity.key === VOUCHER_ENTRY_KEY) continue;` is defense in depth and is
  // UNREACHABLE through commitRestore: planRestore already excludes voucher_entry from the
  // insert plan, so the loop never sees it. Verified by sabotage — replacing that `continue`
  // with a `throw` leaves every test green and the throw never fires. So this assertion
  // proves the OUTCOME (voucher_entry is not written) without pretending to cover the guard.
  ok(!order.includes('voucher_entry'), 'voucher_entries are REPLAYED, never written from the archive');
  ok(order.includes('member') && order.includes('voucher'), 'the archive\'s entities are written');

  // Dependency order: society (if written) before its dependents; member before voucher
  // is not guaranteed by dependency, but nothing may precede its own declared parent.
  const pos = new Map(order.map((k, i) => [k, i]));
  const byKey = new Map(REGISTRY.map(e => [e.key, e]));
  let violations = [];
  for (const k of order) {
    for (const dep of byKey.get(k).dependsOn) {
      if (pos.has(dep) && pos.get(dep) > pos.get(k)) violations.push(`${k} before ${dep}`);
    }
  }
  ok(violations.length === 0, `writes are dependency-first (${violations.slice(0, 3).join('; ')})`);

  ok(audit.calls.length === 1, 'EXACTLY ONE audit event is written');
  ok(audit.calls[0].mode === 'merge' && audit.calls[0].entitiesWritten === order.length,
    'and it describes what was actually written');
}

// ── 6. A WRITE THAT THROWS: honest about partial state ───────────────────────

{
  const writer = spyWriter({ throwOn: 'voucher' });
  const { input, audit } = baseInput({ applyWrites: writer });
  const out = await commitRestore(input);
  ok(out.status === 'partial', 'a write failure yields a PARTIAL outcome, not a clean success');
  ok(out.entityKey === 'voucher', 'it names the entity that failed');
  ok(out.entitiesWritten === writer.order.length, 'and how many were written before it');
  ok(out.preRestoreBackup?.filename === 'pre.slbak',
    'it carries the backup to roll back to — the only undo there is');
  ok(audit.calls.length === 0, 'a partial restore does not write a "success" audit event');
  ok(summarizeOutcome(out, false).includes('roll back'), 'and the operator is told to roll back');
}

// ── 7. AUDIT FAILURE after the writes ────────────────────────────────────────

{
  const { input } = baseInput({ recordRestore: async () => { throw new Error('audit_log unreachable'); } });
  const out = await commitRestore(input);
  ok(out.status === 'audit-failed', 'a restore whose audit write fails is reported as audit-failed');
  ok(out.summary.entitiesWritten > 0, 'the writes DID happen — this is not a clean success and not a silent one');
  ok(input.applyWrites.order.length > 0, 'the rows are in the database; only the trail is missing');
}

// ── 8. SUMMARIES ─────────────────────────────────────────────────────────────

{
  const { input } = baseInput();
  const out = await commitRestore(input);
  ok(summarizeOutcome(out, false).includes('Restore complete'), 'a committed restore says so');
  ok(summarizeOutcome({ status: 'fy-locked' }, false).includes('RULE 6'), 'the FY-lock summary cites RULE 6');
  ok(summarizeOutcome({ status: 'replay-failed', verdict: { vouchers: ['V1', 'V2'] } }, false).includes('2 voucher'),
    'the replay-failure summary counts vouchers');
}

// ── 9. PURITY / STRUCTURE ────────────────────────────────────────────────────

// Comments are stripped first: the doc comment explaining the saga necessarily names the
// write calls it forbids (".insert(", "transaction"), and a check that cannot survive being
// described gets deleted the first time someone documents it. Same lesson as T-32.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const src = stripComments(readFileSync(pathResolve(SRC, 'lib', 'restore', 'commit.ts'), 'utf8'));
ok(src.includes('commitRestore') && src.length > 2000, 'the guard scans real code, not a blanked file');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random', '.insert(', '.upsert(', '.delete(']) {
  ok(!src.includes(forbidden), `commit.ts owns the order, not the writes (found "${forbidden}")`);
}
// The saga must not build entries itself — it replays through the shared rule.
ok(src.includes('replayEntries') && !/dr:\s*l\.type === 'Dr'/.test(src),
  'commit.ts replays through the shared posting rule, and does not reimplement it');

console.log(`\nRestore commit: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
