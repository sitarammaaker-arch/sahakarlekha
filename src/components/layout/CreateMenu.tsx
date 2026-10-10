import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useAllNavigation } from '@/hooks/useNavigation';
import { visibleCreateGroups } from '@/lib/navigation';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * "＋ नई entry" (compact menu phase 3) — every "make a new …" action in one place. Each item just navigates to the
 * page's own form (lib/navigation/createMenu); only actions whose page this user may open are listed.
 * `trigger` is the button (header and sidebar style it differently); `onPicked` lets the phone drawer close itself.
 */
export const CreateMenu: React.FC<{ trigger: React.ReactNode; onPicked?: () => void; side?: 'bottom' | 'right' }> = ({ trigger, onPicked, side = 'bottom' }) => {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { society } = useData();
  const navigate = useNavigate();
  const all = useAllNavigation();
  const groups = React.useMemo(() => visibleCreateGroups(new Set(all.flatMap((g) => g.items.map((m) => m.id)))), [all]);
  if (groups.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="start" className="w-[min(18rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto">
        {society.fyLocked && (
          <p className="flex items-start gap-2 px-2 py-1.5 text-xs text-destructive">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {hi ? 'वित्तीय वर्ष लॉक है — नई entry सेव नहीं होगी।' : 'Financial year is locked — new entries will not save.'}
          </p>
        )}
        {groups.map((g, gi) => (
          <React.Fragment key={g.en}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">{hi ? g.hi : g.en}</DropdownMenuLabel>
            <DropdownMenuGroup>
              {g.actions.map((a) => {
                const Icon = a.icon;
                return (
                  <DropdownMenuItem key={a.id} className="gap-2 py-2.5 cursor-pointer" onSelect={() => { onPicked?.(); navigate(a.to); }}>
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span>{hi ? a.hi : a.en}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

