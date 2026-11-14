/**
 * AdminCommissionsPanel — the Commission tab of /super-admin/partners (migration 166, slice 3).
 *
 *   • Rules: the commission rate is DATA. Rules are effective-dated and append-only — to change the rate, add a rule
 *     with a later date. Adding one prices every "rate pending" commission it covers.
 *   • Commissions: one row per invoice of a referred society; cancel with a reason (e.g. the payment was refunded in
 *     Razorpay — the product has no automatic refund flow). "Sync" records anything the invoice trigger missed.
 * All reads/writes go through SECURITY DEFINER RPCs gated on is_platform_admin(); the list is re-read after every
 * write, so nothing on screen changes unless the server said ok. Payouts, TDS and clawback are the Payouts tab (167).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, FileSpreadsheet, RefreshCw, Plus } from 'lucide-react';
import { fmtDate, fmtDateTime } from '@/lib/dateUtils';
import { downloadCSV } from '@/lib/exportUtils';
import {
  commissionStage, summarizeCommissions, formatPaise, COMMISSION_STAGE_TEXT, COMMISSION_BASIS_TEXT, type CommissionRow,
} from '@/lib/referral/referralCode';

interface RuleRow {
  id: number;
  effective_from: string;
  first_year_pct: number | string;
  renewal_pct: number | string;
  renewal_years: number;
  hold_days: number;
  note: string | null;
  created_by: string;
  created_at: string;
}

interface AdminCommissionRow extends CommissionRow {
  partner_id: string;
  partner_name: string;
  code: string;
  society_id: string;
  invoice_no: string;
  cancelled_by: string | null;
  cancelled_at: string | null;
}

const RULE_ERRORS: Record<string, string> = {
  date_required: 'लागू होने की तारीख़ भरें।',
  duplicate_date: 'इस तारीख़ का नियम पहले से है — दूसरी तारीख़ चुनें।',
  out_of_range: 'प्रतिशत 0–50, renewal साल 0–10 और refund अवधि 0–90 दिन के बीच हो।',
};

const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export default function AdminCommissionsPanel() {
  const { toast } = useToast();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [rows, setRows] = useState<AdminCommissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [ruleOpen, setRuleOpen] = useState(false);
  const [rFrom, setRFrom] = useState(todayIst);
  const [rFirst, setRFirst] = useState('');
  const [rRenewal, setRRenewal] = useState('');
  const [rYears, setRYears] = useState('1');
  const [rHold, setRHold] = useState('15');
  const [rNote, setRNote] = useState('');

  const [cancelTarget, setCancelTarget] = useState<AdminCommissionRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, c] = await Promise.all([supabase.rpc('admin_commission_rules_list'), supabase.rpc('admin_commissions_list')]);
      if (r.error || c.error) {
        const msg = (r.error ?? c.error)?.message ?? '';
        setError(/function .* does not exist|schema cache/i.test(msg)
          ? 'Migration 166 अभी नहीं चली — Supabase SQL Editor में 166_partner_commissions.sql चलाएँ।'
          : `लोड नहीं हुआ: ${msg}`);
        return;
      }
      setRules((r.data ?? []) as RuleRow[]);
      setRows((c.data ?? []) as AdminCommissionRow[]);
    } catch {
      setError('लोड नहीं हुआ — इंटरनेट जाँचें।');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sum = useMemo(() => summarizeCommissions(rows), [rows]);
  const current = rules.find((r) => r.effective_from <= todayIst()) ?? null;

  const addRule = async () => {
    const first = Number(rFirst), renewal = Number(rRenewal), years = Number(rYears), hold = Number(rHold);
    if (!rFrom || rFirst === '' || rRenewal === '' || [first, renewal, years, hold].some((n) => !Number.isFinite(n))) {
      toast({ title: 'अधूरी जानकारी', description: 'तारीख़, दोनों प्रतिशत, renewal साल और refund अवधि भरें।', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_commission_rule_add', {
        p_effective_from: rFrom, p_first_year_pct: first, p_renewal_pct: renewal,
        p_renewal_years: Math.trunc(years), p_hold_days: Math.trunc(hold), p_note: rNote.trim() || null,
      });
      const res = (data ?? {}) as { ok?: boolean; error_code?: string; repriced?: number };
      if (err || !res.ok) {
        toast({ title: 'नियम सेव नहीं हुआ', description: RULE_ERRORS[res.error_code ?? ''] ?? err?.message ?? 'दोबारा कोशिश करें।', variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: 'नियम सेव हो गया ✓', description: res.repriced ? `${res.repriced} रुके हुए commission पर दर लग गई।` : undefined });
      setRuleOpen(false);
      setRNote('');
      await load();
    } catch {
      toast({ title: 'नियम सेव नहीं हुआ', description: 'इंटरनेट जाँचें।', variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!cancelTarget) return;
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_commission_cancel', { p_id: cancelTarget.id, p_reason: cancelReason.trim() });
      const res = (data ?? {}) as { ok?: boolean; error_code?: string };
      if (err || !res.ok) {
        const why = res.error_code === 'reason_required' ? 'कारण लिखें (कम से कम 5 अक्षर)।'
          : res.error_code === 'already_cancelled' ? 'यह पहले ही रद्द है।' : err?.message ?? 'दोबारा कोशिश करें।';
        toast({ title: 'रद्द नहीं हुआ', description: why, variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: 'Commission रद्द हो गया ✓' });
      setCancelTarget(null);
      setCancelReason('');
      await load();
    } catch {
      toast({ title: 'रद्द नहीं हुआ', description: 'इंटरनेट जाँचें।', variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  const sync = async () => {
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_commission_sync');
      const res = (data ?? {}) as { ok?: boolean; recorded?: number };
      if (err || !res.ok) {
        toast({ title: 'Sync नहीं हुआ', description: err?.message ?? 'दोबारा कोशिश करें।', variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: res.recorded ? `${res.recorded} छूटे commission दर्ज हुए ✓` : 'सब पहले से दर्ज है ✓' });
      await load();
    } catch {
      toast({ title: 'Sync नहीं हुआ', description: 'इंटरनेट जाँचें।', variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => downloadCSV(
    ['Partner', 'Code', 'Society', 'Invoice', 'Invoice date', 'Kind', 'Basis', 'Taxable (₹)', 'Rate %', 'Commission (₹)', 'Status', 'Payable from', 'Cancel reason'],
    rows.map((r) => [r.partner_name, r.code, r.society_name ?? r.society_id, r.invoice_no, fmtDate(r.invoice_date), r.kind,
      COMMISSION_BASIS_TEXT[r.basis], (Number(r.taxable_paise) / 100).toFixed(2), r.rate_pct == null ? '' : Number(r.rate_pct),
      (Number(r.commission_paise) / 100).toFixed(2), COMMISSION_STAGE_TEXT[commissionStage(r)].label, fmtDate(r.hold_until), r.cancel_reason ?? '']),
    'partner-commissions',
  );

  return (
    <div className="space-y-5">
      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 flex items-start gap-2 text-destructive"><AlertTriangle className="h-4 w-4 mt-0.5" /> {error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Commission की दर (नियम)</CardTitle>
            <Button size="sm" className="ml-auto gap-1" onClick={() => setRuleOpen(true)}><Plus className="h-3.5 w-3.5" /> नया नियम</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {current ? (
            <p className="text-sm">
              आज लागू: पहला साल <strong>{Number(current.first_year_pct)}%</strong>, renewal <strong>{Number(current.renewal_pct)}%</strong>
              {' '}({current.renewal_years} साल तक), refund अवधि <strong>{current.hold_days} दिन</strong> — {fmtDate(current.effective_from)} से।
            </p>
          ) : (
            <p className="text-sm text-amber-800 bg-amber-50 rounded p-2">
              अभी कोई नियम नहीं है। समितियों के भुगतान "दर तय होनी बाकी" के रूप में दर्ज होते रहेंगे; नियम जोड़ते ही उन पर दर लग जाएगी।
            </p>
          )}
          {rules.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>लागू तारीख़</TableHead><TableHead>पहला साल</TableHead><TableHead>Renewal</TableHead>
                    <TableHead>Renewal साल</TableHead><TableHead>Refund अवधि</TableHead><TableHead>किसने / नोट</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{fmtDate(r.effective_from)}</TableCell>
                      <TableCell>{Number(r.first_year_pct)}%</TableCell>
                      <TableCell>{Number(r.renewal_pct)}%</TableCell>
                      <TableCell>{r.renewal_years}</TableCell>
                      <TableCell>{r.hold_days} दिन</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.created_by} · {fmtDateTime(r.created_at)}{r.note ? ` · ${r.note}` : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Commission ({rows.length})</CardTitle>
            <Badge className="bg-green-100 text-green-900">पक्का: {formatPaise(sum.eligible)}</Badge>
            <Badge className="bg-amber-100 text-amber-900">Refund अवधि में: {formatPaise(sum.hold)}</Badge>
            {sum.paid > 0 && <Badge className="bg-blue-100 text-blue-900">भुगतान हो गया: {formatPaise(sum.paid)}</Badge>}
            {sum.noRuleCount > 0 && <Badge variant="outline">दर बाकी: {sum.noRuleCount}</Badge>}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" className="gap-1" onClick={exportCsv} disabled={rows.length === 0}><FileSpreadsheet className="h-3.5 w-3.5" /> CSV</Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => void sync()} disabled={saving}
                title="जिन invoices का commission दर्ज नहीं हुआ, उन्हें दर्ज करें">
                <RefreshCw className="h-3.5 w-3.5" /> Sync
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{loading ? 'लोड हो रहा है…' : 'अभी किसी जुड़ी समिति का भुगतान नहीं आया।'}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead><TableHead>समिति / invoice</TableHead><TableHead>आधार</TableHead>
                  <TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">Commission</TableHead>
                  <TableHead>स्थिति</TableHead><TableHead>कार्य</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const st = COMMISSION_STAGE_TEXT[commissionStage(r)];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="align-top">{r.partner_name}<div className="text-xs font-mono text-muted-foreground">{r.code}</div></TableCell>
                      <TableCell className="align-top">
                        {r.society_name ?? '—'}
                        <div className="text-xs text-muted-foreground">{r.invoice_no} · {fmtDate(r.invoice_date)} · {r.kind}</div>
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {COMMISSION_BASIS_TEXT[r.basis]}{r.rate_pct != null ? ` · ${Number(r.rate_pct)}%` : ''}
                      </TableCell>
                      <TableCell className="align-top text-right">{formatPaise(r.taxable_paise)}</TableCell>
                      <TableCell className={`align-top text-right font-medium ${r.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>{formatPaise(r.commission_paise)}</TableCell>
                      <TableCell className="align-top">
                        <Badge className={st.cls}>{st.label}</Badge>
                        {commissionStage(r) === 'hold' && <div className="text-xs text-muted-foreground mt-1">{fmtDate(r.hold_until)} को पक्का</div>}
                        {r.status === 'cancelled' && <div className="text-xs text-muted-foreground mt-1 max-w-[14rem]">{r.cancel_reason} · {r.cancelled_by}</div>}
                      </TableCell>
                      <TableCell className="align-top">
                        {r.status !== 'cancelled' && (
                          <Button size="sm" variant="outline" onClick={() => { setCancelTarget(r); setCancelReason(''); }}>रद्द करें</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>नया commission नियम</DialogTitle>
            <DialogDescription>
              नियम बाद में बदला नहीं जा सकता — दर बदलनी हो तो आगे की तारीख़ से नया नियम जोड़ें। हर भुगतान पर वही नियम लगता है जो
              उसकी invoice की तारीख़ पर लागू था।
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="r-from">किस तारीख़ से लागू</Label>
              <Input id="r-from" type="date" value={rFrom} onChange={(e) => setRFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-first">पहला साल (%)</Label>
              <Input id="r-first" type="number" min={0} max={50} step="0.5" value={rFirst} onChange={(e) => setRFirst(e.target.value)} placeholder="जैसे 20" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-renewal">Renewal (%)</Label>
              <Input id="r-renewal" type="number" min={0} max={50} step="0.5" value={rRenewal} onChange={(e) => setRRenewal(e.target.value)} placeholder="जैसे 10" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-years">कितने renewal साल तक</Label>
              <Input id="r-years" type="number" min={0} max={10} step="1" value={rYears} onChange={(e) => setRYears(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-hold">Refund अवधि (दिन)</Label>
              <Input id="r-hold" type="number" min={0} max={90} step="1" value={rHold} onChange={(e) => setRHold(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="r-note">नोट (वैकल्पिक)</Label>
              <Input id="r-note" value={rNote} onChange={(e) => setRNote(e.target.value)} maxLength={200} placeholder="जैसे: Partner Agreement v1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>रद्द</Button>
            <Button onClick={() => void addRule()} disabled={saving}>{saving ? 'सेव हो रहा है…' : 'नियम सेव करें'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commission रद्द करें</DialogTitle>
            <DialogDescription>
              {cancelTarget?.partner_name} · {cancelTarget?.society_name} · {formatPaise(cancelTarget?.commission_paise)}। रद्द करना वापस नहीं होता;
              कारण partner को भी दिखेगा।
              {cancelTarget?.status === 'paid' && ' इसका भुगतान हो चुका है — इतनी रकम clawback बनकर partner के अगले भुगतान से कटेगी।'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="c-reason">कारण (ज़रूरी)</Label>
            <Input id="c-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={300} placeholder="जैसे: समिति को Razorpay से refund दिया" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>वापस</Button>
            <Button variant="destructive" onClick={() => void cancel()} disabled={saving || cancelReason.trim().length < 5}>{saving ? 'रद्द हो रहा है…' : 'रद्द करें'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
