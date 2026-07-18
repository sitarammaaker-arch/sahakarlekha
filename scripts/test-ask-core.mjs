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

  /* THE PAYOFF, and the whole reason Slice 2 preceded the model: a CA-verified rule
     turns the hedge into a fact. 194Q was seeded ₹50,00,000 and hedged; the CA said
     ₹10,00,000 (under the 2025 Act, where s.194Q no longer exists). Now it answers.
     Every rule a human confirms converts one refusal — and nothing else does. */
  /* 194Q, settled by the Act's own text (s.393(1) Table Sl. No. 8(ii), read from
     incometaxindia.gov.in): ₹50,00,000 at 0.1%. It went unverified → verified(wrong) →
     unverified → verified(sourced), and each move was driven by evidence rather than by
     who spoke last. That round trip is the mechanism working, not thrashing. */
  const q = run('194Q की सीमा कितनी है');
  ok('F-lane: 194Q answers — settled by the section text', !!q.answer && q.lane === 'F');
  ok('F-lane: states ₹50,00,000, the Act\'s figure', q.answer.includes('50,00,000'));
  ok('F-lane: no guard fired — the rule is verified', q.trace.guard === null);

  const h = run('194H की दर क्या है');
  ok('F-lane: 194H answers too', !!h.answer && h.lane === 'F');

  /* A/4 — 194C now answers through the seam too, stating both variants rather than
     guessing one. The discipline still holds where there is genuinely no rule: GST. */
  const c = run('194C की दर क्या है');
  ok('F-lane: 194C answers through the seam', !!c.answer && c.lane === 'F');
  ok('F-lane: 194C states both variants, not one guess', c.answer.includes('1%') && c.answer.includes('2%'));
  ok('F-lane: GST still refuses — no rule exists at all', run('GST की दर क्या है').answer === null);
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

