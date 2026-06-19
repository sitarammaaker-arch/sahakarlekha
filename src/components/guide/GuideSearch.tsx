/**
 * GuideSearch — a search box for the /guide hub. Filters all chapters as the
 * reader types and shows a dropdown of matching chapters with a text snippet.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { searchGuide, type GuideSearchHit } from '@/lib/guideSearch';
import { findEntry } from '@/content/guide';
import { localizedEntry } from '@/content/guide/i18n';
import { useGuideLang, useGuideT } from '@/lib/guideLang';

const GuideSearch: React.FC = () => {
  const navigate = useNavigate();
  const lang = useGuideLang();
  const t = useGuideT();
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const hits: GuideSearchHit[] = React.useMemo(() => searchGuide(q), [q]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  React.useEffect(() => setActive(0), [q]);

  const go = (slug: string) => {
    setOpen(false);
    setQ('');
    navigate(`/guide/${slug}`);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || hits.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(hits[active].slug); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative max-w-xl mx-auto">
      <div className="flex items-center gap-2 rounded-full border bg-background px-4 py-2.5 shadow-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={t('hub.search.placeholder')}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          aria-label={t('hub.search.placeholder')}
        />
        {q && (
          <button onClick={() => { setQ(''); setOpen(false); }} aria-label="साफ़ करें" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border bg-background shadow-lg overflow-hidden">
          {hits.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('hub.search.none')}</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {hits.map((h, i) => (
                <li key={h.slug}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h.slug)}
                    className={`w-full text-left px-4 py-2.5 transition-colors ${i === active ? 'bg-primary/10' : 'hover:bg-muted/60'}`}
                  >
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{(() => { const e = findEntry(h.slug); return e ? localizedEntry(e, lang).shortTitle : h.slug; })()}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{h.snippet}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default GuideSearch;
