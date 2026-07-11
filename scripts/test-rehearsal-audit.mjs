// Persisted restore-rehearsal evidence (T-35).
//
// The rehearsal PROOF is already tested (test-backup-rehearsal / -run / -health). This tests
// the PERSISTENCE half T-35 adds:
//   1. buildRehearsalAuditEvent — the append-only `rehearse` evidence row (audit_log), and
//      the privacy invariant that it carries STATUS + COUNTS only, never figures/ids/PII.
//   2. healthFromRehearsalRows — projecting the LATEST persisted evidence into a health
//      verdict, so the card survives reloads and can only go green on a fresh, passing,
//      RECORDED rehearsal (which is what lets the UI say "backup").
//
// Run: node scripts/test-rehearsal-audit.mjs   (npm run test:rehearsal-audit)

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

let audit, health;
try {
  audit = await import(abs('../src/lib/auditLog.ts'));
  health = await import(abs('../src/lib/backup/health.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { buildRehearsalAuditEvent } = audit;
const { healthFromRehearsalRows } = health;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const NOW = '2026-07-10T00:00:00Z';
const daysAgo = (n) => new Date(Date.parse(NOW) - n * 86400000).toISOString();
const CTX = { societyId: 'SOC001', actor: { name: 'A', email: 'a@x.in', role: 'admin' }, now: NOW };

const INPUT = {
  backupRef: 'hash123',
  backupCreatedAt: daysAgo(1),
  passed: true,
  sourceBalanced: true,
  entryCount: 42,
  stockItemCount: 3,
  mismatchAccounts: 0,
  mismatchItems: 0,
};

// ── 1. THE EVIDENCE ROW SHAPE ────────────────────────────────────────────────
const ev = buildRehearsalAuditEvent(INPUT, CTX);
ok(ev.action === 'rehearse', 'action is "rehearse"');
ok(ev.entity_type === 'backup', 'entity_type is "backup"');
ok(ev.entity_id === 'hash123', 'entity_id is the backup ref (manifest hash)');
ok(ev.created_at === NOW, 'created_at is the injected time (deterministic)');
ok(ev.after && ev.after.passed === true && ev.after.entryCount === 42, 'after carries the outcome (passed + counts)');
ok(ev.after.backupCreatedAt === INPUT.backupCreatedAt, 'after carries the backup freshness date');
ok(JSON.stringify(buildRehearsalAuditEvent(INPUT, CTX)) === JSON.stringify(ev), 'the event is deterministic');

// entity_id falls back to backupCreatedAt then 'unknown'
ok(buildRehearsalAuditEvent({ ...INPUT, backupRef: null }, CTX).entity_id === INPUT.backupCreatedAt, 'entity_id falls back to backupCreatedAt');
ok(buildRehearsalAuditEvent({ ...INPUT, backupRef: null, backupCreatedAt: null }, CTX).entity_id === 'unknown', 'and then to "unknown"');

// ── 2. PRIVACY (CL-6 / ADR-0007): STATUS + COUNTS ONLY, no figures/ids/PII ───
const afterKeys = Object.keys(ev.after).sort().join(',');
ok(afterKeys === 'backupCreatedAt,entryCount,mismatchAccounts,mismatchItems,passed,sourceBalanced,stockItemCount',
  'after holds EXACTLY the status+count fields — nothing else');
const blob = JSON.stringify(ev);
for (const leak of ['perAccount', 'perItem', 'totalDr', 'totalCr', 'accountId', 'memberId', 'amount', 'shareCapital']) {
  ok(!blob.includes(leak), `evidence carries no "${leak}" (no figures / per-record detail)`);
}

// ── 3. HEALTH PROJECTION — never green without a fresh, passing, RECORDED rehearsal ──
const row = (at, passed, backupCreatedAt) => ({ created_at: at, after: { passed, backupCreatedAt: backupCreatedAt ?? at } });

ok(healthFromRehearsalRows([], NOW).status !== 'green', 'no evidence ⇒ never green');
ok(healthFromRehearsalRows([], NOW).proven === false, 'no evidence ⇒ not proven');

const freshPass = healthFromRehearsalRows([row(daysAgo(1), true)], NOW);
ok(freshPass.status === 'green', 'a fresh, passing, recorded rehearsal ⇒ green');
ok(freshPass.proven === true, 'and is proven (this is what flips the UI to "backup")');

ok(healthFromRehearsalRows([row(daysAgo(1), false)], NOW).status === 'red', 'a recorded FAILED rehearsal ⇒ red');
ok(healthFromRehearsalRows([row(daysAgo(30), true)], NOW).proven === false, 'a stale passing rehearsal is not proven');
ok(healthFromRehearsalRows([row(daysAgo(30), true)], NOW).status === 'amber', 'and is amber, not green');

// ── 4. LATEST WINS + ROBUSTNESS ──────────────────────────────────────────────
const multi = [row(daysAgo(30), false), row(daysAgo(1), true), row(daysAgo(10), false)];
ok(healthFromRehearsalRows(multi, NOW).proven === true, 'the LATEST row decides (a fresh pass after older fails ⇒ proven)');

const withJunk = [{ created_at: null, after: { passed: true } }, { created_at: 'not-a-date', after: { passed: true } }, row(daysAgo(1), true)];
ok(healthFromRehearsalRows(withJunk, NOW).proven === true, 'rows with missing/unparseable dates are skipped, not fatal');
ok(healthFromRehearsalRows([{ created_at: daysAgo(1) }], NOW).status === 'red',
  'a row missing its outcome reads as not-passed (red), never silently green');

console.log(`\nRehearsal audit + persisted health: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
