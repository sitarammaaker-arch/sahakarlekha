// Public domain API — trust plane + idempotency (T-24 / API Constitution Art. I–III, API-P9).
//
// Proves the contract-first authorization every principal (client, integration, agent) obeys:
//   • no cross-tenant reach, no cross-jurisdiction egress (AUTH-2 / API-P6);
//   • capability-scoped surface = principal scopes ∩ tenant entitlement — least privilege, a
//     principal can never exceed its tenant (AUTH-3);
//   • money/statutory finalization needs explicit human authority + SoD (API-P8 / AUTH-6);
//   • idempotency — retries replay, a reused key with a different request is a conflict (API-P9).
//
// Run: node scripts/test-api-principal.mjs   (npm run test:api-principal)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let P, I;
try {
  P = await import(abs('../src/lib/api/principal.ts'));
  I = await import(abs('../src/lib/api/idempotency.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the api modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { resolveEffectiveScope, authorizeRequest } = P;
const { checkIdempotency, recordIdempotency } = I;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// An integration principal, scoped to lending+gst, tenant SOC-1, jurisdiction Haryana.
const principal = { id: 'intg-9', kind: 'integration', scopes: ['lending', 'gst'], tenantId: 'SOC-1', jurisdiction: 'Haryana' };
const TENANT_ENTITLEMENT = ['lending', 'gst', 'tds', 'deposit_ledger']; // the society's full entitlement
const contract = (o) => ({ resource: 'x', action: 'read', requiredCapability: 'lending', ...o });
const req = ({ contract: c = {}, authorizerId, authorizerIsHuman } = {}) =>
  ({ contract: contract(c), tenantId: 'SOC-1', jurisdiction: 'Haryana', authorizerId, authorizerIsHuman });

// ── 1. LEAST PRIVILEGE — effective = principal scopes ∩ tenant entitlement ────
const eff = resolveEffectiveScope(principal, TENANT_ENTITLEMENT);
ok(JSON.stringify(eff) === JSON.stringify(['lending', 'gst']),
  'effective scope = principal scopes ∩ tenant entitlement (least privilege, AUTH-3)');
// A scope the principal claims but the TENANT is not entitled to is dropped.
const overreach = resolveEffectiveScope({ ...principal, scopes: ['lending', 'housing'] }, TENANT_ENTITLEMENT);
ok(!overreach.includes('housing'), 'a capability the tenant is not entitled to is dropped — a principal cannot exceed its tenant');

// ── 2. CAPABILITY-SCOPED SURFACE ─────────────────────────────────────────────
ok(authorizeRequest(principal, req({ contract: { requiredCapability: 'gst' } }), TENANT_ENTITLEMENT).ok,
  'a read whose required capability is in scope is authorized');
const outOfScope = authorizeRequest(principal, req({ contract: { requiredCapability: 'tds' } }), TENANT_ENTITLEMENT);
ok(!outOfScope.ok && /outside the principal's scope/.test(outOfScope.reason),
  'a capability the TENANT has but this principal was NOT granted is refused (no API backdoor, AUTH-3)');

// ── 3. TENANT & JURISDICTION SCOPE ───────────────────────────────────────────
const crossTenant = authorizeRequest(principal, { ...req({ contract: { requiredCapability: 'lending' } }), tenantId: 'SOC-2' }, TENANT_ENTITLEMENT);
ok(!crossTenant.ok && /cross-tenant/.test(crossTenant.reason), 'a cross-tenant request is refused (AUTH-2)');
const crossJx = authorizeRequest(principal, { ...req({ contract: { requiredCapability: 'lending' } }), jurisdiction: 'Punjab' }, TENANT_ENTITLEMENT);
ok(!crossJx.ok && /cross-jurisdiction/.test(crossJx.reason), 'a cross-jurisdiction request is refused (API-P6 residency)');

// ── 4. WRITE LAWS — money/finalization need human authority + SoD (API-P8) ────
// An ordinary write within scope is allowed (preparing an instruction is a proposal).
ok(authorizeRequest(principal, req({ contract: { action: 'write', requiredCapability: 'lending', effect: 'ordinary' } }), TENANT_ENTITLEMENT).ok,
  'an ordinary write within capability is authorized (prepare-only is a proposal)');
// A finalization write with NO human authorizer is refused — never autonomous.
const autoFinal = authorizeRequest(principal, req({ contract: { action: 'write', requiredCapability: 'lending', effect: 'finalization' } }), TENANT_ENTITLEMENT);
ok(!autoFinal.ok && /human authorization/.test(autoFinal.reason),
  'a finalization effect without a human authorizer is refused — money/statutory finalization is never autonomous (API-P8)');
// With a human authorizer independent of the principal → authorized.
const finalOk = authorizeRequest(principal, { ...req({ contract: { action: 'write', requiredCapability: 'lending', effect: 'finalization' } }), authorizerId: 'ceo-1', authorizerIsHuman: true }, TENANT_ENTITLEMENT);
ok(finalOk.ok, 'a finalization authorized by an independent human is allowed (on-behalf-of, AUTH-4)');
// SoD — the authorizer cannot be the acting principal itself.
const selfFinal = authorizeRequest(principal, { ...req({ contract: { action: 'write', requiredCapability: 'lending', effect: 'finalization' } }), authorizerId: 'intg-9', authorizerIsHuman: true }, TENANT_ENTITLEMENT);
ok(!selfFinal.ok && /separation of duties/.test(selfFinal.reason),
  'the preparer cannot authorize its own finalization (SoD, AUTH-6)');
// A non-human authorizer (another integration/agent) cannot finalize.
const agentFinal = authorizeRequest(principal, { ...req({ contract: { action: 'write', requiredCapability: 'lending', effect: 'finalization' } }), authorizerId: 'bot-2', authorizerIsHuman: false }, TENANT_ENTITLEMENT);
ok(!agentFinal.ok, 'a non-human authorizer cannot finalize a money/statutory effect (API-P8)');

// ── 5. IDEMPOTENCY (API-P9) ──────────────────────────────────────────────────
const seen = new Map();
ok(checkIdempotency('k1', 'fp-A', seen).status === 'new', 'an unseen key is new → proceed');
// record it, then a retry with the SAME request replays.
const rec = recordIdempotency('k1', 'fp-A', { voucherId: 'V1' });
seen.set('k1', rec);
const replay = checkIdempotency('k1', 'fp-A', seen);
ok(replay.status === 'replay' && replay.result.voucherId === 'V1',
  'a retry with the same key+request replays the recorded result — no double-post (exactly-once)');
// same key, DIFFERENT request → conflict.
const conflict = checkIdempotency('k1', 'fp-B', seen);
ok(conflict.status === 'conflict' && /different request/.test(conflict.reason),
  'a reused key with a different request is a conflict, never a second effect');
// a missing key on a mutating call is itself a conflict.
ok(checkIdempotency('', 'fp-A', seen).status === 'conflict', 'a mutating call with no idempotency key is refused (API-P9)');

// ── 6. PURITY ────────────────────────────────────────────────────────────────
for (const [file, sub] of [['principal.ts', 'principal'], ['idempotency.ts', 'idempotency']]) {
  const code = readFileSync(pathResolve(SRC, 'lib', 'api', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
    ok(!code.includes(forbidden), `api/${sub} is pure & does no I/O (no "${forbidden}")`);
  }
}

console.log(`\nPublic domain API — trust plane + idempotency: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
