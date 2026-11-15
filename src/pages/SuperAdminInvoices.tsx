/**
 * SuperAdminInvoices — every society's subscription tax invoices (migrations 130/131).
 *
 *   • Issued invoices in a date range, each with its PDF, and the GSTR-1 working sheet (CSV) for the range.
 *   • "Invoice pending" — paid orders with no invoice yet, with the last reason, and a retry per order.
 * Reads go through admin_list_invoices / admin_list_pending_invoices (SECURITY DEFINER, gated on
 * is_platform_admin). The retry runs the admin-retry-invoice Edge Function — the same issuer the payment
 * webhook uses, idempotent per order. Nothing here writes an invoice directly.
 *   • Slice 4 (migration 134): each issued invoice shows whether its email went out, with "Email फिर भेजें"
 *     (the same function with resend_email: true).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, FileSpreadsheet, FileText, RefreshCw, RotateCcw, AlertTriangle, Mail } from 'lucide-react';
import { invoiceView, type SubscriptionInvoice } from '@/lib/billing/invoiceView';
import { buildGstr1Rows, GSTR1_HEADERS, gstr1FileStem } from '@/lib/billing/gstr1Csv';
import { downloadCSV } from '@/lib/exportUtils';
import { fmtDate, fmtDateTime } from '@/lib/dateUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface PendingRow {
  order_id: string;
  society_id: string;
  society_name: string | null;
  plan: string;
  kind: string;
  amount: number;
  paid_at: string;
  invoice_error: string | null;
  invoice_tried_at: string | null;
  /** 133: false = live payment; null = mode not recorded (cannot be invoiced). Test-mode rows never come back. */
  is_test?: boolean | null;
}

/** Why an order has no invoice yet, in plain Hindi (or English when hi = false). */
function pendingReasonHi(reason: string | null, hi = true): string {
  const L = (h: string, e: string) => (hi ? h : e);
  if (!reason) return L('अभी कोशिश दर्ज नहीं (migration 131 से पहले का भुगतान, या webhook ने invoice तक पहुँचा ही नहीं)', 'No attempt recorded yet (payment from before migration 131, or the webhook never reached the invoice step)');
  if (reason === 'seller_incomplete') return L('Seller की जानकारी अधूरी — billing_seller में नाम/GSTIN/पता/राज्य/SAC/दर भरें', 'Seller details incomplete — fill name/GSTIN/address/state/SAC/rate in billing_seller');
  if (reason === 'buyer_state_unknown') return L('समिति का राज्य/GSTIN नहीं मिला — समिति सेटअप में राज्य भरवाएँ', 'Society state/GSTIN not found — get the state filled in Society Setup');
  if (reason === 'test_mode') return L('Test-mode payment — इस पर कभी invoice नहीं बनेगा', 'Test-mode payment — an invoice will never be made for it');
  if (reason === 'mode_unknown') return L('Payment test था या live, दर्ज नहीं — invoice नहीं बनेगा (Razorpay dashboard से जाँचकर orders.is_test भरें)', 'Whether the payment was test or live is not recorded — no invoice will be made (check the Razorpay dashboard and fill orders.is_test)');
  return L(`त्रुटि: ${reason}`, `Error: ${reason}`);
}

/** The invoice email's state in plain Hindi (or English when hi = false) (migration 134). */
function emailReasonHi(reason: string | null | undefined, hi = true): string {
  const L = (h: string, e: string) => (hi ? h : e);
  if (!reason) return L('अभी भेजा नहीं गया', 'Not sent yet');
  if (reason === 'not_configured') return L('Email setup नहीं — Supabase secrets में RESEND_API_KEY और RESEND_FROM डालें', 'Email not set up — add RESEND_API_KEY and RESEND_FROM to Supabase secrets');
  if (reason === 'no_recipient') return L('भेजने के लिए email नहीं मिला — न payer का, न समिति के admin का', 'No email address to send to — neither the payer\'s nor the society admin\'s');
  if (reason === 'not_migrated') return L('Migration 134 अभी नहीं चली — email नहीं भेजा जाता', 'Migration 134 has not been run — the email is not sent');
  if (reason === 'no_invoice') return L('Invoice नहीं मिला', 'Invoice not found');
  return L(`त्रुटि: ${reason}`, `Error: ${reason}`);
}

const inr = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const monthStart = () => today().slice(0, 8) + '01';

/** The { error } body of a non-2xx Edge Function reply (supabase-js keeps the Response in .context). */
async function functionError(error: unknown, data: { error?: string } | null): Promise<string> {
  let msg = data?.error || (error as { message?: string } | null)?.message || 'Request failed';
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try { const body = await ctx.json(); if (body?.error) msg = body.error; } catch { /* not JSON */ }
  }
  return msg;
}

