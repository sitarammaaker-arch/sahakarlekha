/**
 * LangToggle — a small हिंदी / English switch on the guide pages. It sets the SITE language (the same choice as the
 * header switch), so the guide, the website and the app always agree.
 */
import React from 'react';
import { Languages } from 'lucide-react';
import { useGuideLang, useSetGuideLang } from '@/lib/guideLang';

const LangToggle: React.FC<{ className?: string }> = ({ className }) => {
  const lang = useGuideLang();
  const setGuideLang = useSetGuideLang();
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
