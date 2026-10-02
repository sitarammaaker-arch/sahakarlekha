/**
 * J2 · per-article metadata derived from a blog post's markdown — reading time and the intro preview.
 * PURE. Computed at BUILD time by the `blog-md-meta` Vite plugin (`./*.md?meta`), so list pages
 * (landing, blog index, author) no longer ship all 115 article bodies (~3 MB raw / ~620 KB gzip) just
 * to print "5 मिनट". The article page loads its own body on demand.
 */

export interface BlogMdMeta {
  /** Estimated reading time in minutes (Hindi ~130 wpm), H1 excluded. */
  minutes: number;
  /** First whole paragraphs of prose (markdown stripped), ≥ `INTRO_MAX` chars when available. */
  intro: string;
}

export const INTRO_MAX = 300;

export function blogMdMeta(raw: string): BlogMdMeta {
  const body = raw.replace(/^#\s+.*(\r?\n)+/, '');
  const words = body.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 130));

  const paras = raw
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b && !/^(#|>|[-*]\s|\d+\.\s|\||---|```)/.test(b));
  let intro = '';
  for (const b of paras) {
    const t = b
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    intro = intro ? intro + ' ' + t : t;
    if (intro.length >= INTRO_MAX) break;   // whole paragraphs only — never cut mid-sentence
  }
  return { minutes, intro };
}
