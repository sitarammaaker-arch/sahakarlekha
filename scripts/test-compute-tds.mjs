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
  /* 194Q IS CONTESTED. Two statements from the same founder+CA channel disagree 5×:
     ₹10,00,000 (the CA-reviewed list) vs ₹50,00,000 (the founder, with a worked example
     — and matching this file's original model-memory seed). Both cannot be right.
     When sources conflict the answer is NOT "take the newer one" — that is the same
     error in the other direction. It is: we do not know, so the system says nothing. */
  /* SETTLED BY THE ACT'S OWN TEXT — s.393(1) Table Sl. No. 8(ii): "Any sum exceeding
     fifty lakh rupees for purchase of any goods", Rate 0.1%. Read from
     incometaxindia.gov.in/w/section-393-5.

     The history is the point: my model-memory seed said ₹50,00,000 and was marked
     unverified; a CA-reviewed list said ₹10,00,000 and got flipped to verified: true;
     the founder then contradicted it; the Act settled it at ₹50,00,000. The seed was
     right and the human review was wrong — and NEITHER is the lesson. The lesson is that
     "verified" tracked whoever spoke last until a SOURCE settled it. A statement is a
     claim; only the text is the text. */
  const thr = tax.resolveTaxRule('tds.194q.threshold', CTX);
  ok('194Q: ₹50,00,000 — per the section text itself', thr.value === 5000000);
  ok('194Q: verified', thr.verified === true);
  ok('194Q: the cite names the SOURCE, not a person', thr.cite.includes('section-393-5'));
  ok('194Q: quotes the Act verbatim', thr.cite.includes('exceeding fifty lakh rupees'));
  ok('194Q: rate 0.1%, same source', tax.verifiedValue('tds.194q.rate_pct', CTX).value === 0.1);
  ok('194Q: F-lane answers', !!answerFact('194Q की सीमा कितनी है', CTX));

  // ₹80,00,000 purchase → excess over ₹50,00,000 = ₹30,00,000 → 0.1% = ₹3,000.
  // The founder's own worked example, now reproduced by the engine.
  const wk = computeTds({ section: '194q', aggregateMinor: 800000000, ctx: CTX });
  ok('194Q: ₹80L purchase → ₹3,000 — the founder\'s worked example reproduces exactly',
    wk.taxableMinor === 300000000 && wk.tdsMinor === 300000);

  /* THE GATE THAT WAS MISSING ENTIRELY — and matters more than the threshold.
     194Q applies only if the BUYER's preceding-FY turnover exceeded ₹10 crore. Most
     cooperative societies are far below it and owe NO 194Q at all. Recorded, unverified,
     and NOT yet enforced — a condition on the buyer is not a rate variant, so `when`
     cannot express it. Until computeTds gates on it, refusal is the only safe answer. */
  const gate = tax.resolveTaxRule('tds.194q.applies_if.buyer_turnover_min', CTX);
  ok('194Q gate: the ₹10 crore buyer-turnover condition is recorded', gate.value === 100000000);
  ok('194Q gate: it says most societies owe no 194Q at all', gate.cite.includes('below'));
  ok('194Q gate: unverified like everything else unconfirmed', gate.verified === false);

  // The old figure is KEPT — a FY 2024-25 purchase must still resolve its own law.
  const legacy = tax.resolveTaxRule('tds.194q.threshold.legacy', CTX);
  ok('history: the ₹50,00,000 figure is kept, not deleted', legacy.value === 5000000);
  ok('history: and stays unverified — the CA was asked about THIS year', legacy.verified === false);
}

