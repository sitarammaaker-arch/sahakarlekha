import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { ACCOUNT_IDS } from '@/lib/storage';
import { accountCode } from '@/lib/accountCode';
import { roleCanCreateMaster, findDuplicateByName } from '@/lib/masterCreate';
import { stateFromGstin, validateQuickParty } from '@/lib/partyValidation';
import type { LedgerAccount } from '@/types';

/**
 * Inline "create" for a picker (founder request 2026-10-08): a ledger, a customer, a supplier or a bank account,
 * made right where the user is entering a voucher / bill, and selected there once it is SAVED.
 *
 * Safety (each one checked in code before building this):
 *  - the new record is handed back only from onSaved — i.e. once it is in the cloud. A voucher line is FK-bound
 *    to its account (voucher_lines_account_fkey), so selecting an account that is not yet saved would make the
 *    server refuse the voucher.
 *  - customers / suppliers go through addCustomer / addSupplier (party record + its ledger, saved together and
 *    rolled back together), never as a bare ledger — bill-wise receipts/payments need the party record.
 *  - who may create = who may open that master's page (roleCanCreateMaster, the sidebar's own role gate).
 *  - a same-name record is offered instead of making a duplicate; a parent group is required; opening is ₹0
 *    (openings belong on the Opening Balances page); the account type cannot be changed later — said on screen.
 */
export type QuickKind = 'general' | 'customer' | 'supplier' | 'bank';
export interface QuickCreated { kind: QuickKind; accountId: string; recordId?: string; name: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kinds offered (first = default). */
  kinds?: QuickKind[];
  initialName?: string;
  /** Pre-select the account type for a 'general' ledger (e.g. 'income' when creating a Sales A/c). */
  defaultType?: LedgerAccount['type'];
  onCreated: (c: QuickCreated) => void;
}

const TYPES: { v: LedgerAccount['type']; hi: string; en: string }[] = [
  { v: 'expense', hi: 'व्यय (खर्च)', en: 'Expense' },
  { v: 'income', hi: 'आय', en: 'Income' },
  { v: 'asset', hi: 'संपत्ति', en: 'Asset' },
  { v: 'liability', hi: 'देयता (देनदारी)', en: 'Liability' },
  { v: 'equity', hi: 'पूँजी / निधि', en: 'Equity / Fund' },
];
const KIND_LABEL: Record<QuickKind, { hi: string; en: string }> = {
  general: { hi: 'सामान्य खाता', en: 'Ledger account' },
  customer: { hi: 'ग्राहक (देनदार)', en: 'Customer (debtor)' },
  supplier: { hi: 'आपूर्तिकर्ता (लेनदार)', en: 'Supplier (creditor)' },
  bank: { hi: 'बैंक खाता', en: 'Bank account' },
};
const KIND_MODULE = { general: 'ledgerHeads', bank: 'ledgerHeads', customer: 'customers', supplier: 'suppliers' } as const;

/** Kinds this user may create (empty → the picker shows "ask an admin / accountant" instead of a button). */
export function allowedQuickKinds(role: string | null | undefined, kinds: QuickKind[]): QuickKind[] {
  return kinds.filter((k) => roleCanCreateMaster(role, KIND_MODULE[k]));
}

