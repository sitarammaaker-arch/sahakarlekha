/**
 * HindiOnlyNotice — shown ONLY in English mode, above content that exists only in Hindi (blog posts, help articles,
 * cookbook entries, calculator explainers). The page chrome around it is bilingual; the body is not translated yet,
 * so an English reader is told plainly instead of being surprised. Renders nothing in Hindi mode.
 */
import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSwitchLanguage } from '@/lib/useSwitchLanguage';

const HindiOnlyNotice: React.FC<{ className?: string; what?: string }> = ({ className = '', what = 'This article' }) => {
  const { language } = useLanguage();
  const setLanguage = useSwitchLanguage();
  if (language !== 'en') return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 ${className}`} role="note" lang="en">
      <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{what} is currently available in Hindi only. An English version is on the way.</span>
      <button type="button" onClick={() => setLanguage('hi')} className="ml-auto underline underline-offset-2 hover:no-underline" lang="hi">
        हिंदी में पढ़ें
      </button>
    </div>
  );
};

export default HindiOnlyNotice;
