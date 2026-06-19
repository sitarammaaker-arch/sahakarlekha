/**
 * LangToggle — a small हिंदी / English switch for the guide. Persists the
 * choice (localStorage) so it carries across all guide pages.
 */
import React from 'react';
import { Languages } from 'lucide-react';
import { useGuideLang, setGuideLang } from '@/lib/guideLang';

const LangToggle: React.FC<{ className?: string }> = ({ className }) => {
  const lang = useGuideLang();
  return (
    <div className={`inline-flex items-center gap-1 rounded-full border bg-background p-0.5 text-sm ${className ?? ''}`}>
      <Languages className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
      <button
        onClick={() => setGuideLang('hi')}
        className={`px-2.5 py-1 rounded-full transition-colors ${lang === 'hi' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
        aria-pressed={lang === 'hi'}
      >
        हिंदी
      </button>
      <button
        onClick={() => setGuideLang('en')}
        className={`px-2.5 py-1 rounded-full transition-colors ${lang === 'en' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
        aria-pressed={lang === 'en'}
      >
        English
      </button>
    </div>
  );
};

export default LangToggle;
