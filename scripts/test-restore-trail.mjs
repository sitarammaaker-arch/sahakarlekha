// Restore trail (T-34 / gap EXP-05).
//
// Every restore attempt — committed or refused — leaves a row. The value of the trail is
// almost entirely in the refused ones: a backup that failed to restore is the single most
// important thing this workstream can surface, and it is invisible unless written down.
//
// The trail is audit_log, not a new restore_runs table — the same deliberate deviation as
// export history (see lib/export/jobs.ts). These tests exercise the PURE shaper and reader
// only. audit_log is WORM: a row inserted by a test could never be removed, so the real
// recordRestoreAttempt is never run against the real table.
//
// Run: node scripts/test-restore-trail.mjs   (npm run test:restore-trail)

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

let trailMod;
try {
  trailMod = await import(abs('../src/lib/restore/trail.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the trail module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { toRestoreHistoryEntry, describeRestoreEntry, wasClean } = trailMod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// A full audit_log row as Supabase would return it for a committed restore.
const committedRow = {
  id: 'row-1',
  created_at: '2026-07-10T10:00:00Z',
  actor_name: 'राजेश',
  actor_role: 'admin',
  after: {
    sourceManifestHash: 'HASH-1',
    mode: 'replace',
    outcome: 'committed',
    replay: 'passed',
    disagreeingVouchers: 0,
    entitiesWritten: 84,
    rowsWritten: 5000,
    entriesReplayed: 1200,
    preRestoreBackup: { filename: 'pre.slbak', bytes: 2048, createdAt: '2026-07-10T09:59:00Z', manifestHash: 'BK' },
    message: null,
  },
};

// ── 1. THE SHAPER ────────────────────────────────────────────────────────────

const e = toRestoreHistoryEntry(committedRow);
ok(e.id === 'row-1' && e.at === '2026-07-10T10:00:00Z', 'id and timestamp are carried');
ok(e.actorName === 'राजेश' && e.actorRole === 'admin', 'the actor is carried, Devanagari intact');
ok(e.sourceManifestHash === 'HASH-1' && e.mode === 'replace' && e.outcome === 'committed', 'the core fields are read');
ok(e.replay === 'passed' && e.disagreeingVouchers === 0, 'the replay verdict is read');
ok(e.rowsWritten === 5000, 'the written count is read');
ok(e.preRestoreBackupFile === 'pre.slbak', 'the rollback target is surfaced (acceptance 2 — links to the backup)');

ok(wasClean('committed') === true, 'only "committed" is a clean success');
for (const bad of ['partial', 'audit-failed', 'replay-failed', 'blocked', 'fy-locked', 'no-backup', 'failed']) {
  ok(wasClean(bad) === false, `"${bad}" is NOT a clean success — a human must look`);
}

// ── 2. A REFUSED ATTEMPT still shapes cleanly ────────────────────────────────

const replayFailedRow = {
  id: 'row-2', created_at: '2026-07-09T00:00:00Z', actor_name: 'A', actor_role: 'admin',
  after: { sourceManifestHash: 'H2', mode: 'merge', outcome: 'replay-failed', replay: 'failed', disagreeingVouchers: 3, message: '3 vouchers did not reproduce' },
};
const rf = toRestoreHistoryEntry(replayFailedRow);
ok(rf.outcome === 'replay-failed' && rf.replay === 'failed' && rf.disagreeingVouchers === 3,
  'a failed-replay attempt is readable — this is the row an auditor is looking for');
ok(rf.preRestoreBackupFile === null, 'a refused attempt with no backup shows no rollback target');
ok(rf.message.includes('did not reproduce'), 'and carries its message');

// ── 3. DEFENSIVE against old / malformed rows ────────────────────────────────
//
// audit_log is WORM. A row written by a two-year-old build may predate a field. A history
// that throws on one is a history nobody can audit with.

const empty = toRestoreHistoryEntry({});
ok(empty.id === '' && empty.outcome === 'unknown' && empty.replay === 'not-run',
  'a row with no `after` shapes to safe defaults, not a throw');
ok(empty.disagreeingVouchers === 0 && empty.rowsWritten === 0 && empty.preRestoreBackupFile === null,
  'every numeric and reference field defaults safely');
ok(toRestoreHistoryEntry({ after: 'not an object' }).outcome === 'unknown', 'a non-object `after` does not throw');
ok(toRestoreHistoryEntry({ after: { replay: 'nonsense' } }).replay === 'not-run',
  'an unrecognised replay value falls back to not-run, never a false "passed"');

// ── 4. DESCRIPTION ───────────────────────────────────────────────────────────

ok(describeRestoreEntry(e, false).includes('committed') && describeRestoreEntry(e, false).includes('REPLACE'),
  'the one-line description names the mode and the outcome');
ok(describeRestoreEntry(rf, false).includes('did not reproduce'), 'a failed replay reads plainly in the list');
ok(describeRestoreEntry(rf, true).includes('मेल नहीं खाया'), 'and in Hindi (RULE 7)');
ok(describeRestoreEntry({ ...e, outcome: 'brand-new-status' }, false).includes('brand-new-status'),
  'an unknown outcome degrades to its raw name, never a crash');

// ── 5. NO SPECULATIVE TABLE, and the reason is written down ──────────────────

const src = readFileSync(pathResolve(SRC, 'lib', 'restore', 'trail.ts'), 'utf8');
ok(!/from\(['"]restore_runs['"]\)/.test(src), 'the trail does NOT read from a restore_runs table');
ok(/from\(['"]audit_log['"]\)/.test(src), 'it reads from audit_log — the existing WORM custody trail');
ok(src.includes("eq('society_id'"), 'the society_id filter — the only tenant isolation on audit_log — is present');
ok(src.includes("eq('action', 'restore')"), 'and it reads only restore events');
ok(src.includes('NEVER WRITE A TEST ROW'), 'the WORM hazard is documented for the next reader');
ok(src.includes('DELIBERATE DEVIATION'), 'and the missing table is a documented decision, not an omission');

console.log(`\nRestore trail: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
