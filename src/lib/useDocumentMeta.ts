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
}) {
  const { title, description, canonicalPath, jsonLd, robots } = opts;
  // Stringify once so the effect dep is stable across re-renders (inline objects change identity each render).
  const jsonLdStr = jsonLd ? JSON.stringify(jsonLd) : undefined;
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

    let scriptEl: HTMLScriptElement | null = null;
    if (jsonLdStr) {
      scriptEl = document.createElement('script');
      scriptEl.type = 'application/ld+json';
      scriptEl.setAttribute('data-managed-jsonld', '');
      scriptEl.textContent = jsonLdStr;
      document.head.appendChild(scriptEl);
    }

    return () => {
      document.title = prevTitle;
      if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
      // restore changed attributes (in reverse so first-seen wins)
      for (let i = prev.length - 1; i >= 0; i--) {
        const [el, attr, old] = prev[i];
        if (old == null) el.removeAttribute(attr);
        else el.setAttribute(attr, old);
      }
    };
  }, [title, description, canonicalPath, jsonLdStr, robots]);
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
