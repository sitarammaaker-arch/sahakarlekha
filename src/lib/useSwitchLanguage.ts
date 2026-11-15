/**
 * useSwitchLanguage — what a language switch does (batch E). It saves the visitor's choice AND, on a public page
 * that has an English twin, moves to the other address (/help/x ⇄ /en/help/x) — there the URL decides the
 * language, so saving alone would change nothing on screen. Elsewhere (the logged-in app) it only saves.
 *
 * Reads the REAL address from window.location: inside the page tree useLocation() returns the path with /en
 * stripped (App renders /en/<path> through <Routes location={…}> on <path>), so it can't tell the twins apart.
 */
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { hasEnglishRoute, stripEn, toEn } from '@/lib/enRoutes';

export function useSwitchLanguage(): (lang: 'hi' | 'en') => void {
  const { setLanguage } = useLanguage();
  const navigate = useNavigate();
  return (lang) => {
    setLanguage(lang);
    const { pathname, search, hash } = window.location;
    const inner = stripEn(pathname);
    if (!hasEnglishRoute(inner)) return;
    const target = lang === 'en' ? toEn(inner) : inner;
    if (target !== pathname) navigate(target + search + hash);
  };
}
