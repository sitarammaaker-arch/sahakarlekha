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
import { asDbArgs } from '@/lib/dbRow';
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
import { useLanguage } from '@/contexts/LanguageContext';
import {
  commissionStage, summarizeCommissions, formatPaise, COMMISSION_STAGE_TEXT, tl, basisText, type CommissionRow,
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

const RULE_ERRORS: Record<string, { hi: string; en: string }> = {
  date_required: { hi: 'लागू होने की तारीख़ भरें।', en: 'Enter the date the rule takes effect.' },
  duplicate_date: { hi: 'इस तारीख़ का नियम पहले से है — दूसरी तारीख़ चुनें।', en: 'A rule for this date already exists — choose another date.' },
  out_of_range: {
    hi: 'प्रतिशत 0–50, renewal साल 0–10 और refund अवधि 0–90 दिन के बीच हो।',
    en: 'Percentages must be 0–50, renewal years 0–10 and the refund window 0–90 days.',
  },
};

const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export default function AdminCommissionsPanel() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [rows, setRows] = useState<AdminCommissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ hi: string; en: string } | null>(null);
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
          ? {
            hi: 'Migration 166 अभी नहीं चली — Supabase SQL Editor में 166_partner_commissions.sql चलाएँ।',
            en: 'Migration 166 has not run yet — run 166_partner_commissions.sql in the Supabase SQL Editor.',
          }
          : { hi: `लोड नहीं हुआ: ${msg}`, en: `Could not load: ${msg}` });
        return;
      }
      setRules((r.data ?? []) as RuleRow[]);
      setRows((c.data ?? []) as AdminCommissionRow[]);
    } catch {
      setError({ hi: 'लोड नहीं हुआ — इंटरनेट जाँचें।', en: 'Could not load — check your internet connection.' });
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
      toast({
        title: L('अधूरी जानकारी', 'Incomplete details'),
        description: L('तारीख़, दोनों प्रतिशत, renewal साल और refund अवधि भरें।', 'Fill in the date, both percentages, renewal years and the refund window.'),
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_commission_rule_add', asDbArgs({
        p_effective_from: rFrom, p_first_year_pct: first, p_renewal_pct: renewal,
        p_renewal_years: Math.trunc(years), p_hold_days: Math.trunc(hold), p_note: rNote.trim() || null,
      }));
      const res = (data ?? {}) as { ok?: boolean; error_code?: string; repriced?: number };
      if (err || !res.ok) {
        toast({
          title: L('नियम सेव नहीं हुआ', 'Rule not saved'),
          description: RULE_ERRORS[res.error_code ?? '']?.[language] ?? err?.message ?? L('दोबारा कोशिश करें।', 'Please try again.'),
          variant: 'destructive', duration: 10000,
        });
        return;
      }
      toast({
        title: L('नियम सेव हो गया ✓', 'Rule saved ✓'),
        description: res.repriced ? L(`${res.repriced} रुके हुए commission पर दर लग गई।`, `Rate applied to ${res.repriced} pending commission(s).`) : undefined,
      });
      setRuleOpen(false);
      setRNote('');
      await load();
    } catch {
      toast({ title: L('नियम सेव नहीं हुआ', 'Rule not saved'), description: L('इंटरनेट जाँचें।', 'Check your internet connection.'), variant: 'destructive', duration: 10000 });
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
        const why = res.error_code === 'reason_required' ? L('कारण लिखें (कम से कम 5 अक्षर)।', 'Write a reason (at least 5 characters).')
          : res.error_code === 'already_cancelled' ? L('यह पहले ही रद्द है।', 'This is already cancelled.') : err?.message ?? L('दोबारा कोशिश करें।', 'Please try again.');
        toast({ title: L('रद्द नहीं हुआ', 'Not cancelled'), description: why, variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: L('Commission रद्द हो गया ✓', 'Commission cancelled ✓') });
      setCancelTarget(null);
      setCancelReason('');
      await load();
    } catch {
      toast({ title: L('रद्द नहीं हुआ', 'Not cancelled'), description: L('इंटरनेट जाँचें।', 'Check your internet connection.'), variant: 'destructive', duration: 10000 });
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
        toast({ title: L('Sync नहीं हुआ', 'Sync failed'), description: err?.message ?? L('दोबारा कोशिश करें।', 'Please try again.'), variant: 'destructive', duration: 10000 });
        return;
      }
      toast({
        title: res.recorded
          ? L(`${res.recorded} छूटे commission दर्ज हुए ✓`, `${res.recorded} missed commission(s) recorded ✓`)
          : L('सब पहले से दर्ज है ✓', 'Everything is already recorded ✓'),
      });
      await load();
    } catch {
      toast({ title: L('Sync नहीं हुआ', 'Sync failed'), description: L('इंटरनेट जाँचें।', 'Check your internet connection.'), variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => downloadCSV(
    [L('Partner', 'Partner'), L('Code', 'Code'), L('समिति', 'Society'), L('Invoice', 'Invoice'), L('Invoice की तारीख़', 'Invoice date'),
      L('प्रकार', 'Kind'), L('आधार', 'Basis'), L('Taxable (₹)', 'Taxable (₹)'), L('दर %', 'Rate %'), L('Commission (₹)', 'Commission (₹)'),
      L('स्थिति', 'Status'), L('कब से देय', 'Payable from'), L('रद्द करने का कारण', 'Cancel reason')],
    rows.map((r) => [r.partner_name, r.code, r.society_name ?? r.society_id, r.invoice_no, fmtDate(r.invoice_date), r.kind,
      basisText(r.basis, language), (Number(r.taxable_paise) / 100).toFixed(2), r.rate_pct == null ? '' : Number(r.rate_pct),
      (Number(r.commission_paise) / 100).toFixed(2), tl(COMMISSION_STAGE_TEXT[commissionStage(r)], language), fmtDate(r.hold_until), r.cancel_reason ?? '']),
    'partner-commissions',
  );

  return (
    <div className="space-y-5">
      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 flex items-start gap-2 text-destructive"><AlertTriangle className="h-4 w-4 mt-0.5" /> {error[language]}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{L('Commission की दर (नियम)', 'Commission rate (rules)')}</CardTitle>
            <Button size="sm" className="ml-auto gap-1" onClick={() => setRuleOpen(true)}><Plus className="h-3.5 w-3.5" /> {L('नया नियम', 'New rule')}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {current ? (
            language === 'hi' ? (
              <p className="text-sm">
                आज लागू: पहला साल <strong>{Number(current.first_year_pct)}%</strong>, renewal <strong>{Number(current.renewal_pct)}%</strong>
                {' '}({current.renewal_years} साल तक), refund अवधि <strong>{current.hold_days} दिन</strong> — {fmtDate(current.effective_from)} से।
              </p>
            ) : (
              <p className="text-sm">
                In force today: first year <strong>{Number(current.first_year_pct)}%</strong>, renewal <strong>{Number(current.renewal_pct)}%</strong>
                {' '}(for {current.renewal_years} years), refund window <strong>{current.hold_days} days</strong> — from {fmtDate(current.effective_from)}.
              </p>
            )
          ) : (
            <p className="text-sm text-amber-800 bg-amber-50 rounded p-2">
              {L(
                'अभी कोई नियम नहीं है। समितियों के भुगतान "दर तय होनी बाकी" के रूप में दर्ज होते रहेंगे; नियम जोड़ते ही उन पर दर लग जाएगी।',
                'There is no rule yet. Society payments will keep being recorded as "Rate not set yet"; the rate is applied to them as soon as you add a rule.',
              )}
            </p>
          )}
          {rules.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{L('लागू तारीख़', 'Effective date')}</TableHead><TableHead>{L('पहला साल', 'First year')}</TableHead><TableHead>Renewal</TableHead>
                    <TableHead>{L('Renewal साल', 'Renewal years')}</TableHead><TableHead>{L('Refund अवधि', 'Refund window')}</TableHead><TableHead>{L('किसने / नोट', 'By / note')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{fmtDate(r.effective_from)}</TableCell>
                      <TableCell>{Number(r.first_year_pct)}%</TableCell>
                      <TableCell>{Number(r.renewal_pct)}%</TableCell>
                      <TableCell>{r.renewal_years}</TableCell>
                      <TableCell>{r.hold_days} {L('दिन', 'days')}</TableCell>
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
            <Badge className="bg-green-100 text-green-900">{L('पक्का', 'Confirmed')}: {formatPaise(sum.eligible)}</Badge>
            <Badge className="bg-amber-100 text-amber-900">{L('Refund अवधि में', 'In refund window')}: {formatPaise(sum.hold)}</Badge>
            {sum.paid > 0 && <Badge className="bg-blue-100 text-blue-900">{L('भुगतान हो गया', 'Paid out')}: {formatPaise(sum.paid)}</Badge>}
            {sum.noRuleCount > 0 && <Badge variant="outline">{L('दर बाकी', 'Rate pending')}: {sum.noRuleCount}</Badge>}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" className="gap-1" onClick={exportCsv} disabled={rows.length === 0}><FileSpreadsheet className="h-3.5 w-3.5" /> CSV</Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => void sync()} disabled={saving}
                title={L('जिन invoices का commission दर्ज नहीं हुआ, उन्हें दर्ज करें', 'Record commission for invoices that were missed')}>
                <RefreshCw className="h-3.5 w-3.5" /> Sync
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{loading ? L('लोड हो रहा है…', 'Loading…') : L('अभी किसी जुड़ी समिति का भुगतान नहीं आया।', 'No referred society has paid yet.')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead><TableHead>{L('समिति / invoice', 'Society / invoice')}</TableHead><TableHead>{L('आधार', 'Basis')}</TableHead>
                  <TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">Commission</TableHead>
                  <TableHead>{L('स्थिति', 'Status')}</TableHead><TableHead>{L('कार्य', 'Action')}</TableHead>
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
                        {basisText(r.basis, language)}{r.rate_pct != null ? ` · ${Number(r.rate_pct)}%` : ''}
                      </TableCell>
                      <TableCell className="align-top text-right">{formatPaise(r.taxable_paise)}</TableCell>
                      <TableCell className={`align-top text-right font-medium ${r.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>{formatPaise(r.commission_paise)}</TableCell>
                      <TableCell className="align-top">
                        <Badge className={st.cls}>{tl(st, language)}</Badge>
                        {commissionStage(r) === 'hold' && <div className="text-xs text-muted-foreground mt-1">{L(`${fmtDate(r.hold_until)} को पक्का`, `Confirmed on ${fmtDate(r.hold_until)}`)}</div>}
                        {r.status === 'cancelled' && <div className="text-xs text-muted-foreground mt-1 max-w-[14rem]">{r.cancel_reason} · {r.cancelled_by}</div>}
                      </TableCell>
                      <TableCell className="align-top">
                        {r.status !== 'cancelled' && (
                          <Button size="sm" variant="outline" onClick={() => { setCancelTarget(r); setCancelReason(''); }}>{L('रद्द करें', 'Cancel')}</Button>
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
            <DialogTitle>{L('नया commission नियम', 'New commission rule')}</DialogTitle>
            <DialogDescription>
              {L(
                'नियम बाद में बदला नहीं जा सकता — दर बदलनी हो तो आगे की तारीख़ से नया नियम जोड़ें। हर भुगतान पर वही नियम लगता है जो उसकी invoice की तारीख़ पर लागू था।',
                'A rule cannot be changed later — to change the rate, add a new rule from a later date. Each payment uses the rule that was in force on its invoice date.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="r-from">{L('किस तारीख़ से लागू', 'Effective from')}</Label>
              <Input id="r-from" type="date" value={rFrom} onChange={(e) => setRFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-first">{L('पहला साल (%)', 'First year (%)')}</Label>
              <Input id="r-first" type="number" min={0} max={50} step="0.5" value={rFirst} onChange={(e) => setRFirst(e.target.value)} placeholder={L('जैसे 20', 'e.g. 20')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-renewal">Renewal (%)</Label>
              <Input id="r-renewal" type="number" min={0} max={50} step="0.5" value={rRenewal} onChange={(e) => setRRenewal(e.target.value)} placeholder={L('जैसे 10', 'e.g. 10')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-years">{L('कितने renewal साल तक', 'Number of renewal years')}</Label>
              <Input id="r-years" type="number" min={0} max={10} step="1" value={rYears} onChange={(e) => setRYears(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-hold">{L('Refund अवधि (दिन)', 'Refund window (days)')}</Label>
              <Input id="r-hold" type="number" min={0} max={90} step="1" value={rHold} onChange={(e) => setRHold(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="r-note">{L('नोट (वैकल्पिक)', 'Note (optional)')}</Label>
              <Input id="r-note" value={rNote} onChange={(e) => setRNote(e.target.value)} maxLength={200} placeholder={L('जैसे: Partner Agreement v1', 'e.g. Partner Agreement v1')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>{L('रद्द', 'Cancel')}</Button>
            <Button onClick={() => void addRule()} disabled={saving}>{saving ? L('सेव हो रहा है…', 'Saving…') : L('नियम सेव करें', 'Save rule')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{L('Commission रद्द करें', 'Cancel commission')}</DialogTitle>
            <DialogDescription>
              {cancelTarget?.partner_name} · {cancelTarget?.society_name} · {formatPaise(cancelTarget?.commission_paise)}
              {L('। रद्द करना वापस नहीं होता; कारण partner को भी दिखेगा।', '. Cancelling cannot be undone; the partner will also see the reason.')}
              {cancelTarget?.status === 'paid' && L(
                ' इसका भुगतान हो चुका है — इतनी रकम clawback बनकर partner के अगले भुगतान से कटेगी।',
                ' This has already been paid — the same amount becomes a clawback and is deducted from the partner\'s next payout.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="c-reason">{L('कारण (ज़रूरी)', 'Reason (required)')}</Label>
            <Input id="c-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={300} placeholder={L('जैसे: समिति को Razorpay से refund दिया', 'e.g. Society was refunded through Razorpay')} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>{L('वापस', 'Back')}</Button>
            <Button variant="destructive" onClick={() => void cancel()} disabled={saving || cancelReason.trim().length < 5}>{saving ? L('रद्द हो रहा है…', 'Cancelling…') : L('रद्द करें', 'Cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
