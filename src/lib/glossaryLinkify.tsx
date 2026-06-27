/**
 * glossaryLinkify — turns the FIRST mention of each glossary term inside body text
 * into a link to its glossary page (with a native title tooltip). Used by GuideMarkdown
 * (opt-in) for blog + guide content.
 *
 * Safety rules (avoid over-linking / broken text):
 *   • Match the Devanagari term name only (Hindi-first content; precise inflection).
 *   • Whole-word match via Unicode boundaries (not inside a longer/inflected word):
 *     a letter OR combining mark on either side disqualifies the match.
 *   • Each term links at most once per render; a hard cap bounds total links.
 *   • Operates only on plain-string text nodes (callers skip headings/code/links).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { allGlossary, findTerm, shortDefinition } from '@/content/glossary';

interface Needle { re: RegExp; slug: string; }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Precompiled, longest-first so multi-word terms ("कैश बुक") win over "कैश". */
const NEEDLES: Needle[] = (() => {
  const list = allGlossary()
    .filter((e) => e.hindiName && e.hindiName.length >= 2)
    .map((e) => ({ needle: e.hindiName, slug: e.slug }))
    .sort((a, b) => b.needle.length - a.needle.length);
  return list.map(({ needle, slug }) => {
    let re: RegExp;
    try {
      re = new RegExp(`(?<![\\p{L}\\p{M}])${esc(needle)}(?![\\p{L}\\p{M}])`, 'u');
    } catch {
      re = new RegExp(esc(needle)); // very old engines: fall back to plain match
    }
    return { re, slug };
  });
})();

export interface LinkifyState { seen: Set<string>; count: number; cap: number }

export function newLinkifyState(cap = 8): LinkifyState {
  return { seen: new Set(), count: 0, cap };
}

/** Replace the earliest unseen term in `text` with a tooltip link, then recurse on the rest. */
export function linkifyText(text: string, state: LinkifyState): React.ReactNode {
  if (!text || state.count >= state.cap) return text;
  let best: { index: number; len: number; slug: string } | null = null;
  for (const n of NEEDLES) {
    if (state.seen.has(n.slug)) continue;
    const m = n.re.exec(text);
    if (m && (best === null || m.index < best.index || (m.index === best.index && m[0].length > best.len))) {
      best = { index: m.index, len: m[0].length, slug: n.slug };
    }
  }
  if (!best) return text;
  state.seen.add(best.slug);
  state.count++;
  const before = text.slice(0, best.index);
  const matched = text.slice(best.index, best.index + best.len);
  const after = text.slice(best.index + best.len);
  const term = findTerm(best.slug);
  // Plain link + native title tooltip — light (no per-term Radix instance), keyboard/SR accessible.
  return (
    <>
      {before}
      <Link
        to={`/glossary/${best.slug}`}
        title={term ? shortDefinition(term, 160) : undefined}
        className="text-primary/90 underline decoration-dotted decoration-primary/40 underline-offset-2 hover:decoration-solid"
      >
        {matched}
      </Link>
      {linkifyText(after, state)}
    </>
  );
}
