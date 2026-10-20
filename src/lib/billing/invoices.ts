/**
 * Subscription tax invoices (migration 130) — read side for the app.
 *
 * Invoices are issued ONLY by the server (razorpay-webhook → issue_invoice); a society can read its own
 * rows (RLS invoices_select_own) and never write. Each row is a frozen snapshot — the PDF is drawn from
 * the row alone, never from the society's current settings, so a re-download always matches what was
 * issued. Money is integer paise in the row; invoiceView turns it into rupees for display.
 */
import { supabase } from '@/lib/supabase';
import type { SubscriptionInvoice } from '@/lib/billing/invoiceView';

export type { SubscriptionInvoice } from '@/lib/billing/invoiceView';
export { invoiceView, stateLabel } from '@/lib/billing/invoiceView';

export const INVOICE_COLUMNS =
  'id, invoice_no, invoice_date, order_id, payment_id, plan, kind, seller_name, seller_gstin, seller_address, seller_state_code, ' +
  'buyer_name, buyer_address, buyer_state_code, buyer_gstin, place_of_supply, sac, gst_rate_pct, ' +
  'taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise';

type InvoiceClient = Pick<typeof supabase, 'from'>;

/** The society's invoices, newest first. A read error is returned, never swallowed. */
export async function fetchSocietyInvoices(societyId: string, client: InvoiceClient = supabase): Promise<{ rows: SubscriptionInvoice[]; error: string | null }> {
  const { data, error } = await client
    .from('invoices').select(INVOICE_COLUMNS)
    .eq('society_id', societyId)
    .order('invoice_date', { ascending: false })
    .order('invoice_no', { ascending: false });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as unknown as SubscriptionInvoice[], error: null };
}

