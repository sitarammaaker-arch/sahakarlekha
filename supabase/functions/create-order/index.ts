/**
 * create-order — starts a Razorpay checkout for a subscription plan.
 *
 * The client sends { plan, society_id }; the AMOUNT is computed HERE (server-side,
 * never trusted from the client), a Razorpay order is created, recorded in `orders`,
 * and { orderId, amount, currency, keyId } is returned to open Razorpay Checkout.
 * The order's `notes` carry society_id + plan so the webhook can activate the right
 * society authoritatively. Payment is only ever CONFIRMED by razorpay-webhook.
 *
 * Secrets (set by the project owner, NEVER in the repo/browser):
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET   (Supabase → Edge Functions → Secrets)
 * Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Deno runtime — not the app's TypeScript. Deploy: npx supabase functions deploy create-order
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

// SEC-03 (migration 085): a token that still owes a 2FA code gets nothing. getUser() verifies the
// token; its payload is read only to refuse more (unreadable → pending).
const mfaPending = (t: string): boolean => {
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).mfa_pending === true; } catch { return true; }
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Annual price in ₹ per self-serve plan — MIRRORS src/lib/plans.ts PLAN_CATALOG.
// Enterprise is contact-sales (no self-serve checkout); legacy/trial are internal.
const PRICE_INR: Record<string, number> = { starter: 1499, plus: 3999, pro: 9999 };
const RANK: Record<string, number> = { starter: 1, plus: 2, pro: 3 };
const PERIOD_MONTHS = 12;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { plan, society_id } = await req.json().catch(() => ({}));
    if (!PRICE_INR[plan] || !society_id) return json({ error: 'Invalid plan or society' }, 400);

    const keyId = Deno.env.get('RAZORPAY_KEY_ID') ?? '';
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
    if (!keyId || !keySecret) return json({ error: 'Razorpay is not configured' }, 500);

    const supa = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // WHO is paying — verified by value, never from the body (Phase-2 A5). The gateway's verify_jwt
    // accepts the public anon key too, so without this anyone could open an order for any society id
    // and read its current plan / renewal date back from the prorated amount. The caller must be an
    // active user OF that society, on a session that has passed 2FA (SEC-03).
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!bearer || bearer === anonKey) return json({ error: 'Please sign in again' }, 401);
    if (mfaPending(bearer)) return json({ error: '2FA required — finish the 2FA step and sign in again' }, 403);
    const { data: authData, error: authErr } = await createClient(Deno.env.get('SUPABASE_URL') ?? '', anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }).auth.getUser(bearer);
    const callerEmail = authData?.user?.email?.toLowerCase();
    if (authErr || !callerEmail) return json({ error: 'Please sign in again' }, 401);
    // Exact, case-insensitive email match (ilike would treat '_' / '%' in an email as wildcards).
    const { data: staff } = await supa
      .from('society_users').select('email')
      .eq('society_id', society_id).eq('is_active', true);
    const isMember = (staff ?? []).some((r: { email?: string }) => (r.email ?? '').toLowerCase() === callerEmail);
    if (!isMember) return json({ error: 'Not a user of this society' }, 403);

    // Amount + resulting period_end are decided HERE from the CURRENT subscription
    // (server-side; the client never sets them). Upgrade = prorated difference for the
    // remaining period (renewal date unchanged); renew = full price + extend; new = full.
    const { data: cur } = await supa
      .from('subscriptions').select('plan, period_end').eq('society_id', society_id).maybeSingle();
    const now = new Date();
    const curPlan: string | null = cur?.plan ?? null;
    const curEnd = cur?.period_end ? new Date(cur.period_end) : null;
    const remainingDays = curEnd && curEnd > now ? (curEnd.getTime() - now.getTime()) / 86_400_000 : 0;
    const curRank = curPlan ? (RANK[curPlan] ?? 0) : 0;
    const tgtRank = RANK[plan];
    const addYear = (d: Date) => { const e = new Date(d); e.setMonth(e.getMonth() + PERIOD_MONTHS); return e; };

    let kind = 'new';
    let rupees = PRICE_INR[plan];
    let setEnd = addYear(now);

    if (tgtRank > curRank && curRank > 0 && remainingDays > 0 && PRICE_INR[curPlan!] != null) {
      kind = 'upgrade';
      // Cap at one year: an upgrade never costs more than the annual price difference,
      // even if the society pre-paid multiple years. They keep all remaining time at the
      // higher tier (a small upgrade perk) while the charge stays intuitive.
      const days = Math.min(remainingDays, 365);
      rupees = Math.max(1, Math.round((PRICE_INR[plan] - PRICE_INR[curPlan!]) * days / 365));
      setEnd = curEnd!; // keep the same renewal date — only the plan level changes now
    } else if (tgtRank === curRank && curRank > 0) {
      kind = 'renew';
      setEnd = addYear(curEnd && curEnd > now ? curEnd : now); // extend, never lose time
    } // else NEW (trial/legacy → paid): full price, now + 12mo (defaults)

    // Create the order on Razorpay (Basic auth = key_id:key_secret).
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        amount: rupees * 100, // paise
        currency: 'INR',
        receipt: `sl_${society_id}_${plan}`.slice(0, 40),
        notes: { society_id, plan, kind },
      }),
    });
    const order = await rzpRes.json();
    if (!rzpRes.ok) {
      return json({ error: order?.error?.description ?? 'Razorpay order failed' }, 502);
    }

    await supa.from('orders').insert({
      id: order.id,
      society_id,
      plan,
      amount: rupees,
      currency: 'INR',
      status: 'created',
      kind,
      set_period_end: setEnd.toISOString(),
    });

    return json({ orderId: order.id, amount: rupees * 100, currency: 'INR', keyId, kind, rupees });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
