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
  stateVaries: 'ध्यान दें: यह नियम हर राज्य में अलग हो सकता है।',
  action:
    'मैं वाउचर या कोई भी प्रविष्टि खुद नहीं बना सकता — यह अभी उपलब्ध नहीं है। ' +
    'फ़िलहाल यह काम आपको स्वयं करना होगा।',
  needLogin: 'अपनी समिति का आँकड़ा देखने के लिए आपको login करना होगा।',
  noData: 'यह आपकी समिति के आँकड़े से जुड़ा सवाल है, पर यह सुविधा अभी उपलब्ध नहीं है।',
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
    // Slice 2 gives this lane a rules engine to look up. Until then it must hedge —
    // and hedging is the CORRECT behaviour, not a gap: a rate stated without a
    // versioned, cited source is a compliance event waiting to happen (AI-N3/AI-N8).
    const hits = searchIndex(docs, req.text, limit);
    return base({
      lane: 'F',
      unanswered: SAY.regulated + (jurisdiction ? '' : ' ' + SAY.stateVaries),
      cites: hits.map(cite),
      trace: { reason: intent.reason, jurisdiction, asOf, corpus: [], retrieved: hits.map((h) => h.id), guard: 'F-lane: no rule source (Slice 2)', model: null },
    });
  }
  if (intent.lane === 'D') {
    return base({
      lane: 'D',
      unanswered: req.societyId ? SAY.noData : SAY.needLogin,
      trace: { reason: intent.reason, jurisdiction, asOf, corpus: [], retrieved: [], guard: 'D-lane: no tools (Slice 4)', model: null },
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
