// Server rehearsal-core bundle (T-35, server half).
//
// The scheduled-rehearsal Edge Function runs on Deno and must reach the EXACT SAME verdict
// the browser reaches — else a server "backup is healthy" claim could diverge from what a
// real restore would produce, the very failure T-35 exists to prevent. To guarantee that
// WITHOUT forking the code, the function imports an esbuild bundle of the real client proof
// (runRehearsal + loadArchive). This test regenerates that bundle, builds a real archive,
// and drives the bundled rehearsal through the pass / fail paths.
//
// It runs in Node, which shares Deno's WebCrypto + fflate, so green here is strong evidence
// the deployed function is correct (only the Deno DEPLOY itself is untested from here).
//
// Run: node scripts/test-rehearsal-core-bundle.mjs   (npm run test:rehearsal-core-bundle)

import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SHARED = pathResolve(ROOT, 'supabase', 'functions', '_shared');
const REH_BUNDLE = pathResolve(SHARED, 'rehearsal-core.mjs');
const BK_BUNDLE = pathResolve(SHARED, 'backup-core.mjs');

// 1. Regenerate both bundles from source — so this can never pass against a stale bundle.
//    rehearsal-core is the code under test; backup-core is used only to fabricate archives.
try {
  execSync('npm run build:rehearsal-core', { cwd: ROOT, stdio: 'pipe' });
  execSync('npm run build:backup-core', { cwd: ROOT, stdio: 'pipe' });
} catch (e) {
  console.error('\nFAIL    Could not build the bundles.');
  console.error('        ' + String(e?.stderr ?? e?.message ?? e).split('\n').slice(0, 4).join('\n        '));
  process.exit(1);
}
if (!existsSync(REH_BUNDLE)) {
  console.error('\nFAIL    The rehearsal-core bundle was not produced at ' + REH_BUNDLE);
  process.exit(1);
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const reh = await import(pathToFileURL(REH_BUNDLE).href);
const bk = await import(pathToFileURL(BK_BUNDLE).href);

ok(typeof reh.loadArchive === 'function', 'the bundle exports loadArchive');
ok(typeof reh.runRehearsal === 'function', 'the bundle exports runRehearsal');
ok(Array.isArray(reh.REGISTRY) && reh.REGISTRY.length > 0, `the bundle carries the registry (${reh.REGISTRY?.length})`);
ok(reh.REGISTRY.length === bk.REGISTRY.length, 'rehearsal-core and backup-core carry the same registry (no drift)');

// 2. Build a real archive: no vouchers (books trivially balance), one stock item whose one
//    purchase movement drives closing stock to 150. The rehearsal is decoupled from voucher
//    posting on purpose — the canonical stock formula alone proves match vs mismatch.
const rowsByKey = {
  stock_item: [{ id: 'I1', openingStock: 100 }],
  stock_movement: [{ itemId: 'I1', type: 'purchase', qty: 50 }], // closing 150
};
const fetchRows = (overrides = {}) => async (e) => ({
  rows: overrides[e.key] ?? rowsByKey[e.key] ?? [],
  truncated: false, fetched: 0, error: null,
});
const meta = {
  appVersion: '3.0-supabase', schemaVersion: String(reh.REGISTRY.length), societyId: 'SOC1',
  societyName: 'परख सहकारी समिति', registrationNo: 'REG/1', financialYear: '2025-26',
  createdAt: '2026-07-12T00:00:00.000Z', createdBy: { name: 'test', email: null, role: 'system' },
  trigger: 'scheduled', encryption: null,
};
const { archive } = await bk.buildArchive({ entities: reh.REGISTRY, societyId: 'SOC1', fetchRows: fetchRows(), meta });
ok(archive instanceof Uint8Array && archive.length > 0, 'a non-empty archive was built to rehearse');

const base = { bytes: archive, societyId: 'SOC1', entities: reh.REGISTRY, loadArchive: reh.loadArchive, backupCreatedAt: meta.createdAt };

// 3a. PASSED — the live books are identical to what the archive reconstructs.
const passed = await reh.runRehearsal({ ...base, fetchRows: fetchRows(), now: '2026-07-12T01:00:00.000Z' });
ok(passed.status === 'passed', `THE ROUND TRIP: identical live books ⇒ passed (got "${passed.status}")`);
ok(passed.status === 'passed' && passed.verdict.ok === true && passed.verdict.items.length === 0, 'the passing verdict names zero mismatched items');
ok(passed.status === 'passed' && passed.live.perItem.I1 === 150, `the canonical stock formula ran server-side (I1 = ${passed.status === 'passed' ? passed.live.perItem.I1 : '?'})`);

// 3b. FAILED — a single changed live movement (qty 40 ⇒ closing 140) must be caught, and the
//     item named. This is the discrimination the whole workstream turns on.
const failed = await reh.runRehearsal({ ...base, fetchRows: fetchRows({ stock_movement: [{ itemId: 'I1', type: 'purchase', qty: 40 }] }), now: '2026-07-12T01:00:00.000Z' });
ok(failed.status === 'failed', `a changed live movement ⇒ failed (got "${failed.status}")`);
ok(failed.status === 'failed' && failed.verdict.items.includes('I1'), 'the failing item I1 is named in the verdict');

console.log(`\nServer rehearsal-core bundle: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
