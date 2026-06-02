import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getVoucherLines } from '@/lib/voucherUtils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LedgerAccount } from '@/types';

/**
 * Reusable searchable account picker — type any part of the English name, Hindi
 * name, or account code to filter. Optionally shows each account's running
 * balance (Dr/Cr) next to it, the way Tally lists ledger balances in pickers.
 *
 * Returns the selected account ID (backward-compatible with the plain <select>
 * sites it replaces).
 */
const TYPE_ORDER: { type: LedgerAccount['type']; en: string; hi: string }[] = [
  { type: 'asset', en: 'Assets', hi: 'संपत्ति' },
  { type: 'liability', en: 'Liabilities', hi: 'देयता' },
  { type: 'equity', en: 'Equity', hi: 'पूंजी' },
  { type: 'income', en: 'Income', hi: 'आय' },
  { type: 'expense', en: 'Expenses', hi: 'व्यय' },
];

interface AccountPickerProps {
  value: string;
  onChange: (id: string) => void;
  /** Include group (header) accounts in the list. Default false (leaf accounts only). */
  includeGroups?: boolean;
  /** Restrict to accounts directly under this parent group id (e.g. '4100' Sales). */
  filterByParentId?: string;
  /** Account ids to omit (e.g. Cash/Bank in a Cash Book "other account" picker). */
  excludeIds?: string[];
  /** Show the running Dr/Cr balance next to each account. Default true. */
  showBalance?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Extra classes for the popover content. */
  className?: string;
  /** Extra classes for the trigger button. */
  triggerClassName?: string;
}

export const AccountPicker: React.FC<AccountPickerProps> = ({
  value, onChange, includeGroups = false, filterByParentId, excludeIds,
  showBalance = true, placeholder, disabled, className, triggerClassName,
}) => {
  const { accounts, vouchers } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const [open, setOpen] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));

  // One pass over active vouchers → Dr-positive signed balance per account.
  const balanceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of accounts) {
      m.set(a.id, a.openingBalanceType === 'debit' ? a.openingBalance : -(a.openingBalance || 0));
    }
    for (const v of vouchers) {
      if (v.isDeleted) continue;
      for (const l of getVoucherLines(v)) {
        m.set(l.accountId, (m.get(l.accountId) || 0) + (l.type === 'Dr' ? l.amount : -l.amount));
      }
    }
    return m;
  }, [accounts, vouchers]);

  const excluded = useMemo(() => new Set(excludeIds || []), [excludeIds]);

  const groups = useMemo(() => {
    const visible = accounts.filter(a => {
      if (!includeGroups && a.isGroup) return false;
      if (filterByParentId && a.parentId !== filterByParentId) return false;
      if (excluded.has(a.id)) return false;
      return true;
    });
    return TYPE_ORDER
      .map(t => ({ label: hi ? t.hi : t.en, items: visible.filter(a => a.type === t.type) }))
      .filter(g => g.items.length > 0);
  }, [accounts, includeGroups, filterByParentId, excluded, hi]);

  const selected = accounts.find(a => a.id === value);
  const balLabel = (id: string) => {
    const b = balanceMap.get(id) || 0;
    return `${fmt(b)} ${b >= 0 ? 'Dr' : 'Cr'}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', triggerClassName)}
        >
          <span className="truncate">
            {selected
              ? `${hi ? selected.nameHi : selected.name} (${selected.id})`
              : (placeholder || (hi ? 'खाता चुनें' : 'Select account'))}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[--radix-popover-trigger-width] min-w-72 p-0', className)} align="start">
        <Command filter={(val, search) => (val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={hi ? 'खाता खोजें (नाम या कोड)…' : 'Search account (name or code)…'} />
          <CommandList>
            <CommandEmpty>{hi ? 'कोई खाता नहीं मिला' : 'No account found'}</CommandEmpty>
            {groups.map(g => (
              <CommandGroup key={g.label} heading={g.label}>
                {g.items.map(a => {
                  const bal = balanceMap.get(a.id) || 0;
                  return (
                    <CommandItem
                      key={a.id}
                      value={`${a.name} ${a.nameHi} ${a.id}`}
                      onSelect={() => { onChange(a.id); setOpen(false); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4 shrink-0', value === a.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 truncate">{hi ? a.nameHi : a.name}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground shrink-0">{a.id}</span>
                      {showBalance && (
                        <span className={cn('ml-2 text-xs tabular-nums shrink-0', bal >= 0 ? 'text-muted-foreground' : 'text-amber-600')}>
                          {balLabel(a.id)}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default AccountPicker;
