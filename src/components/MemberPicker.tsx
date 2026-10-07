import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Member } from '@/types';

/**
 * Searchable member picker (usability audit P1-4) — the plain dropdown listed every member (hundreds,
 * in random load order, resigned/expelled included) with only "ID — name", while many members share a
 * name. Type any part of the member ID, name, father's name or address. Lists active, approved members
 * sorted by member ID; a member already selected stays visible even if no longer active.
 * Returns the member's record id ('' = none), like the Select it replaces.
 */
interface MemberPickerProps {
  value: string;
  onChange: (id: string) => void;
  className?: string;
  triggerClassName?: string;
}

const memberLabel = (m: Member) => `${m.memberId} — ${m.name}`;

export const MemberPicker: React.FC<MemberPickerProps> = ({ value, onChange, className, triggerClassName }) => {
  const { members } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const [open, setOpen] = useState(false);

  const list = useMemo(() => members
    .filter(m => m.id === value || (m.status === 'active' && m.approvalStatus !== 'pending' && m.approvalStatus !== 'rejected'))
    .sort((a, b) => (a.memberId || '').localeCompare(b.memberId || '', undefined, { numeric: true })),
  [members, value]);

  const selected = members.find(m => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open}
          className={cn('w-full justify-between font-normal h-11', triggerClassName)}>
          <span className="truncate">
            {selected ? memberLabel(selected) : (hi ? 'कोई सदस्य नहीं' : 'No member linked')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[--radix-popover-trigger-width] min-w-72 p-0', className)} align="start">
        <Command filter={(val, search) => (val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={hi ? 'सदस्य खोजें (ID, नाम, पिता का नाम, गाँव)…' : 'Search member (ID, name, father, village)…'} />
          <CommandList>
            <CommandEmpty>{hi ? 'कोई सदस्य नहीं मिला' : 'No member found'}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__ कोई नहीं none" onSelect={() => { onChange(''); setOpen(false); }}>
                <Check className={cn('mr-2 h-4 w-4 shrink-0', !value ? 'opacity-100' : 'opacity-0')} />
                {hi ? 'कोई नहीं' : 'None'}
              </CommandItem>
              {list.map(m => (
                <CommandItem key={m.id}
                  value={`${m.memberId} ${m.name} ${m.fatherName || ''} ${m.address || ''}`}
                  onSelect={() => { onChange(m.id); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', value === m.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{memberLabel(m)}</span>
                    {(m.fatherName || m.address) && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {[m.fatherName && (hi ? `पिता: ${m.fatherName}` : `S/o ${m.fatherName}`), m.address].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  {m.status !== 'active' && <span className="ml-2 text-[10px] text-amber-600 shrink-0">{m.status}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default MemberPicker;
