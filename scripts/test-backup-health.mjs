// Backup Health (T-35 acceptance 3 / gap EXP-04).
//
// The one rule: NEVER GREEN ON MISSING DATA. A green light that means "we have not checked"
// is the most dangerous thing a health card can show. Green requires three positive, fresh
// facts: a recent backup, that it was verified, and that a rehearsal RESTORED it and the
// books matched. These tests exist to prove the card cannot be talked into green without a
// passing, fresh rehearsal.
//
// Run: node scripts/test-backup-health.mjs   (npm run test:backup-health)

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

let mod;
try {
  mod = await import(abs('../src/lib/backup/health.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the health module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { backupHealth, summarizeHealth, healthFromRehearsalRows } = mod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const NOW = '2026-07-10T00:00:00Z';
const daysAgo = (n) => new Date(Date.parse(NOW) - n * 86400000).toISOString();

// A placement that satisfies 3-2-1 / LOCKSS (the shape evaluate321 returns when ok).
const goodPlacement = { ok: true, copies: 3, providers: 2, offProviderOffRegion: true, deficiencies: [] };

// The only shape that earns green: recent backup, verified, rehearsal passed & recent, AND the
// copies placed safely (T-36 / DP-P4 — a single-vendor backup is one outage from total loss).
const healthy = {
  lastBackupAt: daysAgo(1),
  lastVerifyAt: daysAgo(1),
  lastRehearsal: { at: daysAgo(1), passed: true },
  now: NOW,
  placement: goodPlacement,
};

// ── 1. GREEN IS HARD TO EARN ─────────────────────────────────────────────────

ok(backupHealth(healthy).status === 'green', 'a fresh, verified, rehearsed backup is green');
ok(backupHealth(healthy).proven === true, 'and is marked proven');
ok(backupHealth(healthy).reasons.length === 0, 'with no outstanding reasons');

// ── 2. NEVER GREEN ON MISSING DATA — the whole point ─────────────────────────

ok(backupHealth({ ...healthy, lastRehearsal: null }).status !== 'green',
  'a backup that was NEVER rehearsed is never green — unproven is not safe');
ok(backupHealth({ ...healthy, lastRehearsal: null }).status === 'amber', 'it is amber (exists, but unproven)');
ok(backupHealth({ ...healthy, lastRehearsal: null }).proven === false, 'and is not proven');
ok(backupHealth({ ...healthy, lastRehearsal: null }).reasons.some(r => r.includes('never been rehearsed')),
  'and the reason names the missing rehearsal');

ok(backupHealth({ ...healthy, lastVerifyAt: null }).status !== 'green', 'an unverified backup is never green');
ok(backupHealth({ ...healthy, lastVerifyAt: null }).status === 'amber', 'it is amber');

// ── 3. RED — known-bad, worse than nothing ───────────────────────────────────

ok(backupHealth({ ...healthy, lastBackupAt: null, lastRehearsal: null }).status === 'red',
  'no backup ever taken is red');
ok(backupHealth({ ...healthy, lastBackupAt: null, lastRehearsal: null }).reasons[0].includes('no backup'),
  'and says so');

const failedRehearsal = backupHealth({ ...healthy, lastRehearsal: { at: daysAgo(1), passed: false } });
ok(failedRehearsal.status === 'red', 'a FAILED rehearsal is red — a known-bad backup is worse than no backup');
ok(failedRehearsal.reasons.some(r => r.includes('FAILED')), 'and the failure is named');

// A failed rehearsal that is ALSO stale is still red, not softened to amber.
const failedAndStale = backupHealth({ lastBackupAt: daysAgo(30), lastVerifyAt: daysAgo(30), lastRehearsal: { at: daysAgo(30), passed: false }, now: NOW });
ok(failedAndStale.status === 'red', 'red is the worst condition found — staleness does not soften a failed rehearsal');

// ── 4. AMBER — staleness ─────────────────────────────────────────────────────

const staleBackup = backupHealth({ ...healthy, lastBackupAt: daysAgo(30) });
ok(staleBackup.status === 'amber', 'a stale backup is amber');
ok(staleBackup.reasons.some(r => r.includes('30 days old')), 'and the age is named');
ok(staleBackup.backupAgeDays === 30, 'the backup age is computed from injected time, deterministically');

const staleRehearsal = backupHealth({ ...healthy, lastRehearsal: { at: daysAgo(30), passed: true } });
ok(staleRehearsal.status === 'amber', 'a passing but stale rehearsal is amber, not green');
ok(staleRehearsal.proven === false, 'a stale rehearsal does not count as proven');

// Freshness threshold is configurable (D6 default is weekly).
ok(backupHealth({ ...healthy, lastBackupAt: daysAgo(10), freshnessDays: 14 }).status === 'green',
  'a 10-day-old backup is still green under a 14-day freshness window');

// ── 5. DETERMINISM / EDGE ────────────────────────────────────────────────────

ok(backupHealth({ ...healthy, now: 'not-a-date' }).status === 'unknown', 'an unparseable now is unknown, never green');
ok(JSON.stringify(backupHealth(healthy)) === JSON.stringify(backupHealth(healthy)), 'the verdict is deterministic');

ok(summarizeHealth(backupHealth(healthy), false).includes('proven by rehearsal'), 'green says it was proven');
ok(summarizeHealth(failedRehearsal, false).includes('cannot be trusted'), 'red is blunt');
ok(summarizeHealth(backupHealth({ ...healthy, lastRehearsal: null }), true).includes('सिद्ध नहीं'),
  'amber, in Hindi, says "not yet proven" (RULE 7)');

// ── 6. PURITY ────────────────────────────────────────────────────────────────

const rawSource = readFileSync(pathResolve(SRC, 'lib', 'backup', 'health.ts'), 'utf8');
// Strip comments first: the header explains that it uses NO `new Date()` / `Date.now()`,
// which necessarily quotes them. Grep the code, not the prose (the T-32/T-33 lesson).
const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(source.includes('backupHealth') && source.length > 800, 'the purity scan sees real code, not a blanked file');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!source.includes(forbidden), `health.ts is pure and deterministic (found "${forbidden}")`);
}
ok(rawSource.includes('NEVER GREEN ON MISSING DATA'), 'the one rule is stated at the top of the file');

// ── PLACEMENT (T-36 / DP-P4) — a restorable backup is still not safe at one vendor ──────────────
{
  // No placement evaluated ⇒ missing data ⇒ never green (THE ONE RULE).
  const unevaluated = backupHealth({ ...healthy, placement: undefined });
  ok(unevaluated.status === 'amber', 'a perfect backup with an UNEVALUATED placement is amber, never green');
  ok(unevaluated.reasons.some((r) => /placement has never been evaluated/.test(r)), 'and says the placement was never evaluated');
  ok(backupHealth({ ...healthy, placement: null }).status === 'amber', 'placement: null is treated the same as absent');

  // The real situation today: one copy, one vendor.
  const singleVendor = {
    ok: false, copies: 1, providers: 1, offProviderOffRegion: false,
    deficiencies: ['needs ≥3 copies, has 1 (3-2-1)', 'needs ≥2 providers, has 1 (never all with one vendor)'],
  };
  const oneVendor = backupHealth({ ...healthy, placement: singleVendor });
  ok(oneVendor.status === 'amber', 'a fresh, verified, REHEARSED backup that lives at ONE vendor is amber — restorable is not the same as safe');
  ok(oneVendor.proven === true, 'it is still "proven" (the rehearsal did restore it) — placement is a separate fact');
  ok(oneVendor.reasons.some((r) => r.startsWith('placement: ') && /≥2 providers/.test(r)), 'every placement deficiency is surfaced verbatim');
  ok(oneVendor.reasons.length === singleVendor.deficiencies.length, 'only the placement reasons remain — nothing else is wrong');

  // Placement never makes it RED: the bytes do restore; they are merely not durable enough.
  ok(backupHealth({ ...healthy, placement: singleVendor }).status !== 'red', 'a placement shortfall is amber, never red');
  // …but a failed rehearsal still wins (red beats amber).
  ok(backupHealth({ ...healthy, placement: singleVendor, lastRehearsal: { at: daysAgo(1), passed: false } }).status === 'red',
    'a FAILED rehearsal still dominates a placement shortfall (worst condition wins)');

  // healthFromRehearsalRows passes the placement through.
  const rows = [{ created_at: daysAgo(1), after: { passed: true, backupCreatedAt: daysAgo(1) } }];
  ok(healthFromRehearsalRows(rows, NOW, 7, goodPlacement).status === 'green', 'healthFromRehearsalRows: a good placement earns green');
  ok(healthFromRehearsalRows(rows, NOW, 7).status === 'amber', 'healthFromRehearsalRows: no placement ⇒ amber (never green on missing data)');
}

console.log(`\nBackup health: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
