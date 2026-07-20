/**
 * ask-core — the CAIOS mechanism. PURE: no I/O, no fetch, no model, no clock.
 *
 * This is the pipe a question travels down (blueprint §4). Slice 1 wires stages 1–5
 * and assembles the answer WITHOUT a model, so the whole mechanism runs — gated,
 * jurisdiction-resolved, guarded and auditable — at zero token cost. The model is a
 * later slice that slots into stage 6 and must beat this one's eval score to ship.
 *
 *   1 GATE       killSwitch (AI-G4) — checked first, so "off" is instant and total
 *   2 CLASSIFY   the lane, from the question frame (classify.ts, CAIOS-K10)
 *   3 CONTEXT    jurisdiction / asOf / authenticated (§4.3)
 *   4 RETRIEVE   filter first, rank second — the filter is law, the ranker is detail
 *   5 GUARD      ← the important one. Nothing servable ⇒ the model is NOT called.
 *   6 SYNTHESIZE (no model yet — assemble from the retrieved KI text)
 *   7 VALIDATE   (nothing to validate without a model — see decide())
 *   8 RECORD     the caller's job: this module is pure, the audit write is I/O
 *   9 DELIVER    the channel's job
 *
 * The gate/guard/lane decisions all come back on the result so the seam can record
 * exactly why an answer looked the way it did — "AI ने उस दिन क्या कहा था" is
 * reconstructible (AI-A5), which is the thing you cannot retrofit (IRR-3).
 */

import { searchIndex } from '../search/rank';
import type { SearchDoc, SearchResult, SearchType } from '../search/rank';
import { isAiEnabled } from '../ai/killSwitch';
import type { AiFlags } from '../ai/killSwitch';
import { resolveJurisdiction } from '../jurisdiction';
import { classify } from './classify';
import type { Intent, Lane } from './classify';
import { answerFact, unverifiedHint } from './fact';
import { cashBalance } from './tools/cashBalance';
import { trialBalanceCheck } from './tools/trialBalance';
import type { LedgerEvent } from '../ledger/event';
import type { LedgerAccount } from '@/types';

/**
 * The society's books, INJECTED — the fetch is the seam's job (I/O), the decision is
 * this module's (pure). Same split as `docs`: ask() stays testable without a server,
 * and the one place that touches the network is the one place that is audited.
 *
 * Absent = the seam could not load them. That is a refusal, never a fallback to
 * documents — see the D-lane below.
 */
export interface SocietyData {
  events: readonly LedgerEvent[];
  accounts: readonly LedgerAccount[];
  /** The branch in view. '' / undefined = consolidated. Drives the ECR-17 opening rule. */
  activeBranchId?: string;
  headOfficeBranchId?: string;
}

/* D-lane tool words, in both scripts. Order matters at the routing site: the FIRST
   set whose word appears wins, so a phrase like "ट्रायल बैलेंस का रोकड़" (unlikely, but)
   resolves deterministically. Keep each set to the terms that unambiguously name that
   report — a word shared with another tool belongs in neither. */
const CASH_WORDS = ['रोकड़', 'नकद', 'कैश', 'cash', 'rokad', 'nakad'];
const TB_WORDS = ['ट्रायल बैलेंस', 'ट्रायल', 'trial balance', 'trial', 'तलपट', 'talpat', 'कुल नाम जमा', 'नाम जमा मिलान'];

export type { Lane, Intent };

export type Channel = 'web' | 'app' | 'whatsapp' | 'api';

export interface AskRequest {
  text: string;
  channel: Channel;
  /** absent = anonymous. Anonymous is first-class: F/K/N only, never society data. */
  societyId?: string;
  userId?: string;
  /** the society's state — resolved to a jurisdiction key, never trusted raw */
  state?: string;
  /** the rule/version date to answer as-of. Default: the caller's today. */
  asOf?: string;
  sessionId?: string;
}

export interface Citation {
  id: string;
  title: string;
  url: string;
  type: SearchType;
}

export interface AskAnswer {
  lane: Lane;
  /** the assembled answer, or null when the guard refused to assert */
  answer: string | null;
  cites: Citation[];
  confidence: 'high' | 'medium' | 'low';
  /** set when we will not answer — carries the honest reason, in the user's Hindi */
  unanswered?: string;
  /** true = AI is off (or gated); the channel should fall back to plain search */
  degraded?: boolean;
  deeplink?: string;
  /** everything the audit row needs, so stage 8 records the WHY, not just the what */
  trace: {
    reason: string;
    jurisdiction: string;
    asOf: string;
    corpus: SearchType[];
    retrieved: string[];
    guard: string | null;
    model: null;
  };
}

