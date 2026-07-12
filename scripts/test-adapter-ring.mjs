// Anti-corruption adapter ring (T-26 / API Constitution INT-1..7; INV-7).
//
// Proves the ring guarantees:
//   • inbound adapters validate untrusted input & translate to canonical; the core sees only
//     canonical (INT-1/API-P7);
//   • adapters fail CLOSED and ISOLATED — a partner error is contained as a Result, never thrown
//     into the core; a circuit breaker sheds a failing partner (INT-5);
//   • integrations are registered, scoped principals — entitled by a server source only (INT-2/3);
//   • none is silently active; a plugin can never exceed its tenant (INT-3/AUTH-3);
//   • egress is consent-, scope-, and jurisdiction-bound (INT-7/API-P6); rate-limited (INT-6).
//
// Run: node scripts/test-adapter-ring.mjs   (npm run test:adapter-ring)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let R, G;
try {
  R = await import(abs('../src/lib/api/adapterRing.ts'));
  G = await import(abs('../src/lib/api/integrationRegistry.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the adapter-ring modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { runInbound, runOutbound, newBreaker, canAttempt, recordOutcome, probe } = R;
const { registerIntegration, isIntegrationActive, authorizeEgress, withinRateLimit } = G;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. INBOUND boundary — validate untrusted → canonical (INT-1/API-P7) ──────
// A bank-statement adapter: external {amt: "50.00", dr: "D"} → canonical {minor: 5000, side: 'debit'}.
const bankAdapter = {
  name: 'bank-statement',
  validate: (ext) => (typeof ext.amt === 'string' && /^\d+\.\d{2}$/.test(ext.amt) ? [] : ['amt must be a 2dp string']),
  toCanonical: (ext) => ({ minor: Math.round(parseFloat(ext.amt) * 100), side: ext.dr === 'D' ? 'debit' : 'credit' }),
};
const good = runInbound(bankAdapter, { amt: '50.00', dr: 'D' });
ok(good.ok && good.value.minor === 5000 && good.value.side === 'debit', 'a valid external payload is translated to canonical');
const bad = runInbound(bankAdapter, { amt: 'fifty', dr: 'D' });
ok(!bad.ok && /rejected untrusted input/.test(bad.error), 'invalid untrusted input is rejected at the boundary (API-P7) — the core never sees it');

// ── 2. FAIL CLOSED & ISOLATED — a throwing adapter never crashes the core (INT-5)
const brokenAdapter = { name: 'flaky-partner', validate: () => [], toCanonical: () => { throw new Error('partner exploded'); } };
let result;
let threw = false;
try { result = runInbound(brokenAdapter, {}); } catch { threw = true; }
ok(!threw && result.ok === false && /adapter failure/.test(result.error),
  'a partner that throws is contained as a Result — runInbound NEVER throws into the core (INT-5)');
const outThrow = runOutbound({ name: 'x', toExternal: () => { throw new Error('boom'); } }, {});
ok(!outThrow.ok && /adapter failure/.test(outThrow.error), 'outbound failures are isolated too');

// ── 3. CIRCUIT BREAKER — sheds a failing partner (INT-5) ─────────────────────
let b = newBreaker(3);
ok(canAttempt(b), 'a fresh breaker is closed — calls allowed');
b = recordOutcome(b, false); b = recordOutcome(b, false);
ok(canAttempt(b) && b.failures === 2, 'below the threshold the breaker stays closed');
b = recordOutcome(b, false);
ok(!canAttempt(b) && b.status === 'open', 'at the failure threshold the breaker OPENS — calls are shed (fail closed)');
b = recordOutcome(b, true);
ok(b.status === 'open', 'a recorded outcome while OPEN is ignored (canAttempt gates it out)');
b = probe(b);
ok(b.status === 'half_open' && canAttempt(b), 'after cool-down the breaker is probed to half-open (a single trial allowed)');
ok(recordOutcome(b, true).status === 'closed', 'a successful trial closes the breaker');
ok(recordOutcome(b, false).status === 'open', 'a failed trial re-opens it');
ok(recordOutcome(newBreaker(3), true).failures === 0, 'a success resets the failure count');

// ── 4. REGISTRATION — a scoped, audited principal (INT-2) ─────────────────────
const base = { id: 'intg-1', owner: 'admin-1', tenantId: 'SOC-1', jurisdiction: 'Haryana', scopes: ['gst'], entitlement: 'plugin', rateLimitPerWindow: 100, enabled: true, consentedPurposes: ['tax_filing'] };
const reg = registerIntegration(base);
ok(reg.ok && reg.registration.tenantId === 'SOC-1' && reg.registration.scopes.length === 1, 'a complete registration is accepted & normalized');
ok(!registerIntegration({ ...base, owner: '' }).ok, 'a registration with no owner is rejected (audit)');
ok(!registerIntegration({ ...base, scopes: [] }).ok, 'a registration with no capability scope is rejected (least privilege)');
const selfGrant = registerIntegration({ ...base, entitlement: 'admin' });
ok(!selfGrant.ok && selfGrant.problems.some((p) => /server-controlled/.test(p)),
  'a client-writable entitlement source cannot light up an integration (INT-3)');

// ── 5. ACTIVATION — opted-in, entitled, within tenant (INT-3/AUTH-3) ─────────
const R1 = reg.registration;
ok(isIntegrationActive(R1, ['gst', 'tds']), 'an opted-in integration whose scopes are within the tenant entitlement is active');
ok(!isIntegrationActive({ ...R1, enabled: false }, ['gst', 'tds']), 'an opted-out integration is NOT active (none silently active)');
ok(!isIntegrationActive(R1, ['tds']), 'an integration whose scope exceeds the tenant entitlement is NOT active (a plugin cannot exceed its tenant)');

// ── 6. EGRESS DISCIPLINE (INT-7/API-P6) & RATE LIMIT (INT-6) ─────────────────
ok(authorizeEgress(R1, { purpose: 'tax_filing', requiredCapability: 'gst', destinationJurisdiction: 'Haryana' }).ok,
  'egress within consent + scope + jurisdiction is authorized');
ok(!authorizeEgress(R1, { purpose: 'marketing', requiredCapability: 'gst', destinationJurisdiction: 'Haryana' }).ok,
  'egress for a non-consented purpose is refused (INT-7/ADR-0007)');
ok(!authorizeEgress(R1, { purpose: 'tax_filing', requiredCapability: 'lending', destinationJurisdiction: 'Haryana' }).ok,
  'egress of a data class outside scope is refused (AUTH-3)');
ok(!authorizeEgress(R1, { purpose: 'tax_filing', requiredCapability: 'gst', destinationJurisdiction: 'Punjab' }).ok,
  'cross-jurisdiction egress is refused (API-P6)');
ok(!authorizeEgress({ ...R1, enabled: false }, { purpose: 'tax_filing', requiredCapability: 'gst', destinationJurisdiction: 'Haryana' }).ok,
  'a disabled integration cannot egress');
ok(withinRateLimit(R1, 99) && !withinRateLimit(R1, 100), 'calls beyond the rate limit are refused (INT-6)');

// ── 7. PURITY ────────────────────────────────────────────────────────────────
for (const [file, sub] of [['adapterRing.ts', 'adapterRing'], ['integrationRegistry.ts', 'integrationRegistry']]) {
  const code = readFileSync(pathResolve(SRC, 'lib', 'api', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
    ok(!code.includes(forbidden), `api/${sub} is pure & does no I/O (no "${forbidden}")`);
  }
}

console.log(`\nAnti-corruption adapter ring: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
