/**
 * KI-Powered Glossary — Knowledge Adapter.
 *
 * The glossary is GENERATED from the ACTIVE Knowledge Items (KPP Wave-1A), which
 * live as markdown in /docs/kpp/wave-1-active/KI-*.md. Those KI files are the single
 * source of truth — this module only READS and ADAPTS them into GlossaryEntry shapes.
 * It never stores its own copy of a definition (no duplication of knowledge).
 *
 * Pipeline:  KI markdown (frontmatter + body)  →  parse  →  GlossaryEntry  →  pages.
 * Adding/activating a KI .md file automatically adds a glossary term — no manual writing.
 */

export interface RelatedRef {
  id: string;      // KI-000004
  label: string;   // "Member"
  slug?: string;   // resolved slug if that KI is active (so we can link it)
}

export interface GlossaryEntry {
  // identity (reused from the KI — never minted here)
  id: string;            // KI-000001
  slug: string;          // cooperative-society (from filename)
  topicId: string;       // SCOS cluster (C001)
  evidenceId: string;    // KAE evidence (EV-000001)
  // naming
  title: string;
  hindiName: string;
  englishName: string;
  // classification
  category: string;
  knowledgeType: string;
  difficulty: string;
  personas: string[];
  jurisdiction: string;
  // governance
  evidenceLevel: string;
  readiness: string;     // A | B | C | D
  status: string;        // active
  lastUpdated: string;
  reviewSchedule: string;
  // body fields (definition is the single source of truth)
  definition: string;
  plain: string;
  hindi: string;
  english: string;
  why: string;
  misconceptions: string;        // markdown bullet list
  learningObjectives: string;    // markdown bullet list
  searchIntent: string;
  related: RelatedRef[];
  internalLinks: string[];       // in-app routes (e.g. /guide/introduction)
  modules: string[];             // related software module routes
  suggestedFaq?: string;
  suggestedArticle?: string;
  suggestedHelp?: string;
  suggestedVideo?: string;
  suggestedDownload?: string;
  suggestedCalculator?: string;
  // derived
  keywords: string[];            // lowercased searchable tokens
  initial: string;               // first letter for A–Z grouping (English)
}

/* Raw KI markdown, keyed by absolute path. Root-relative glob → reads the docs folder
   (the KI source of truth) directly; only the active KIs match KI-*.md.
   SCALABILITY NOTE: `eager` bundles every matched .md into a shared chunk that any page
   importing this module (the glossary pages, site search, and the in-module GlossaryHint)
   pulls in. Fine at the current ~50 entries (~20 KB gzip). Past a few hundred KIs, switch
   to a build-time generated compact JSON index (slug/title/shortDef) for hints+search and
   lazy-load full bodies only on the term page — keeps the KI files the single source while
   shrinking the shared bundle. */
const RAW = import.meta.glob('/docs/kpp/wave-1-active/KI-*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/* ---- minimal frontmatter + body parsing (no extra deps) ---- */

function parseFrontmatter(src: string): { fm: Record<string, string>; body: string } {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { fm: {}, body: src };
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) fm[kv[1].trim()] = kv[2].trim();
  }
  return { fm, body: m[2] };
}

