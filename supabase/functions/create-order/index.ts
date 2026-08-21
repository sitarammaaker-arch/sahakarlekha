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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Annual price in ₹ per self-serve plan — MIRRORS src/lib/plans.ts PLAN_CATALOG.
// Enterprise is contact-sales (no self-serve checkout); legacy/trial are internal.
const PRICE_INR: Record<string, number> = { starter: 1499, plus: 3999, pro: 9999 };

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
    const rupees = PRICE_INR[plan];
    if (!rupees || !society_id) return json({ error: 'Invalid plan or society' }, 400);

    const keyId = Deno.env.get('RAZORPAY_KEY_ID') ?? '';
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
    if (!keyId || !keySecret) return json({ error: 'Razorpay is not configured' }, 500);

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
        notes: { society_id, plan },
      }),
    });
    const order = await rzpRes.json();
    if (!rzpRes.ok) {
      return json({ error: order?.error?.description ?? 'Razorpay order failed' }, 502);
    }

    // Record the order (service-role bypasses RLS).
    const supa = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    await supa.from('orders').insert({
      id: order.id,
      society_id,
      plan,
      amount: rupees,
      currency: 'INR',
      status: 'created',
    });

    return json({ orderId: order.id, amount: rupees * 100, currency: 'INR', keyId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