/* 9 · IDENTITY COMES FROM THE VERIFIED TOKEN, NEVER THE BODY (AI-P2).
   The pure core takes societyId as a parameter — it cannot know where the caller got it.
   So the guarantee lives in the SEAM, and these assertions read the seam's source: a
   test that only exercised ask() would pass while the hole stayed wide open. Grepping
   source is a blunt instrument, but the alternative is trusting a comment. */
{
  const seam = readFileSync(resolve(ROOT, 'supabase', 'functions', 'ai-ask', 'index.ts'), 'utf8');
  const client = readFileSync(resolve(ROOT, 'src', 'lib', 'ask', 'client.ts'), 'utf8');

  ok('seam: never passes body.societyId into ask()', !/societyId:\s*typeof body\.societyId/.test(seam));
  ok('seam: never passes body.userId into ask()', !/userId:\s*typeof body\.userId/.test(seam));
  // BY VALUE, explicitly. The argless getUser() reads auth-js's _useSession — the client's own
  // stored session, which a server has no business having; reused Edge isolates made identity
  // intermittent. So the bare form is now the REGRESSION, not the guarantee: assert the token
  // goes in as an argument AND that nobody reintroduces the ambient-session call.
  ok('seam: verifies the bearer token by value, not from ambient session state',
    /auth\.getUser\(bearer\)/.test(seam) && !/auth\.getUser\(\s*\)/.test(seam));
  ok('seam: resolves the society from society_users, not the request',
    /from\('society_users'\)/.test(seam) && /select\('society_id'\)/.test(seam));
  ok('seam: treats the anon key as NO user — a public visitor is not authenticated',
    /bearer !== anonKey/.test(seam));
  ok('seam: only active users resolve a society', /is_active['"]?,\s*true\)/.test(seam));
  ok('seam: the AUDIT row records the verified id, not the claim',
    /society_id: societyId \|\| 'anonymous'/.test(seam) && !/society_id: \(body\.societyId/.test(seam));
  ok('seam: an unverifiable token stays anonymous, never falls back to the body',
    /societyId = undefined;/.test(seam));
  ok('client: no longer offers a societyId parameter to be believed',
    !/societyId\?: string/.test(client));

  /* THE FETCH (Slice 4). The service-role client BYPASSES RLS, so the `.eq('society_id')`
     is not a belt-and-braces filter — it IS the tenant boundary. It is the one line in
     this function that, if wrong, shows one society another's cash. Asserted by reading
     the source: no unit test of ask() can see it, because ask() is handed the books.

     That line no longer sits next to `from('ledger_events')`: the paging fix funnelled every
     read through fetchAllRows, so the boundary is now ONE choke point shared by both tables.
     Assert it where it actually lives — the helper scopes, and each call site hands it the
     VERIFIED societyId — rather than expecting the two adjacent on one line. */
  const helperScopes = /\.select\(columns\)\s*\.eq\('society_id', societyId\)/.test(seam);
  ok('fetch: the one paging helper scopes EVERY read to a society — the service-role client bypasses RLS',
    helperScopes);
  ok('fetch: ledger_events is scoped to the VERIFIED societyId',
    helperScopes && /fetchAllRows\(\s*db,\s*'ledger_events',\s*'\*',\s*societyId,/.test(seam));
  ok('fetch: accounts is scoped to the VERIFIED societyId',
    helperScopes && /fetchAllRows\(\s*db,\s*'accounts',\s*'\*',\s*societyId,/.test(seam));
  // The books are paged to exhaustion in a TOTAL order — occurred_at ties on event_id, or rows
  // repeat and vanish across pages and the assistant states a confidently wrong balance.
  ok('fetch: the journal pages in a total order (occurred_at ties broken on the event_id PK)',
    /fetchAllRows\(\s*db,\s*'ledger_events',\s*'\*',\s*societyId,\s*\['occurred_at',\s*'event_id'\]\)/.test(seam));
  ok('fetch: never scoped to body.societyId', !/eq\('society_id', body\./.test(seam));
  ok('fetch: branch comes from the JWT claim, not the body',
    /user_branch_id/.test(seam) && !/activeBranchId: body\./.test(seam));
  ok('fetch: only loads the books for a D-lane question — a journal per "क्या है" is waste',
    /probe\.lane === 'D'/.test(seam));
  ok('fetch: a failed load leaves society undefined (the D-lane then refuses)',
    /catch\s*\{[\s\S]{0,240}\}/.test(seam) && !/society = \{[^}]*\}\s*;?\s*\}\s*catch/.test(seam));
  ok('audit: records WHAT LEDGER WAS READ — an auditor must reconstruct what the AI saw',
    /ledgerRead:/.test(seam));
}

/* 10 · THE D-LANE, WIRED (Slice 4). The society's books are INJECTED — the fetch is the
   seam's job (I/O), the decision is the core's (pure). Every branch below is a refusal
   except one, and that ratio is the design: a D-lane question answered from anything but
   the ledger is the whole reason the lane exists. */
{
  const CASH = '3301';
  const accounts = [{ id: CASH, name: 'Cash in Hand', openingBalance: 50000, openingBalanceType: 'debit' }];
  const ev = (id, date, legs) => ({
    eventId: 'e-' + id, eventType: 'voucher.posted', schemaVersion: 1, tenantId: 'SOC001',
    jurisdiction: 'hr', aggregateType: 'voucher', aggregateId: id, sequence: 1,
    occurredAt: date + 'T10:00:00Z', producer: { kind: 'human', id: 'u1' },
    payload: { id, date, voucherNo: 'V-' + id, narration: 't', createdAt: date + 'T10:00:00Z', lines: legs },
  });
  const events = [ev('v1', '2026-04-10', [{ accountId: CASH, drCr: 'Dr', amountMinor: 100000 }])];
  const books = { events, accounts, activeBranchId: '', headOfficeBranchId: 'HO' };
  const withBooks = (text, s = books, over = {}) =>
    ask({ text, channel: 'web', societyId: 'SOC001', ...over }, CORPUS, ON, TODAY, 8, s);

  /* D-LANE FIGURES ARE DISABLED (RULE 2). The seam reads the RAW journal; the app trusts it
     only when ledgerParity confirms it matches the vouchers, else it uses voucher STATE.
     Proven on the founder's books: the raw journal over-counted the trial balance by ₹51
     lakh — 6 recently-cancelled vouchers keep a live `voucher.posted` event with no
     cancellation event, so the journal has drifted from state. Until the seam reads the same
     source the page shows, it MUST NOT state a figure: a confident wrong balance is worse
     than "I don't know". The TOOLS stay correct (test:tool-cash-balance /
     test:tool-trial-balance prove the arithmetic); it is the DATA that is not trustworthy,
     so ask() refuses at the D-lane. Remove the guard in core.ts to re-enable once the seam
     matches getTrialBalance. */
  const r = withBooks('रोकड़ शेष कितना है');
  ok('D-lane: with books, REFUSES a figure — disabled until parity-checked (RULE 2)',
    r.lane === 'D' && r.answer === null);
  ok('D-lane: the refusal is the unverified-source message, not a wrong number',
    (r.unanswered || '').includes('सटीक आँकड़ा नहीं'));
  ok('D-lane: the trace says WHY it is disabled', (r.trace.guard || '').includes('disabled'));

  /* Anonymous can never reach the books (AI-N5) — refused BEFORE the disable guard, with the
     login message, so the two refusals stay distinguishable. The possessive is what makes it
     a D question at all (§4.2 — D needs quantitative AND an owner). */
  const anon = ask({ text: 'मेरी समिति का रोकड़ शेष कितना है', channel: 'web' }, CORPUS, ON, TODAY, 8, books);
  ok('D-lane: anonymous refuses even when books are present', anon.lane === 'D' && anon.answer === null);
  ok('D-lane: ...and says to log in (a different refusal than the disable)',
    (anon.unanswered || '').includes('login'));

  // Books absent ⇒ refuse and blame the LOAD — also before the disable guard.
  const noBooks = ask({ text: 'रोकड़ शेष कितना है', channel: 'web', societyId: 'SOC001' }, CORPUS, ON, TODAY, 8);
  ok('D-lane: no books loaded ⇒ refuses, never guesses', noBooks.answer === null);
  ok('D-lane: ...and blames the load, not the user', (noBooks.unanswered || '').includes('लोड'));

  /* THE ECR-17 SCOPE, surfaced. A branch's figure legitimately excludes the society's
     opening. The branch-scope handling lives in the tool (test:tool-cash-balance covers it);
     while the D-lane is disabled, a branch view refuses like any other. */
  const br = withBooks('रोकड़ शेष कितना है', { ...books, activeBranchId: 'BR1' });
  ok('D-lane: a branch view also refuses while disabled (RULE 2)', br.lane === 'D' && br.answer === null);

  // The kill switch still governs the books, not just the corpus.
  const off = ask({ text: 'रोकड़ शेष कितना है', channel: 'web', societyId: 'SOC001' },
    CORPUS, { globalEnabled: false }, TODAY, 8, books);
  ok('D-lane: AI off ⇒ degraded, the books are never touched', off.degraded === true && off.answer === null);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
