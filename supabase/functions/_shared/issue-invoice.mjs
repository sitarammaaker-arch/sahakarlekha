/**
 * Issue the tax invoice for one paid order — the ONE path shared by razorpay-webhook (right after
 * payment) and admin-retry-invoice (SuperAdmin "retry pending"). Takes a SERVICE-ROLE Supabase client;
 * plain JS so scripts/test-issue-invoice.mjs can drive it with a fake client.
 *
 * Steps: read the order (amount + the buyer confirmed at checkout), the billing_seller row and the buyer's
 * society_settings (fallback), compute the
 * split with the tested pure core, call issue_invoice() (migration 130 — re-checks every figure, takes the
 * number). Never throws: returns { status, invoice_no?, error? }. Whatever the outcome, it is written to
 * orders.invoice_error / invoice_tried_at (migration 131) so SuperAdmin shows WHY an order is pending;
 * an issued (or already-issued) invoice clears the reason. That write is best-effort — before 131 runs
 * the columns do not exist, and that must not turn a good invoice into a failure.
 *
 * opts.email (slice 4, migration 134): once the order HAS an invoice (issued now or already), it is emailed
 * via _shared/invoice-email.mjs — exactly once, claimed on the invoice row. Its outcome comes back as
 * result.email and never changes result.status. Without opts.email nothing is sent.
 */
import { buildInvoiceCalc } from './invoice-core.mjs';
import { sendInvoiceEmail } from './invoice-email.mjs';

/**
 * @param {{ email?: { apiKey?: string, from?: string, appUrl?: string, force?: boolean, fetch?: typeof fetch } }} [opts]
 * @returns {Promise<{ status: string, invoice_no?: string, error?: string, email?: { status: string, to?: string[], error?: string } }>}
 */
export async function issueInvoiceForOrder(supa, orderId, opts = {}) {
  let result;
  try {
    // select('*'): the buyer_* columns (migration 132) may not exist yet — never name them.
    const { data: order, error: oErr } = await supa.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!order) return { status: 'unknown_order' };
    if (order.status !== 'paid') result = { status: 'order_not_paid' };
    else {
      const { data: seller } = await supa.from('billing_seller').select('*').eq('id', true).maybeSingle();
      // select('*'): society_settings.gstin may not exist as a column yet — never name it.
      const { data: soc } = await supa.from('society_settings').select('*').eq('society_id', order.society_id).limit(1).maybeSingle();
      // The buyer confirmed at checkout (migration 132) wins; society_settings is the fallback for orders
      // placed before the checkout dialog — field by field, so a blank address still gets the society's.
      const fromSoc = soc ? { name: soc.name, address: [soc.address, soc.district].filter(Boolean).join(', '), state: soc.state, gstin: soc.gstin } : null;
      const buyer = order.buyer_state_code
        ? { name: order.buyer_name || fromSoc?.name, address: order.buyer_address || fromSoc?.address, state: order.buyer_state_code, gstin: order.buyer_gstin }
        : fromSoc;
      const built = buildInvoiceCalc({ amountRupees: order.amount, seller, buyer });
      if (built.status !== 'ok') result = { status: built.status };
      else {
        const { data: res, error } = await supa.rpc('issue_invoice', { p_order_id: orderId, p_calc: built.calc });
        result = error ? { status: 'error', error: error.message } : { status: res?.status ?? 'error', invoice_no: res?.invoice_no };
      }
    }
  } catch (e) {
    result = { status: 'error', error: e instanceof Error ? e.message : String(e) };
  }

  const done = result.status === 'issued' || result.status === 'already';
  try {
    await supa.from('orders').update({
      invoice_error: done ? null : (result.error ? `${result.status}: ${result.error}` : result.status),
      invoice_tried_at: new Date().toISOString(),
    }).eq('id', orderId);
  } catch { /* best-effort — see header */ }

  if (done && opts.email) {
    try {
      result.email = await sendInvoiceEmail(supa, orderId, opts.email);
    } catch (e) {
      result.email = { status: 'error', error: e instanceof Error ? e.message : String(e) };
    }
  }
  return result;
}
