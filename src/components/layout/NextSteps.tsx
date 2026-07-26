/**
 * NextSteps — a per-page "अगला कदम" footer for the authenticated app (audit HP-6, part 2).
 *
 * Reads a curated route→next-modules map and renders the natural follow-on actions as a
 * small strip below the page content. Visibility is taken from useNavigation() — the SAME
 * source the sidebar uses — so a user is never pointed at a module their role/capabilities
 * hide. Unmapped routes (and routes whose only next-steps are hidden) render nothing.
 */
import React, { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigation } from '@/hooks/useNavigation';
import { MODULE_CATALOG } from '@/lib/navigation/moduleCatalog';
import { NEXT_STEPS } from '@/lib/navigation/nextSteps';

const NextSteps: React.FC = () => {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const groups = useNavigation();

  const items = useMemo(() => {
    const nextIds = NEXT_STEPS[pathname];
    if (!nextIds || nextIds.length === 0) return [];
    // Only modules the user can actually reach (same visibility rule as the sidebar).
    const visibleIds = new Set(groups.flatMap((g) => g.items.map((m) => m.id)));
    return nextIds
      .map((id) => MODULE_CATALOG.find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => !!m && visibleIds.has(m.id));
  }, [pathname, groups]);

  if (items.length === 0) return null;

  return (
    <nav aria-label={t('nextStep')} className="mt-8 border-t border-border/60 pt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('nextStep')}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.id}
              to={m.route}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{t(m.titleKey)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default NextSteps;
