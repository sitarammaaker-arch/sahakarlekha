/**
 * razorpayCheckout — opens Razorpay Checkout for a subscription plan.
 *
 * The order is created SERVER-SIDE (create-order Edge function, which computes the
 * amount) and the payment is CONFIRMED server-side (razorpay-webhook activates the
 * subscription). The browser never sets the amount and never activates — it only
 * opens the checkout with the server-issued order. The publishable Key ID comes back
 * from create-order; no secret ever reaches the client.
 */
import { supabase } from '@/lib/supabase';

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler?: () => void;
}
interface RazorpayInstance { open(): void; }

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export async function startCheckout(
  plan: string,
  societyId: string,
  opts?: { name?: string; email?: string; onDone?: () => void },
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('create-order', {
    body: { plan, society_id: societyId },
  });
  if (error || !data?.orderId) {
    return { ok: false, error: error?.message || data?.error || 'Could not start payment' };
  }
  const loaded = await loadScript();
  if (!loaded || !window.Razorpay) return { ok: false, error: 'Could not load Razorpay' };

  const rzp = new window.Razorpay({
    key: data.keyId,
    order_id: data.orderId,
    amount: data.amount,
    currency: data.currency,
    name: 'सहकार लेखा',
    description: `${plan} plan`,
    prefill: { name: opts?.name, email: opts?.email },
    theme: { color: '#0F7B5A' },
    handler: () => opts?.onDone?.(),
  });
  rzp.open();
  return { ok: true };
}
