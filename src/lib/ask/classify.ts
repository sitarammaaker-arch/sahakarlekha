/**
 * Lane classification — CAIOS blueprint §4.2, Stage 2. PURE.
 *
 * Reads the QUESTION FRAME that retrieval throws away. `rank.ts` strips "क्या है /
 * kaise / कितना" as stopwords and must — with AND-matching, a question word keeps only
 * documents containing a question word. But those words are the only place the user
 * says what KIND of answer they want, so they are read HERE, before retrieval sees the
 * query (CAIOS-K10: classify on the frame, retrieve on the rest).
 *
 * Why this is routing and not ranking: a "prefer definitions" weight in the scorer
 * would score better against a definition-heavy golden set while making real search
 * worse — overfitting the eval. The lane picks WHICH corpus to search; the ranker still
 * decides what wins inside it. Route on intent, rank on relevance, never conflate them.
 *
 * Deterministic and free — no model. Village societies ask the same ~200 questions
 * (CAIOS-K2: never pay a model for what a lookup can answer).
 */

import type { SearchType } from '../search/rank';

/** F=fact · K=knowledge · D=society data · A=action · N=navigation. §4.2 */
export type Lane = 'F' | 'K' | 'D' | 'A' | 'N';

export interface Intent {
  lane: Lane;
  /** Which doc types this lane searches. Empty = all (no opinion). */
  corpus: SearchType[];
  /** Why this lane — carried into the audit row so a routing mistake is diagnosable. */
  reason: string;
}

const has = (t: string, words: string[]) => words.some((w) => t.includes(w));

/* The frames, in both scripts. Order matters: a query can carry more than one signal,
   and the first match wins, so the most consequential signal is tested first. */

/** "कितना बकाया", "रोकड़ शेष", "how much" — wants a NUMBER. */
const QUANTITATIVE = [
  'कितना', 'कितने', 'कितनी', 'शेष', 'बकाया', 'बैलेंस', 'balance', 'outstanding',
  'kitna', 'kitne', 'kitni', 'how much', 'how many', 'total', 'कुल',
];

/**
 * "मेरी समिति का…", "हमारा…", "my …" — the user is asking about THEIR books.
 *
 * Quantitative alone is NOT enough to mean D-lane, and getting this wrong is the
 * difference between a useful marketing site and an insulting one: a visitor asking
 * "कितना खर्चा आएगा?" wants pricing, and answering "पहले login करें" would be absurd.
 * The possessive is what turns a number question into a question about a ledger.
 *
 * Note this is the same lesson as CAIOS-K10, one layer down: `rank.ts` stopwords
 * "मेरी/मेरा/my" because no document contains them — but they are exactly what tells
 * us whose books are meant. The frame is noise for matching and signal for routing.
 */
const POSSESSIVE = [
  'मेरी', 'मेरा', 'मेरे', 'हमारी', 'हमारा', 'हमारे', 'अपनी', 'अपना', 'अपने',
  'meri', 'mera', 'mere', 'hamari', 'hamara', 'my ', 'our ', 'apni', 'apna',
];

/** "दर", "सीमा", "धारा", "%" — wants a REGULATED SPECIFIC. F-lane. */
const REGULATED = [
  'दर ', 'दरें', 'रेट', 'सीमा', 'धारा', 'प्रतिशत', 'लिमिट', 'threshold', 'rate',
  'section', 'limit', 'slab', 'स्लैब', 'छूट', 'deduction', 'due date', 'आखिरी तारीख',
  'अंतिम तिथि', 'deadline', 'कब तक',
];

/** "कैसे करें", "कहाँ है", "how do i" — wants a PROCEDURE or a place in the app. */
const PROCEDURAL = [
  'कैसे', 'कहाँ', 'कहां', 'kaise', 'kahan', 'how do', 'how to', 'where is', 'where do',
  'जोड़ें', 'बनाएं', 'बनाएँ', 'निकालें', 'डालें', 'खोलें', 'kaha',
];

/** "क्या है", "मतलब", "what is" — wants a DEFINITION. */
const DEFINITIONAL = [
  'क्या है', 'क्या हैं', 'क्या होता', 'क्या होती', 'किसे कहते', 'मतलब', 'अर्थ',
  'kya hai', 'kya hota', 'kya h', 'what is', 'what are', 'meaning', 'define',
  'किसे बोलते', 'क्या होते',
];

/** "बना दो", "कर दो" — wants an ACTION. A-lane: draft only, never commit (AI-P4). */
const ACTION = [
  'बना दो', 'कर दो', 'डाल दो', 'भेज दो', 'बनाओ', 'करो', 'draft', 'create it', 'post it',
];

/**
 * PURE — pick the lane from the raw query (before stopwords strip the frame).
 *
 * `hasSociety` matters: "कितना बकाया" from an anonymous visitor is not a D-lane query,
 * because there is no society to ask about. Anonymous is a first-class context, not a
 * degraded one (§4.3) — it just cannot reach society data (§5.1, CAIOS-K8).
 */
export function classify(text: string, hasSociety: boolean): Intent {
  const t = text.toLowerCase().trim();

  if (has(t, ACTION)) {
    return { lane: 'A', corpus: [], reason: 'action verb — draft only, human commits (AI-P4)' };
  }
  // Regulated before quantitative: "194Q की सीमा कितनी है" carries both, and the
  // statutory reading is the consequential one — a wrong rate is a compliance event.
  if (has(t, REGULATED)) {
    return { lane: 'F', corpus: [], reason: 'regulated specific — exact versioned lookup, never a document' };
  }
  // D needs a number AND an owner. A logged-in user asking "रोकड़ शेष कितना" means
  // their own books; an anonymous visitor saying "मेरी समिति का…" means theirs too,
  // and deserves an honest "please log in" rather than a document that dodges them.
  // Without either signal, "कितना" is just a question about the world (pricing, a
  // concept) and belongs in the ordinary corpus.
  if (has(t, QUANTITATIVE) && (hasSociety || has(t, POSSESSIVE))) {
    return { lane: 'D', corpus: [], reason: 'quantitative + owned — tool call, never retrieval' };
  }
  if (has(t, PROCEDURAL)) {
    // Help is the DO layer; guide/cookbook are how-it-works. Glossary stays in scope
    // because several KIs are themselves task KIs ("सदस्य कैसे जोड़ें" = KI-000327).
    return { lane: 'N', corpus: ['help', 'cookbook', 'guide', 'glossary'], reason: 'procedural — the DO layer' };
  }
  if (has(t, DEFINITIONAL)) {
    return { lane: 'K', corpus: ['glossary', 'guide', 'faq'], reason: 'definitional — the KI corpus' };
  }
  // No frame at all ("trial balance", "PACS") — a bare term. The user gave us no
  // signal about the kind of answer they want, so we must not invent one: search
  // everything and let relevance decide. This is the honest default, and it is what
  // /ask did for its whole life before lanes existed.
  return { lane: 'K', corpus: [], reason: 'bare term — no frame given, no corpus opinion' };
}