export const ASK_FEATURE = 'ask';

/** Hindi-first, plain second (RULE 7). These are the only user-facing strings here. */
const SAY = {
  unknown: 'मुझे इसका पक्का उत्तर नहीं पता। नीचे के स्रोत देखें, या अपने CA / RCS से पूछें।',
  regulated:
    'यह एक नियामक आँकड़ा है (दर / सीमा / धारा) और मेरे पास इसका प्रमाणित, तिथि-सहित स्रोत नहीं है — ' +
    'इसलिए मैं अंदाज़ा नहीं लगाऊँगा। अपने CA / RCS या आधिकारिक पोर्टल से पुष्टि करें।',
  // A different, more useful truth than "मुझे नहीं पता": the rule is in the catalog,
  // it just has not been checked by a human yet — and it names what to check.
  unverified: (cite: string) =>
    'इसका नियम मेरे पास दर्ज तो है, पर अभी किसी इंसान ने उसे सत्यापित नहीं किया — ' +
    'इसलिए मैं उसे तथ्य की तरह नहीं बोलूँगा। जाँचने योग्य स्रोत: ' + cite,
  stateVaries: 'ध्यान दें: यह नियम हर राज्य में अलग हो सकता है।',
  action:
    'मैं वाउचर या कोई भी प्रविष्टि खुद नहीं बना सकता — यह अभी उपलब्ध नहीं है। ' +
    'फ़िलहाल यह काम आपको स्वयं करना होगा।',
  needLogin: 'अपनी समिति का आँकड़ा देखने के लिए आपको login करना होगा।',
  noData: 'आपकी समिति की बही अभी लोड नहीं हो पाई — इसलिए मैं आँकड़ा नहीं बताऊँगा। दोबारा कोशिश करें।',
  // A D-lane question with no tool must refuse, never fall through to documents: an
  // answer about "your society's stock" pulled from a help article looks like a fact
  // about their books and is not.
  noTool: 'यह आपकी समिति के आँकड़े से जुड़ा सवाल है, पर अभी मैं सिर्फ़ रोकड़ शेष और ट्रायल बैलेंस बता सकता हूँ। बाक़ी के लिए संबंधित रिपोर्ट खोलें।',
  noAccounts: 'आपकी समिति में अभी कोई खाता नहीं मिला — इसलिए मैं ट्रायल बैलेंस नहीं बता सकता।',
  noCashAccount: 'आपकी समिति में रोकड़ खाता नहीं मिला — इसलिए मैं शेष नहीं बता सकता।',
};

const cite = (r: SearchResult): Citation => ({ id: r.id, title: r.title, url: r.url, type: r.type });

/**
 * PURE — run the mechanism. `docs` is the frozen corpus (src/generated/search-index.json);
 * `flags` and `today` are injected so this stays free of I/O and of the clock.
 */
