/**
 * useDocumentMeta — lightweight per-page SEO for the SPA (no react-helmet).
 * Sets <title>, meta description, canonical, and og:/twitter: title+description,
 * then restores the previous values on unmount so other pages aren't affected.
 */
import { useEffect } from 'react';

const SITE = 'https://www.sahakarlekha.com';

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
}) {
  const { title, description, canonicalPath } = opts;
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
    if (canonicalPath) {
      const canon = ensure('link[rel="canonical"]', () => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        return l;
      });
      set(canon, 'href', SITE + canonicalPath);
      set(metaByProp('og:url'), 'content', SITE + canonicalPath);
    }

    return () => {
      document.title = prevTitle;
      // restore changed attributes (in reverse so first-seen wins)
      for (let i = prev.length - 1; i >= 0; i--) {
        const [el, attr, old] = prev[i];
        if (old == null) el.removeAttribute(attr);
        else el.setAttribute(attr, old);
      }
    };
  }, [title, description, canonicalPath]);
}