export const QuickCreateMaster: React.FC<Props> = ({ open, onOpenChange, kinds = ['general', 'customer', 'supplier', 'bank'], initialName = '', defaultType = 'expense', onCreated }) => {
  const { accounts, customers, suppliers, addAccount, addCustomer, addSupplier } = useData();
  const { user } = useAuth();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const allowed = useMemo(() => allowedQuickKinds(user?.role, kinds), [user?.role, kinds]);

  const [kind, setKind] = useState<QuickKind>(allowed[0] ?? 'general');
  const [name, setName] = useState(initialName);
  const [nameHi, setNameHi] = useState('');
  const [type, setType] = useState<LedgerAccount['type']>('expense');
  const [parentId, setParentId] = useState('');
  const [mobile, setMobile] = useState('');
  const [gstin, setGstin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setKind(allowed[0] ?? 'general'); setName(initialName); setNameHi(''); setType(defaultType); setParentId('');
    setMobile(''); setGstin(''); setSaving(false); setError('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => accounts
    .filter((a) => a.isGroup && a.type === type)
    .sort((a, b) => (accountCode(a) || a.id).localeCompare(accountCode(b) || b.id, undefined, { numeric: true })), [accounts, type]);
  useEffect(() => { if (parentId && !groups.some((g) => g.id === parentId)) setParentId(''); }, [groups, parentId]);

  const duplicate = useMemo(() => {
    if (kind === 'customer') return findDuplicateByName(customers.map((c) => ({ ...c, id: c.accountId, name: c.legalName || c.name })), name);
    if (kind === 'supplier') return findDuplicateByName(suppliers.map((s) => ({ ...s, id: s.accountId, name: s.legalName || s.name })), name);
    return findDuplicateByName(accounts, name, kind === 'general' ? { type } : { type: 'asset' });
  }, [kind, name, type, accounts, customers, suppliers]);

  if (allowed.length === 0) return null;

  const done = (c: QuickCreated) => { setSaving(false); onCreated(c); onOpenChange(false); };
  const failed = () => setSaving(false);   // DataContext already showed why (and rolled back)

  const save = () => {
    setError('');
    const nm = name.trim();
    if (!nm) { setError(hi ? 'नाम आवश्यक है' : 'Name is required'); return; }
    if (kind === 'general' && !parentId) { setError(hi ? 'समूह (parent group) चुनें — बिना समूह खाता नहीं बनता' : 'Choose a parent group'); return; }
    if (kind === 'customer' || kind === 'supplier') {
      const err = validateQuickParty({ name: nm, mobile: mobile.trim(), gstin: gstin.trim().toUpperCase() }, hi);
      if (err) { setError(err); return; }
    }
    setSaving(true);
    if (kind === 'general' || kind === 'bank') {
      const acc = addAccount({
        name: nm, nameHi: nameHi.trim() || nm,
        type: kind === 'bank' ? 'asset' : type,
        openingBalance: 0, openingBalanceType: (kind === 'bank' || type === 'asset' || type === 'expense') ? 'debit' : 'credit',
        isSystem: false, isGroup: false,
        parentId: kind === 'bank' ? ACCOUNT_IDS.BANK : parentId,
        ...(kind === 'bank' ? { subtype: 'cash_bank' as const } : {}),
      }, { onSaved: (a) => done({ kind, accountId: a.id, name: a.name }), onFailed: failed });
      if (!acc?.id) failed();
      return;
    }
    const g = gstin.trim().toUpperCase();
    const st = g ? stateFromGstin(g) : '';
    const base = { name: nm, nameHi: nameHi.trim() || undefined, legalName: nm, mobile: mobile.trim() || undefined, phone: mobile.trim() || undefined,
      ...(g ? { gstin: g, gstNo: g, pan: g.slice(2, 12), state: st, placeOfSupply: st } : {}), isActive: true, openingBalance: 0 };
    if (kind === 'customer') {
      const c = addCustomer(base as Parameters<typeof addCustomer>[0], { onSaved: (x) => done({ kind, accountId: x.accountId, recordId: x.id, name: x.legalName || x.name }), onFailed: failed });
      if (!c?.id) failed();
    } else {
      const s = addSupplier(base as Parameters<typeof addSupplier>[0], { onSaved: (x) => done({ kind, accountId: x.accountId, recordId: x.id, name: x.legalName || x.name }), onFailed: failed });
      if (!s?.id) failed();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{hi ? '➕ नया बनाएँ' : '➕ Create new'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {allowed.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {allowed.map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`px-3 py-1 rounded-full text-xs border ${kind === k ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
                  {hi ? KIND_LABEL[k].hi : KIND_LABEL[k].en}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <Label>{hi ? 'नाम *' : 'Name *'}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label>{hi ? 'हिंदी नाम (वैकल्पिक)' : 'Hindi name (optional)'}</Label>
            <Input value={nameHi} onChange={(e) => setNameHi(e.target.value)} />
          </div>

          {kind === 'general' && (
            <>
              <div className="space-y-1">
                <Label>{hi ? 'खाते का प्रकार *' : 'Account type *'}</Label>
                <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as LedgerAccount['type'])}>
                  {TYPES.map((t) => <option key={t.v} value={t.v}>{hi ? t.hi : t.en}</option>)}
                </select>
                <p className="text-xs text-amber-700">{hi ? 'ध्यान दें: खाता बनने के बाद उसका प्रकार नहीं बदलता।' : 'Note: the type cannot be changed once created.'}</p>
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'समूह (Parent Group) *' : 'Parent group *'}</Label>
                <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">{hi ? '— समूह चुनें —' : '— choose a group —'}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{(hi ? (g.nameHi || g.name) : g.name)}{accountCode(g) ? ` (${accountCode(g)})` : ''}</option>)}
                </select>
              </div>
            </>
          )}

          {(kind === 'customer' || kind === 'supplier') && (
            <>
              <div className="space-y-1">
                <Label>{hi ? 'मोबाइल (वैकल्पिक)' : 'Mobile (optional)'}</Label>
                <Input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <Label>{hi ? 'GSTIN (वैकल्पिक)' : 'GSTIN (optional)'}</Label>
                <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))} />
                {gstin.length >= 2 && stateFromGstin(gstin) && <p className="text-xs text-muted-foreground">{hi ? 'राज्य' : 'State'}: {stateFromGstin(gstin)}</p>}
              </div>
              <p className="text-xs text-muted-foreground">{hi ? 'पता, बैंक आदि बाद में ग्राहक / आपूर्तिकर्ता पेज पर भर सकते हैं।' : 'Address, bank details etc. can be added later on the Customers / Suppliers page.'}</p>
            </>
          )}
          {kind === 'bank' && <p className="text-xs text-muted-foreground">{hi ? 'बैंक खाता "बैंक खाते" (3302) समूह में बनेगा और बैंक बुक में दिखेगा।' : 'Created under Bank Accounts (3302); appears in the Bank Book.'}</p>}

          <p className="text-xs text-muted-foreground">{hi ? 'प्रारंभिक शेष ₹0 रहेगा — ज़रूरत हो तो "ओपनिंग बैलेंस" पेज पर भरें।' : 'Opening balance is ₹0 — use the Opening Balances page if needed.'}</p>

          {duplicate && (
            <div className="p-2.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-sm">
              {hi ? `"${duplicate.name}" नाम का खाता पहले से है।` : `"${duplicate.name}" already exists.`}{' '}
              <button type="button" className="underline font-medium"
                onClick={() => done({ kind, accountId: duplicate.id as string, name: duplicate.name || '' })}>
                {hi ? 'यही चुनें' : 'Use it'}
              </button>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{hi ? 'रद्द करें' : 'Cancel'}</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{hi ? 'बन रहा है…' : 'Saving…'}</> : (hi ? 'बनाएँ और चुनें' : 'Create & select')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickCreateMaster;
