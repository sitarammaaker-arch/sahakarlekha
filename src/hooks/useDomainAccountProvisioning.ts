/**
 * useDomainAccountProvisioning — the EXPLICIT replacement for the Consumer/Dairy load-time account
 * seeders (removed; see src/lib/domainAccounts/provisioning.ts for why they wrote duplicates).
 *
 * `provision()` runs only on an admin click and is idempotent:
 *   1. Guards: FY lock (RULE 6), a real society session (not the JWT-less super-admin), and the
 *      'config' permission.
 *   2. Re-reads the society's chart FROM THE DATABASE and plans against it (unioned with in-memory
 *      rows, so an account whose save is still in flight is not planned twice). Planning against the
 *      in-memory chart alone is exactly what created the duplicates — that chart can be the CMS
 *      template fallback after a failed fetch. If the read fails, nothing is created.
 *   3. Creates only the still-missing accounts through core addAccount, which already rolls back and
 *      shows a destructive toast when the cloud save fails (RULE 1).
 * An in-flight lock stops a double click from racing two plans.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useToast } from '@/hooks/use-toast';
import { fetchAllPaged } from '@/lib/supabasePaging';
import { planMissingDomainAccounts, type DomainAccountSpec } from '@/lib/domainAccounts/provisioning';
import type { LedgerAccount } from '@/types';

export interface DomainAccountProvisioning {
  /** Specs missing from the in-memory chart (display only — provision() re-plans from the DB). */
  missing: DomainAccountSpec[];
  /** The current user may run provision() (society session + 'config' permission). */
  canProvision: boolean;
  busy: boolean;
  provision: () => Promise<void>;
}

export function useDomainAccountProvisioning(): DomainAccountProvisioning {
  const { accounts, society, addAccount } = useData();
  const { user, isSuperAdmin, can } = useAuth();
  const { capabilities } = useCapabilities(); // raw set — no super-admin bypass
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const missing = useMemo(() => planMissingDomainAccounts(accounts, capabilities), [accounts, capabilities]);
  const canProvision = !!user?.societyId && !isSuperAdmin && can('config');

  const provision = useCallback(async () => {
    if (inFlight.current) return;
    if (society.fyLocked) {
      toast({ title: 'FY Locked', description: 'वित्तीय वर्ष audit-locked है — खाते नहीं बन सकते। (Cannot modify data while Financial Year is audit-locked.)', variant: 'destructive' });
      return;
    }
    const sid = user?.societyId;
    if (!sid || isSuperAdmin) {
      toast({ title: 'समिति login ज़रूरी', description: 'डोमेन खाते केवल समिति के अपने login से बन सकते हैं, super-admin से नहीं।', variant: 'destructive', duration: 10000 });
      return;
    }
    if (!can('config')) {
      toast({ title: 'अनुमति नहीं', description: 'आपकी भूमिका को खाते बनाने (config) की अनुमति नहीं है।', variant: 'destructive', duration: 8000 });
      return;
    }

    inFlight.current = true;
    setBusy(true);
    try {
      const { data: dbAccounts, error } = await fetchAllPaged<LedgerAccount>('accounts', sid);
      if (error) {
        toast({ title: 'खाते जाँचे नहीं जा सके', description: `Cloud से chart नहीं पढ़ा गया — ${error.message}. कोई खाता नहीं बनाया गया; थोड़ी देर बाद दोबारा कोशिश करें।`, variant: 'destructive', duration: 12000 });
        return;
      }
      const byId = new Map<string, LedgerAccount>();
      for (const a of dbAccounts) byId.set(a.id, a);
      for (const a of accounts) if (!byId.has(a.id)) byId.set(a.id, a);
      const plan = planMissingDomainAccounts([...byId.values()], capabilities);
      if (plan.length === 0) {
        toast({ title: 'सभी डोमेन खाते मौजूद हैं', description: 'कोई नया खाता बनाने की ज़रूरत नहीं। (All domain accounts already exist.)' });
        return;
      }
      const created = plan.map(spec => addAccount(spec.template)).filter(a => !!a.id);
      if (created.length === 0) return; // addAccount bailed on a guard and already toasted
      toast({
        title: `${created.length} डोमेन खाते जोड़े गए`,
        description: `${created.map(a => a.nameHi || a.name).join(', ')}. Cloud save fail हुआ तो लाल चेतावनी आएगी और वह खाता हट जाएगा।`,
        duration: 10000,
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [society.fyLocked, user?.societyId, isSuperAdmin, can, accounts, capabilities, addAccount, toast]);

  return { missing, canProvision, busy, provision };
}
