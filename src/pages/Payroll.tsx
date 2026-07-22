/**
 * Payroll (new pay_* engine, read surface). Lists payroll runs computed by the payroll platform and,
 * on selecting a run, shows its payslips. Reads via the tenant-safe public RPCs (pay_list_runs /
 * pay_run_payslips, migration 115) — the browser cannot touch the pay_* schemas directly. RLS scopes
 * everything to the logged-in user's society.
 *
 * This is the read-only first slice; running/approving/posting a run is a later slice.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, Users, IndianRupee, Loader2, Play } from 'lucide-react';

interface PayRun {
  run_id: string; run_no: string; period: string; period_month: string;
  state: string; currency: string; created_at: string; payslip_count: number; total_net_minor: number;
}
interface Payslip {
  payslip_id: string; employee_code: string; employee_name: { hi?: string; en?: string } | null;
  payslip_no: string; gross_minor: number; deductions_minor: number; net_minor: number;
  currency: string; paid_days: number; lop_days: number; status: string;
}
interface Payline {
  code: string; name: { hi?: string; en?: string } | null; kind: string; computed_minor: number; currency: string; seq: number;
}
const isDeduction = (kind: string) => kind === 'deduction' || kind === 'loan_recovery';

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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lines, setLines] = useState<Payline[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);

  const [runOpen, setRunOpen] = useState(false);
  const [period, setPeriod] = useState('');
  const [running, setRunning] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('pay_list_runs');
    if (error) {
      toast({ title: hi ? 'पेरोल लोड नहीं हुआ' : 'Could not load payroll', description: error.message, variant: 'destructive' });
    } else {
      setRuns((data as PayRun[]) || []);
    }
    setLoading(false);
  }, [hi, toast]);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const runPayroll = async () => {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      toast({ title: hi ? 'अवधि चुनें' : 'Pick a period', description: hi ? 'YYYY-MM (जैसे 2026-05)' : 'YYYY-MM (e.g. 2026-05)', variant: 'destructive' });
      return;
    }
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('pay-run', { body: { period } });
    setRunning(false);
    if (error || (data && (data as { error?: string }).error)) {
      toast({ title: hi ? 'पेरोल नहीं चला' : 'Payroll run failed', description: error?.message || (data as { error?: string })?.error || '', variant: 'destructive' });
      return;
    }
    const d = data as { runNo?: string; employeeCount?: number };
    toast({ title: hi ? 'पेरोल चल गया ✓' : 'Payroll run complete ✓', description: `${d.runNo} — ${d.employeeCount} ${hi ? 'पेस्लिप' : 'payslip(s)'}` });
    setRunOpen(false);
    loadRuns();
  };

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

  const toggleLines = async (payslipId: string) => {
    if (expanded === payslipId) { setExpanded(null); return; }
    setExpanded(payslipId);
    setLinesLoading(true);
    setLines([]);
    const { data, error } = await supabase.rpc('pay_payslip_lines', { p_payslip_id: payslipId });
    if (error) {
      toast({ title: hi ? 'ब्रेकडाउन लोड नहीं हुआ' : 'Could not load breakdown', description: error.message, variant: 'destructive' });
    } else {
      setLines((data as Payline[]) || []);
    }
    setLinesLoading(false);
  };

  const empName = (n: Payslip['employee_name'] | Payline['name']) => (hi ? n?.hi : n?.en) || n?.en || n?.hi || '—';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold">{hi ? 'पेरोल' : 'Payroll'}</h1>
        <Badge variant="secondary" className="ml-1">{hi ? 'नया इंजन' : 'new engine'}</Badge>
        <Button className="ml-auto" size="sm" onClick={() => { setPeriod(''); setRunOpen(true); }}>
          <Play className="h-4 w-4 mr-1" /> {hi ? 'नया पेरोल चलाएँ' : 'Run payroll'}
        </Button>
      </div>

      <Dialog open={runOpen} onOpenChange={(o) => !running && setRunOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{hi ? 'नया पेरोल चलाएँ' : 'Run payroll'}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pay-period">{hi ? 'अवधि (माह)' : 'Period (month)'}</Label>
            <Input id="pay-period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            <p className="text-xs text-muted-foreground">{hi ? 'सर्वर इस माह के लिए सभी नियुक्त कर्मचारियों की गणना करके पेस्लिप बनाएगा।' : 'The server computes payslips for all assigned employees for this month.'}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)} disabled={running}>{hi ? 'रद्द' : 'Cancel'}</Button>
            <Button onClick={runPayroll} disabled={running}>
              {running ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {hi ? 'चल रहा है…' : 'Running…'}</> : <>{hi ? 'चलाएँ' : 'Run'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                    <React.Fragment key={s.payslip_id}>
                      <TableRow className="cursor-pointer" onClick={() => toggleLines(s.payslip_id)}>
                        <TableCell>
                          <span className="text-xs text-primary mr-1">{expanded === s.payslip_id ? '▾' : '▸'}</span>
                          <span className="font-medium">{empName(s.employee_name)}</span> <span className="text-xs text-muted-foreground">{s.employee_code}</span>
                        </TableCell>
                        <TableCell className="text-right">{rupees(s.gross_minor)}</TableCell>
                        <TableCell className="text-right">{rupees(s.deductions_minor)}</TableCell>
                        <TableCell className="text-right font-semibold">{rupees(s.net_minor)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{Number(s.paid_days)}</TableCell>
                      </TableRow>
                      {expanded === s.payslip_id && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/40 py-2">
                            {linesLoading ? (
                              <div className="flex items-center gap-2 px-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {hi ? 'लोड हो रहा है…' : 'Loading…'}</div>
                            ) : (
                              <div className="space-y-1">
                                {lines.map((ln) => (
                                  <div key={ln.code} className="flex justify-between text-sm px-2">
                                    <span>{empName(ln.name)} <span className="text-xs text-muted-foreground">{ln.code}</span></span>
                                    <span className={isDeduction(ln.kind) ? 'text-destructive' : ''}>{isDeduction(ln.kind) ? '− ' : ''}{rupees(ln.computed_minor)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
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
