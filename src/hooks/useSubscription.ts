/**
 * useSubscription — resolves the current society's subscription (plan + limits) for
 * client-side affordances (seat cap, society cap, read-only-on-expiry). It is a
 * PRESENTATION-layer helper: real enforcement is (and must stay) server-side
 * (RLS / SECURITY DEFINER RPCs). A society with no row — or an unreadable one — is
 * treated as 'legacy' (grandfathered / pre-billing), i.e. never stricter than today,
 * so nothing breaks for existing societies. See migration 055 + src/lib/plans.ts.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PLAN_CATALOG, type PlanId, type PlanSpec } from '@/lib/plans';

export type SubscriptionStatus = 'active' | 'trialing' | 'grace' | 'expired';

export interface SubscriptionState {
  loading: boolean;
  plan: PlanId;
  status: SubscriptionStatus;
  spec: PlanSpec;
  periodEnd: string | null;
  /** max login users; null = unlimited */
  seatsLimit: number | null;
  /** max societies; null = unlimited */
  maxSocieties: number | null;
  /** writes should be blocked (expired past grace) — consumed from 2a-4 */
  isReadOnly: boolean;
}

interface SubRow {
  plan: PlanId;
  status: SubscriptionStatus;
  period_end: string | null;
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const societyId = user?.societyId;
  const [row, setRow] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!societyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status, period_end')
        .eq('society_id', societyId)
        .maybeSingle();
      if (cancelled) return;
      setRow(error || !data ? null : (data as SubRow));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [societyId]);

  // Missing/unreadable row → legacy (grandfathered): unlimited, active, never stricter.
  const plan: PlanId = row?.plan ?? 'legacy';
  const status: SubscriptionStatus = row?.status ?? 'active';
  const spec: PlanSpec = PLAN_CATALOG[plan] ?? PLAN_CATALOG.legacy;

  return {
    loading,
    plan,
    status,
    spec,
    periodEnd: row?.period_end ?? null,
    seatsLimit: spec.seatsLimit,
    maxSocieties: spec.maxSocieties,
    isReadOnly: status === 'expired',
  };
}
