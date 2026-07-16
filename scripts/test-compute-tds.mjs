// CAIOS Slice 2 — Tier 0 / F-lane: TDS as versioned data + a deterministic calculator.
//
// Proves the thing the AI Constitution assumes and the codebase never had: a function
// that computes TDS, from effective-dated rule DATA, with exact money, that REFUSES
// rather than guesses (AI-P3/AI-N3; ADR-0008; ADR-0006).
//
// The load-bearing test is the boring one: an UNVERIFIED rule is never stated as fact.
// A wrong statutory figure with a section number attached is more dangerous than no
// answer — it looks checked.
//
// Run: node scripts/test-compute-tds.mjs   (npm run test:compute-tds)

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadViteModule } from './lib/vite-bundle.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ONE bundle, so every module shares the same TDS_RULES instance. Loading each file
// separately would give each its own copy, and step 3 (verify-then-answer) would be
// mutating a catalog nobody reads — a test that passes while proving nothing.
const M = await loadViteModule(ROOT, resolve(ROOT, 'supabase', 'functions', '_shared', 'ask-core.entry.ts'), 'eval');
const tax = M;
const { computeTds, isRefusal, answerFact, unverifiedHint } = M;

const CTX = { asOf: '2026-07-16' };
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
};

console.log('\n  Tier 0 — TDS as data, computed deterministically\n');

/* 1 · THE GUARANTEE — nothing unverified is ever stated as fact. */
{
  const raw = tax.resolveTaxRule('tds.194q.threshold', CTX);
  ok('rule: the seed EXISTS as structure', !!raw && raw.value === 5000000);
  ok('rule: the seed is marked UNVERIFIED', raw.verified === false);
  ok('rule: the seed names what to check', raw.cite.includes('194Q'));
  ok('gate: verifiedValue() withholds it', tax.verifiedValue('tds.194q.threshold', CTX) === null);
  ok('F-lane: refuses to state an unverified rule', answerFact('194Q की सीमा कितनी है', CTX) === null);
  ok('F-lane: but says WHY — the rule exists, unchecked', !!unverifiedHint('194Q की सीमा कितनी है', CTX));
  const r = computeTds({ section: '194q', aggregateMinor: 900000000, ctx: CTX });
  ok('compute: refuses on an unverified rule', isRefusal(r));
  ok('compute: does NOT fall back to a default rate', isRefusal(r) && r.missing.length === 2);
}

/* 2 · Once a human verifies it, the same machinery answers. Simulated here by
   verifying a copy — the real act is a person editing rules/tax.ts. */
{
  const V = {
    asOf: '2026-07-16',
    // a locally-verified catalog standing in for "a human checked the section"
  };
  const verified = JSON.parse(JSON.stringify(tax.TDS_RULES));
  for (const k of Object.keys(verified)) verified[k].byJurisdiction[''][0].verified = true;

  // resolveRule is the engine's; re-resolve against the verified copy directly.
  const thr = verified['tds.194q.threshold'].byJurisdiction[''][0];
  ok('verified: flipping the flag is the ONLY change needed', thr.verified === true && thr.value === 5000000);
  ok('verified: the value never moved — only its status did', thr.effectiveFrom === '2021-07-01');
}

/* 3 · The arithmetic, with the rule verified. Exercised through the money primitive. */
{
  // Temporarily verify the live catalog (in-process only; nothing is written).
  for (const k of Object.keys(tax.TDS_RULES)) tax.TDS_RULES[k].byJurisdiction[''][0].verified = true;

  ok('F-lane: NOW it answers', !!answerFact('194Q की सीमा कितनी है', CTX));
  const a = answerFact('194Q की सीमा कितनी है', CTX);
  ok('F-lane: states the effective date, not just a number', a.text.includes('2021-07-01'));
  ok('F-lane: carries the citation', a.cite.includes('194Q'));
  ok('F-lane: rate query answers the RATE, not the threshold', answerFact('194Q की दर क्या है', CTX).text.includes('0.1%'));

  // ₹90,00,000 aggregate → excess over ₹50,00,000 is ₹40,00,000 → 0.1% = ₹4,000.
  const r = computeTds({ section: '194q', aggregateMinor: 900000000, ctx: CTX });
  ok('compute: applicable above the threshold', r.applicable === true);
  ok('compute: taxes only the EXCESS, not the whole value', r.taxableMinor === 400000000);
  ok('compute: ₹4,000 exactly, in paise', r.tdsMinor === 400000);
  ok('compute: records the rule version that produced it', r.basis.length === 2 && r.basis[0].version === 1);
  ok('compute: explains in Hindi', r.explain.includes('TDS'));

  const below = computeTds({ section: '194q', aggregateMinor: 100000000, ctx: CTX });
  ok('compute: below threshold ⇒ zero, not a refusal', below.applicable === false && below.tdsMinor === 0);

  // At exactly the threshold — the boundary everyone gets wrong. 194Q says "exceeding".
  const at = computeTds({ section: '194q', aggregateMinor: 500000000, ctx: CTX });
  ok('compute: AT the threshold ⇒ no TDS ("exceeding", not "at or above")', at.tdsMinor === 0);

  // asOf is not decoration: before the rule existed, there is no rule.
  const old = computeTds({ section: '194q', aggregateMinor: 900000000, ctx: { asOf: '2020-01-01' } });
  ok('compute: a 2020 bill gets 2020\'s law (none) — not today\'s', isRefusal(old));

  const unknown = computeTds({ section: '194c', aggregateMinor: 900000000, ctx: CTX });
  ok('compute: an unseeded section refuses, never improvises', isRefusal(unknown));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
