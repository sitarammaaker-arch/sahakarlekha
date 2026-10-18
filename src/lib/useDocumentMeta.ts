/**
 * useDocumentMeta — lightweight per-page SEO for the SPA (no react-helmet).
 * Sets <title>, meta description, canonical, and og:/twitter: title+description,
 * then restores the previous values on unmount so other pages aren't affected.
 */
import { useEffect } from 'react';

const SITE = 'https://sahakarlekha.com';

function ensure(selector: string, create: () => HTMLElement): HTMLElement {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

function metaByName(name: string) {
  return ensure(`meta[name="${name}"]`, () => {
    const m = document.createElement('meta');
    m.setAttribute('name', name);
    return m;
  });
}
function metaByProp(prop: string) {
  return ensure(`meta[property="${prop}"]`, () => {
    const m = document.createElement('meta');
    m.setAttribute('property', prop);
    return m;
  });
}

export function useDocumentMeta(opts: {
  title?: string;
  description?: string;
  canonicalPath?: string;
  /** Optional JSON-LD structured data injected as a <script> in <head> while this page is mounted. */
  jsonLd?: object | object[];
  /** Optional robots directive (e.g. 'noindex') applied while this page is mounted. */
  robots?: string;
  /** Optional absolute or site-relative image → og:image + twitter:image. */
  image?: string;
  /** Article pages: og:type=article + article:published_time / modified_time / section. */
  article?: { publishedTime: string; modifiedTime?: string; section?: string };
}) {
  const { title, description, canonicalPath, jsonLd, robots, image, article } = opts;
  // Stringify once so the effect dep is stable across re-renders (inline objects change identity each render).
  const jsonLdStr = jsonLd ? JSON.stringify(jsonLd) : undefined;
  const articleStr = article ? JSON.stringify(article) : undefined;
  useEffect(() => {
    const prev: Array<[HTMLElement, string, string | null]> = [];
    const set = (el: HTMLElement, attr: string, value?: string) => {
      if (value == null) return;
      prev.push([el, attr, el.getAttribute(attr)]);
      el.setAttribute(attr, value);
    };

    const prevTitle = document.title;
    if (title) document.title = title;

    if (description) {
      set(metaByName('description'), 'content', description);
      set(metaByProp('og:description'), 'content', description);
      set(metaByName('twitter:description'), 'content', description);
    }
    if (title) {
      set(metaByProp('og:title'), 'content', title);
      set(metaByName('twitter:title'), 'content', title);
    }
    if (image) {
      const abs = image.startsWith('http') ? image : SITE + image;
      set(metaByProp('og:image'), 'content', abs);
      set(metaByName('twitter:image'), 'content', abs);
    }
    if (robots) {
      set(metaByName('robots'), 'content', robots);
    }
    if (canonicalPath) {
      const canon = ensure('link[rel="canonical"]', () => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        return l;
      });
      set(canon, 'href', SITE + canonicalPath);
      set(metaByProp('og:url'), 'content', SITE + canonicalPath);
    }

    // article:* tags belong to one article URL only — drop them (static or ours) when this page unmounts.
    const articleEls: HTMLElement[] = [];
    if (articleStr) {
      const a = JSON.parse(articleStr) as NonNullable<typeof article>;
      set(metaByProp('og:type'), 'content', 'article');
      const put = (prop: string, value?: string) => {
        if (!value) return;
        const el = metaByProp(prop);
        el.setAttribute('content', value);
        articleEls.push(el);
      };
      put('article:published_time', a.publishedTime);
      put('article:modified_time', a.modifiedTime);
      put('article:section', a.section);
    }

    let scriptEl: HTMLScriptElement | null = null;
    if (jsonLdStr) {
      // The prerendered page's own JSON-LD (scripts/prerender-guide.mjs marks it) describes this same
      // page; keeping it next to ours gave crawlers two BlogPosting/FAQPage blocks that disagreed.
      document.head.querySelectorAll('script[data-prerendered-jsonld]').forEach((s) => s.remove());
      scriptEl = document.createElement('script');
      scriptEl.type = 'application/ld+json';
      scriptEl.setAttribute('data-managed-jsonld', '');
      scriptEl.textContent = jsonLdStr;
      document.head.appendChild(scriptEl);
    }

    return () => {
      document.title = prevTitle;
      if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
      articleEls.forEach((el) => el.remove());
      // restore changed attributes (in reverse so first-seen wins)
      for (let i = prev.length - 1; i >= 0; i--) {
        const [el, attr, old] = prev[i];
        if (old == null) el.removeAttribute(attr);
        else el.setAttribute(attr, old);
      }
    };
  }, [title, description, canonicalPath, jsonLdStr, robots, image, articleStr]);
}

/**
 * Mark the current page noindex while mounted (app-only/protected/404 pages).
 * Restores the previous robots value on unmount so public pages are unaffected.
 */
export function useNoIndex() {
  useEffect(() => {
    const el = metaByName('robots');
    const prev = el.getAttribute('content');
    el.setAttribute('content', 'noindex');
    return () => {
      if (prev == null) el.removeAttribute('content');
      else el.setAttribute('content', prev);
    };
  }, []);
}
