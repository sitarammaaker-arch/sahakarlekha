/**
 * The ranker — pure. Takes documents, returns ranked documents. Imports nothing.
 *
 * Extracted from siteSearch.ts (which still owns buildIndex() and the public
 * `search()`) so the SAME scoring can run in three places without being copied:
 *   • the browser        — siteSearch.ts feeds it the Vite-built index
 *   • the Edge Function  — ask-core feeds it the generated corpus (CAIOS Slice 1)
 *   • the eval harness   — scripts/eval-ask.mjs, so the baseline measures shipped code
 * A second copy of this scoring would drift, and the day it drifted the assistant
 * and the search box would disagree in front of a user (RULE 2's failure mode).
 *
 * No I/O, no globs, no content imports — that is the whole point.
 */

export type SearchType = 'help' | 'cookbook' | 'guide' | 'blog' | 'faq' | 'glossary' | 'calculator';

export interface SearchDoc {
  id: string;
  type: SearchType;
  title: string;
  url: string;
  snippet: string;
  category?: string;
  /** for cookbook docs: the Dr/Cr posting, so an answer can show it inline */
  lines?: { account: string; type: 'Dr' | 'Cr' }[];
  /**
   * Title-weight text that is scored but NEVER displayed. Exists because a KI's
   * display title is built as `hindiName · englishName`, which drops the KI's own
   * `title` field — and that is exactly where acronyms live ("PACS (Primary
   * Agricultural Credit Society)"). Without this the KI *about* PACS scored 4
   * (haystack hit) while a blog merely *mentioning* PACS scored 10 (title hit).
   * Display stays untouched; only ranking sees this. Measured by `npm run eval:ask`.
   */
  altTitle?: string;
  /** lowercased searchable haystack */
  haystack: string;
}
export interface SearchResult extends SearchDoc { score: number }

// Synonym groups — variants (Devanagari / roman / common typos / abbreviations) that
// should reach the same docs. Seeded from the cooperative-accounting Hinglish glossary.
export const SYNONYMS: string[][] = [
  ['member', 'membar', 'sadasya', 'सदस्य', 'मेम्बर'],
  ['voucher', 'vouchar', 'वाउचर', 'entry', 'एंट्री'],
  ['trial balance', 'tb', 'ट्रायल बैलेंस', 'talpat', 'तलपट'],
  ['balance sheet', 'बैलेंस शीट', 'tulan'],
  ['ledger', 'khata', 'खाता', 'लेजर', 'account', 'खाते'],
  ['opening', 'ओपनिंग', 'prarambhik', 'प्रारंभिक'],
  ['cash', 'nakad', 'नकद', 'कैश'],
  ['bank', 'बैंक'],
  ['loan', 'rin', 'ऋण', 'लोन', 'karz', 'कर्ज'],
  ['interest', 'byaj', 'ब्याज'],
  ['sale', 'bikri', 'बिक्री', 'sales'],
  ['purchase', 'kharid', 'खरीद', 'kharidari'],
  ['salary', 'vetan', 'वेतन', 'tankhwah', 'तनख्वाह'],
  ['depreciation', 'ghisai', 'घिसाई', 'डेप्रिसिएशन', 'मूल्यह्रास'],
  ['stock', 'inventory', 'स्टॉक', 'maal', 'इन्वेंटरी'],
  ['audit', 'ऑडिट', 'ankekshan', 'अंकेक्षण'],
  ['gst', 'जीएसटी'],
  ['tds', 'टीडीएस', '26q'],
  ['share', 'sheyar', 'शेयर', 'capital', 'कैपिटल', 'पूँजी', 'पूंजी', 'punji', 'शेयर कैपिटल', 'अंश पूँजी'],
  ['dividend', 'डिविडेंड', 'labhansh', 'लाभांश'],
  ['reserve', 'रिज़र्व', 'sanchay'],
  ['reconciliation', 'brs', 'समाधान', 'reconcile', 'milan', 'मिलान'],
  ['permission', 'role', 'भूमिका', 'user', 'rights'],
  ['hafed', 'msp', 'एमएसपी', 'mandi', 'मंडी', 'procurement'],
  ['report', 'रिपोर्ट'],
  ['society', 'samiti', 'समिति'],
  ['profit', 'munafa', 'मुनाफ़ा', 'labh', 'लाभ'],
  ['cashbook', 'cash book', 'कैश बुक', 'रोकड़ बही', 'रोकड़', 'कैश', 'rokad'],
  ['daybook', 'day book', 'डे बुक', 'rojnamcha', 'रोज़नामचा', 'रोजनामचा'],
  // Users type the concept; the corpus names it in another script or register.
  // "दोहरा लेखा क्या है?" is docs/kdi/ask-ai-map.md's OWN trigger for KI-000026,
  // yet the KI is titled "डबल एंट्री सिस्टम" — the spec did not reach the content.
  ['double entry', 'दोहरा लेखा', 'डबल एंट्री', 'dohra lekha', 'द्विअंकन'],
  ['federation', 'फेडरेशन', 'शीर्ष संस्था', 'संघ', 'महासंघ'],
  ['difference', 'अंतर', 'बनाम', 'फर्क', 'फ़र्क', 'vs'],
  ['liability', 'लायबिलिटी', 'देयता', 'denadari', 'देनदारी'],
  ['asset', 'एसेट', 'sampatti', 'संपत्ति', 'परिसंपत्ति'],
];

export const norm = (s: string) => s.toLowerCase().trim();

