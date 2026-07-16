// CAIOS Slice 1 — the ask-core mechanism (blueprint §4).
//
// Proves the pipe behaves as the AI Constitution requires, with no model present:
//   • the GATE is checked first and a kill is total (AI-G4) — off ⇒ degrade, never error
//   • the GUARD refuses to assert rather than guess (AI-N8) — this is the load-bearing one
//   • a regulated specific NEVER becomes a document answer (AI-N3) — F-lane hedges
//   • anonymous can never reach society data (AI-N5 / CAIOS-K8)
//   • the AI never claims it can post (AI-P4 / AI-N1) — A-lane refuses
//   • every answer carries a trace, so stage 8 records WHY (AI-A2/AI-A5)
//
// Run: node scripts/test-ask-core.mjs   (npm run test:ask-core)

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { ask } = await loadViteModule(ROOT, resolve(ROOT, 'src', 'lib', 'ask', 'core.ts'), 'eval');
const CORPUS = JSON.parse(readFileSync(resolve(ROOT, 'src', 'generated', 'search-index.json'), 'utf8')).docs;

const ON = { globalEnabled: true };
const TODAY = '2026-07-16';
const run = (text, over = {}, flags = ON) => ask({ text, channel: 'web', ...over }, CORPUS, flags, TODAY);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
};

console.log('\n  ask-core — the mechanism, with no model\n');

/* 1 · GATE (AI-G4) — a kill is instant, total, and degrades rather than errors. */
{
  const r = run('सहकारी समिति क्या है', {}, { globalEnabled: false });
  ok('gate: global kill ⇒ degraded, no answer', r.degraded === true && r.answer === null);
  ok('gate: kill is recorded in the trace', r.trace.guard === 'killSwitch');
  const s = run('सहकारी समिति क्या है', { societyId: 'SOC001' }, { globalEnabled: true, societyEnabled: { SOC001: false } });
  ok('gate: per-society kill ⇒ that society only', s.degraded === true);
  const t = run('सहकारी समिति क्या है', { societyId: 'SOC002' }, { globalEnabled: true, societyEnabled: { SOC001: false } });
  ok('gate: another society is unaffected', !t.degraded && !!t.answer);
}

/* 2 · CLASSIFY — the question frame routes (CAIOS-K10). */
{
  ok('lane: "क्या है" ⇒ K (definitional)', run('वाउचर क्या है').lane === 'K');
  ok('lane: "kya hai" ⇒ K (roman too)', run('voucher kya hai').lane === 'K');
  ok('lane: "कैसे" ⇒ N (procedural)', run('सदस्य कैसे जोड़ें').lane === 'N');
  ok('lane: "दर" ⇒ F (regulated)', run('GST की दर क्या है').lane === 'F');
  ok('lane: "सीमा" ⇒ F', run('194Q की सीमा कितनी है').lane === 'F');
  ok('lane: bare term ⇒ K with no corpus opinion', run('trial balance').trace.corpus.length === 0);
  const d = run('रोकड़ शेष कितना है', { societyId: 'SOC001' });
  ok('lane: quantitative + logged in ⇒ D', d.lane === 'D');
  ok('lane: quantitative + possessive ⇒ D even anonymous', run('मेरी समिति का रोकड़ शेष कितना है').lane === 'D');
  // The one that keeps the marketing site sane: a visitor asking about price wants
  // pricing, not "please log in". A number question with no owner is about the world.
  ok('lane: quantitative, no owner ⇒ NOT D', run('कितना खर्चा आएगा').lane !== 'D');
}

/* 3 · GUARD — the stage that makes "never fabricate" architectural (AI-N8). */
{
  const r = run('zzzq nonexistent gibberish topic');
  ok('guard: nothing retrieved ⇒ refuses to assert', r.answer === null && !!r.unanswered);
  ok('guard: says the model would not be called', r.trace.guard.includes('model would not be called'));
  ok('guard: refusal is honest, not silent', r.unanswered.includes('नहीं पता'));
}

/* 4 · F-LANE (AI-N3) — a regulated specific is NEVER answered from a document. */
{
  const r = run('GST की दर क्या है');
  ok('F-lane: states no figure', r.answer === null);
  ok('F-lane: hedges with a reason', r.unanswered.includes('CA'));
  ok('F-lane: still offers sources to read', r.cites.length > 0);
  ok('F-lane: trace names why it refused', r.trace.guard.includes('no rule for this specific'));
  // The whole point: search DOES find GST docs. The lane refuses anyway.
  ok('F-lane: refuses even though docs exist', r.trace.retrieved.length > 0 && r.answer === null);

  /* Slice 2 — the F-lane now distinguishes two different truths. "मुझे नहीं पता"
     (no rule at all, e.g. GST) is NOT the same as "the rule is in the catalog but no
     human has verified it" (194Q). The second tells the user what would fix it, and
     an unverified rule must still never be stated as fact. */
  const u = run('194Q की सीमा कितनी है');
  ok('F-lane: 194Q — seeded but UNVERIFIED ⇒ still no figure', u.answer === null);
  ok('F-lane: says the rule exists but is unchecked', u.trace.guard.includes('unverified'));
  ok('F-lane: names the section to check', (u.unanswered || '').includes('194Q'));
  ok('F-lane: never leaks the unverified number', !(u.unanswered || '').includes('50,00,000'));
}

/* 5 · SCOPE (AI-N5 / CAIOS-K8) — anonymous cannot reach society data. */
{
  const r = run('मेरी समिति का रोकड़ शेष कितना है');
  ok('scope: anonymous D-query ⇒ asks for login', (r.unanswered || '').includes('login'));
  ok('scope: anonymous never gets society data', r.answer === null);
}

/* 6 · A-LANE (AI-P4 / AI-N1) — never claims it can post. */
{
  const r = run('इस बिल का वाउचर बना दो', { societyId: 'SOC001' });
  ok('action: refuses to create', r.lane === 'A' && r.answer === null);
  ok('action: does not pretend it will', (r.unanswered || '').includes('नहीं'));
}

/* 7 · TRACE (AI-A2/AI-A5) — every answer is reconstructible. */
{
  const r = run('वाउचर क्या है');
  ok('trace: carries the routing reason', !!r.trace.reason);
  ok('trace: carries jurisdiction + asOf', r.trace.asOf === TODAY && r.trace.jurisdiction === '');
  ok('trace: records what was retrieved', r.trace.retrieved.length > 0);
  ok('trace: model is null — this answer cost nothing', r.trace.model === null);
  const j = run('वाउचर क्या है', { state: 'Haryana' });
  ok('trace: state resolves via the ONE resolver (Haryana→hr)', j.trace.jurisdiction === 'hr');
}

/* 8 · ANSWERS — the happy path still answers, grounded. */
{
  const r = run('दोहरा लेखा क्या है');
  ok('answer: definitional query is answered', !!r.answer);
  ok('answer: every answer is cited', r.cites.length > 0);
  ok('answer: cites carry a url to check', r.cites.every((c) => !!c.url));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
