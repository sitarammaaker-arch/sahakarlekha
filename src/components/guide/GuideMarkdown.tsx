/**
 * GuideMarkdown — renders the SahakarLekha book markdown into the styled
 * /guide pages. Same markdown source also builds the Word/PDF book.
 *
 * Highlights:
 *  - GFM tables → responsive, blue-header, zebra, bordered (matches the book).
 *  - Blockquotes starting with an emoji (💡 ⚠️ 🔍 📘 ✅ 📚) become coloured
 *    callout boxes — the book's "सावधानी / ऑडिट टिप्पणी / केस-स्टडी" blocks.
 *  - ## / ### headings get stable slug ids so the in-chapter TOC can link to them.
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* Stable slug for heading anchors — keeps Devanagari letters, used by both
   the renderer (id=) and the chapter sub-TOC (href=). Must stay deterministic. */
export const slugifyHeading = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[*`_]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

/* Flatten React children to plain text (to read a heading's / blockquote's text). */
function nodeText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((c) => {
      if (typeof c === 'string' || typeof c === 'number') return String(c);
      if (React.isValidElement(c)) return nodeText((c.props as { children?: React.ReactNode }).children);
      return '';
    })
    .join('');
}

/* Callout colour map keyed by the blockquote's leading emoji. */
const CALLOUTS: Record<string, string> = {
  '💡': 'bg-blue-50 border-blue-400 text-blue-900 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-100',
  'ℹ️': 'bg-blue-50 border-blue-400 text-blue-900 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-100',
  '⚠️': 'bg-amber-50 border-amber-400 text-amber-900 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-100',
  '🔍': 'bg-violet-50 border-violet-400 text-violet-900 dark:bg-violet-950/30 dark:border-violet-700 dark:text-violet-100',
  '📘': 'bg-slate-50 border-slate-400 text-slate-800 dark:bg-slate-900/40 dark:border-slate-600 dark:text-slate-100',
  '✅': 'bg-green-50 border-green-400 text-green-900 dark:bg-green-950/30 dark:border-green-700 dark:text-green-100',
  '📚': 'bg-indigo-50 border-indigo-400 text-indigo-900 dark:bg-indigo-950/30 dark:border-indigo-700 dark:text-indigo-100',
};
const DEFAULT_CALLOUT =
  'bg-muted/60 border-primary/40 text-foreground';

const Heading: React.FC<{ level: 2 | 3 | 4; children: React.ReactNode }> = ({ level, children }) => {
  const id = slugifyHeading(nodeText(children));
  const cls =
    level === 2
      ? 'text-xl md:text-2xl font-bold text-foreground mt-8 mb-3 scroll-mt-24'
      : level === 3
      ? 'text-lg font-semibold text-foreground mt-6 mb-2 scroll-mt-24'
      : 'text-base font-semibold text-foreground mt-4 mb-2 scroll-mt-24';
  const Tag = (`h${level}` as unknown) as keyof JSX.IntrinsicElements;
  return (
    <Tag id={id} className={cls}>
      {children}
    </Tag>
  );
};

/* Image renderer — styled figure with caption (alt) that hides itself gracefully
   if the file is missing. Lets future screenshots be added as ![caption](/path.png).
   Uses <span class="block"> (not <figure>) to stay valid inside markdown <p>. */
const GuideImg: React.FC<{ src?: string; alt?: string }> = ({ src, alt }) => {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) return null;
  return (
    <span className="block my-5">
      <img
        src={src}
        alt={alt || ''}
        loading="lazy"
        onError={() => setFailed(true)}
        className="rounded-lg border shadow-sm w-full"
      />
      {alt && <span className="block mt-2 text-xs text-muted-foreground text-center">{alt}</span>}
    </span>
  );
};

const components: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  img: ({ src, alt }) => <GuideImg src={src as string} alt={alt as string} />,
  h1: ({ children }) => (
    <h2 className="text-2xl font-bold text-foreground mt-8 mb-3 scroll-mt-24">{children}</h2>
  ),
  h2: ({ children }) => <Heading level={2}>{children}</Heading>,
  h3: ({ children }) => <Heading level={3}>{children}</Heading>,
  h4: ({ children }) => <Heading level={4}>{children}</Heading>,
  p: ({ children }) => <p className="my-3 leading-relaxed text-foreground/90">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="list-disc pl-6 my-3 space-y-1.5 marker:text-primary">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 my-3 space-y-1.5 marker:text-primary">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  hr: () => <hr className="my-8 border-border" />,
  code: ({ children }) => (
    <code className="px-1.5 py-0.5 rounded bg-muted text-[0.85em] font-mono text-foreground">
      {children}
    </code>
  ),
  blockquote: ({ children }) => {
    const txt = nodeText(children).trim();
    const emoji = Object.keys(CALLOUTS).find((e) => txt.startsWith(e));
    const cls = emoji ? CALLOUTS[emoji] : DEFAULT_CALLOUT;
    return (
      <div className={`my-4 border-l-4 rounded-r-lg px-4 py-3 [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 text-sm md:text-[0.95rem] ${cls}`}>
        {children}
      </div>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-5 rounded-lg border border-border">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-primary text-primary-foreground">{children}</thead>,
  th: ({ children }) => <th className="text-left font-semibold p-2.5 border border-primary/30">{children}</th>,
  tr: ({ children }) => <tr className="even:bg-muted/40 border-b border-border">{children}</tr>,
  td: ({ children }) => <td className="p-2.5 align-top border border-border">{children}</td>,
};

const GuideMarkdown: React.FC<{ source: string }> = ({ source }) => (
  <div className="text-[0.95rem]">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {source}
    </ReactMarkdown>
  </div>
);

export default GuideMarkdown;
