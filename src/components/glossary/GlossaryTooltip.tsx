/**
 * GlossaryTooltip — hover a term to see its mini definition + "Read more →".
 * Reusable across content pages and software modules. Definition text comes from
 * the active Knowledge Item (single source of truth) via the glossary adapter.
 *
 * Usage:  <GlossaryTooltip slug="ledger">खाता बही</GlossaryTooltip>
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { findTerm, shortDefinition } from '@/content/glossary';

interface Props {
  slug: string;
  children?: React.ReactNode;
  className?: string;
}

const GlossaryTooltip: React.FC<Props> = ({ slug, children, className }) => {
  const term = findTerm(slug);
  // If the term isn't an active glossary entry, render the text plainly (never a dead link).
  if (!term) return <>{children}</>;

  const label = children ?? term.hindiName ?? term.title;
  const mini = shortDefinition(term, 180);

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <Link
          to={`/glossary/${term.slug}`}
          className={
            className ??
            'text-primary underline decoration-dotted decoration-primary/50 underline-offset-2 hover:decoration-solid'
          }
        >
          {label}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <BookOpen className="h-3.5 w-3.5" />
            {term.hindiName ? `${term.hindiName} · ${term.englishName}` : term.title}
          </p>
          <p className="text-sm leading-relaxed text-foreground/90">{mini}</p>
          <Link
            to={`/glossary/${term.slug}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            पूरा पढ़ें <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default GlossaryTooltip;
