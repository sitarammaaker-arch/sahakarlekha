// Preservation — 3-2-1/LOCKSS + WORM + key escrow (T-36 / DP-P4, DP-P5, DP-P9; BK-3/4/5).
//
// Proves:
//   • 3-2-1 + LOCKSS placement — ≥3 copies, ≥2 providers, ≥1 off-provider+off-region, residency-
//     respecting; every deficiency reported (DP-P4);
//   • WORM — a sealed backup is write-once and tamper-evident (BK-4/DP-P5);
//   • key escrow — M-of-N recovery so a lost key never means lost data, no single custodian recovers
//     alone (BK-5/DP-P9).
//
// Run: node scripts/test-preservation.mjs   (npm run test:preservation)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// placement.ts imports './integrity' (relative, no ext) — resolve it.
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath } from 'node:url';
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
      for (const cand of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) {
        const u = new URL(cand, ctx.parentURL);
        if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true };
      }
    }
    return next(spec, ctx);
  }
`));

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let P, K;
try {
  P = await import(abs('../src/lib/backup/placement.ts'));
  K = await import(abs('../src/lib/backup/keyEscrow.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the preservation modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { evaluate321, sealObject, verifyWorm } = P;
const { establishEscrow, canRecover } = K;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. 3-2-1 + LOCKSS PLACEMENT (DP-P4) ──────────────────────────────────────
const good = [
  { provider: 'supabase', region: 'ap-south-1', jurisdiction: 'India' },   // primary
  { provider: 'r2',       region: 'ap-south-1', jurisdiction: 'India' },   // off-provider, same region
  { provider: 'b2',       region: 'ap-south-2', jurisdiction: 'India', offline: true }, // off-provider + off-region
];
const v = evaluate321(good, 'India');
ok(v.ok && v.copies === 3 && v.providers === 3 && v.offProviderOffRegion, 'a 3-copy, 3-provider, off-region placement satisfies 3-2-1 + LOCKSS');

const tooFew = evaluate321(good.slice(0, 2), 'India');
ok(!tooFew.ok && tooFew.deficiencies.some((d) => /≥3 copies/.test(d)), 'fewer than 3 copies is a deficiency');
const oneVendor = evaluate321([
  { provider: 'supabase', region: 'r1', jurisdiction: 'India' },
  { provider: 'supabase', region: 'r2', jurisdiction: 'India' },
  { provider: 'supabase', region: 'r3', jurisdiction: 'India' },
], 'India');
ok(!oneVendor.ok && oneVendor.deficiencies.some((d) => /≥2 providers/.test(d)), 'all copies with one vendor is a deficiency (organizational diversity)');
const sameRegionProviders = evaluate321([
  { provider: 'supabase', region: 'r1', jurisdiction: 'India' },
  { provider: 'r2', region: 'r1', jurisdiction: 'India' },
  { provider: 'b2', region: 'r1', jurisdiction: 'India' },
], 'India');
ok(!sameRegionProviders.ok && sameRegionProviders.deficiencies.some((d) => /off-region/.test(d)),
  'no off-provider+off-region copy is a deficiency (all in one region)');
const residency = evaluate321([
  { provider: 'supabase', region: 'ap-south-1', jurisdiction: 'India' },
  { provider: 'r2', region: 'ap-south-1', jurisdiction: 'India' },
  { provider: 'b2', region: 'us-east-1', jurisdiction: 'USA' },
], 'India');
ok(!residency.ok && residency.deficiencies.some((d) => /residency/.test(d)), 'a copy outside the tenant jurisdiction is a residency deficiency (ADR-0009)');

// ── 2. WORM — write-once + tamper-evident (BK-4/DP-P5) ───────────────────────
const sealed = new Map();
const s1 = sealObject(sealed, 'aip-2026-04', 'digest-abc', '2026-07-12T00:00:00Z');
ok(s1.ok && s1.object.digest === 'digest-abc', 'a new object seals write-once');
sealed.set('aip-2026-04', s1.object);
const s2 = sealObject(sealed, 'aip-2026-04', 'digest-xyz', '2026-07-12T01:00:00Z');
ok(!s2.ok && /write-once/.test(s2.reason), 'overwriting a sealed object is refused (WORM — ransomware/insider resistance)');
ok(!sealObject(sealed, '', 'd', 't').ok, 'a WORM object needs an id');
ok(verifyWorm(s1.object, 'digest-abc'), 'a matching fixity digest verifies the sealed object');
ok(!verifyWorm(s1.object, 'digest-tampered'), 'a mismatched digest fails — tampering/bit-rot is detectable (DP-P5)');

// ── 3. KEY ESCROW — M-of-N (BK-5/DP-P9) ──────────────────────────────────────
const shares = [
  { custodian: 'secretary', index: 1 },
  { custodian: 'president', index: 2 },
  { custodian: 'auditor', index: 3 },
  { custodian: 'federation', index: 4 },
];
const est = establishEscrow('key-2026', { threshold: 2, total: 4 }, shares);
ok(est.ok && est.record.policy.threshold === 2, 'a valid 2-of-4 escrow is established');
ok(!establishEscrow('key-x', { threshold: 5, total: 4 }, shares).ok, 'a threshold exceeding total is rejected');
ok(!establishEscrow('key-x', { threshold: 2, total: 4 }, [shares[0], shares[0], shares[1], shares[2]]).ok,
  'duplicate custodians are rejected (no single point of recovery)');
ok(!establishEscrow('', { threshold: 2, total: 4 }, shares).ok, 'a missing keyId is rejected');

const rec = est.record;
ok(canRecover(rec, ['secretary', 'auditor']), 'the key recovers from exactly the threshold of distinct custodians (a lost key never means lost data)');
ok(canRecover(rec, ['secretary', 'president', 'auditor']), 'more than the threshold also recovers');
ok(!canRecover(rec, ['secretary']), 'fewer than the threshold cannot recover (confidentiality — no single custodian)');
ok(!canRecover(rec, ['secretary', 'stranger']), 'an unknown custodian does not count toward the threshold');

// ── 4. PURITY ────────────────────────────────────────────────────────────────
for (const [file, sub] of [['placement.ts', 'placement'], ['keyEscrow.ts', 'keyEscrow']]) {
  const code = readFileSync(pathResolve(SRC, 'lib', 'backup', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
    ok(!code.includes(forbidden), `backup/${sub} is pure & does no I/O (no "${forbidden}")`);
  }
}

console.log(`\nPreservation — 3-2-1 + WORM + key escrow: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
