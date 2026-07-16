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

/* 1 · THE REFUSAL EARNED ITS KEEP — the seed was not merely unverified, it was WRONG.
   This file shipped ₹50,00,000 for 194Q, marked unverified, because I would not assert
   it from memory. The CA then said ₹10,00,000 — a 5× drop, under a section that no
   longer exists. Had the flag been flipped on a guess, every procurement voucher would
   have been wrong AND would have looked checked. */
{
  const thr = tax.resolveTaxRule('tds.194q.threshold', CTX);
  ok('194Q: the CA-confirmed threshold is ₹10,00,000, NOT the ₹50,00,000 seed', thr.value === 1000000);
  ok('194Q: verified — a named human owns it', thr.verified === true);
  ok('194Q: the cite carries the CHAIN, not just a source', thr.cite.includes('CA') && thr.cite.includes('founder'));
  ok('194Q: names the 2025 section AND the 1961 one it replaced',
    thr.cite.includes('393(1) Table 8') && thr.cite.includes('194Q'));
  ok('194Q: effective from the 2025 Act commencement', thr.effectiveFrom === '2026-04-01');

  // The old figure is KEPT — a FY 2024-25 purchase must still resolve its own law.
  const legacy = tax.resolveTaxRule('tds.194q.threshold.legacy', CTX);
  ok('history: the ₹50,00,000 figure is kept, not deleted', legacy.value === 5000000);
  ok('history: and stays unverified — the CA was asked about THIS year', legacy.verified === false);
}

/* 2 · THE SHAPE'S LIMIT, asserted so it cannot be quietly forgotten. The CA confirmed
   194A / 194C / 194J too, but this catalog holds ONE threshold and ONE rate per section
   and those do not fit: 194C is ₹30,000 per payment OR ₹1,00,000 annual, at 1% or 2% by
   payee type. Encoding it flat would drop half the law — a wrong answer wearing a
   citation, which is worse than none (AI-N8). Their absence is a design statement. */
{
  for (const s of ['194a', '194c', '194i', '194j']) {
    const S = s.toUpperCase();
    ok(`shape: ${S} absent — it needs conditions this catalog lacks`,
      tax.resolveTaxRule(`tds.${s}.threshold`, CTX) === null);
    ok(`shape: ...so compute refuses rather than half-answering (${S})`,
      isRefusal(computeTds({ section: s, aggregateMinor: 900000000, ctx: CTX })));
  }
}

/* 3 · The arithmetic, and the F-lane finally ANSWERING — the hedge became a fact. */
{
  ok('F-lane: 194Q now answers', !!answerFact('194Q की सीमा कितनी है', CTX));
  const a = answerFact('194Q की सीमा कितनी है', CTX);
  ok('F-lane: states the effective date, not just a number', a.text.includes('2026-04-01'));
  ok('F-lane: 194H answers too', !!answerFact('194H की दर क्या है', CTX));
  ok('F-lane: 194C still refuses — no rule, and that is correct', answerFact('194C की दर क्या है', CTX) === null);
  ok('F-lane: carries the citation', a.cite.includes('194Q'));
  ok('F-lane: rate query answers the RATE, not the threshold', answerFact('194Q की दर क्या है', CTX).text.includes('0.1%'));

  // ₹90,00,000 aggregate → excess over ₹10,00,000 is ₹80,00,000 → 0.1% = ₹8,000.
  const r = computeTds({ section: '194q', aggregateMinor: 900000000, ctx: CTX });
  ok('compute: applicable above the threshold', r.applicable === true);
  ok('compute: taxes only the EXCESS, not the whole value', r.taxableMinor === 800000000);
  ok('compute: ₹8,000 exactly, in paise', r.tdsMinor === 800000);
  ok('compute: records the rule version that produced it', r.basis.length === 2 && r.basis[0].version === 2);
  ok('compute: explains in Hindi', r.explain.includes('TDS'));

  const below = computeTds({ section: '194q', aggregateMinor: 50000000, ctx: CTX });
  ok('compute: below threshold ⇒ zero, not a refusal', below.applicable === false && below.tdsMinor === 0);

  // At exactly the threshold — the boundary everyone gets wrong. The law says "exceeding".
  const at = computeTds({ section: '194q', aggregateMinor: 100000000, ctx: CTX });
  ok('compute: AT the threshold ⇒ no TDS ("exceeding", not "at or above")', at.tdsMinor === 0);

  // THE 5× CHANGE, made concrete: ₹40L attracted NOTHING at the old ₹50L threshold.
  const mid = computeTds({ section: '194q', aggregateMinor: 400000000, ctx: CTX });
  ok('impact: ₹40L NOW attracts TDS — it did not under the ₹50,00,000 seed', mid.applicable === true);

  // asOf is not decoration: before the rule existed, there is no rule.
  const old = computeTds({ section: '194q', aggregateMinor: 900000000, ctx: { asOf: '2020-01-01' } });
  ok('compute: a 2020 bill gets 2020\'s law (none) — not today\'s', isRefusal(old));

  const unknown = computeTds({ section: '194c', aggregateMinor: 900000000, ctx: CTX });
  ok('compute: an unseeded section refuses, never improvises', isRefusal(unknown));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
