import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBankAccountIds } from '@/lib/storage';
import { QuickCreateMaster, allowedQuickKinds } from '@/components/QuickCreateMaster';

/**
 * The bank-account <select> used on entry screens, with a "+ नया बैंक खाता…" option (inline create, 2026-10-08).
 * The new bank is selected only once it is saved in the cloud (see QuickCreateMaster). Shows only leaf bank
 * ledgers — never the 3302 group itself.
 */
interface Props {
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Optional placeholder option ('' value), e.g. "बैंक चुनें…". */
  placeholder?: string;
  /** Restrict to these ids (default: every bank ledger). */
  bankIds?: string[];
}

const CREATE = '__create_bank__';

export const BankAccountSelect: React.FC<Props> = ({ value, onChange, className, placeholder, bankIds }) => {
  const { accounts } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const [open, setOpen] = useState(false);
  const ids = bankIds ?? getBankAccountIds(accounts);
  const canCreate = allowedQuickKinds(user?.role, ['bank']).length > 0;

  return (
    <>
      <select
        value={value}
        onChange={(e) => { if (e.target.value === CREATE) { setOpen(true); return; } onChange(e.target.value); }}
        className={className ?? 'h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm'}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {ids.map((bid) => {
          const acc = accounts.find((a) => a.id === bid);
          return <option key={bid} value={bid}>{acc ? (hi ? (acc.nameHi || acc.name) : acc.name) : bid}</option>;
        })}
        {canCreate && <option value={CREATE}>{hi ? '+ नया बैंक खाता…' : '+ New bank account…'}</option>}
      </select>
      {canCreate && (
        <QuickCreateMaster open={open} onOpenChange={setOpen} kinds={['bank']} onCreated={(c) => onChange(c.accountId)} />
      )}
    </>
  );
};

export default BankAccountSelect;
