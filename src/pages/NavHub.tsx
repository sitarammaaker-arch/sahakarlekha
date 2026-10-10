import React from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { Search, Star } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAllNavigation } from '@/hooks/useNavigation';
import { useNavPrefs } from '@/hooks/useNavPrefs';
import { HUBS, hubById, hubRoute, hubSections } from '@/lib/navigation';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Group page (/hub/:hubId) — the pages of one menu group as cards (compact menu, 2026-10-10). Lists ONLY what the
 * engine already made visible for this user (useAllNavigation → role + capability gates); nothing new is reachable.
 * Responsive: 1 column on a phone, 2 on a tablet, 3–4 on a desktop; cards are full-width tap targets.
 */
const NavHub: React.FC = () => {
  const { hubId } = useParams();
  const { t, language } = useLanguage();
  const hi = language === 'hi';
  const visible = useAllNavigation().flatMap((g) => g.items);
  const { isFavourite, toggleFavourite } = useNavPrefs();
  const [q, setQ] = React.useState('');
  const stripRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    setQ('');
    // Phone: bring the current group's chip into view in the scrollable strip.
    stripRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [hubId]);

  const hub = hubById(hubId);
  if (!hub) return <Navigate to="/dashboard" replace />;
  const sections = hubSections(hub, visible);
  if (sections.length === 0) return <Navigate to="/dashboard" replace />;

  const needle = q.trim().toLowerCase();
  const shown = sections
    .map((s) => ({ ...s, items: needle ? s.items.filter((m) => t(m.titleKey).toLowerCase().includes(needle) || m.route.includes(needle)) : s.items }))
    .filter((s) => s.items.length > 0);
  const otherHubs = HUBS.filter((h) => hubSections(h, visible).length > 0);
  const HubIcon = hub.icon;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <HubIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{hi ? hub.hi : hub.en}</h1>
            <p className="text-sm text-muted-foreground">
              {hi ? `${sections.reduce((n, s) => n + s.items.length, 0)} पेज — काम पर टैप करें, ⭐ दबाकर menu में ऊपर रखें` : `${sections.reduce((n, s) => n + s.items.length, 0)} pages — tap one, ⭐ to pin it to the menu`}
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={hi ? 'इस समूह में खोजें…' : 'Search this group…'} className="pl-9 h-11" aria-label={hi ? 'खोजें' : 'Search'} />
        </div>
      </div>

      {/* Other groups — a scrollable strip (stays inside the page width on a phone). */}
      <nav ref={stripRef} aria-label={hi ? 'समूह' : 'Groups'} className="-mx-1 flex gap-2 overflow-x-auto pb-1 px-1">
        {otherHubs.map((h) => (
          <NavLink
            key={h.id}
            to={hubRoute(h.id)}
            className={({ isActive }) => cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
              isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted',
            )}
          >
            {hi ? h.hi : h.en}
          </NavLink>
        ))}
      </nav>

      {shown.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">{hi ? 'कोई पेज नहीं मिला — ऊपर Ctrl + K से पूरे ऐप में खोजें।' : 'No page found — press Ctrl + K to search the whole app.'}</p>
      )}

      {shown.map(({ section, items }) => (
        <section key={section.en} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{hi ? section.hi : section.en}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
            {items.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.id} className="group flex items-stretch rounded-lg border bg-card hover:border-primary hover:bg-primary/5 transition-colors">
                  <Link
                    to={m.route}
                    className="flex flex-1 min-w-0 items-center gap-3 p-3 min-h-[56px] rounded-l-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="flex-1 min-w-0 text-sm font-medium break-words">{t(m.titleKey)}</span>
                  </Link>
                  {/* ⭐ — pin this page to the top of the menu (and to Ctrl+K) */}
                  <button
                    type="button"
                    onClick={() => toggleFavourite(m.id)}
                    aria-pressed={isFavourite(m.id)}
                    aria-label={isFavourite(m.id) ? (hi ? 'पसंदीदा से हटाएँ' : 'Remove from favourites') : (hi ? 'पसंदीदा में जोड़ें' : 'Add to favourites')}
                    title={isFavourite(m.id) ? (hi ? 'पसंदीदा से हटाएँ' : 'Remove from favourites') : (hi ? 'पसंदीदा में जोड़ें' : 'Add to favourites')}
                    className="shrink-0 w-12 flex items-center justify-center rounded-r-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Star className={cn('h-4 w-4', isFavourite(m.id) ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground')} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default NavHub;
