/**
 * razorpay-webhook — the AUTHORITATIVE payment confirmation.
 *
 * Razorpay POSTs here after a payment. We (1) verify the HMAC-SHA256 signature over
 * the RAW body with RAZORPAY_WEBHOOK_SECRET, (2) on payment.captured read the order_id,
 * (3) look up OUR `orders` row (created in create-order, holds society_id + plan — we
 * never trust amounts/plan from the payload), (4)+(5) mark the order paid AND activate the
 * subscription in ONE transaction — activate_order() (migration 186, SEC-07), which also checks
 * the captured amount and is safe to retry — then (6) issues the GST tax invoice via
 * issue_invoice() (migration 130) — non-fatal. The browser is never trusted for activation.
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
import { issueInvoiceForOrder } from '../_shared/issue-invoice.mjs';

/** Resend settings for the invoice email (Supabase function secrets). */
const invoiceEmailConfig = () => ({
  apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
  from:   Deno.env.get('RESEND_FROM') ?? '',
  appUrl: Deno.env.get('APP_URL') ?? 'https://sahakarlekha.com',
});

// Seats per plan and the 12-month default period live in activate_order() (migration 186), mirroring src/lib/plans.ts.

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

    // (4)+(5) SEC-07 (migration 186): ONE transaction marks the order paid AND activates the plan, from OUR order row
    // (society, plan, period_end, amount — never the payload's), after checking the captured amount. Before, the two
    // writes were separate and unchecked: a failed subscription write left the order "paid" with no plan, and the
    // retry was answered "already processed". Now a failure returns 500 so Razorpay retries, and the retry is safe.
    const { data: act, error: actErr } = await supa.rpc('activate_order', {
      p_order_id: orderId, p_payment_id: payment.id ?? null,
      p_amount_paise: Number.isFinite(Number(payment.amount)) ? Number(payment.amount) : null,
    });
    if (actErr) {
      console.error(`activate_order failed for ${orderId}: ${actErr.message}`);
      return new Response('activation failed — retry', { status: 500 });
    }
    const status = (act as { status?: string } | null)?.status ?? '';
    if (status === 'unknown_order') return new Response('unknown order', { status: 200 });
    if (status === 'amount_mismatch' || status === 'different_payment') {
      // Money arrived that does not match this order — never activate; a human must look (logged for SuperAdmin).
      console.error(`order ${orderId} NOT activated: ${status} ${JSON.stringify(act)}`);
      return new Response(status, { status: 200 });
    }
    // 'activated' or 'already' → (6)/(7) below are idempotent, so a retry also finishes a pending invoice.

    // (6) Tax invoice (migration 130). AFTER activation and never fatal: a missing seller row,
    // an unknown buyer state or any error leaves the order "invoice pending" (paid, no invoice
    // row) for the SuperAdmin retry — the plan the society paid for is already live.
    // issueInvoiceForOrder never throws; the try is a second guard so nothing here can fail the webhook.
    // (7) Slice 4 (migration 134): the issued invoice is emailed to the payer — exactly once, never fatal.
    // RESEND_API_KEY / RESEND_FROM unset → the invoice shows "email: not configured" in SuperAdmin.
    try {
      const inv = await issueInvoiceForOrder(supa, orderId, { email: invoiceEmailConfig() });
      if (inv.status !== 'issued' && inv.status !== 'already') console.error(`invoice pending for ${orderId}: ${inv.status}${inv.error ? ` — ${inv.error}` : ''}`);
      else if (inv.email && inv.email.status !== 'sent') console.error(`invoice email not sent for ${orderId}: ${inv.email.status}${inv.email.error ? ` — ${inv.email.error}` : ''}`);
    } catch (e) {
      console.error(`invoice pending for ${orderId}: ${e instanceof Error ? e.message : String(e)}`);
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 500 });
  }
});
