/**
 * GlossaryHint — an in-module "इसका क्या मतलब है?" (What does this mean?) helper.
 * Drop next to any technical label inside a software module (Vouchers, Ledger,
 * Cash Book, Trial Balance, Balance Sheet, Reports…). Opens a small popup with the
 * Knowledge-Item definition + a link to the full glossary term. Knowledge stays the
 * single source of truth; modules never hard-code definitions.
 *
 * Usage:  <GlossaryHint slug="trial-balance" />
 *         <GlossaryHint slug="trial-balance" label="Trial Balance क्या है?" />
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowRight, BookOpen } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { findTerm } from '@/content/glossary';

interface Props {
  slug: string;
  /** optional visible label on the trigger; default is just the "?" icon */
  label?: string;
  className?: string;
}

const GlossaryHint: React.FC<Props> = ({ slug, label, className }) => {
  const term = findTerm(slug);
  if (!term) return null;

  const mini = (term.definition.split(/(?<=।)|(?<=\.)\s/)[0] || term.definition).slice(0, 220);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${term.englishName} — इसका क्या मतलब है?`}
          className={
            className ??
            'inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors'
          }
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {label && <span>{label}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
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
            शब्दकोश में पूरा पढ़ें <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default GlossaryHint;
