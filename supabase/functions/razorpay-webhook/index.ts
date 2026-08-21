/**
 * razorpay-webhook — the AUTHORITATIVE payment confirmation.
 *
 * Razorpay POSTs here after a payment. We (1) verify the HMAC-SHA256 signature over
 * the RAW body with RAZORPAY_WEBHOOK_SECRET, (2) on payment.captured read the order_id,
 * (3) look up OUR `orders` row (created in create-order, holds society_id + plan — we
 * never trust amounts/plan from the payload), (4) mark the order paid, and (5) activate
 * the subscription (service-role upsert). The browser is never trusted for activation.
 *
 * Secrets (owner sets in Supabase → Edge Functions → Secrets; never in repo/browser):
 *   RAZORPAY_WEBHOOK_SECRET
 * Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * DEPLOY WITHOUT JWT (Razorpay has no Supabase JWT):
 *   npx supabase functions deploy razorpay-webhook --no-verify-jwt
 * Deno runtime — not the app's TypeScript.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Seats per plan — mirrors src/lib/plans.ts / migration 058 (null = unlimited).
const SEATS: Record<string, number | null> = { starter: 1, plus: 6, pro: null };
const PERIOD_MONTHS = 12;

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
async function validSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return timingSafeEqual(hex(sig), signature);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? '';
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const raw = await req.text(); // RAW body — needed for signature verification

  if (!secret || !signature || !(await validSignature(raw, signature, secret))) {
    return new Response('Invalid signature', { status: 401 });
  }

  try {
    const event = JSON.parse(raw);
    if (event.event !== 'payment.captured') {
      return new Response('ignored', { status: 200 }); // ack non-capture events
    }
    const payment = event.payload?.payment?.entity ?? {};
    const orderId: string = payment.order_id ?? '';
    if (!orderId) return new Response('no order_id', { status: 200 });

    const supa = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Trust OUR record for society_id + plan (not the payload).
    const { data: order } = await supa
      .from('orders').select('society_id, plan, status').eq('id', orderId).maybeSingle();
    if (!order) return new Response('unknown order', { status: 200 });
    if (order.status === 'paid') return new Response('already processed', { status: 200 }); // idempotent

    await supa.from('orders').update({ status: 'paid', payment_id: payment.id, updated_at: new Date().toISOString() }).eq('id', orderId);

    const now = new Date();
    const end = new Date(now); end.setMonth(end.getMonth() + PERIOD_MONTHS);
    await supa.from('subscriptions').upsert({
      society_id:   order.society_id,
      plan:         order.plan,
      status:       'active',
      period_start: now.toISOString(),
      period_end:   end.toISOString(),
      seats_limit:  SEATS[order.plan] ?? null,
      source:       'razorpay',
      activated_by: `razorpay:${payment.id}`,
      updated_at:   now.toISOString(),
    }, { onConflict: 'society_id' });

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
  }
});
