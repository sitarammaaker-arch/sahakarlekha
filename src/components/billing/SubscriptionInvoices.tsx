/**
 * The society's subscription tax invoices (migration 130) with a PDF download per invoice.
 * Read-only: invoices are issued by the server after a Razorpay payment, never from here.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { fetchSocietyInvoices, invoiceView, type SubscriptionInvoice } from '@/lib/billing/invoices';
import { fmtDate } from '@/lib/dateUtils';

const inr = (n: number) => '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function SubscriptionInvoices({ societyId, hi }: { societyId: string; hi: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<SubscriptionInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!societyId) { setLoading(false); return; }
    setLoading(true);
    const r = await fetchSocietyInvoices(societyId);
    setRows(r.rows);
    setError(r.error);
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [societyId]);

  const download = async (inv: SubscriptionInvoice) => {
    try {
      const { generateSubscriptionInvoicePDF } = await import('@/lib/pdf');
      generateSubscriptionInvoicePDF(inv);
    } catch (e) {
      toast({
        title: hi ? 'PDF नहीं बना' : 'PDF failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />{hi ? 'प्लान के इनवॉइस' : 'Plan invoices'}
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} aria-label={hi ? 'रीफ्रेश' : 'Refresh'}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <p className="px-4 pb-4 text-sm text-destructive">
            {hi ? 'इनवॉइस लोड नहीं हुए: ' : 'Could not load invoices: '}{error}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            {loading
              ? (hi ? 'लोड हो रहा है…' : 'Loading…')
              : (hi ? 'अभी कोई इनवॉइस नहीं। ऑनलाइन भुगतान के बाद इनवॉइस यहाँ दिखेगा।' : 'No invoices yet. An invoice appears here after an online payment.')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'इनवॉइस नं.' : 'Invoice No.'}</TableHead>
                  <TableHead>{hi ? 'तारीख' : 'Date'}</TableHead>
                  <TableHead>{hi ? 'प्लान' : 'Plan'}</TableHead>
                  <TableHead className="text-right">{hi ? 'GST' : 'GST'}</TableHead>
                  <TableHead className="text-right">{hi ? 'कुल राशि' : 'Total'}</TableHead>
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
                      <TableCell>{v.planName}</TableCell>
                      <TableCell className="text-right">{inr(v.tax)}</TableCell>
                      <TableCell className="text-right font-semibold">{inr(v.total)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => download(inv)}>
                          <Download className="h-4 w-4" />PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
