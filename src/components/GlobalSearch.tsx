import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useData } from '@/contexts/DataContext';
import { useHousingData } from '@/contexts/HousingDataContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useNavigation } from '@/hooks/useNavigation';
import { rankItems } from '@/lib/globalSearch';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Users, FileText, BookOpen, Landmark, Package, Building2, Receipt, MessageSquareWarning, Truck, UserCheck, ShoppingCart, PackagePlus, Boxes, HardHat, CornerDownRight } from 'lucide-react';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ open, onOpenChange }) => {
  const { language, t } = useLanguage();
  const { members, vouchers, accounts, loans, assets, suppliers, customers, sales, purchases, stockItems, employees } = useData();
  const { housingFlats, maintenanceBills, complaints } = useHousingData();
  const { has } = useCapabilities();
  const navGroups = useNavigation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const hi = language === 'hi';

  const q = query;
  const inv = has('inventory_sales');

  // Entity results — ranked (prefix/word-start above buried substrings) via the pure lib.
  const filteredMembers = rankItems(q, members, m => [m.name, m.memberId, m.phone], 5);
  const filteredVouchers = rankItems(q, vouchers.filter(v => !v.isDeleted), v => [v.voucherNo, v.narration], 5);
  const filteredAccounts = rankItems(q, accounts, a => [a.name, a.nameHi, a.id], 5);
  const filteredSuppliers = rankItems(q, suppliers.filter(s => !(s as { isDeleted?: boolean }).isDeleted), s => [s.name, s.nameHi, (s as { supplierCode?: string }).supplierCode, (s as { tradeName?: string }).tradeName], 5);
  const filteredCustomers = rankItems(q, customers.filter(c => !(c as { isDeleted?: boolean }).isDeleted), c => [c.name, c.nameHi, (c as { customerCode?: string }).customerCode, (c as { tradeName?: string }).tradeName], 5);
  const filteredSales = inv ? rankItems(q, sales.filter(s => !(s as { isDeleted?: boolean }).isDeleted), s => [s.saleNo, s.customerName], 5) : [];
  const filteredPurchases = inv ? rankItems(q, purchases.filter(p => !p.isDeleted), p => [p.purchaseNo, p.supplierName], 5) : [];
  const filteredItems = inv ? rankItems(q, stockItems.filter(i => !(i as { isDeleted?: boolean }).isDeleted), i => [(i as { itemCode?: string }).itemCode, i.name, i.nameHi], 5) : [];
  const filteredEmployees = rankItems(q, employees.filter(e => !(e as { isDeleted?: boolean }).isDeleted), e => [(e as { empNo?: string }).empNo, e.name, (e as { nameHi?: string }).nameHi, (e as { designation?: string }).designation], 5);
  const filteredLoans = has('lending') ? rankItems(q, loans, l => [l.loanNo, l.purpose], 3) : [];
  const filteredAssets = rankItems(q, assets, a => [a.name, a.assetNo], 3);

  const isHousing = has('housing');
  const filteredFlats = isHousing ? rankItems(q, housingFlats.filter(f => !f.isDeleted), f => [f.flatNo, f.blockNo], 5) : [];
  const filteredBills = isHousing ? rankItems(q, maintenanceBills.filter(b => !b.isDeleted), b => [b.billNo, b.flatNo], 5) : [];
  const filteredComplaints = isHousing ? rankItems(q, complaints.filter(c => !c.isDeleted), c => [c.complaintNo, c.title], 5) : [];

  // "Go to page" — the same visible modules the sidebar shows, ranked by title.
  const navItems = navGroups.flatMap(g => g.items);
  const filteredPages = rankItems(q, navItems, m => [t(m.titleKey)], 6);

  const go = useCallback((path: string) => {
    onOpenChange(false);
    setQuery('');
    navigate(path);
  }, [navigate, onOpenChange]);

  const typeLabel = (type: string) => {
    const map: Record<string, [string, string]> = {
      receipt: ['रसीद', 'Receipt'], payment: ['भुगतान', 'Payment'], journal: ['जर्नल', 'Journal'],
    };
    return hi ? map[type]?.[0] : map[type]?.[1];
  };

  const entityCount = filteredMembers.length + filteredVouchers.length + filteredAccounts.length + filteredSuppliers.length +
    filteredCustomers.length + filteredSales.length + filteredPurchases.length + filteredItems.length + filteredEmployees.length +
    filteredLoans.length + filteredAssets.length + filteredFlats.length + filteredBills.length + filteredComplaints.length;
  const hasResults = entityCount + filteredPages.length > 0;
  const short = q.trim().length < 2;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder={hi ? 'खोजें — सदस्य, वाउचर, खाता, पेज…' : 'Search members, vouchers, accounts, pages…'}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {short && <CommandEmpty>{hi ? 'खोजने के लिए कम से कम 2 अक्षर टाइप करें' : 'Type at least 2 characters to search'}</CommandEmpty>}
        {!short && !hasResults && <CommandEmpty>{hi ? 'कोई परिणाम नहीं मिला' : 'No results found'}</CommandEmpty>}

        {filteredPages.length > 0 && (
          <CommandGroup heading={hi ? 'पेज पर जाएँ' : 'Go to page'}>
            {filteredPages.map(m => {
              const Icon = m.icon;
              return (
                <CommandItem key={m.id} value={`page-${m.id}`} onSelect={() => go(m.route)} className="gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{t(m.titleKey)}</span>
                  <CornerDownRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {filteredMembers.length > 0 && (
          <>
            {filteredPages.length > 0 && <CommandSeparator />}
            <CommandGroup heading={hi ? 'सदस्य' : 'Members'}>
              {filteredMembers.map(m => (
                <CommandItem key={m.id} value={`member-${m.id}`} onSelect={() => go(`/members?q=${encodeURIComponent(m.memberId)}`)} className="gap-2">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground text-xs ml-auto">{m.memberId}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredVouchers.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'वाउचर' : 'Vouchers'}>
              {filteredVouchers.map(v => (
                <CommandItem key={v.id} value={`voucher-${v.id}`} onSelect={() => go('/vouchers')} className="gap-2">
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
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'खाते' : 'Accounts'}>
              {filteredAccounts.map(a => (
                <CommandItem key={a.id} value={`account-${a.id}`} onSelect={() => go(`/ledger?account=${a.id}`)} className="gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{hi ? a.nameHi : a.name}</span>
                  <span className="text-xs ml-auto text-muted-foreground capitalize">{a.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredSuppliers.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'आपूर्तिकर्ता' : 'Suppliers'}>
              {filteredSuppliers.map(s => (
                <CommandItem key={s.id} value={`supplier-${s.id}`} onSelect={() => go(`/suppliers?q=${encodeURIComponent(s.name)}`)} className="gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{hi ? (s.nameHi || s.name) : s.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredCustomers.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'ग्राहक' : 'Customers'}>
              {filteredCustomers.map(c => (
                <CommandItem key={c.id} value={`customer-${c.id}`} onSelect={() => go(`/customers?q=${encodeURIComponent(c.name)}`)} className="gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{hi ? (c.nameHi || c.name) : c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredSales.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'बिक्री' : 'Sales'}>
              {filteredSales.map(s => (
                <CommandItem key={s.id} value={`sale-${s.id}`} onSelect={() => go('/sales')} className="gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm">{s.saleNo}</span>
                  <span className="text-muted-foreground text-xs truncate">{s.customerName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredPurchases.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'खरीद' : 'Purchases'}>
              {filteredPurchases.map(p => (
                <CommandItem key={p.id} value={`purchase-${p.id}`} onSelect={() => go('/purchases')} className="gap-2">
                  <PackagePlus className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm">{p.purchaseNo}</span>
                  <span className="text-muted-foreground text-xs truncate">{p.supplierName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredItems.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'वस्तुएँ' : 'Items'}>
              {filteredItems.map(i => (
                <CommandItem key={i.id} value={`item-${i.id}`} onSelect={() => go('/inventory')} className="gap-2">
                  <Boxes className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{hi ? (i.nameHi || i.name) : i.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredEmployees.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'कर्मचारी' : 'Employees'}>
              {filteredEmployees.map(e => (
                <CommandItem key={e.id} value={`emp-${e.id}`} onSelect={() => go('/salary')} className="gap-2">
                  <HardHat className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{e.name}</span>
                  <span className="text-muted-foreground text-xs ml-auto">{(e as { designation?: string }).designation}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredLoans.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'ऋण' : 'Loans'}>
              {filteredLoans.map(l => (
                <CommandItem key={l.id} value={`loan-${l.id}`} onSelect={() => go('/loan-register')} className="gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm">{l.loanNo}</span>
                  <span className="text-muted-foreground text-xs truncate">{l.purpose}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredAssets.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'संपत्ति' : 'Assets'}>
              {filteredAssets.map(a => (
                <CommandItem key={a.id} value={`asset-${a.id}`} onSelect={() => go('/asset-register')} className="gap-2">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm">{a.assetNo}</span>
                  <span className="text-muted-foreground text-xs truncate">{a.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredFlats.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'फ्लैट' : 'Flats'}>
              {filteredFlats.map(f => (
                <CommandItem key={f.id} value={`flat-${f.id}`} onSelect={() => go('/flats-register')} className="gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{f.flatNo}{f.blockNo ? ` / ${f.blockNo}` : ''}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredBills.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'रखरखाव बिल' : 'Maintenance Bills'}>
              {filteredBills.map(b => (
                <CommandItem key={b.id} value={`bill-${b.id}`} onSelect={() => go('/maintenance-billing')} className="gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm">{b.billNo}</span>
                  <span className="text-muted-foreground text-xs ml-auto">{b.flatNo}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredComplaints.length > 0 && (
          <><CommandSeparator />
            <CommandGroup heading={hi ? 'शिकायतें' : 'Complaints'}>
              {filteredComplaints.map(c => (
                <CommandItem key={c.id} value={`complaint-${c.id}`} onSelect={() => go('/complaints')} className="gap-2">
                  <MessageSquareWarning className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm">{c.complaintNo}</span>
                  <span className="text-muted-foreground text-xs truncate">{c.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
