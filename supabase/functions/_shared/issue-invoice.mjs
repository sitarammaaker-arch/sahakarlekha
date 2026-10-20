/**
 * Issue the tax invoice for one paid order — the ONE path shared by razorpay-webhook (right after
 * payment) and admin-retry-invoice (SuperAdmin "retry pending"). Takes a SERVICE-ROLE Supabase client;
 * plain JS so scripts/test-issue-invoice.mjs can drive it with a fake client.
 *
 * Steps: read the order (amount), the billing_seller row and the buyer's society_settings, compute the
 * split with the tested pure core, call issue_invoice() (migration 130 — re-checks every figure, takes the
 * number). Never throws: returns { status, invoice_no?, error? }. Whatever the outcome, it is written to
 * orders.invoice_error / invoice_tried_at (migration 131) so SuperAdmin shows WHY an order is pending;
 * an issued (or already-issued) invoice clears the reason. That write is best-effort — before 131 runs
 * the columns do not exist, and that must not turn a good invoice into a failure.
 */
import { buildInvoiceCalc } from './invoice-core.mjs';

/** @returns {Promise<{ status: string, invoice_no?: string, error?: string }>} */
export async function issueInvoiceForOrder(supa, orderId) {
  let result;
  try {
    const { data: order, error: oErr } = await supa.from('orders').select('id, society_id, amount, status').eq('id', orderId).maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!order) return { status: 'unknown_order' };
    if (order.status !== 'paid') result = { status: 'order_not_paid' };
    else {
      const { data: seller } = await supa.from('billing_seller').select('*').eq('id', true).maybeSingle();
      // select('*'): society_settings.gstin may not exist as a column yet — never name it.
      const { data: soc } = await supa.from('society_settings').select('*').eq('society_id', order.society_id).limit(1).maybeSingle();
      const built = buildInvoiceCalc({
        amountRupees: order.amount,
        seller,
        buyer: soc ? { name: soc.name, address: [soc.address, soc.district].filter(Boolean).join(', '), state: soc.state, gstin: soc.gstin } : null,
      });
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
  return result;
}
