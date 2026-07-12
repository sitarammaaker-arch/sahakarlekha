// AI as a scoped principal on the trust plane (T-29 / AI Constitution AI-P2; AI-N4; RULE 6).
//
// Proves the AI is a principal, never an authority:
//   • its usable scope = agent grants ∩ the acting human's scopes ∩ the tenant entitlement — it
//     inherits AT MOST the human's permissions and cannot self-elevate (AI-P2);
//   • every action names the agent AND the human it served (on-behalf-of recorded, AI-A2);
//   • it can never act on FY/period-locked data (AI-N4/RULE 6);
//   • it can never finalize autonomously — finalization still needs an independent human (AI-N1).
//
// Run: node scripts/test-ai-principal.mjs   (npm run test:ai-principal)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

// ai/principal.ts imports '../api/principal' (relative, no ext) — resolve it.
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

let mod;
try {
  mod = await import(abs('../src/lib/ai/principal.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the ai/principal module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { resolveAgentScope, attribution, authorizeAgentAction } = mod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// A secretary who can do lending + gst, in SOC-1 / Haryana.
const human = { id: 'secretary-1', scopes: ['lending', 'gst'], tenantId: 'SOC-1', jurisdiction: 'Haryana' };
// The tenant is entitled to more than the human holds.
const TENANT = ['lending', 'gst', 'tds', 'deposit_ledger'];
// An agent configured (perhaps over-optimistically) with lending + tds.
const agent = { id: 'assistant-1', grantedScopes: ['lending', 'tds'], onBehalfOf: 'secretary-1' };

const contract = (o) => ({ resource: 'vouchers', action: 'read', requiredCapability: 'lending', ...o });

// ── 1. LEAST PRIVILEGE — agent ∩ human ∩ tenant (AI-P2) ──────────────────────
const scope = resolveAgentScope(agent, human, TENANT);
ok(JSON.stringify(scope) === JSON.stringify(['lending']),
  'the agent scope is agent grants ∩ human scopes ∩ tenant — "tds" is dropped (the human lacks it): no self-elevation');
// even if the tenant is entitled to tds and the agent was granted it, the human gate removes it.
ok(!resolveAgentScope(agent, human, TENANT).includes('tds'), 'the agent cannot use a capability the human lacks, even if entitled at the tenant');

// ── 2. ON-BEHALF-OF is recorded, and required (AI-A2) ────────────────────────
const attr = attribution(agent, human);
ok(attr && attr.actor === 'agent' && attr.agentId === 'assistant-1' && attr.onBehalfOf === 'secretary-1',
  'the attribution names the agent AND the human it serves');
ok(attribution({ ...agent, onBehalfOf: 'someone-else' }, human) === null, 'a mismatched on-behalf-of yields no attribution (agent has no authority)');
ok(attribution({ ...agent, onBehalfOf: '' }, human) === null, 'an unbound agent has no attribution');

// ── 3. AUTHORIZE — within the human-bounded scope ────────────────────────────
ok(authorizeAgentAction(agent, human, TENANT, { contract: contract({ requiredCapability: 'lending' }), tenantId: 'SOC-1', jurisdiction: 'Haryana' }).ok,
  'a read within the human-bounded scope is authorized');
const elevated = authorizeAgentAction(agent, human, TENANT, { contract: contract({ requiredCapability: 'tds' }), tenantId: 'SOC-1', jurisdiction: 'Haryana' });
ok(!elevated.ok, 'the agent CANNOT act with a capability the human lacks — cannot self-elevate (AI-P2/AI-N4)');
const unbound = authorizeAgentAction({ ...agent, onBehalfOf: '' }, human, TENANT, { contract: contract(), tenantId: 'SOC-1', jurisdiction: 'Haryana' });
ok(!unbound.ok && /on-behalf-of/.test(unbound.reason), 'an unbound agent may do nothing');

// ── 4. FY-LOCK — an agent can never touch a locked period (AI-N4/RULE 6) ─────
const locked = authorizeAgentAction(agent, human, TENANT, { contract: contract({ action: 'write', requiredCapability: 'lending' }), tenantId: 'SOC-1', jurisdiction: 'Haryana', touchesLockedPeriod: true });
ok(!locked.ok && /locked/.test(locked.reason), 'an action on FY/period-locked data is refused (AI-N4/RULE 6)');

// ── 5. NO CROSS-TENANT / CROSS-JURISDICTION (inherited from the trust plane) ─
ok(!authorizeAgentAction(agent, human, TENANT, { contract: contract(), tenantId: 'SOC-2', jurisdiction: 'Haryana' }).ok, 'no cross-tenant action');
ok(!authorizeAgentAction(agent, human, TENANT, { contract: contract(), tenantId: 'SOC-1', jurisdiction: 'Punjab' }).ok, 'no cross-jurisdiction action');

// ── 6. NO AUTONOMOUS FINALIZATION (AI-N1, via the trust plane) ───────────────
const autoFinal = authorizeAgentAction(agent, human, TENANT, { contract: contract({ action: 'write', requiredCapability: 'lending', effect: 'finalization' }), tenantId: 'SOC-1', jurisdiction: 'Haryana' });
ok(!autoFinal.ok, 'an agent cannot finalize autonomously — finalization needs an independent human (AI-N1)');
const humanFinal = authorizeAgentAction(agent, human, TENANT, { contract: contract({ action: 'write', requiredCapability: 'lending', effect: 'finalization' }), tenantId: 'SOC-1', jurisdiction: 'Haryana', authorizerId: 'president-1', authorizerIsHuman: true });
ok(humanFinal.ok, 'a finalization authorized by an independent human is allowed');

// ── 7. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'ai', 'principal.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `ai/principal is pure & does no I/O (no "${forbidden}")`);
}

console.log(`\nAI as a scoped principal: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