export default function SuperAdminInvoices() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const L = (h: string, e: string) => (hi ? h : e);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<SubscriptionInvoice[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [mailing, setMailing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [inv, pen] = await Promise.all([
      supabase.rpc('admin_list_invoices', { p_from: from, p_to: to }),
      supabase.rpc('admin_list_pending_invoices'),
    ]);
    const err = inv.error?.message || pen.error?.message || null;
    setError(err);
    setRows(inv.error ? [] : ((inv.data ?? []) as SubscriptionInvoice[]));
    setPending(pen.error ? [] : ((pen.data ?? []) as PendingRow[]));
    setLoading(false);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const retry = async (orderId: string) => {
    setRetrying(orderId);
    const { data, error: fnErr } = await supabase.functions.invoke('admin-retry-invoice', { body: { order_id: orderId } });
    setRetrying(null);
    if (fnErr) {
      toast({ title: L('Retry नहीं हुआ', 'Retry failed'), description: await functionError(fnErr, data), variant: 'destructive', duration: 10000 });
      return;
    }
    if (data?.status === 'issued' || data?.status === 'already') {
      const mail = data.email?.status === 'sent' ? ` · ${L('email भेजा', 'email sent')}: ${(data.email.to ?? []).join(', ')}`
        : data.email && data.email.status !== 'already_sent' ? ` · ${L('email नहीं गया', 'email not sent')}: ${emailReasonHi(data.email.error ? `${data.email.status}: ${data.email.error}` : data.email.status, hi)}` : '';
      toast({ title: L('Invoice बन गया', 'Invoice created'), description: `${data.invoice_no}${mail}` });
    } else {
      toast({ title: L('Invoice अभी भी pending', 'Invoice still pending'), description: pendingReasonHi(data?.error ? `${data.status}: ${data.error}` : data?.status ?? null, hi), variant: 'destructive', duration: 10000 });
    }
    load();
  };

  const resendEmail = async (inv: SubscriptionInvoice) => {
    setMailing(inv.order_id);
    const { data, error: fnErr } = await supabase.functions.invoke('admin-retry-invoice', { body: { order_id: inv.order_id, resend_email: true } });
    setMailing(null);
    if (fnErr) {
      toast({ title: L('Email नहीं गया', 'Email not sent'), description: await functionError(fnErr, data), variant: 'destructive', duration: 10000 });
      return;
    }
    const mail = data?.email;
    if (mail?.status === 'sent') {
      toast({ title: L('Email भेज दिया', 'Email sent'), description: `${inv.invoice_no} → ${(mail.to ?? []).join(', ')}` });
    } else {
      toast({ title: L('Email नहीं गया', 'Email not sent'), description: emailReasonHi(mail?.error ? `${mail.status}: ${mail.error}` : mail?.status ?? data?.status, hi), variant: 'destructive', duration: 10000 });
    }
    load();
  };

  const pdf = async (inv: SubscriptionInvoice) => {
    try {
      const { generateSubscriptionInvoicePDF } = await import('@/lib/pdf');
      generateSubscriptionInvoicePDF(inv);
    } catch (e) {
      toast({ title: L('PDF नहीं बना', 'PDF not created'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  };

  // Summed in paise, shown in rupees.
  const totals = rows.reduce((s, i) => ({
    tax: s.tax + Number(i.cgst_paise) + Number(i.sgst_paise) + Number(i.igst_paise),
    total: s.total + Number(i.total_paise),
    n: s.n + 1,
  }), { tax: 0, total: 0, n: 0 });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <Link to="/super-admin" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> {L('डैशबोर्ड', 'Dashboard')}
      </Link>
      <div className="flex items-center gap-2 flex-wrap">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Subscription Invoices</h1>
        <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive flex items-start gap-1.5">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {L('लोड नहीं हुआ', 'Could not load')}: {error}
        </p>
      )}

      {/* Pending */}
      <Card className={pending.length ? 'border-amber-300' : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Invoice pending <Badge variant={pending.length ? 'destructive' : 'secondary'}>{pending.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">{L('हर paid order का invoice बन चुका है।', 'Every paid order has its invoice.')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{L('समिति', 'Society')}</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">{L('राशि', 'Amount')}</TableHead>
                    <TableHead>{L('भुगतान', 'Paid')}</TableHead>
                    <TableHead>{L('कारण', 'Reason')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((p) => (
                    <TableRow key={p.order_id}>
                      <TableCell>{p.society_name || p.society_id}</TableCell>
                      <TableCell className="font-mono text-xs">{p.order_id}</TableCell>
                      <TableCell>{p.plan} ({p.kind})</TableCell>
                      <TableCell className="text-right">{inr(p.amount)}</TableCell>
                      <TableCell className="text-xs">{fmtDateTime(p.paid_at)}</TableCell>
                      <TableCell className="text-xs max-w-xs">
                        {p.is_test === null ? pendingReasonHi('mode_unknown', hi) : pendingReasonHi(p.invoice_error, hi)}
                        {p.invoice_tried_at && <span className="block text-muted-foreground">{L('आख़िरी कोशिश', 'Last attempt')}: {fmtDateTime(p.invoice_tried_at)}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="gap-1" disabled={retrying === p.order_id || p.is_test === null} onClick={() => retry(p.order_id)}>
                          <RotateCcw className={`h-4 w-4 ${retrying === p.order_id ? 'animate-spin' : ''}`} /> {L('फिर से', 'Retry')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Issued */}
      <Card>
        <CardHeader className="pb-2 space-y-3">
          <CardTitle className="text-base">{L('जारी invoices', 'Issued invoices')}</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="inv-from" className="text-xs">{L('से', 'From')}</Label>
              <Input id="inv-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-to" className="text-xs">{L('तक', 'To')}</Label>
              <Input id="inv-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
            </div>
            <Button size="sm" variant="outline" className="gap-2 ml-auto" disabled={rows.length === 0}
              onClick={() => downloadCSV(GSTR1_HEADERS, buildGstr1Rows(rows), gstr1FileStem(from, to))}>
              <FileSpreadsheet className="h-4 w-4" /> GSTR-1 CSV
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {L('CSV एक working sheet है (B2B invoice-wise, B2C summary, कुल) — GSTN offline tool का upload template नहीं। Filing से पहले CA से मिलान कराएँ।', 'The CSV is a working sheet (B2B invoice-wise, B2C summary, total) — not the GSTN offline tool upload template. Get it matched by a CA before filing.')}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">{loading ? L('लोड हो रहा है…', 'Loading…') : L('इस अवधि में कोई invoice नहीं।', 'No invoices in this period.')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice No.</TableHead>
                    <TableHead>{L('तारीख', 'Date')}</TableHead>
                    <TableHead>{L('खरीदार', 'Buyer')}</TableHead>
                    <TableHead>GSTIN</TableHead>
                    <TableHead>Place of Supply</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">{L('कुल', 'Total')}</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((inv) => {
                    const v = invoiceView(inv);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.invoice_no}</TableCell>
                        <TableCell>{fmtDate(inv.invoice_date)}</TableCell>
                        <TableCell>{inv.buyer_name}</TableCell>
                        <TableCell className="font-mono text-xs">{inv.buyer_gstin || '—'}</TableCell>
                        <TableCell className="text-xs">{v.posLabel}</TableCell>
                        <TableCell className="text-right">{inr(v.tax)}</TableCell>
                        <TableCell className="text-right font-semibold">{inr(v.total)}</TableCell>
                        <TableCell className="text-xs max-w-[14rem]">
                          {inv.emailed_at && !inv.email_error ? (
                            <span className="text-emerald-700" title={inv.emailed_to ?? undefined}>
                              {L('भेजा', 'Sent')} · {fmtDateTime(inv.emailed_at)}
                              {inv.emailed_to && <span className="block text-muted-foreground break-all">{inv.emailed_to}</span>}
                            </span>
                          ) : (
                            <span className={inv.email_error ? 'text-destructive' : 'text-muted-foreground'}>{emailReasonHi(inv.email_error, hi)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap space-x-1">
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => pdf(inv)}>
                            <Download className="h-4 w-4" />PDF
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" disabled={mailing === inv.order_id}
                            title={inv.emailed_at && !inv.email_error ? L('Email फिर भेजें', 'Send email again') : L('Email भेजें', 'Send email')} onClick={() => resendEmail(inv)}>
                            <Mail className={`h-4 w-4 ${mailing === inv.order_id ? 'animate-pulse' : ''}`} />{inv.emailed_at && !inv.email_error ? L('फिर भेजें', 'Send again') : L('भेजें', 'Send')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={5}>{L('कुल', 'Total')} ({totals.n})</TableCell>
                    <TableCell className="text-right">{inr(totals.tax / 100)}</TableCell>
                    <TableCell className="text-right">{inr(totals.total / 100)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
