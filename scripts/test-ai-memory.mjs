// Tenant-isolated, consent-bound AI memory + kill switch (T-31 / AI Constitution Art. V, AI-G4).
//
// Proves:
//   • tenant isolation is absolute — no cross-tenant leakage (AI-M1);
//   • PII enters memory only under an active consent for its purpose; pseudonymous preferred (AI-M2/3);
//   • right-to-erasure purges AI memory of an individual, losing no books (AI-M2/M6);
//   • the kill switch disables AI instantly at global/society/feature level (AI-G4).
//
// Run: node scripts/test-ai-memory.mjs   (npm run test:ai-memory)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// memory.ts imports '../identity/consent' → './identity' (relative, no ext) — resolve them.
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

let M, K;
try {
  M = await import(abs('../src/lib/ai/memory.ts'));
  K = await import(abs('../src/lib/ai/killSwitch.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the ai memory/killSwitch modules.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { admitToMemory, readMemory, crossTenantLeak, purgeIdentity } = M;
const { isAiEnabled, killAllAi, killSocietyAi, killFeatureAi } = K;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const consent = (ref, purpose, status = 'active') => ({ identityRef: ref, purpose, basis: 'consent', grantedAt: '2025-04-01', status });

// ── 1. CONSENT-BOUND ADMISSION (AI-M2/M3) ────────────────────────────────────
const consents = [consent('id-1', 'assistance')];
ok(admitToMemory({ id: 'm1', tenantId: 'SOC-1', scope: 'durable', purpose: 'assistance', identityRef: 'id-1', containsPii: true, content: {} }, consents).ok,
  'a PII entry with an active consent for its purpose is admitted');
ok(!admitToMemory({ id: 'm2', tenantId: 'SOC-1', scope: 'durable', purpose: 'marketing', identityRef: 'id-1', containsPii: true, content: {} }, consents).ok,
  'a PII entry for a NON-consented purpose is refused (AI-M2)');
ok(!admitToMemory({ id: 'm3', tenantId: 'SOC-1', scope: 'durable', purpose: 'assistance', identityRef: 'id-1', containsPii: true, content: {} }, [consent('id-1', 'assistance', 'withdrawn')]).ok,
  'a withdrawn consent refuses admission');
ok(!admitToMemory({ id: 'm4', tenantId: 'SOC-1', scope: 'durable', purpose: 'assistance', containsPii: true, content: {} }, consents).ok,
  'a PII entry with no identityRef cannot be consent-checked → refused (AI-M3)');
ok(admitToMemory({ id: 'm5', tenantId: 'SOC-1', scope: 'ephemeral', purpose: 'assistance', identityRef: 'id-1', content: {} }, []).ok,
  'a pseudonymous (non-PII) entry is admitted without further consent (minimization preferred)');

// ── 2. TENANT ISOLATION (AI-M1) ──────────────────────────────────────────────
const store = [
  { id: 'a', tenantId: 'SOC-1', scope: 'durable', purpose: 'p', identityRef: 'id-1', content: {} },
  { id: 'b', tenantId: 'SOC-1', scope: 'ephemeral', purpose: 'p', identityRef: 'id-2', content: {} },
  { id: 'c', tenantId: 'SOC-2', scope: 'durable', purpose: 'p', identityRef: 'id-9', content: {} },
];
const mine = readMemory(store, 'SOC-1');
ok(mine.length === 2 && mine.every((e) => e.tenantId === 'SOC-1'), 'readMemory returns only the tenant’s own entries');
ok(!mine.some((e) => e.tenantId === 'SOC-2'), 'no cross-tenant entry is ever visible (AI-M1)');
ok(crossTenantLeak(store.filter((e) => e.tenantId === 'SOC-1'), 'SOC-1').length === 0, 'a properly per-tenant store has no leak');
ok(crossTenantLeak(store, 'SOC-1').length === 1, 'the leak guard flags a foreign-tenant entry as a defect');

// ── 3. RIGHT-TO-ERASURE (AI-M2/M6) ───────────────────────────────────────────
const purged = purgeIdentity(store, 'id-1');
ok(purged.length === 2 && !purged.some((e) => e.identityRef === 'id-1'), 'purging an identity removes every entry referencing it');
ok(purged.some((e) => e.identityRef === 'id-2') && purged.some((e) => e.identityRef === 'id-9'),
  'other subjects’ memory is untouched — and no books are lost (memory is not a system of record, AI-M6)');

// ── 4. KILL SWITCH (AI-G4) ───────────────────────────────────────────────────
const flags = { globalEnabled: true };
ok(isAiEnabled(flags, 'SOC-1', 'assistant'), 'with nothing killed, AI is enabled');
ok(!isAiEnabled(killAllAi(flags), 'SOC-1', 'assistant'), 'the global kill disables all AI everywhere, instantly');
const soc = killSocietyAi(flags, 'SOC-1');
ok(!isAiEnabled(soc, 'SOC-1', 'assistant') && isAiEnabled(soc, 'SOC-2', 'assistant'), 'a per-society kill disables only that society');
const feat = killFeatureAi(flags, 'assistant');
ok(!isAiEnabled(feat, 'SOC-1', 'assistant') && isAiEnabled(feat, 'SOC-1', 'search'), 'a per-feature kill disables only that feature');
// precedence: a global kill overrides a per-society/feature enable state.
ok(!isAiEnabled({ globalEnabled: false, societyEnabled: { 'SOC-1': true } }, 'SOC-1', 'assistant'),
  'the global kill overrides everything (precedence)');
ok(isAiEnabled({ globalEnabled: true, societyEnabled: {} }, 'SOC-9', 'x'), 'an absent society entry means "not killed", not "off"');

// ── 5. PURITY ────────────────────────────────────────────────────────────────
for (const [file, sub] of [['memory.ts', 'memory'], ['killSwitch.ts', 'killSwitch']]) {
  const code = readFileSync(pathResolve(SRC, 'lib', 'ai', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
    ok(!code.includes(forbidden), `ai/${sub} is pure & does no I/O (no "${forbidden}")`);
  }
}

console.log(`\nAI memory isolation + kill switch: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
