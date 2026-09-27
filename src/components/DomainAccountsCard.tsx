/**
 * Domain accounts (Consumer / Dairy) — shown on Ledger Hygiene.
 *
 * The diagnostic part is READ-ONLY: it lists each domain role's candidate accounts, which one the
 * resolver currently posts to, and live-voucher counts, so duplicates left by the removed load-time
 * seeder are visible. It never merges, renames or deletes. The only write is the explicit
 * "डोमेन खाते बनाएँ" button, which creates still-missing accounts (useDomainAccountProvisioning).
 */
import React, { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDomainAccountProvisioning } from '@/hooks/useDomainAccountProvisioning';
import { diagnoseDomainAccounts, type DomainAccountStatus } from '@/lib/domainAccounts/provisioning';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CLS: Record<DomainAccountStatus, string> = {
  ok: 'bg-green-100 text-green-800 border-green-300',
  missing: 'bg-amber-100 text-amber-800 border-amber-300',
  duplicate: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_LABEL: Record<DomainAccountStatus, { hi: string; en: string }> = {
  ok: { hi: 'ठीक', en: 'OK' },
  missing: { hi: 'नहीं है', en: 'Missing' },
  duplicate: { hi: 'दोहरा', en: 'Duplicate' },
};

const DomainAccountsCard: React.FC<{ hi: boolean }> = ({ hi }) => {
  const { accounts, vouchers, getAccountBalance } = useData();
  const { capabilities } = useCapabilities();
  const { missing, canProvision, busy, provision } = useDomainAccountProvisioning();

  const rows = useMemo(() => diagnoseDomainAccounts(accounts, vouchers, capabilities), [accounts, vouchers, capabilities]);
  if (rows.length === 0) return null;

  const dupCount = rows.filter(r => r.status === 'duplicate').length;
  const splitCount = rows.filter(r => r.postingsSplit).length;
  const fmt = (n: number) => new Intl.NumberFormat('hi-IN', { maximumFractionDigits: 2 }).format(n);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Layers className="h-4 w-4 text-primary" />
          {hi ? 'डोमेन खाते (Consumer / Dairy)' : 'Domain accounts (Consumer / Dairy)'}
          {dupCount > 0 && <Badge variant="outline" className={cn('text-[10px]', STATUS_CLS.duplicate)}>{hi ? `${dupCount} दोहरे` : `${dupCount} duplicated`}</Badge>}
          {missing.length > 0 && <Badge variant="outline" className={cn('text-[10px]', STATUS_CLS.missing)}>{hi ? `${missing.length} नहीं हैं` : `${missing.length} missing`}</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground pl-6">
          {hi
            ? 'Consumer/Dairy posting इन खातों पर जाती है। "पोस्टिंग यहाँ" वाला खाता ही अभी इस्तेमाल हो रहा है। दोहरे खाते पुराने auto-seeding से बने हैं — यह सूची सिर्फ़ जाँच है, इनमें से किसी को अभी merge या delete न करें।'
            : 'Consumer/Dairy postings go to these accounts; the one marked "posts here" is in use today. Duplicates come from the old auto-seeding — this list is diagnostic only; do not merge or delete any of them yet.'}
        </p>
      </CardHeader>
      <CardContent className="pl-6 space-y-3">
        {splitCount > 0 && (
          <p className="text-xs text-red-700">
            {hi
              ? `${splitCount} खाता-भूमिकाओं में वाउचर एक से ज़्यादा दोहरे खातों में बँटे हैं — इन भूमिकाओं का शेष अलग-अलग खातों में दिख रहा है।`
              : `${splitCount} role(s) have vouchers spread across more than one duplicate — their balance is split between accounts.`}
          </p>
        )}

        {rows.map(r => (
          <div key={r.key} className="rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <Badge variant="outline" className={cn('text-[10px]', STATUS_CLS[r.status])}>{hi ? STATUS_LABEL[r.status].hi : STATUS_LABEL[r.status].en}</Badge>
              <span className="font-medium">{hi ? r.nameHi : r.name}</span>
              <span className="text-muted-foreground">· {r.capability === 'pos_billing' ? 'Consumer' : 'Dairy'}</span>
              {!r.required && <span className="text-muted-foreground">· {hi ? 'capability बंद' : 'capability off'}</span>}
              {r.postingsSplit && <span className="text-red-700">· {hi ? 'posting बँटी हुई' : 'postings split'}</span>}
            </div>
            {r.candidates.length > 0 && (
              <ul className="mt-1.5 pl-2 space-y-0.5">
                {r.candidates.map(c => (
                  <li key={c.id} className="text-[11px] flex flex-wrap items-center gap-x-2">
                    <span className="font-mono text-muted-foreground">{c.id.length > 10 ? c.id.slice(0, 8) + '…' : c.id}</span>
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">· {hi ? `${c.liveVoucherCount} वाउचर` : `${c.liveVoucherCount} vouchers`}</span>
                    <span className="text-muted-foreground">· {hi ? 'शेष' : 'balance'} ₹{fmt(getAccountBalance(c.id))}</span>
                    {c.isResolved && <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-800 border-blue-300">{hi ? 'पोस्टिंग यहाँ' : 'posts here'}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {missing.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <Button size="sm" className="gap-2 w-fit" onClick={provision} disabled={!canProvision || busy}>
              <Plus className="h-4 w-4" />
              {busy ? (hi ? 'बना रहे हैं…' : 'Creating…') : (hi ? 'डोमेन खाते बनाएँ' : 'Create domain accounts')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {canProvision
                ? (hi ? 'सिर्फ़ जो खाते नहीं हैं वही बनेंगे; मौजूदा खाते नहीं बदलेंगे। पहले cloud से chart दोबारा जाँचा जाएगा।' : 'Creates only the missing accounts; existing ones are untouched. The chart is re-checked from the cloud first.')
                : (hi ? 'यह केवल समिति admin/manager अपने login से चला सकते हैं।' : 'Only a society admin/manager can run this, from their own login.')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DomainAccountsCard;
