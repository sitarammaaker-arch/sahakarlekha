/**
 * guideLang — the guide's language IS the site language (LanguageContext, key 'sahayata_language').
 *
 * The guide used to keep its own choice under 'sl_guide_lang', so a visitor who picked English in the site header
 * still got the guide in Hindi (and vice versa). Since 2026-11-15 there is one choice for the whole site; the old
 * guide key is read once by LanguageProvider as a fallback (see LanguageContext) and otherwise ignored.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { GUIDE_UI, type GuideLang } from '@/content/guide/i18n';

export type { GuideLang };

/** The legacy per-guide key — only read as a first-visit fallback by LanguageProvider. */
export const LEGACY_GUIDE_LANG_KEY = 'sl_guide_lang';

export function useGuideLang(): GuideLang {
  return useLanguage().language;
}

/** Setter bound to the site language (the guide's हिंदी / English switch uses it). */
export function useSetGuideLang(): (lang: GuideLang) => void {
  return useLanguage().setLanguage;
}

/** Returns a translator bound to the current guide language. */
export function useGuideT() {
  const lang = useGuideLang();
  return (key: string, vars?: Record<string, string | number>) => {
    const e = GUIDE_UI[key];
    let s = e ? e[lang] : key;
    if (vars) for (const k of Object.keys(vars)) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
    return s;
  };
}