function fmList(v?: string): string[] {
  if (!v) return [];
  return v.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Strip inline markdown so a field renders cleanly as plain text everywhere it is
 * NOT run through a markdown renderer (definition callout, cards, meta description,
 * JSON-LD, tooltips, search). KI bodies use **bold**, *italic*, `code`, [[KI-..]],
 * and [text](url) — none of which should ever show as literal asterisks/brackets.
 */
export function plainText(s: string): string {
  return (s || '')
    .replace(/\[\[[^\]]*\]\]/g, '')              // [[KI-0001]]
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')      // [text](url) → text
    .replace(/[*_`]/g, '')                        // bold / italic / code markers
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a KI body into { label → content } sections keyed on `**Label:**` markers. */
function parseSections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /\*\*([^*\n]+?):\*\*/g;
  const marks: { label: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    marks.push({ label: m[1].trim(), start: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i < marks.length; i++) {
    const next = i + 1 < marks.length ? marks[i + 1].start : body.length;
    const text = body.slice(marks[i].end, next).trim();
    out[marks[i].label] = text;
  }
  return out;
}

/** Normalise a label so `Hindi explanation (आसान हिंदी)` → `hindi explanation`. */
const labelKey = (s: string) => s.replace(/\([^)]*\)/g, '').trim().toLowerCase();

function getSection(sections: Record<string, string>, key: string): string {
  const want = key.toLowerCase();
  for (const k of Object.keys(sections)) {
    if (labelKey(k) === want) return sections[k];
  }
  return '';
}

/** Routes appear as `/foo` tokens, often separated by `·`. */
function parseRoutes(text: string): string[] {
  return Array.from(text.matchAll(/(^|[\s·])(\/[a-z0-9/:_-]+)/gi)).map((mm) => mm[2]);
}

/** Related concepts: `[[KI-000004]] Member · [[KI-000002]] ...` */
function parseRelated(text: string): RelatedRef[] {
  const out: RelatedRef[] = [];
  const re = /\[\[(KI-\d+)\]\]\s*([^·\n]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ id: m[1], label: m[2].replace(/\(planned\)/i, '').trim() });
  }
  return out;
}

function buildEntry(path: string, raw: string): GlossaryEntry | null {
  const { fm, body } = parseFrontmatter(raw);
  if (!fm.knowledge_id || (fm.status && fm.status !== 'active')) return null;
  const file = path.split('/').pop() || '';
  const slug = file.replace(/^KI-\d+-/, '').replace(/\.md$/, '');
  const sections = parseSections(body);

  const title = fm.title || fm.english_name || slug;
  const hindiName = fm.hindi_name || '';
  const englishName = fm.english_name || title;
  const category = fm.category || '';

  const related = parseRelated(getSection(sections, 'related concepts'));
  const internalLinks = parseRoutes(getSection(sections, 'internal links'));
  const modules = parseRoutes(getSection(sections, 'suggested software module'));

  const clean = (s: string) => s.replace(/^—.*$/, '').trim(); // "— (not applicable)" → ""

  const keywords = Array.from(
    new Set(
      [title, hindiName, englishName, category, slug.replace(/-/g, ' ')]
        .join(' ')
        .toLowerCase()
        .split(/[\s/—·,()]+/)
        .filter((t) => t.length >= 2),
    ),
  );

  const initialSrc = (englishName || title).replace(/[^A-Za-z]/g, '');
  const initial = initialSrc ? initialSrc[0].toUpperCase() : '#';

  return {
    id: fm.knowledge_id,
    slug,
    topicId: fm.topic_id || '',
    evidenceId: fm.evidence_id || '',
    title,
    hindiName,
    englishName,
    category,
    knowledgeType: fm.knowledge_type || 'definitional',
    difficulty: fm.difficulty || 'beginner',
    personas: fmList(fm.user_persona),
    jurisdiction: fm.jurisdiction || 'CENTRAL',
    evidenceLevel: fm.evidence_level || '',
    readiness: fm.content_readiness || 'A',
    status: fm.status || 'active',
    lastUpdated: fm.last_updated || '',
    reviewSchedule: fm.review_schedule || '',
    definition: plainText(getSection(sections, 'definition')),
    plain: plainText(getSection(sections, 'plain-language explanation')),
    hindi: plainText(getSection(sections, 'hindi explanation')),
    english: plainText(getSection(sections, 'english explanation')),
    why: plainText(getSection(sections, 'why it matters')),
    misconceptions: getSection(sections, 'common misconceptions'), // rendered via markdown (keeps bullets/bold)
    learningObjectives: getSection(sections, 'learning objectives'),
    searchIntent: plainText(getSection(sections, 'search intent')),
    related,
    internalLinks,
    modules,
    suggestedFaq: clean(getSection(sections, 'suggested faq')) || undefined,
    suggestedArticle: clean(getSection(sections, 'suggested article title')) || undefined,
    suggestedHelp: clean(getSection(sections, 'suggested help page')) || undefined,
    suggestedVideo: clean(getSection(sections, 'suggested video title')) || undefined,
    suggestedDownload: clean(getSection(sections, 'suggested downloadable asset')) || undefined,
    suggestedCalculator: clean(getSection(sections, 'suggested calculator')) || undefined,
    keywords,
    initial,
  };
}

/* Build once at module load. */
const ENTRIES: GlossaryEntry[] = Object.entries(RAW)
  .map(([path, raw]) => buildEntry(path, raw))
  .filter((e): e is GlossaryEntry => e != null)
  .sort((a, b) => a.englishName.localeCompare(b.englishName));

/* id → slug map so related-concept refs to OTHER active KIs become links. */
const ID_TO_SLUG = new Map<string, string>(ENTRIES.map((e) => [e.id, e.slug]));
for (const e of ENTRIES) {
  for (const r of e.related) r.slug = ID_TO_SLUG.get(r.id);
}

export function allGlossary(): GlossaryEntry[] {
  return ENTRIES;
}

export function findTerm(slug: string): GlossaryEntry | null {
  return ENTRIES.find((e) => e.slug === slug) ?? null;
}

/** First sentence of a term's (already plain) definition — for tooltips/hover cards. */
export function shortDefinition(e: GlossaryEntry, max = 200): string {
  const first = e.definition.split(/(?<=[।.])\s/)[0] || e.definition;
  return first.length > max ? first.slice(0, max).trimEnd() + '…' : first;
}

/** Entries grouped A–Z by English initial (for the index page). */
export function glossaryByLetter(): { letter: string; items: GlossaryEntry[] }[] {
  const map = new Map<string, GlossaryEntry[]>();
  for (const e of ENTRIES) {
    const arr = map.get(e.initial) || [];
    arr.push(e);
    map.set(e.initial, arr);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([letter, items]) => ({ letter, items }));
}

/** Lightweight client filter: matches title/hindi/english/keywords + simple typo tolerance. */
export function filterGlossary(query: string): GlossaryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return ENTRIES;
  const toks = q.split(/\s+/).filter(Boolean);
  return ENTRIES.filter((e) => {
    const hay = `${e.title} ${e.hindiName} ${e.englishName} ${e.keywords.join(' ')} ${e.category}`.toLowerCase();
    return toks.every((t) => hay.includes(t) || (t.length >= 4 && e.keywords.some((k) => k.startsWith(t.slice(0, 4)))));
  });
}

/**
 * Module route → related glossary slugs. Drives the in-app context-help bar shown on
 * EVERY module via MainLayout (one integration point, no per-module edits). Only slugs
 * that resolve to an ACTIVE glossary term render; unknown routes show nothing.
 */
export const MODULE_TERMS: Record<string, string[]> = {
  '/vouchers': ['voucher', 'debit', 'credit', 'double-entry'],
  '/compound-voucher': ['voucher', 'double-entry'],
  '/cash-book': ['cash-book', 'cash'],
  '/bank-book': ['bank-book', 'bank-account', 'cheque'],
  '/bank-reconciliation': ['bank-statement', 'bank-book'],
  '/ledger': ['ledger', 'ledger-account', 'posting'],
  '/ledger-heads': ['account', 'books-of-account'],
  '/day-book': ['day-book', 'journal'],
  '/trial-balance': ['double-entry', 'ledger'],
  '/balance-sheet': ['accounting-equation', 'asset', 'liability', 'capital'],
  '/profit-loss': ['income', 'expense', 'how-to-read-financial-reports'],
  '/trading-account': ['income', 'expense', 'how-to-read-financial-reports'],
  '/receipts-payments': ['cash-book', 'how-to-read-financial-reports'],
  '/reports': ['how-to-read-financial-reports'],
  '/dashboard': ['accounting', 'accounting-cycle', 'how-to-read-financial-reports'],
  '/members': ['membership', 'member', 'nominal-member'],
  '/member-application': ['membership', 'member'],
  '/share-register': ['share', 'paid-up-capital', 'face-value'],
  '/society-setup': ['society-setup', 'society-types', 'financial-year'],
  '/opening-balances': ['financial-year', 'accounting-equation'],
  '/backup-restore': ['data-backup'],
};

/** Resolve the active glossary terms for a module route (filters out any non-active slugs). */
export function termsForRoute(pathname: string): GlossaryEntry[] {
  const slugs = MODULE_TERMS[pathname];
  if (!slugs) return [];
  return slugs.map((s) => findTerm(s)).filter((e): e is GlossaryEntry => e != null);
}

/** Up to `n` related glossary terms for a "learning path" (active refs first, then same category). */
export function learningPath(slug: string, n = 6): GlossaryEntry[] {
  const self = findTerm(slug);
  if (!self) return [];
  const out: GlossaryEntry[] = [];
  const push = (e?: GlossaryEntry | null) => { if (e && e.slug !== slug && !out.find((x) => x.slug === e.slug)) out.push(e); };
  for (const r of self.related) if (r.slug) push(findTerm(r.slug));
  for (const e of ENTRIES) if (e.category === self.category) push(e);
  return out.slice(0, n);
}
