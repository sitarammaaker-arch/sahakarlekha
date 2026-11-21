/**
 * SEO-04 (product audit 2026-11-17): Privacy and Terms were ~100-word stubs without JavaScript — the binding text was
 * rendered only in the browser. The build-time prerender (scripts/prerender-guide.mjs) calls this to write the SAME
 * section text (src/content/legal/*Sections.tsx, which the pages render too) into the static HTML.
 *
 * The section bodies are plain JSX elements (p, ul, li, strong, a, …), so a small walker turns them into HTML —
 * no react-dom/server (its Node build cannot be bundled by the prerender's esbuild step). Class names are dropped:
 * the static page has its own stylesheet. Only `href` is kept, and only for http(s) / mailto / site-relative links.
 */
import { isValidElement, type ReactNode } from 'react';
import { SECTIONS as PRIVACY } from './privacySections';
import { SECTIONS as TERMS } from './termsSections';

interface Section { num: number; title: { hi: string; en: string }; hi: ReactNode; en: ReactNode }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SAFE_TAGS = new Set(['p', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'br', 'span', 'code', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const safeHref = (h: unknown) => typeof h === 'string' && /^(https?:\/\/|mailto:|\/)/.test(h) ? h : null;

/** ReactNode → HTML. Unknown element types (components) render their children only. */
export function nodeToHtml(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return esc(String(node));
  if (Array.isArray(node)) return node.map(nodeToHtml).join('');
  if (isValidElement(node)) {
    const props = (node.props ?? {}) as { children?: ReactNode; href?: unknown };
    const inner = nodeToHtml(props.children);
    const tag = typeof node.type === 'string' ? node.type : '';
    if (!tag || !SAFE_TAGS.has(tag)) return inner;   // fragments and components: content only
    if (tag === 'br') return '<br>';
    const href = tag === 'a' ? safeHref(props.href) : null;
    return `<${tag}${href ? ` href="${esc(href).replace(/"/g, '&quot;')}"` : ''}>${inner}</${tag}>`;
  }
  return '';
}

/** The sections as plain HTML: an h2 per section + its body. */
export function legalHtml(which: 'privacy' | 'terms', lang: 'hi' | 'en'): string {
  const sections = (which === 'privacy' ? PRIVACY : TERMS) as unknown as Section[];
  return sections.map((s) => `<h2>${s.num}. ${esc(lang === 'hi' ? s.title.hi : s.title.en)}</h2>${nodeToHtml(lang === 'hi' ? s.hi : s.en)}`).join('');
}