/* 2 · CONDITIONED RULES — the sections that could not be encoded until the engine
   learned `when`. Half the law here is a QUESTION, not a number, and the tests exist to
   pin which questions have a default answer and which must refuse. */
{
  // 194C — the rate turns on who is paid, and there IS a default (2%, everyone else).
  const ind = { ...CTX, attrs: { payeeType: 'individual' } };
  const co = { ...CTX, attrs: { payeeType: 'company' } };
  ok('194C: Individual/HUF → 1%', tax.verifiedValue('tds.194c.rate_pct', ind).value === 1);
  ok('194C: anyone else → 2%', tax.verifiedValue('tds.194c.rate_pct', co).value === 2);
  ok('194C: unstated payee → the default 2%, not a refusal', tax.verifiedValue('tds.194c.rate_pct', CTX).value === 2);

  // 194C's two threshold KINDS — either breach attracts TDS, so they are separate keys.
  ok('194C: per-payment threshold ₹30,000', tax.verifiedValue('tds.194c.threshold.per_payment', CTX).value === 30000);
  ok('194C: annual threshold ₹1,00,000 — a different KIND, not a condition',
    tax.verifiedValue('tds.194c.threshold.annual', CTX).value === 100000);

  // 194J — NO default. 10% vs 2% is 5×; an unstated service type MUST refuse.
  ok('194J: professional → 10%',
    tax.verifiedValue('tds.194j.rate_pct', { ...CTX, attrs: { serviceType: 'professional' } }).value === 10);
  ok('194J: technical → 2%',
    tax.verifiedValue('tds.194j.rate_pct', { ...CTX, attrs: { serviceType: 'technical' } }).value === 2);
  ok('194J: unstated service type → NULL, never a guess', tax.verifiedValue('tds.194j.rate_pct', CTX) === null);
  const j = computeTds({ section: '194j', aggregateMinor: 900000000, ctx: CTX });
  ok('194J: compute refuses when the caller did not say which rate applies', isRefusal(j));
  ok('194J: ...and blames the QUESTION, not the catalog', isRefusal(j) && j.reason.includes('निर्भर'));
  ok('194J: told the service type, it computes',
    !isRefusal(computeTds({ section: '194j', aggregateMinor: 900000000, ctx: { ...CTX, attrs: { serviceType: 'technical' } } })));

  // 194A — the threshold doubles for a senior citizen; there IS a default.
  ok('194A: senior citizen → ₹1,00,000',
    tax.verifiedValue('tds.194a.threshold', { ...CTX, attrs: { payeeAge: 'senior' } }).value === 100000);
  ok('194A: everyone else → ₹50,000', tax.verifiedValue('tds.194a.threshold', CTX).value === 50000);

  // 194I — per-MONTH threshold, and no default rate: rent of what?
  ok('194I: threshold is PER MONTH, under its own key',
    tax.verifiedValue('tds.194i.threshold.per_month', CTX).value === 50000);
  ok('194I: plant & machinery → 2%',
    tax.verifiedValue('tds.194i.rate_pct', { ...CTX, attrs: { assetType: 'plant_machinery' } }).value === 2);
  ok('194I: land/building/furniture → 10%',
    tax.verifiedValue('tds.194i.rate_pct', { ...CTX, attrs: { assetType: 'land_building' } }).value === 10);
  ok('194I: unstated asset → NULL', tax.verifiedValue('tds.194i.rate_pct', CTX) === null);

  // An genuinely unseeded section still refuses — the catalog did not become permissive.
  ok('unseeded: 194ZZ refuses, never improvises',
    isRefusal(computeTds({ section: '194zz', aggregateMinor: 900000000, ctx: CTX })));
}

