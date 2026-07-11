// Server backup-core bundle (D1 / EXP-12).
//
// The scheduled-backup Edge Function runs on Deno and must produce the EXACT `.slbak` the
// browser produces — else a server backup would fail the client's own verifier, the very
// failure the whole workstream exists to prevent. To guarantee that WITHOUT forking the
// code, the Edge Function imports an esbuild bundle of the real client backup libs.
//
// This test regenerates that bundle from source, builds an archive with it, and verifies the
// archive with the CLIENT verifier (src/lib/backup/verify.ts). If the bundle ever drifted
// from the source — or the source changed and the bundle was not rebuilt — this goes red.
// It runs in Node, which shares Deno's WebCrypto + fflate, so a green here is strong
// evidence the deployed function is format-correct (only the Deno DEPLOY itself is untested
// from this workspace).
//
// Run: node scripts/test-backup-core-bundle.mjs   (npm run test:backup-core-bundle)

import { register } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SRC = pathResolve(ROOT, 'src');
const BUNDLE = pathResolve(ROOT, 'supabase', 'functions', '_shared', 'backup-core.mjs');

// 1. Regenerate the bundle from source — so this test can never pass against a stale bundle.
try {
  execSync('npm run build:backup-core', { cwd: ROOT, stdio: 'pipe' });
} catch (e) {
  console.error('\nFAIL    Could not build the backup-core bundle.');
  console.error('        ' + String(e?.stderr ?? e?.message ?? e).split('\n').slice(0, 4).join('\n        '));
  process.exit(1);
}
if (!existsSync(BUNDLE)) {
  console.error('\nFAIL    The bundle was not produced at ' + BUNDLE);
  process.exit(1);
}

// 2. Loader for the SOURCE verifier (stubs @/lib/supabase, resolves extensionless TS).
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
      const SB = pathToFileURL(PR(SRC, 'lib', 'supabase.ts')).href;
      export async function resolve(spec, ctx, next) {
        if (spec === '@/lib/supabase') return { url: SB, shortCircuit: true };
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
      export async function load(u, c, n) { if (u === SB) return { format: 'module', shortCircuit: true, source: 'export const supabase = {};' }; return n(u, c); }
    `),
);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const core = await import(pathToFileURL(BUNDLE).href);
const { verifyArchive } = await import(pathToFileURL(pathResolve(SRC, 'lib', 'backup', 'verify.ts')).href);

ok(typeof core.buildArchive === 'function', 'the bundle exports buildArchive');
ok(Array.isArray(core.REGISTRY) && core.REGISTRY.length === 93, `the bundle carries the full registry (${core.REGISTRY?.length})`);

// 3. Build an archive with the BUNDLE, verify it with the SOURCE verifier.
const fetchRows = async (e) => ({
  rows: e.key === 'member' ? [{ memberId: 'M1', name: 'राजेश' }, { memberId: 'M2', name: 'सीता' }]
      : e.key === 'voucher' ? [{ voucherNo: 'V-1', amount: 1500 }]
      : e.key === 'account' ? [{ id: 'A1', name: 'Cash' }]
      : [],
  truncated: false, fetched: 0, error: null,
});
const meta = {
  appVersion: '3.0-supabase', schemaVersion: '93', societyId: 'SOC1', societyName: 'श्री कृष्ण सहकारी समिति',
  registrationNo: 'REG/1', financialYear: '2025-26', createdAt: '2026-07-11T00:00:00.000Z',
  createdBy: { name: 'scheduled-backup', email: null, role: 'system' }, trigger: 'scheduled', encryption: null,
};

const { archive, manifest } = await core.buildArchive({ entities: core.REGISTRY, societyId: 'SOC1', fetchRows, meta });
ok(archive instanceof Uint8Array && archive.length > 0, 'the bundle builds a non-empty archive');
ok(manifest.entities.some(e => e.key === 'member' && e.rowCount === 2), 'the member rows are written');

const report = await verifyArchive(archive, { entities: core.REGISTRY });
ok(report.ok === true, `THE ROUND TRIP: the client verifier ACCEPTS the bundle-built archive (problems: ${report.problems.length})`);
ok(report.problems.length === 0, report.problems.length === 0 ? 'with zero problems' : `problems: ${report.problems.slice(0, 3).join(' | ')}`);

// The registry fingerprint matches too — same entity set on both sides (this is why the
// Edge Function passes REGISTRY, not backupEntities()).
ok(report.fingerprintMatches === true, 'and the registry fingerprint MATCHES — the server build is indistinguishable from the client build');

console.log(`\nServer backup-core bundle: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
