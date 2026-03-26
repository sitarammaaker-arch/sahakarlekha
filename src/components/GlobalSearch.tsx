import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Users, FileText, BookOpen, Landmark, Package } from 'lucide-react';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ open, onOpenChange }) => {
  const { language } = useLanguage();
  const { members, vouchers, accounts, loans, assets } = useData();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const q = query.toLowerCase().trim();

  const filteredMembers = q.length < 2 ? [] : members.filter(m =>
    m.name.toLowerCase().includes(q) || m.memberId.toLowerCase().includes(q) || m.phone.includes(q)
  ).slice(0, 5);

  const filteredVouchers = q.length < 2 ? [] : vouchers.filter(v =>
    !v.isDeleted && (v.voucherNo.toLowerCase().includes(q) || v.narration.toLowerCase().includes(q))
  ).slice(0, 5);

  const filteredAccounts = q.length < 2 ? [] : accounts.filter(a =>
    a.name.toLowerCase().includes(q) || a.nameHi.includes(q) || a.id.toLowerCase().includes(q)
  ).slice(0, 5);

  const filteredLoans = q.length < 2 ? [] : loans.filter(l =>
    l.loanNo.toLowerCase().includes(q) || l.purpose.toLowerCase().includes(q)
  ).slice(0, 3);

  const filteredAssets = q.length < 2 ? [] : assets.filter(a =>
    a.name.toLowerCase().includes(q) || a.assetNo.toLowerCase().includes(q)
  ).slice(0, 3);

  const go = useCallback((path: string) => {
    onOpenChange(false);
    setQuery('');
    navigate(path);
  }, [navigate, onOpenChange]);

  const typeLabel = (type: string) => {
    const map: Record<string, [string, string]> = {
      receipt: ['रसीद', 'Receipt'],
      payment: ['भुगतान', 'Payment'],
      journal: ['जर्नल', 'Journal'],
    };
    return language === 'hi' ? map[type]?.[0] : map[type]?.[1];
  };

  const hasResults = filteredMembers.length + filteredVouchers.length + filteredAccounts.length + filteredLoans.length + filteredAssets.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={language === 'hi' ? 'खोजें — सदस्य, वाउचर, खाता…' : 'Search members, vouchers, accounts…'}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {q.length < 2 && (
          <CommandEmpty>
            {language === 'hi' ? 'खोजने के लिए कम से कम 2 अक्षर टाइप करें' : 'Type at least 2 characters to search'}
          </CommandEmpty>
        )}
        {q.length >= 2 && !hasResults && (
          <CommandEmpty>{language === 'hi' ? 'कोई परिणाम नहीं मिला' : 'No results found'}</CommandEmpty>
        )}

        {filteredMembers.length > 0 && (
          <CommandGroup heading={language === 'hi' ? 'सदस्य' : 'Members'}>
            {filteredMembers.map(m => (
              <CommandItem key={m.id} onSelect={() => go('/members')} className="gap-2">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground text-xs ml-auto">{m.memberId}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredVouchers.length > 0 && (
          <>
            {filteredMembers.length > 0 && <CommandSeparator />}
            <CommandGroup heading={language === 'hi' ? 'वाउचर' : 'Vouchers'}>
              {filteredVouchers.map(v => (
                <CommandItem key={v.id} onSelect={() => go('/vouchers')} className="gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm">{v.voucherNo}</span>
                  {v.narration && <span className="text-muted-foreground text-xs truncate">{v.narration}</span>}
                  <span className="text-xs ml-auto text-muted-foreground">{typeLabel(v.type)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredAccounts.length > 0 && (
          <>
            {(filteredMembers.length > 0 || filteredVouchers.length > 0) && <CommandSeparator />}
            <CommandGroup heading={language === 'hi' ? 'खाते' : 'Accounts'}>
              {filteredAccounts.map(a => (
                <CommandItem key={a.id} onSelect={() => go('/ledger')} className="gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{language === 'hi' ? a.nameHi : a.name}</span>
                  <span className="text-xs ml-auto text-muted-foreground capitalize">{a.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredLoans.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={language === 'hi' ? 'ऋण' : 'Loans'}>
              {filteredLoans.map(l => (
                <CommandItem key={l.id} onSelect={() => go('/loan-register')} className="gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm">{l.loanNo}</span>
                  <span className="text-muted-foreground text-xs truncate">{l.purpose}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredAssets.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={language === 'hi' ? 'संपत्ति' : 'Assets'}>
              {filteredAssets.map(a => (
                <CommandItem key={a.id} onSelect={() => go('/asset-register')} className="gap-2">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm">{a.assetNo}</span>
                  <span className="text-muted-foreground text-xs truncate">{a.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