// Grammatical particles that carry no search value and are often absent from the
// content haystack — removing them keeps AND-matching from failing on phrases like
// "GST जमा की एंट्री" (the "की" would otherwise exclude every real answer).
//
// INTERROGATIVES ARE STOPWORDS TOO. This list once held the Hindi particles but not
// the question words, while listing the English `how`/`do` — so with AND-matching
// (`matchedTokens === tokens.length` below) a query kept only docs whose haystack
// contained the question word itself. Since FAQ is the only content type whose
// haystack holds question words, every naturally-phrased Hindi question was funnelled
// to ~18 FAQ items and the 100-KI glossary corpus was unreachable:
//   "PACS" → 3 hits · "PACS है" → 3 hits · "PACS क्या है" → 0.
// A Hindi question ALWAYS carries "क्या है / कैसे करें / कौन होता है"; that is the
// language, not noise. Fixing this moved `npm run eval:ask` from 17.9% to 70.5%.
//
// NOTE — the question word is noise for MATCHING and gold for ROUTING. It says whether
// the user wants a definition ("क्या है"), a procedure ("कैसे") or a number ("कितना").
// The CAIOS lane classifier reads it BEFORE retrieval strips it (blueprint §4.2,
// CAIOS-K10). Dropping it here is correct; dropping it everywhere is not.
export const STOPWORDS = new Set([
  // particles
  'की', 'का', 'के', 'को', 'में', 'से', 'पर', 'और', 'या', 'है', 'हैं', 'कि', 'एक',
  'यह', 'वह', 'हो', 'तो', 'भी', 'पे', 'ने', 'नहीं', 'व',
  // interrogatives — the question frame, never the subject of the question
  'क्या', 'कौन', 'कैसे', 'कब', 'कहाँ', 'कहां', 'क्यों', 'कितना', 'कितने', 'कितनी',
  'किसे', 'किस', 'किसको', 'किसका', 'मतलब',
  // auxiliaries / verb tails that frame a question but carry no topic
  'होता', 'होती', 'होते', 'करें', 'करना', 'करते', 'करती', 'कहते', 'कहा',
  'लें', 'लेना', 'दें', 'देना', 'सकते', 'सकता', 'सकती', 'बनाएं', 'बनाएँ',
  'रहा', 'रही', 'रहे', 'चाहिए', 'गया', 'गई',
  // possessives — "मेरी समिति का…" is about the society, not about "मेरी"
  'मेरा', 'मेरी', 'मेरे', 'मुझे', 'हमारा', 'हमारी', 'अपनी', 'अपना', 'तक',
  // The SAME list in roman script. Users type Hinglish at least as often as
  // Devanagari ("voucher kya hai", "backup kaise le") — the register is the whole
  // reason SYNONYMS exists, so the stopwords must cover it too or Hinglish
  // questions fail exactly the way Devanagari ones did.
  'kya', 'hai', 'hain', 'kaise', 'kaun', 'kab', 'kahan', 'kyon', 'kyun',
  'kitna', 'kitne', 'kitni', 'hota', 'hoti', 'hote', 'karna', 'kare', 'karein',
  'karta', 'karte', 'lena', 'lein', 'dena', 'sakta', 'sakte', 'matlab',
  'mera', 'meri', 'mere', 'mujhe', 'nahi', 'nahin', 'ka', 'ki', 'ke', 'ko',
  'mein', 'se', 'par', 'aur', 'ya', 'ye', 'yeh', 'wo', 'woh',
  // english
  'the', 'a', 'an', 'of', 'to', 'in', 'is', 'for', 'on', 'how', 'do', 'i', 'my',
  'what', 'who', 'when', 'where', 'why', 'which', 'are', 'was', 'does', 'can', 'me',
]);

/** Expand a query token to its synonym set (itself + any group it appears in). */
export function expand(token: string): string[] {
  const set = new Set<string>([token]);
  for (const group of SYNONYMS) {
    if (group.some((g) => g === token || g.includes(token) || token.includes(g))) {
      group.forEach((g) => set.add(g));
    }
  }
  return [...set];
}

/** Levenshtein distance (small strings only) for a 1-typo fallback. */
export function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2; // early out — we only care about <=1
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Query → content tokens, with the question frame removed. */
export function tokenize(query: string): string[] {
  const q = norm(query);
  if (q.length < 2) return [];
  return q.split(/\s+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Rank `docs` against `query`. The scoring function of record — see the module note. */
export function searchIndex(docs: SearchDoc[], query: string, limit = 30): SearchResult[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const results: SearchResult[] = [];

  for (const doc of docs) {
    // altTitle is scored at title weight but never shown — see SearchDoc.altTitle.
    const title = doc.altTitle ? norm(doc.title) + ' ' + norm(doc.altTitle) : norm(doc.title);
    // strip surrounding punctuation so the typo fallback matches e.g. "(depreciation)"
    const words = doc.haystack.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
    let score = 0;
    let matchedTokens = 0;

    for (const token of tokens) {
      const variants = expand(token);
      let hit = false;
      for (const v of variants) {
        if (title.includes(v)) { score += 10; hit = true; break; }
      }
      if (!hit) {
        for (const v of variants) {
          if (doc.haystack.includes(v)) { score += 4; hit = true; break; }
        }
      }
      if (!hit && token.length >= 4) {
        // 1-typo fallback against haystack words
        if (words.some((w) => w.length >= 4 && editDistance(w, token) <= 1)) { score += 2; hit = true; }
      }
      if (hit) matchedTokens++;
    }

    // require every query token to match somehow (AND semantics) for precision
    if (matchedTokens === tokens.length && score > 0) {
      results.push({ ...doc, score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.title.length - b.title.length)
    .slice(0, limit);
}
