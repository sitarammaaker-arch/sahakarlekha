// Edge-Function bundles must match their source.
//
// The Deno Edge Functions (scheduled-backup, backup-rehearsal, ai-ask, …) import COMMITTED
// esbuild artifacts in supabase/functions/_shared/*.mjs — not src/. Nothing rebuilds them
// automatically, so a change to src/ (a new registry entity, a new ledger param) silently
// leaves the deployed function on the old code. That happened: member_distribution_runs and
// loan_interest_accruals were added to the export registry but the backup bundle kept 96
// entities, so weekly server backups omitted both tables.
//
// This check rebuilds every bundle from source into a temp file (using the exact `build:*`
// script from package.json) and compares it with the committed file. Any difference fails.
//
//   node scripts/check-edge-bundles.mjs           # check only (CI) — never touches the tree
//   node scripts/check-edge-bundles.mjs --write   # rebuild + overwrite the committed bundles
//
// esbuild writes a `// <path>` comment for every bundled module, relative to the cwd. In a git
// worktree whose node_modules is a junction to the main checkout, that path becomes
// `../../../node_modules/…`; we normalise it to `node_modules/…` so the output is the same on
// every machine and in CI.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const scripts = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts;

const bundles = Object.entries(scripts)
  .filter(([k, v]) => k.startsWith('build:') && /esbuild .*supabase\/functions\/_shared\/.*--outfile=/.test(v))
  .map(([k, v]) => ({ name: k, cmd: v, out: v.match(/--outfile=(\S+)/)[1] }));

const normalise = (s) => s.replace(/\r\n/g, '\n').replace(/^\/\/ (?:\.\.\/)+node_modules\//gm, '// node_modules/');

const tmp = mkdtempSync(join(tmpdir(), 'edge-bundles-'));
const stale = [];
try {
  for (const b of bundles) {
    const tmpOut = join(tmp, b.out.replace(/[\\/]/g, '_'));
    execSync(b.cmd.replace(/--outfile=\S+/, `--outfile="${tmpOut}"`), { cwd: ROOT, stdio: 'pipe' });
    const fresh = normalise(readFileSync(tmpOut, 'utf8'));
    let committed = '';
    try { committed = normalise(readFileSync(join(ROOT, b.out), 'utf8')); } catch { /* missing = stale */ }
    if (fresh === committed) { console.log(`  ✓ ${b.out}`); continue; }
    if (WRITE) { writeFileSync(join(ROOT, b.out), fresh); console.log(`  ↻ ${b.out} (rebuilt)`); }
    else { stale.push(b); console.error(`  ✗ ${b.out} is STALE — run: npm run build:edge-bundles`); }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nEdge bundles: ${bundles.length - stale.length}/${bundles.length} up to date`);
if (stale.length) {
  console.error('A committed Edge-Function bundle does not match src/. Rebuild, commit, and redeploy the function(s) that import it.');
  process.exit(1);
}
