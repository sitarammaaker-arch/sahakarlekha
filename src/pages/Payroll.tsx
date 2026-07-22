/**
 * Payroll (new pay_* engine, read surface). Lists payroll runs computed by the payroll platform and,
 * on selecting a run, shows its payslips. Reads via the tenant-safe public RPCs (pay_list_runs /
 * pay_run_payslips, migration 115) — the browser cannot touch the pay_* schemas directly. RLS scopes
 * everything to the logged-in user's society.
 *
 * This is the read-only first slice; running/approving/posting a run is a later slice.
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, Users, IndianRupee, Loader2 } from 'lucide-react';

interface PayRun {
  run_id: string; run_no: string; period: string; period_month: string;
  state: string; currency: string; created_at: string; payslip_count: number; total_net_minor: number;
}
interface Payslip {
  payslip_id: string; employee_code: string; employee_name: { hi?: string; en?: string } | null;
  payslip_no: string; gross_minor: number; deductions_minor: number; net_minor: number;
  currency: string; paid_days: number; lop_days: number; status: string;
}

const rupees = (minor: number | string) =>
  '₹' + (Number(minor) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const stateVariant = (s: string): 'default' | 'secondary' | 'outline' =>
  s === 'posted' || s === 'paid' ? 'default' : s === 'draft' ? 'outline' : 'secondary';

const Payroll: React.FC = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const hi = language === 'hi';

  const [runs, setRuns] = useState<PayRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayRun | null>(null);
  const [slips, setSlips] = useState<Payslip[]>([]);
  const [slipsLoading, setSlipsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('pay_list_runs');
      if (error) {
        toast({ title: hi ? 'पेरोल लोड नहीं हुआ' : 'Could not load payroll', description: error.message, variant: 'destructive' });
      } else {
        setRuns((data as PayRun[]) || []);
      }
      setLoading(false);
    })();
  }, [hi, toast]);

  const openRun = async (run: PayRun) => {
    setSelected(run);
    setSlipsLoading(true);
    setSlips([]);
    const { data, error } = await supabase.rpc('pay_run_payslips', { p_run_id: run.run_id });
    if (error) {
      toast({ title: hi ? 'पेस्लिप लोड नहीं हुईं' : 'Could not load payslips', description: error.message, variant: 'destructive' });
    } else {
      setSlips((data as Payslip[]) || []);
    }
    setSlipsLoading(false);
  };

  const empName = (n: Payslip['employee_name']) => (hi ? n?.hi : n?.en) || n?.en || n?.hi || '—';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold">{hi ? 'पेरोल' : 'Payroll'}</h1>
        <Badge variant="secondary" className="ml-1">{hi ? 'नया इंजन' : 'new engine'}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {hi ? 'पेरोल इंजन द्वारा गणना किए गए वेतन-रन और उनकी पेस्लिप।' : 'Salary runs computed by the payroll engine and their payslips.'}
      </p>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {hi ? 'लोड हो रहा है…' : 'Loading…'}</div>
          ) : runs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {hi ? 'अभी कोई पेरोल-रन नहीं। (पेरोल इंजन से एक रन बनने पर यहाँ दिखेगा।)' : 'No payroll runs yet. (A run computed by the payroll engine will appear here.)'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{hi ? 'रन नं.' : 'Run No.'}</TableHead>
                  <TableHead>{hi ? 'अवधि' : 'Period'}</TableHead>
                  <TableHead>{hi ? 'स्थिति' : 'State'}</TableHead>
                  <TableHead className="text-right">{hi ? 'पेस्लिप' : 'Payslips'}</TableHead>
                  <TableHead className="text-right">{hi ? 'कुल नेट' : 'Total Net'}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.run_id} className="cursor-pointer" onClick={() => openRun(r)}>
                    <TableCell className="font-medium">{r.run_no}</TableCell>
                    <TableCell>{r.period}</TableCell>
                    <TableCell><Badge variant={stateVariant(r.state)}>{r.state}</Badge></TableCell>
                    <TableCell className="text-right">{r.payslip_count}</TableCell>
                    <TableCell className="text-right font-medium">{rupees(r.total_net_minor)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openRun(r); }}>{hi ? 'देखें' : 'View'}</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              {hi ? 'पेस्लिप' : 'Payslips'} — {selected?.run_no} <span className="text-muted-foreground font-normal">({selected?.period})</span>
            </DialogTitle>
          </DialogHeader>
          {slipsLoading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {hi ? 'लोड हो रहा है…' : 'Loading…'}</div>
          ) : slips.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground"><Users className="h-5 w-5 mx-auto mb-1" />{hi ? 'कोई पेस्लिप नहीं' : 'No payslips'}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{hi ? 'कर्मचारी' : 'Employee'}</TableHead>
                    <TableHead className="text-right">{hi ? 'सकल' : 'Gross'}</TableHead>
                    <TableHead className="text-right">{hi ? 'कटौती' : 'Deductions'}</TableHead>
                    <TableHead className="text-right">{hi ? 'नेट' : 'Net'}</TableHead>
                    <TableHead className="text-right">{hi ? 'दिन' : 'Days'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slips.map((s) => (
                    <TableRow key={s.payslip_id}>
                      <TableCell><span className="font-medium">{empName(s.employee_name)}</span> <span className="text-xs text-muted-foreground">{s.employee_code}</span></TableCell>
                      <TableCell className="text-right">{rupees(s.gross_minor)}</TableCell>
                      <TableCell className="text-right">{rupees(s.deductions_minor)}</TableCell>
                      <TableCell className="text-right font-semibold">{rupees(s.net_minor)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{Number(s.paid_days)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payroll;
