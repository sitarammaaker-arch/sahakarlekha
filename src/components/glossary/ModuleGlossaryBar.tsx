/**
 * ModuleGlossaryBar — in-app context help for EVERY module, from one place.
 * Rendered once inside MainLayout; it reads the current route and shows a compact
 * "इस पेज से जुड़े शब्द" strip of glossary terms (definition popup on click + link to
 * the full term). Route→terms mapping + definitions come from the active Knowledge
 * Items (single source of truth). Renders nothing on routes with no mapped terms.
 */
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { BookOpen, ArrowRight } from 'lucide-react';
import { termsForRoute } from '@/content/glossary';
import GlossaryHint from '@/components/glossary/GlossaryHint';

const ModuleGlossaryBar: React.FC = () => {
  const { pathname } = useLocation();
  const terms = React.useMemo(() => termsForRoute(pathname), [pathname]);
  if (terms.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
        <BookOpen className="h-3.5 w-3.5" /> इस पेज से जुड़े शब्द:
      </span>
      {terms.map((t) => (
        <GlossaryHint
          key={t.slug}
          slug={t.slug}
          label={t.hindiName || t.englishName}
          className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-xs text-foreground hover:border-primary/50 hover:text-primary transition-colors"
        />
      ))}
      <Link
        to="/glossary"
        className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        पूरा शब्दकोश <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
};

export default ModuleGlossaryBar;
