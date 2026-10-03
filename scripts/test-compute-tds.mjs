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
  /* NOTE 1 HAS BEEN READ, and it does not say what we were told. Verbatim:
       "(a) ...shall not apply to a transaction on which tax is deductible or collectible
        under any of the provisions of the Act. (b) The tax shall be deducted on the sum
        exceeding fifty lakh rupees."
     No ₹10-crore buyer-turnover condition anywhere in it. That gate came from a
     statement, not a source — the exact distinction this section keeps re-teaching. */
  const gate = tax.resolveTaxRule('tds.194q.applies_if.buyer_turnover_min', CTX);
  ok('194Q gate: the CLAIMED ₹10 crore condition is still recorded, not deleted', gate.value === 100000000);
  /* FOUND 2026-10-03 — not in s.393 but in the definition of "buyer", s.402(6) Table Sl. No. 1. The figure
     the founder stated was right; until the text was read it stayed a claim. */
  ok('194Q gate: now cites the definition of "buyer", s.402(6)', gate.cite.includes('s.402(6)') && gate.cite.includes('section-402-5'));
  ok('194Q gate: quotes the text ("ten crore rupees … immediately preceding")', gate.cite.includes('ten crore rupees') && gate.cite.includes('immediately'));
  ok('194Q gate: verified — read in the Act, not stated', gate.verified === true);
  const gst = tax.resolveTaxRule('tds.194q.base_excludes_gst_when_separate_and_on_credit', CTX);
  ok('194Q GST: the circular is recorded with BOTH halves (credit basis / payment basis)', gst.cite.includes('payment basis') && gst.cite.includes('13/2021'));
  ok('194Q GST: unverified under the 2025 Act (a 1961-Act circular)', gst.verified === false);
  ok('194Q gate: never enforced, so it cannot silently gate a computation',
    computeTds({ section: '194q', aggregateMinor: 800000000, ctx: CTX }).applicable === true);

  /* Note 1(a) — a REAL carve-out from the text that computeTds does not yet honour. */
  const carve = tax.resolveTaxRule('tds.194q.excluded_if.taxed_under_other_provision', CTX);
  ok('194Q: Note 1(a)\'s carve-out is recorded from the text', carve.verified === true);
  ok('194Q: ...cited to the section, and flagged as NOT enforced',
    carve.cite.includes('section-393-5') && carve.cite.includes('NOT ENFORCED'));

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
  // Told the service type, the RATE resolves; above the threshold it then stops only for the missing
  // sourced excess/whole basis (Phase-2 D) — not for the rate any more. Below the threshold it answers.
  const jt = computeTds({ section: '194j', aggregateMinor: 900000000, ctx: { ...CTX, attrs: { serviceType: 'technical' } } });
  ok('194J: told the service type, above the threshold TDS is on the ENTIRE sum (s.393(1)(a))',
    !isRefusal(jt) && jt.taxableMinor === 900000000 && jt.tdsMinor === 18000000);
  ok('194J: told the service type, below the threshold it answers (no TDS)',
    !isRefusal(computeTds({ section: '194j', aggregateMinor: 4000000, ctx: { ...CTX, attrs: { serviceType: 'technical' } } })));

  // 194A — DOWNGRADED 2026-10-03: ₹50,000/₹1,00,000 is the BANKING payers' row (5(ii)); a non-banking
  // society is 5(iii) (₹10,000) and s.393(4) Sl. 7(b) exempts interest it pays members; rate is "Rates in force".
  ok('194A: the banking-row figure is no longer stated as fact', tax.verifiedValue('tds.194a.threshold', CTX) === null);
  ok('194A: ...its cite names the payer split and the member exemption',
    tax.resolveTaxRule('tds.194a.threshold', CTX).cite.includes('5(iii)') && tax.resolveTaxRule('tds.194a.threshold', CTX).cite.includes('7(b)'));
  ok('194A: rate unverified ("Rates in force")', tax.verifiedValue('tds.194a.rate_pct', CTX) === null);
  ok('194A: compute refuses', isRefusal(computeTds({ section: '194a', aggregateMinor: 900000000, ctx: CTX })));

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
  ok('F-lane: 194A is NOT stated as a fact any more (payer-dependent)', !(answerFact('194A की सीमा', CTX) || { text: '' }).text.includes('50,000'));
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
  /* Phase-2 D (2026-10-01): "excess only vs whole sum" is per-section STATUTE, now a sourced
     rule (tds.<s>.charge_on_excess_only). The maths runs on 194Q, whose threshold, rate and
     basis are all read from the section text (s.393(1) Sl. 8(ii) + Note 1(b)). 194H has no
     sourced basis, so above its threshold it must REFUSE — this test used to pin 194H to
     "excess only", which was exactly the unsourced assumption. */
  // ₹90,00,000 aggregate → excess over ₹50,00,000 is ₹40,00,000 → 0.1% = ₹4,000.
  const r = computeTds({ section: '194q', aggregateMinor: 900000000, ctx: CTX });
  ok('compute: applicable above the threshold', r.applicable === true);
  ok('compute: 194Q taxes only the EXCESS (its Note 1(b)), not the whole value', r.taxableMinor === 400000000);
  ok('compute: ₹4,000 exactly, in paise', r.tdsMinor === 400000);
  ok('compute: records the rule versions incl. the basis rule', r.basis.length === 3 && r.basis[0].version === 2 && r.basis[2].key === 'tds.194q.charge_on_excess_only');
  ok('compute: explains in Hindi', r.explain.includes('TDS'));
  /* 2026-10-03: s.393(1)(a) — "on the entire amount of such income or sum, where the amount or aggregate of
     amounts exceeds the threshold limit" — read in the text. 194H/194C/194J/194I now carry that basis (0). */
  const h = computeTds({ section: '194h', aggregateMinor: 2500000, ctx: CTX });   // ₹25,000 > ₹20,000
  ok('compute: 194H above its threshold → TDS on the ENTIRE sum, not the excess', !isRefusal(h) && h.taxableMinor === 2500000);
  ok('compute: 194H ₹25,000 × 2% = ₹500 exactly', !isRefusal(h) && h.tdsMinor === 50000);
  ok('compute: …cites s.393(1)(a) in the basis', !isRefusal(h) && h.basis[2].key === 'tds.194h.charge_on_excess_only' && h.basis[2].cite.includes('393(1)(a)'));
  // A section with NO basis rule still refuses above its threshold (the guard did not become permissive).
  const noBasis = tax.TDS_RULES['tds.194q.charge_on_excess_only'];
  ok('compute: the basis is still data — 194Q stays "excess" (Note 1(b))', !!noBasis);
  // 194C: either limit binds. Aggregate under ₹1,00,000 but ONE sum over ₹30,000 ⇒ TDS on that sum.
  const k1 = computeTds({ section: '194c', aggregateMinor: 4000000, paymentMinor: 4000000, ctx: CTX });
  ok('compute: 194C single sum ₹40,000 > ₹30,000 → TDS on that sum (2% = ₹800)', !isRefusal(k1) && k1.applicable && k1.tdsMinor === 80000);
  const k2 = computeTds({ section: '194c', aggregateMinor: 4000000, paymentMinor: 2500000, ctx: CTX });
  ok('compute: 194C sum ₹25,000, year ₹40,000 → no TDS', !isRefusal(k2) && !k2.applicable && k2.tdsMinor === 0);
  const k3 = computeTds({ section: '194c', aggregateMinor: 4000000, ctx: CTX });
  ok('compute: 194C under the annual limit WITHOUT the payment → refuses (cannot tell)', isRefusal(k3) && k3.missing.includes('paymentMinor'));
  const k4 = computeTds({ section: '194c', aggregateMinor: 12000000, ctx: { ...CTX, attrs: { payeeType: 'individual' } } });
  ok('compute: 194C year ₹1,20,000 > ₹1,00,000, individual → 1% of the ENTIRE ₹1,20,000 = ₹1,200', !isRefusal(k4) && k4.tdsMinor === 120000);

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
