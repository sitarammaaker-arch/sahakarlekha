// Delegated auth root & dual-auth window (T-18 / ADR-0007; IRR-5; API-P8 SoD).
//
// Proves the migration off the self-managed credential store is SAFE:
//   • the delegated root is authoritative and tried first;
//   • the dual-auth window still accepts a legacy login BUT upgrades it to the delegated root;
//   • a retired legacy secret (and any legacy login after cutover) is REFUSED — a deprecated
//     root can never re-authenticate;
//   • access continuity holds — the migration never strands an account with no accepted root;
//   • SoD — an account cannot migrate/reset its own root.
//
// Run: node scripts/test-auth-root.mjs   (npm run test:auth-root)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let mod;
try {
  mod = await import(abs('../src/lib/auth/authRoot.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the authRoot module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { acceptedRoots, authenticate, hasAccess, planRetireLegacy, authorizeRootChange } = mod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const acct = (o) => ({ identityRef: 'id-1', hasDelegated: false, hasLegacy: false, legacyRetired: false, ...o });

// ── 1. DELEGATED is authoritative & tried first ──────────────────────────────
const both = acct({ hasDelegated: true, hasLegacy: true });
ok(JSON.stringify(acceptedRoots(both, 'dual_auth')) === JSON.stringify(['delegated', 'legacy']),
  'in the window both roots are accepted, delegated first (authoritative)');
ok(JSON.stringify(acceptedRoots(both, 'delegated_only')) === JSON.stringify(['delegated']),
  'after cutover only the delegated root is accepted');

// ── 2. Legacy-only account still authenticates in the window, and UPGRADES ────
const legacyOnly = acct({ hasLegacy: true });
const legLogin = authenticate(legacyOnly, 'dual_auth', 'legacy');
ok(legLogin.authenticated && legLogin.via === 'legacy' && legLogin.upgrade === true,
  'a legacy login in the window authenticates AND flags an upgrade to the delegated root (access continuity)');
const delLogin = authenticate(both, 'dual_auth', 'delegated');
ok(delLogin.authenticated && delLogin.via === 'delegated' && delLogin.upgrade === false,
  'a delegated login authenticates and never flags an upgrade');

// ── 3. Retired legacy / post-cutover legacy is REFUSED ───────────────────────
const migrated = acct({ hasDelegated: true, hasLegacy: false, legacyRetired: true });
const refusedRetired = authenticate(migrated, 'dual_auth', 'legacy');
ok(!refusedRetired.authenticated && /no longer accepted/.test(refusedRetired.reason),
  'a retired legacy secret is refused even inside the window — the deprecated root cannot re-authenticate');
ok(!authenticate(both, 'delegated_only', 'legacy').authenticated,
  'after cutover a legacy verification is refused regardless of the stored secret');
ok(!authenticate(legacyOnly, 'dual_auth', 'delegated').authenticated,
  'a delegated verification is refused when the account has no delegated root provisioned');
ok(!authenticate(both, 'dual_auth', null).authenticated,
  'no verified credential → not authenticated');

// ── 4. ACCESS CONTINUITY — never strand an account ───────────────────────────
ok(hasAccess(both, 'dual_auth') && hasAccess(migrated, 'delegated_only'),
  'an account with an accepted root has access');
ok(!hasAccess(legacyOnly, 'delegated_only'),
  'a legacy-only account has NO access after cutover — it MUST be migrated before the window closes');
// planRetireLegacy refuses to strand a legacy-only account...
const badRetire = planRetireLegacy(legacyOnly);
ok(!badRetire.ok && /stranded/.test(badRetire.problem),
  'retiring legacy before the delegated root exists is refused (would strand the account)');
// ...and succeeds once delegated is provisioned, leaving the account still reachable.
const goodRetire = planRetireLegacy(both);
ok(goodRetire.ok && goodRetire.next.legacyRetired === true && goodRetire.next.hasLegacy === false,
  'once the delegated root exists, legacy can be retired');
ok(hasAccess(goodRetire.next, 'delegated_only') && hasAccess(goodRetire.next, 'dual_auth'),
  'the retired account still has access via the delegated root — continuity preserved');

// The full safe migration order for a legacy account never loses access at any step:
let a = acct({ hasLegacy: true });
ok(hasAccess(a, 'dual_auth'), 'step 0: legacy account reachable in the window');
a = { ...a, hasDelegated: true };                       // provision delegated (upgrade)
ok(hasAccess(a, 'dual_auth') && hasAccess(a, 'delegated_only'), 'step 1: after provisioning delegated, reachable in both phases');
a = planRetireLegacy(a).next;                            // retire legacy
ok(hasAccess(a, 'delegated_only'), 'step 2: after retiring legacy, still reachable — migration never dropped access');

// ── 5. SoD — cannot change one's own root ────────────────────────────────────
ok(authorizeRootChange('admin-9', 'id-1'), 'an administrator may authorize a root change for another account');
ok(!authorizeRootChange('id-1', 'id-1'), 'an account cannot migrate/reset its OWN root (SoD, API-P8)');
ok(!authorizeRootChange('', 'id-1'), 'an empty actor cannot authorize a root change');

// ── 6. PURITY — no I/O, and CRUCIALLY no plaintext credential ────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'auth', 'authRoot.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random',
                         'password', 'secret', 'token', 'hash', 'bcrypt']) {
  ok(!code.includes(forbidden), `authRoot.ts is pure & handles no plaintext credential (no "${forbidden}")`);
}

console.log(`\nDelegated auth root & dual-auth window: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
