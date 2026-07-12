// AI proposals, decisions, attribution & explainability (T-30 / AI Constitution Art. I–IV, VI).
//
// Proves the "AI helps / human owns" boundary:
//   • no autonomous financial mutation — a human commit is required (AI-N1/AI-P4);
//   • the LLM is never the source of a figure of record — money figures come from engines (AI-P3);
//   • every money-affecting suggestion is cited, else it is not actionable (AI-X1);
//   • the AI can never approve its own proposal; SoD independent-approver holds (III.2);
//   • one append-only trail with full attribution, redacted inputs only (AI-A1/A2).
//
// Run: node scripts/test-ai-proposal.mjs   (npm run test:ai-proposal)

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

let mod;
try {
  mod = await import(abs('../src/lib/ai/proposal.ts'));
} catch (e) {
  console.error('\nFAIL    Could not import the ai/proposal module.');
  console.error('        ' + String(e?.message ?? e).split('\n')[0]);
  process.exit(1);
}

const { figuresFromEngine, isActionable, decideProposal, buildAuditEnvelope } = mod;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const AT = '2026-07-12T00:00:00Z';
// A well-formed money-affecting proposal: engine-sourced figure + a rule citation.
const good = {
  id: 'prop-1', agentId: 'assistant-1', onBehalfOf: 'secretary-1', capability: 'gst', tier: 'D',
  moneyAffecting: true,
  figures: [{ label: 'reserve_appropriation', minor: 250000, source: 'engine', ref: 'UCAS:reserve@25%' }],
  citations: [{ kind: 'rule', ref: 'UCAS-RF-25' }],
  draft: {},
};

// ── 1. AI-P3/AI-N3 — the LLM is never the source of a figure of record ───────
ok(figuresFromEngine(good).ok, 'an engine-sourced figure with a ref is admissible');
const llm = { ...good, figures: [{ label: 'interest', minor: 5000, source: 'llm' }] };
ok(!figuresFromEngine(llm).ok, 'an LLM-"calculated" money figure is inadmissible (AI-P3)');
const noRef = { ...good, figures: [{ label: 'x', minor: 100, source: 'engine' }] };
ok(!figuresFromEngine(noRef).ok, 'an engine figure with no ref is inadmissible');
ok(figuresFromEngine({ ...good, moneyAffecting: false, figures: [] }).ok, 'a proposal with no monetary figures is trivially clean');

// ── 2. AI-X1 — no money-affecting suggestion without a citation ──────────────
ok(isActionable(good), 'a cited, engine-sourced money proposal is actionable');
ok(!isActionable({ ...good, citations: [] }), 'a money-affecting proposal with NO citation is not actionable (AI-X1)');
ok(!isActionable(llm), 'a money proposal with an LLM figure is not actionable (AI-P3)');
ok(isActionable({ ...good, moneyAffecting: false, figures: [], citations: [] }), 'a non-money draft is actionable as advice without a citation');

// ── 3. NO AUTONOMOUS COMMIT + SoD (AI-N1/AI-P4/III.2) ────────────────────────
const selfApprove = decideProposal(good, { kind: 'approved', decidedBy: 'assistant-1' }, AT);
ok(!selfApprove.ok && /own proposal/.test(selfApprove.reason), 'the AI cannot approve its own proposal (III.2 SoD)');
const noHuman = decideProposal(good, { kind: 'approved', decidedBy: '' }, AT);
ok(!noHuman.ok, 'a commit needs a human decider (AI-P1)');
const humanApprove = decideProposal(good, { kind: 'approved', decidedBy: 'president-1' }, AT);
ok(humanApprove.ok && humanApprove.decision.kind === 'approved' && humanApprove.decision.decidedBy === 'president-1',
  'an independent human can approve a well-formed proposal');
// approving an uncited/LLM money proposal is refused.
ok(!decideProposal({ ...good, citations: [] }, { kind: 'approved', decidedBy: 'president-1' }, AT).ok,
  'an uncited money proposal cannot be committed (AI-X1)');
ok(!decideProposal(llm, { kind: 'approved', decidedBy: 'president-1' }, AT).ok,
  'a proposal with an LLM figure cannot be committed (AI-P3)');
// independent-approver policy: the drafting human cannot self-approve.
const selfHuman = decideProposal(good, { kind: 'approved', decidedBy: 'secretary-1', requiresIndependentApprover: true }, AT);
ok(!selfHuman.ok && /independent approver/.test(selfHuman.reason), 'the drafting human cannot self-approve where independent review is required (III.2)');
// reject / modify never need actionability (no posting is created).
ok(decideProposal({ ...good, citations: [] }, { kind: 'rejected', decidedBy: 'secretary-1' }, AT).ok, 'a human may reject any proposal');
ok(decideProposal(llm, { kind: 'modified', decidedBy: 'secretary-1' }, AT).ok, 'a human may modify any proposal (their commit is a separate posting)');

// ── 4. AUDIT ENVELOPE — one trail, full attribution, redacted inputs (AI-A2) ─
const env = buildAuditEnvelope(good, humanApprove.decision, { model: 'claude', modelVersion: '4.8', redactedInputsRef: 'blob://redacted-1' });
ok(env.agentId === 'assistant-1' && env.onBehalfOf === 'secretary-1' && env.capability === 'gst',
  'the envelope attributes the agent, the human it served, and the capability used');
ok(env.model === 'claude' && env.modelVersion === '4.8' && env.decision === 'approved' && env.decidedBy === 'president-1',
  'the envelope records the model/version in effect and the human decision');
ok(env.redactedInputsRef === 'blob://redacted-1' && !('rawInputs' in env), 'the envelope carries only a redacted-inputs reference, never raw PII (AI-A2/AI-M3)');

// ── 5. PURITY ────────────────────────────────────────────────────────────────
const code = readFileSync(pathResolve(SRC, 'lib', 'ai', 'proposal.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
for (const forbidden of ['supabase', 'fetch(', 'localStorage', 'document.', 'Date.now', 'new Date', 'Math.random']) {
  ok(!code.includes(forbidden), `ai/proposal is pure & does no I/O (no "${forbidden}")`);
}

console.log(`\nAI proposals, decisions & explainability: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