export function ask(
  req: AskRequest,
  docs: SearchDoc[],
  flags: AiFlags,
  today: string,
  limit = 8,
  /** The society's books, when the seam could load them. Absent ⇒ the D-lane refuses. */
  society?: SocietyData,
): AskAnswer {
  const tenant = req.societyId ?? 'anonymous';
  const jurisdiction = req.state ? resolveJurisdiction(req.state) : '';
  const asOf = req.asOf || today;

  const base = (over: Partial<AskAnswer>): AskAnswer => ({
    lane: 'K',
    answer: null,
    cites: [],
    confidence: 'low',
    trace: { reason: '', jurisdiction, asOf, corpus: [], retrieved: [], guard: null, model: null },
    ...over,
  });

  /* 1 · GATE — before anything else, so a kill is instant and total (AI-G4).
     There is no model in this slice, but the gate governs the assistant as a whole:
     off ⇒ the channel degrades to plain search, which is exactly today's product. */
  if (!isAiEnabled(flags, tenant, ASK_FEATURE)) {
    return base({
      degraded: true,
      trace: { reason: 'gate: assistant disabled', jurisdiction, asOf, corpus: [], retrieved: [], guard: 'killSwitch', model: null },
    });
  }

  /* 2 · CLASSIFY — read the question frame before retrieval strips it (CAIOS-K10). */
  const intent = classify(req.text, !!req.societyId);

  /* 3 · CONTEXT is resolved above (jurisdiction, asOf, authenticated). */

  /* Lanes that do not retrieve at all. Answering these from documents is precisely
     the mistake this architecture exists to prevent. */
  if (intent.lane === 'F') {
    /* Slice 2 — Tier 0. An exact, versioned lookup, NEVER a document and never a model.
       Sources are still attached either way, so an answer is checkable and a refusal
       still points somewhere useful. */
    const hits = searchIndex(docs, req.text, limit);
    const fact = answerFact(req.text, { asOf, jurisdiction });

    if (fact) {
      return base({
        lane: 'F',
        answer: fact.text,
        // The citation IS the answer's authority — stated first, ahead of the docs.
        cites: [{ id: fact.ruleKey, title: fact.cite, url: '', type: 'glossary' }, ...hits.map(cite)],
        confidence: 'high', // a verified, effective-dated rule is the only thing here that earns this
        trace: {
          reason: intent.reason, jurisdiction, asOf, corpus: [],
          retrieved: [`rule:${fact.ruleKey}@v${fact.version}`, ...hits.map((h) => h.id)],
          guard: null, model: null,
        },
      });
    }

    /* No VERIFIED rule ⇒ no figure. This is the guarantee, not a gap: a rate stated
       without a versioned, cited source is a compliance event waiting to happen
       (AI-N3/AI-N8). Each rule a human verifies turns one of these into a fact. */
    const pending = unverifiedHint(req.text, { asOf, jurisdiction });
    return base({
      lane: 'F',
      // "I don't know" and "the rule is there but nobody checked it" are different
      // truths. The second one tells the user exactly what would fix it.
      unanswered: (pending ? SAY.unverified(pending) : SAY.regulated) + (jurisdiction ? '' : ' ' + SAY.stateVaries),
      cites: hits.map(cite),
      trace: {
        reason: intent.reason, jurisdiction, asOf, corpus: [],
        retrieved: hits.map((h) => h.id),
        guard: pending ? `F-lane: rule exists but unverified (${pending})` : 'F-lane: no rule for this specific',
        model: null,
      },
    });
  }
  if (intent.lane === 'D') {
    /* Anonymous can never reach society data — no token, no books (§5.1, AI-N5). The
       seam derives identity from the verified JWT, so `societyId` being absent here
       means genuinely nobody, not "the caller didn't say". */
    if (!req.societyId) {
      return base({
        lane: 'D',
        unanswered: SAY.needLogin,
        trace: { reason: intent.reason, jurisdiction, asOf, corpus: [], retrieved: [], guard: 'D-lane: anonymous', model: null },
      });
    }
    /* The seam could not load the books (not passed, fetch failed, RLS said no). Say so
       rather than guess: a D-lane question answered from anything but the ledger is the
       whole reason this lane exists. */
    if (!society) {
      return base({
        lane: 'D',
        unanswered: SAY.noData,
        trace: { reason: intent.reason, jurisdiction, asOf, corpus: [], retrieved: [], guard: 'D-lane: no society data loaded', model: null },
      });
    }

    /* TOOL ROUTING. Each tool owns a word set; the first that matches the question wins.
       A D-lane question we have NO tool for must REFUSE — not fall through to documents.
       "मेरी समिति का स्टॉक कितना है" answered from a help article would be exactly the
       failure the lane split prevents: it looks like an answer about their books and is
       not. Adding a tool = one word set + one branch here + a pure tool file. */
    const q = req.text.toLowerCase();

    // Trial balance — checked before cash so "ट्रायल बैलेंस" never routes on a stray "cash".
    if (TB_WORDS.some((w) => q.includes(w))) {
      const tb = trialBalanceCheck({ events: society.events, accounts: society.accounts, asOf });
      if (!tb) {
        return base({
          lane: 'D',
          unanswered: SAY.noAccounts,
          trace: { reason: intent.reason, jurisdiction, asOf, corpus: [], retrieved: [], guard: 'D-lane: no accounts', model: null },
        });
      }
      /* Every numeral in the answer is a TOOL string, verbatim (§3.7 number check). The
         verdict is the tool's `balanced`, not a re-comparison here. */
      const verdict = tb.balanced
        ? 'मिलता है ✓'
        : `मिलता नहीं ⚠️ — अंतर ${tb.formattedDifference} (कोई प्रविष्टि असंतुलित है)`;
      return base({
        lane: 'D',
        answer: `कुल नाम (Dr): ${tb.formattedDebit} · कुल जमा (Cr): ${tb.formattedCredit}${asOf ? ` (${asOf} तक)` : ''} — ${verdict}`,
        confidence: 'high',
        cites: [{ id: 'tool:trialBalance', title: 'ट्रायल बैलेंस (Trial Balance)', url: '/trial-balance', type: 'help' }],
        trace: {
          reason: intent.reason, jurisdiction, asOf, corpus: [],
          retrieved: [`tool:trialBalance@${tb.accountCount}accounts`],
          guard: tb.balanced ? 'D-lane: trial balance tool' : 'D-lane: trial balance tool (UNBALANCED)',
          model: null,
        },
      });
    }

    if (!CASH_WORDS.some((w) => q.includes(w))) {
      return base({
        lane: 'D',
        unanswered: SAY.noTool,
        trace: { reason: intent.reason, jurisdiction, asOf, corpus: [], retrieved: [], guard: 'D-lane: no tool for this question', model: null },
      });
    }

    const bal = cashBalance({
      events: society.events,
      accounts: society.accounts,
      activeBranchId: society.activeBranchId,
      headOfficeBranchId: society.headOfficeBranchId,
      asOf,
    });
    if (!bal) {
      return base({
        lane: 'D',
        unanswered: SAY.noCashAccount,
        trace: { reason: intent.reason, jurisdiction, asOf, corpus: [], retrieved: [], guard: 'D-lane: no cash account', model: null },
      });
    }

    /* The figure is the TOOL's, verbatim. `bal.formatted` is the only string a model may
       quote (§3.7's number check is a set-membership test on tool output), so it is what
       goes in the answer — never re-formatted here, or the check would fail against its
       own source. */
    const scope = bal.openingIncluded ? '' : ' (शाखा दृश्य — समिति का प्रारंभिक शेष शामिल नहीं)';
    return base({
      lane: 'D',
      answer: `रोकड़ शेष: ${bal.formatted}${asOf ? ` (${asOf} तक)` : ''}${scope}`,
      confidence: 'high', // it came from the ledger, not from a document
      cites: [{ id: 'tool:cashBalance', title: 'रोकड़ बही (Cash Book)', url: '/cash-book', type: 'help' }],
      trace: {
        reason: intent.reason, jurisdiction, asOf, corpus: [],
        retrieved: [`tool:cashBalance@${bal.entryCount}entries`],
        guard: null, model: null,
      },
    });
  }
  if (intent.lane === 'A') {
    return base({
      lane: 'A',
      unanswered: SAY.action,
      trace: { reason: intent.reason, jurisdiction, asOf, corpus: [], retrieved: [], guard: 'A-lane: not built (Slice 6)', model: null },
    });
  }

  /* 4 · RETRIEVE — filter first (law), then rank (detail).
     The corpus filter is the lane's decision; the ranker is untouched by it. */
  const scoped = intent.corpus.length ? docs.filter((d) => intent.corpus.includes(d.type)) : docs;
  let hits = searchIndex(scoped, req.text, limit);
  // A lane's corpus is a preference, not a cage: if scoping found nothing, fall back
  // to everything rather than tell a user "I don't know" about a document we have.
  let widened = false;
  if (!hits.length && intent.corpus.length) {
    hits = searchIndex(docs, req.text, limit);
    widened = hits.length > 0;
  }

  /* 5 · GUARD — the stage that makes "never fabricate" architectural rather than a
     prompt plea. Nothing retrieved ⇒ nothing to ground an answer in ⇒ when a model
     exists, it is NOT called. A model that was never handed a source cannot cite one. */
  if (!hits.length) {
    return base({
      lane: intent.lane,
      unanswered: SAY.unknown,
      trace: { reason: intent.reason, jurisdiction, asOf, corpus: intent.corpus, retrieved: [], guard: 'empty retrieval — model would not be called', model: null },
    });
  }

  /* 6 · SYNTHESIZE — no model in this slice. The top hit's snippet IS the answer, and
     it is the KI's own definition text, so it is grounded by construction. When a
     model lands it replaces this line and nothing else. */
  const top = hits[0];

  /* 7 · VALIDATE — nothing to validate: every cite is from the retrieved set by
     construction and no number was generated. The checks land with the model. */

  return base({
    lane: intent.lane,
    answer: top.snippet || top.title,
    cites: hits.map(cite),
    confidence: top.score >= 10 ? 'high' : top.score >= 4 ? 'medium' : 'low',
    deeplink: intent.lane === 'N' ? top.url : undefined,
    trace: {
      reason: intent.reason + (widened ? ' (widened: lane corpus was empty)' : ''),
      jurisdiction, asOf,
      corpus: widened ? [] : intent.corpus,
      retrieved: hits.map((h) => h.id),
      guard: null,
      model: null,
    },
  });
}
