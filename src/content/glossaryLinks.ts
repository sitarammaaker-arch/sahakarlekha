/**
 * Glossary links written by hand in articles (Phase L8).
 *
 * Blog markdown links `[text](/glossary/<slug>)` to terms by slug. 392 of 570 such links pointed at
 * 262 slugs that are not in the glossary (trial-balance, reserve-fund, cm-pacs …); GlossaryTerm then
 * bounced the reader to the /glossary index. The fix lives at render time — the same rule in the
 * React renderer (GuideMarkdown) and the static prerender — so content never has to be rewritten:
 *   - slug exists            → link as written
 *   - exact synonym exists   → link to that term (ALIASES; only same-meaning pairs)
 *   - otherwise              → plain text (the words stay, the dead link goes)
 * When a missing term is later added to the glossary, its links come back on their own.
 * Pure (no imports) so the prerender script can load it too.
 */
export const GLOSSARY_ALIASES: Record<string, string> = {
  registrar: 'registrar-of-cooperative-societies',
  'registrar-cooperative': 'registrar-of-cooperative-societies',
  'marketing-society': 'marketing-cooperative',
  nomination: 'nominee',
};

const GLOSSARY_HREF = /^\/glossary\/([^/?#]+)\/?([?#].*)?$/;

/** The href to render, or null to render the link text as plain text. Non-glossary hrefs pass through. */
export function resolveGlossaryHref(href: string | undefined, exists: (slug: string) => boolean): string | null | undefined {
  if (!href) return href;
  const m = GLOSSARY_HREF.exec(href);
  if (!m) return href;
  const slug = decodeURIComponent(m[1]);
  if (exists(slug)) return href;
  const alias = GLOSSARY_ALIASES[slug];
  if (alias && exists(alias)) return `/glossary/${alias}${m[2] || ''}`;
  return null;
}
