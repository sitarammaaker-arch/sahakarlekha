/**
 * J5 · one subscription read per society, shared by every reader.
 *
 * DataContext (the expiry flag), the layout's SubscriptionBanner and the pages that show the plan each
 * fetched the same row on login — 3 requests. They now share one in-flight/recent read. A short TTL keeps a
 * renewal done elsewhere (super admin) visible within a minute; a failed read is never cached, so the next
 * reader retries. A missing or unreadable row resolves null (→ legacy / grandfathered, never stricter).
 */
import { supabase } from '@/lib/supabase';
import type { PlanId } from '@/lib/plans';

export type SubscriptionStatus = 'active' | 'trialing' | 'grace' | 'expired';

export interface SubRow {
  plan: PlanId;
  status: SubscriptionStatus;
  period_end: string | null;
}

export const SUB_TTL_MS = 60_000;
const subCache = new Map<string, { at: number; p: Promise<SubRow | null> }>();

type SubClient = Pick<typeof supabase, 'from'>;

/** The society's subscription row, fetched at most once per TTL (null = none / unreadable). */
export function fetchSubscriptionRow(societyId: string, client: SubClient = supabase, now: () => number = Date.now): Promise<SubRow | null> {
  const hit = subCache.get(societyId);
  if (hit && now() - hit.at < SUB_TTL_MS) return hit.p;
  const p = Promise.resolve(
    client.from('subscriptions').select('plan, status, period_end').eq('society_id', societyId).maybeSingle(),
  ).then(({ data, error }) => {
    if (error) { subCache.delete(societyId); return null; }
    return (data as SubRow | null) ?? null;
  }, () => { subCache.delete(societyId); return null; });
  subCache.set(societyId, { at: now(), p });
  return p;
}

/** Test seam: forget every cached read. */
export function clearSubscriptionCache(): void { subCache.clear(); }
