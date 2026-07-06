/**
 * RelatedKnowledge — the "और सीखें" block for landing pages (GOS-11).
 * Renders a SurfaceLinks bundle (guide/blog refs carry their own titles;
 * help/cookbook slugs resolve titles from their light data registries), so
 * software-type and state pages are no longer knowledge silos.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { type SurfaceLinks } from '@/content/relatedContent';
import { HELP_TASKS } from '@/content/help';
import { COOKBOOK_ENTRIES } from '@/content/cookbook';
import { BookOpen, Newspaper, ListChecks, NotebookPen, ArrowRight } from 'lucide-react';

interface Item { href: string; title: string; kind: string; icon: React.ReactNode }

const RelatedKnowledge: React.FC<{ links: SurfaceLinks; heading?: string }> = ({ links, heading = 'और सीखें — आपकी समिति के लिए' }) => {
  const items: Item[] = [
    ...(links.guide || []).map((r) => ({
      href: `/guide/${r.slug}`, title: r.title, kind: 'गाइड',
      icon: <BookOpen className="h-4 w-4 text-primary" />,
    })),
    ...(links.blog || []).map((r) => ({
      href: `/blog/${r.slug}`, title: r.title, kind: 'ब्लॉग',
      icon: <Newspaper className="h-4 w-4 text-sky-600" />,
    })),
    ...(links.help || [])
      .map((s) => HELP_TASKS.find((t) => t.slug === s))
      .filter((t): t is NonNullable<typeof t> => t != null)
      .map((t) => ({
        href: `/help/${t.slug}`, title: t.title, kind: 'मदद',
        icon: <ListChecks className="h-4 w-4 text-emerald-600" />,
      })),
    ...(links.cookbook || [])
      .map((s) => COOKBOOK_ENTRIES.find((e) => e.slug === s))
      .filter((e): e is NonNullable<typeof e> => e != null)
      .map((e) => ({
        href: `/cookbook/${e.slug}`, title: e.title, kind: 'एंट्री',
        icon: <NotebookPen className="h-4 w-4 text-amber-600" />,
      })),
  ];
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-foreground mb-3">{heading}</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((it) => (
          <Link key={it.href} to={it.href} className="group block">
            <Card className="h-full hover:border-primary/40 hover:bg-primary/5 transition-colors">
              <CardContent className="p-4 flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5">{it.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{it.kind}</span>
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                    {it.title} <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" />
                  </span>
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default RelatedKnowledge;