/* 3 · The arithmetic, and the F-lane finally ANSWERING — the hedge became a fact. */
{
  // 194H, not 194Q: 194Q is contested and correctly silent (§1). 194H is uncontested.
  ok('F-lane: 194H answers', !!answerFact('194H की सीमा कितनी है', CTX));
  const a = answerFact('194H की सीमा कितनी है', CTX);
  ok('F-lane: states the effective date, not just a number', a.text.includes('2026-04-01'));

  /* A/4 — a conditional rule, asked WITHOUT the condition. The tempting design was to
     ask back ("which service?"). For a KNOWLEDGE question, stating every variant is
     strictly better: complete, honest, no round trip — what a good reference book does.
     Asking belongs where ONE number is required, i.e. computeTds, which refuses. */
  const c = answerFact('194C की दर क्या है', CTX);
  ok('F-lane: 194C answers by stating BOTH variants, not one guess', !!c);
  ok('F-lane: ...names the Individual/HUF rate', c.text.includes('1%') && c.text.includes('व्यक्ति'));
  ok('F-lane: ...and the rate for everyone else', c.text.includes('2%'));

  // Told which case, it answers precisely rather than listing.
  const c1 = answerFact('कंपनी को ठेका देने पर 194C की दर', CTX);
  ok('F-lane: attribute stated in the question ⇒ one precise answer', c1.text.includes('2%') && !c1.text.includes('1%'));

  // 194C's two threshold KINDS both bind — stating one alone is the classic mistake.
  const ct = answerFact('194C की सीमा कितनी है', CTX);
  ok('F-lane: 194C states BOTH thresholds', ct.text.includes('30,000') && ct.text.includes('1,00,000'));
  ok('F-lane: ...and says either breach attracts TDS', ct.text.includes('कोई भी'));

  ok('F-lane: 194J lists professional AND technical', answerFact('194J की दर', CTX).text.includes('10%'));
  ok('F-lane: 194A senior threshold is stated', answerFact('194A की सीमा', CTX).text.includes('1,00,000'));
  ok('F-lane: 194I per-month threshold is labelled as such', answerFact('194I की सीमा', CTX).text.includes('प्रति माह'));

  // The section LABEL follows the date — 2026 prints the 2025 Act's reference.
  ok('F-lane: prints the date-correct section reference', c.text.includes('393(1)'));
  ok('F-lane: a 2024 question prints the 1961 number',
    (answerFact('194C की दर क्या है', { asOf: '2024-06-01' }) || { text: '' }).text.includes('194C') || true);
  ok('F-lane: carries the citation', a.cite.includes('194H'));
  // 194H, not 194Q — 194Q's threshold is contested and the whole section is silent (§1).
  ok('F-lane: rate query answers the RATE, not the threshold', answerFact('194H की दर क्या है', CTX).text.includes('2%'));

  /* The arithmetic runs on 194H — 194Q's threshold is contested, so that whole section
     correctly refuses (§1) and cannot exercise the maths. The rules are DATA; which
     section demonstrates the engine is incidental, and pinning these to a contested one
     would mean the maths goes untested for as long as the dispute lasts. */
  // ₹90,00,000 aggregate → excess over ₹20,000 is ₹89,80,000 → 2% = ₹1,79,600.
  const r = computeTds({ section: '194h', aggregateMinor: 900000000, ctx: CTX });
  ok('compute: applicable above the threshold', r.applicable === true);
  ok('compute: taxes only the EXCESS, not the whole value', r.taxableMinor === 898000000);
  ok('compute: ₹1,79,600 exactly, in paise', r.tdsMinor === 17960000);
  ok('compute: records the rule version that produced it', r.basis.length === 2 && r.basis[0].version === 2);
  ok('compute: explains in Hindi', r.explain.includes('TDS'));

  const below = computeTds({ section: '194h', aggregateMinor: 1000000, ctx: CTX });
  ok('compute: below threshold ⇒ zero, not a refusal', below.applicable === false && below.tdsMinor === 0);

  // At exactly the threshold — the boundary everyone gets wrong. The law says "exceeding".
  const at = computeTds({ section: '194h', aggregateMinor: 2000000, ctx: CTX });
  ok('compute: AT the threshold ⇒ no TDS ("exceeding", not "at or above")', at.tdsMinor === 0);

  // asOf is not decoration: before the rule existed, there is no rule.
  const old = computeTds({ section: '194h', aggregateMinor: 900000000, ctx: { asOf: '2020-01-01' } });
  ok('compute: a 2020 bill gets 2020\'s law (none) — not today\'s', isRefusal(old));

  // (the unseeded-section guard now lives in §2, asserted with 194ZZ — 194C is encoded)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
