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
import { ChevronRight, Home } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MODULE_CATALOG } from '@/lib/navigation/moduleCatalog';
import { DOMAIN_HEADING_KEY } from '@/lib/navigation/capabilities';

const HIDE_ON = new Set(['/dashboard', '/my-dashboard', '/']);

const Breadcrumbs: React.FC = () => {
  const { pathname } = useLocation();
  const { t } = useLanguage();

  if (HIDE_ON.has(pathname)) return null;

  // Longest matching module route (so /members/123 resolves to the Members module).
  const mod = MODULE_CATALOG
    .filter((m) => pathname === m.route || pathname.startsWith(m.route + '/'))
    .sort((a, b) => b.route.length - a.route.length)[0];

  if (!mod) return null;

  const domainKey = DOMAIN_HEADING_KEY[mod.domain];

  return (
    <nav aria-label="breadcrumb" className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
      <Link to="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors" title={t('dashboard')}>
        <Home className="h-3.5 w-3.5" />
      </Link>
      {domainKey && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span>{t(domainKey)}</span>
        </>
      )}
      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      <span className="text-foreground font-medium" aria-current="page">{t(mod.titleKey)}</span>
    </nav>
  );
};

export default Breadcrumbs;
