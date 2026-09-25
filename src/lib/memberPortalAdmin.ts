/**
 * Member Portal S2b — client side of the member-portal-admin Edge Function (S2a).
 *
 * Pure helpers (portal URL, WhatsApp hand-out text/link) are exported separately from the
 * network wrapper so they can be tested without a browser. The PIN only ever lives in the
 * dialog's state for the moment it is shown; nothing here stores it.
 */
import { supabase } from '@/lib/supabase';

export type PortalAction = 'list' | 'issue' | 'reset_pin' | 'revoke';

export interface PortalLoginRow {
  member_id: string;
  is_active: boolean;
  created_at: string;
  revoked_at: string | null;
}

export interface PortalHandout {
  pin: string;
  memberNo: string;
  societyId: string;
  portalPath: string;
}

export type PortalResult<T> = { ok: true; data: T } | { ok: false; reason: string; message: string };

export { portalPlanAllowed, portalUrl, whatsappPhone, handoutMessage, whatsappLink } from './memberPortalHandout';

/** Calls the Edge Function; unwraps the server's Hindi message from a non-2xx (supabase-js puts it on error.context). */
export async function callMemberPortalAdmin<T>(action: PortalAction, memberId?: string): Promise<PortalResult<T>> {
  const { data, error } = await supabase.functions.invoke('member-portal-admin', {
    body: memberId ? { action, member_id: memberId } : { action },
  });
  if (!error && data?.ok) return { ok: true, data: data as T };
  let body: { reason?: string; message?: string } | null = data ?? null;
  const ctx = (error as { context?: Response } | null)?.context;
  if (!body?.message && ctx && typeof ctx.json === 'function') {
    try { body = await ctx.json(); } catch { /* not JSON */ }
  }
  return {
    ok: false,
    reason: body?.reason ?? 'network',
    message: body?.message ?? 'सर्वर से संपर्क नहीं हो सका — इंटरनेट जाँचें और फिर कोशिश करें। / Could not reach the server.',
  };
}
