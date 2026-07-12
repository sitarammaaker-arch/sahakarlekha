// Consent lifecycle & gated erasure (T-19 / ADR-0007; IRR-3; DPDP; AI-M2; API IE-6).
//
// Proves erasure-vs-retention is reconciled:
//   • erasure is BLOCKED by an active retention hold, an active binding basis, or active consent;
//   • erasure is ALLOWED only when none apply — then the identity is tombstoned but its ref (and
//     thus the financial history) survives (composing T-17);
//   • it is point-in-time (a hold that has lapsed no longer blocks);
//   • consentAllows gates PII sharing (an export/AI use redacts a non-consented identity).
//
// Run: node scripts/test-consent-erasure.mjs   (npm run test:consent-erasure)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

// consent.ts imports ./identity (relative, no ext) — resolve it.
import { register } from 'node:module';
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

let co, id;
try {
  co = await import(abs('../src/lib/identity/consent.ts'));
  id = await import(abs('../src/lib/identity/identity.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the consent/identity modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { authorizeErasure, eraseIfAuthorized, consentAllows } = co;
const { splitIdentity } = id;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const REF = 'id-abc';
const NOW = '2026-07-12T00:00:00Z';
const consent = (purpose, basis, status = 'active') => ({ identityRef: REF, purpose, basis, grantedAt: '2025-04-01', status });
const hold = (reason, until) => ({ identityRef: REF, reason, until });
const req = (consents, holds, asOf = NOW) => ({ identityRef: REF, consents, holds, asOf });

// A split identity (from T-17) to erase.
const { identity } = splitIdentity({ memberNo: 'M1', name: 'Rajesh', phone: '9999' }, REF);

// ── 1. ALLOWED — no holds, consent withdrawn, no binding basis ───────────────
const clean = authorizeErasure(req([consent('membership', 'consent', 'withdrawn')], []));
ok(clean.ok, 'erasure is allowed when consent is withdrawn and no hold/binding basis remains');
const done = eraseIfAuthorized(identity, req([consent('membership', 'consent', 'withdrawn')], []));
ok(done.erased && done.identity.status === 'tombstoned' && Object.keys(done.identity.attributes).length === 0,
  'the identity is tombstoned — PII erased');
ok(done.identity.identityRef === REF, 'but the identityRef survives — the financial history stays intact (erasure vs retention, IRR-3)');

// ── 2. BLOCKED by a statutory retention hold ─────────────────────────────────
const held = authorizeErasure(req([consent('kyc', 'consent', 'withdrawn')], [hold('financial_records', '2034-03-31')]));
ok(!held.ok && held.problems.some((p) => p.includes('retention hold')), 'an active retention hold blocks erasure (retention wins for its period)');
const heldOutcome = eraseIfAuthorized(identity, req([], [hold('financial_records', '2034-03-31')]));
ok(!heldOutcome.erased && heldOutcome.identity.status === 'active', 'and the identity is NOT erased while held');

// ── 3. BLOCKED by an active binding basis / active consent ───────────────────
ok(!authorizeErasure(req([consent('kyc', 'legal_obligation', 'active')], [])).ok, 'an active legal_obligation basis blocks erasure');
const stillConsented = authorizeErasure(req([consent('membership', 'consent', 'active')], []));
ok(!stillConsented.ok && stillConsented.problems.some((p) => p.includes('withdraw it')),
  'active consent blocks erasure — the member must withdraw it first');

// ── 4. POINT-IN-TIME — a lapsed hold no longer blocks ────────────────────────
const expiredHold = [hold('financial_records', '2020-03-31')];
ok(authorizeErasure(req([], expiredHold, NOW)).ok, 'a hold that has already lapsed does not block erasure');
ok(authorizeErasure(req([], [hold('litigation', '2026-01-01')], NOW)).ok, 'a hold whose date has passed no longer blocks');
ok(!authorizeErasure(req([], [hold('litigation', '2027-01-01')], '2026-07-12T00:00:00Z')).ok, 'a hold still in the future blocks');

// ── 5. consentAllows gates PII SHARING (export/AI) ───────────────────────────
ok(consentAllows(REF, [consent('communication', 'consent', 'active')], 'communication'), 'an active consent permits PII use for that purpose');
ok(!consentAllows(REF, [consent('communication', 'consent', 'withdrawn')], 'communication'), 'a withdrawn consent → PII is redacted (export honours consent, API IE-6)');
ok(!consentAllows(REF, [consent('membership', 'consent', 'active')], 'communication'), 'consent is purpose-limited — membership consent does not permit communication use');

// ── 6. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'identity', 'consent.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `consent.ts is pure & deterministic (no "${forbidden}")`);
}

console.log(`\nConsent lifecycle & gated erasure: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
