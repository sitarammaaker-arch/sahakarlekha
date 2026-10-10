/**
 * Breadcrumbs — a lightweight location indicator for the authenticated app.
 *
 * The ~120 protected pages had no "where am I / go up" affordance (audit HP-6), so a
 * user arriving via deep-link, Ctrl+K search, or a notification had no context. This
 * derives the trail from the capability module catalog: Home → [domain group] →
 * current module. Uncatalogued routes (report sub-pages, query-param views) simply
 * render nothing — graceful, never wrong.
 */
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home, Star } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MODULE_CATALOG } from '@/lib/navigation/moduleCatalog';
import { hubForModule, hubRoute } from '@/lib/navigation/hubs';
import { useNavPrefs } from '@/hooks/useNavPrefs';
import { cn } from '@/lib/utils';

const HIDE_ON = new Set(['/dashboard', '/my-dashboard', '/']);

const Breadcrumbs: React.FC = () => {
  const { pathname } = useLocation();
  const { t, language } = useLanguage();
  const hi = language === 'hi';
  const { isFavourite, toggleFavourite } = useNavPrefs();

  if (HIDE_ON.has(pathname)) return null;

  // Longest matching module route (so /members/123 resolves to the Members module).
  const mod = MODULE_CATALOG
    .filter((m) => pathname === m.route || pathname.startsWith(m.route + '/'))
    .sort((a, b) => b.route.length - a.route.length)[0];

  if (!mod) return null;

  // The middle crumb is the menu group the page lives in, and it links back to that group page (2026-10-10).
  const hub = hubForModule(mod);
  const fav = isFavourite(mod.id);
  const favLabel = fav ? (hi ? 'पसंदीदा से हटाएँ' : 'Remove from favourites') : (hi ? '⭐ पसंदीदा में जोड़ें' : 'Add to favourites');

  return (
    <nav aria-label="breadcrumb" className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
      <Link to="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors" title={t('dashboard')}>
        <Home className="h-3.5 w-3.5" />
      </Link>
      {hub && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <Link to={hubRoute(hub.id)} className="hover:text-foreground hover:underline transition-colors">{hi ? hub.hi : hub.en}</Link>
        </>
      )}
      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      <span className="text-foreground font-medium" aria-current="page">{t(mod.titleKey)}</span>
      <button
        type="button"
        onClick={() => toggleFavourite(mod.id)}
        aria-pressed={fav}
        aria-label={favLabel}
        title={favLabel}
        className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
      >
        <Star className={cn('h-4 w-4', fav ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground')} />
      </button>
    </nav>
  );
};

export default Breadcrumbs;
