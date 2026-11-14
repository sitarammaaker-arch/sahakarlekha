/**
 * AdminPayoutsPanel — the Payouts tab of /super-admin/partners (migration 167, slice 4).
 *
 *   • TDS rules: TDS is DATA with a required section + source. The form is pre-filled from the repo's own
 *     source-verified rule for commission (lib/rules/tax.ts `tds.194h.*`, read against s.393(1) Table Sl. No. 1(ii));
 *     the rate without PAN is NOT pre-filled — no source for it has been read here. Whether TDS applies to this
 *     payer at all is for the CA; if it does not, record a 0% rule with that reason as the source.
 *   • Make a payout: pick a partner + date → the server previews every eligible commission and open clawback, the
 *     PAN state and the TDS; the money is sent OUTSIDE the app; the admin records it with the UTR. The server
 *     re-computes and refuses a stale preview.
 *   • PAN / bank / UPI per partner (admin-entered; the partner sees only "PAN on file").
 *   • Payout list + TDS register CSV for a financial year.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, FileSpreadsheet, Plus, Wallet, IdCard } from 'lucide-react';
import { fmtDate, fmtDateTime } from '@/lib/dateUtils';
import { downloadCSV } from '@/lib/exportUtils';
import { TDS_RULES } from '@/lib/rules/tax';
import { formatPaise, financialYearOf, rupeesToPaise, payoutErrorText } from '@/lib/referral/referralCode';

interface PartnerLite { id: string; name: string; code: string | null; status: string; phone: string }

interface TdsRule {
  id: number; effective_from: string; rate_pct: number | string; no_pan_rate_pct: number | string;
  fy_threshold_paise: number; section_ref: string; source_ref: string; note: string | null; created_by: string; created_at: string;
}

interface Preview {
  ok: boolean; error_code?: string; fy?: string; commission_ids?: number[];
  credit_paise?: number; clawback_paise?: number; base_paise?: number; pan_on_file?: boolean;
  tds_rate_pct?: number | string; section_ref?: string; fy_threshold_paise?: number;
  fy_base_before_paise?: number; fy_tds_before_paise?: number; tds_paise?: number; net_paise?: number;
  commissions: { id: number; society_name: string | null; invoice_no: string; invoice_date: string; commission_paise: number }[];
  clawbacks: { id: number; amount_paise: number; reason: string; created_at: string }[];
  details: { pan: string | null; account_name: string | null; account_no: string | null; ifsc: string | null; upi_id: string | null } | null;
}

interface PayoutRow {
  id: number; partner_id: string; partner_name: string; code: string | null; payout_date: string; fy: string;
  credit_paise: number; clawback_paise: number; base_paise: number; tds_rate_pct: number | string; section_ref: string;
  pan_at_payout: string | null; tds_paise: number; net_paise: number; method: string; utr: string; note: string | null;
  created_by: string; created_at: string; commission_count: number;
}

interface Details { pan: string; pan_name: string; account_name: string; account_no: string; ifsc: string; upi_id: string; gstin: string }
const EMPTY_DETAILS: Details = { pan: '', pan_name: '', account_name: '', account_no: '', ifsc: '', upi_id: '', gstin: '' };

const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** The repo's source-verified commission TDS values (rate, threshold) and their citations — a suggestion only. */
function commissionTdsSuggestion() {
  const v = (key: string) => TDS_RULES[key]?.byJurisdiction['']?.[0] as { value?: number; cite?: string } | undefined;
  const rate = v('tds.194h.rate_pct');
  const threshold = v('tds.194h.threshold');
  return {
    rate: rate?.value != null ? String(rate.value) : '',
    thresholdRupees: threshold?.value != null ? String(threshold.value) : '',
    section: 'Income-tax Act 2025 s.393(1) Table Sl. No. 1(ii) [1961: s.194H] — commission',
    source: [rate?.cite, threshold?.cite].filter(Boolean).join(' | '),
  };
}

const METHOD_LABEL: Record<string, string> = { bank: 'Bank (NEFT/IMPS)', upi: 'UPI', other: 'अन्य' };

export default function AdminPayoutsPanel() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<PartnerLite[]>([]);
  const [rules, setRules] = useState<TdsRule[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // payout form
  const [partnerId, setPartnerId] = useState('');
  const [payDate, setPayDate] = useState(todayIst);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [method, setMethod] = useState<'bank' | 'upi' | 'other'>('bank');
  const [utr, setUtr] = useState('');
  const [note, setNote] = useState('');

  // TDS rule form
  const sug = useMemo(commissionTdsSuggestion, []);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [tFrom, setTFrom] = useState('2026-04-01');
  const [tRate, setTRate] = useState(sug.rate);
  const [tNoPan, setTNoPan] = useState('');
  const [tThreshold, setTThreshold] = useState(sug.thresholdRupees);
  const [tSection, setTSection] = useState(sug.section);
  const [tSource, setTSource] = useState(sug.source);
  const [tNote, setTNote] = useState('');

  // payment details
  const [detailsFor, setDetailsFor] = useState<PartnerLite | null>(null);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);

  const [fy, setFy] = useState(() => financialYearOf(todayIst()));

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, r, o] = await Promise.all([
        supabase.rpc('admin_partners_list'), supabase.rpc('admin_tds_rules_list'), supabase.rpc('admin_payouts_list'),
      ]);
      if (p.error || r.error || o.error) {
        const msg = (p.error ?? r.error ?? o.error)?.message ?? '';
        setError(/function .* does not exist|schema cache/i.test(msg)
          ? 'Migration 167 अभी नहीं चली — Supabase SQL Editor में 167_partner_payouts.sql चलाएँ।'
          : `लोड नहीं हुआ: ${msg}`);
        return;
      }
      setPartners(((p.data ?? []) as PartnerLite[]).filter((x) => x.status === 'approved' || x.status === 'suspended'));
      setRules((r.data ?? []) as TdsRule[]);
      setPayouts((o.data ?? []) as PayoutRow[]);
    } catch {
      setError('लोड नहीं हुआ — इंटरनेट जाँचें।');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const currentRule = rules.find((r) => r.effective_from <= todayIst()) ?? null;
  const fyOptions = useMemo(() => [...new Set([financialYearOf(todayIst()), ...payouts.map((p) => p.fy)])].sort().reverse(), [payouts]);
  const fyPayouts = payouts.filter((p) => p.fy === fy);

  const runPreview = async () => {
    if (!partnerId) return;
    setPreview(null);
    try {
      const { data, error: err } = await supabase.rpc('admin_payout_preview', { p_partner_id: partnerId, p_payout_date: payDate });
      if (err) { toast({ title: 'Preview नहीं बना', description: err.message, variant: 'destructive', duration: 10000 }); return; }
      setPreview(data as Preview);
    } catch {
      toast({ title: 'Preview नहीं बना', description: 'इंटरनेट जाँचें।', variant: 'destructive', duration: 10000 });
    }
  };

  const record = async () => {
    if (!preview?.ok || !preview.commission_ids?.length) return;
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_payout_record', {
        p_partner_id: partnerId, p_payout_date: payDate, p_commission_ids: preview.commission_ids,
        p_expected_net_paise: preview.net_paise, p_method: method, p_utr: utr.trim(), p_note: note.trim() || null,
      });
      const res = (data ?? {}) as { ok?: boolean; error_code?: string; net_paise?: number };
      if (err || !res.ok) {
        toast({ title: 'भुगतान दर्ज नहीं हुआ', description: err?.message ?? payoutErrorText(res.error_code), variant: 'destructive', duration: 12000 });
        if (res.error_code === 'stale_preview') await runPreview();
        return;
      }
      toast({ title: 'भुगतान दर्ज हो गया ✓', description: `शुद्ध रकम ${formatPaise(res.net_paise)} · UTR ${utr.trim()}` });
      setPreview(null); setUtr(''); setNote('');
      await load();
    } catch {
      toast({ title: 'भुगतान दर्ज नहीं हुआ', description: 'इंटरनेट जाँचें। पैसा भेज दिया हो तो दोबारा दर्ज करने से पहले सूची देखें।', variant: 'destructive', duration: 12000 });
    } finally {
      setSaving(false);
    }
  };

  const addRule = async () => {
    const threshold = rupeesToPaise(tThreshold);
    const rate = Number(tRate), noPan = Number(tNoPan);
    if (!tFrom || tRate === '' || tNoPan === '' || threshold == null || !Number.isFinite(rate) || !Number.isFinite(noPan)) {
      toast({ title: 'अधूरी जानकारी', description: 'तारीख़, दोनों दरें और सीमा (₹) भरें।', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_tds_rule_add', {
        p_effective_from: tFrom, p_rate_pct: rate, p_no_pan_rate_pct: noPan, p_fy_threshold_paise: threshold,
        p_section_ref: tSection.trim(), p_source_ref: tSource.trim(), p_note: tNote.trim() || null,
      });
      const res = (data ?? {}) as { ok?: boolean; error_code?: string };
      if (err || !res.ok) {
        toast({ title: 'TDS नियम सेव नहीं हुआ', description: err?.message ?? payoutErrorText(res.error_code), variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: 'TDS नियम सेव हो गया ✓' });
      setRuleOpen(false);
      await load();
    } catch {
      toast({ title: 'TDS नियम सेव नहीं हुआ', description: 'इंटरनेट जाँचें।', variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (p: PartnerLite) => {
    setDetailsFor(p);
    setDetails(EMPTY_DETAILS);
    try {
      const { data, error: err } = await supabase.rpc('admin_partner_payment_details_get', { p_partner_id: p.id });
      if (err) { toast({ title: 'जानकारी लोड नहीं हुई', description: err.message, variant: 'destructive' }); return; }
      const d = (data as { details?: Record<string, string | null> | null })?.details;
      if (d) setDetails({
        pan: d.pan ?? '', pan_name: d.pan_name ?? '', account_name: d.account_name ?? '', account_no: d.account_no ?? '',
        ifsc: d.ifsc ?? '', upi_id: d.upi_id ?? '', gstin: d.gstin ?? '',
      });
    } catch {
      toast({ title: 'जानकारी लोड नहीं हुई', description: 'इंटरनेट जाँचें।', variant: 'destructive' });
    }
  };

  const saveDetails = async () => {
    if (!detailsFor) return;
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_partner_payment_details_set', {
        p_partner_id: detailsFor.id, p_pan: details.pan, p_pan_name: details.pan_name, p_account_name: details.account_name,
        p_account_no: details.account_no, p_ifsc: details.ifsc, p_upi_id: details.upi_id, p_gstin: details.gstin,
      });
      const res = (data ?? {}) as { ok?: boolean; error_code?: string };
      if (err || !res.ok) {
        toast({ title: 'सेव नहीं हुआ', description: err?.message ?? payoutErrorText(res.error_code), variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: 'भुगतान जानकारी सेव हो गई ✓' });
      setDetailsFor(null);
      if (preview && partnerId === detailsFor.id) await runPreview();
    } catch {
      toast({ title: 'सेव नहीं हुआ', description: 'इंटरनेट जाँचें।', variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  const exportRegister = () => downloadCSV(
    ['Payout date', 'FY', 'Partner', 'Code', 'PAN', 'Section', 'Commission credited (₹)', 'Clawback (₹)', 'Base (₹)', 'TDS rate %', 'TDS (₹)', 'Net paid (₹)', 'Method', 'UTR'],
    fyPayouts.map((p) => [fmtDate(p.payout_date), p.fy, p.partner_name, p.code ?? '', p.pan_at_payout ?? 'PAN नहीं', p.section_ref,
      (p.credit_paise / 100).toFixed(2), (p.clawback_paise / 100).toFixed(2), (p.base_paise / 100).toFixed(2), Number(p.tds_rate_pct),
      (p.tds_paise / 100).toFixed(2), (p.net_paise / 100).toFixed(2), METHOD_LABEL[p.method] ?? p.method, p.utr]),
    `partner-tds-register-${fy}`,
  );

  const selected = partners.find((p) => p.id === partnerId) ?? null;
  const fyTotals = fyPayouts.reduce((a, p) => ({ base: a.base + Number(p.base_paise), tds: a.tds + Number(p.tds_paise), net: a.net + Number(p.net_paise) }), { base: 0, tds: 0, net: 0 });

  return (
    <div className="space-y-5">
      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 flex items-start gap-2 text-destructive"><AlertTriangle className="h-4 w-4 mt-0.5" /> {error}</CardContent>
        </Card>
      )}

      {/* TDS rules */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">TDS नियम</CardTitle>
            <Button size="sm" className="ml-auto gap-1" onClick={() => setRuleOpen(true)}><Plus className="h-3.5 w-3.5" /> नया TDS नियम</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {currentRule ? (
            <p>
              आज लागू: PAN होने पर <strong>{Number(currentRule.rate_pct)}%</strong>, PAN न होने पर <strong>{Number(currentRule.no_pan_rate_pct)}%</strong>,
              साल की सीमा <strong>{formatPaise(currentRule.fy_threshold_paise)}</strong> — {currentRule.section_ref}
              <span className="block text-xs text-muted-foreground">स्रोत: {currentRule.source_ref}</span>
            </p>
          ) : (
            <p className="text-amber-800 bg-amber-50 rounded p-2">
              अभी कोई TDS नियम नहीं है, इसलिए भुगतान दर्ज नहीं होगा। आप पर (payer पर) commission का TDS लागू है या नहीं, यह CA से पक्का करें; लागू न
              हो तो 0% का नियम, कारण को स्रोत में लिखकर जोड़ें।
            </p>
          )}
          {rules.length > 1 && (
            <ul className="text-xs text-muted-foreground list-disc pl-5">
              {rules.map((r) => <li key={r.id}>{fmtDate(r.effective_from)} से: {Number(r.rate_pct)}% / बिना PAN {Number(r.no_pan_rate_pct)}% / सीमा {formatPaise(r.fy_threshold_paise)} — {r.section_ref}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* make a payout */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> भुगतान करें</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
            <div className="space-y-1">
              <Label>Partner</Label>
              <Select value={partnerId} onValueChange={(v) => { setPartnerId(v); setPreview(null); }}>
                <SelectTrigger aria-label="Partner"><SelectValue placeholder="Partner चुनें" /></SelectTrigger>
                <SelectContent>
                  {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.code ?? '—'}{p.status === 'suspended' ? ' (रोका गया)' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay-date">भुगतान की तारीख़</Label>
              <Input id="pay-date" type="date" value={payDate} max={todayIst()} onChange={(e) => { setPayDate(e.target.value); setPreview(null); }} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!selected} onClick={() => selected && void openDetails(selected)} className="gap-1"><IdCard className="h-4 w-4" /> PAN / बैंक</Button>
              <Button disabled={!partnerId} onClick={() => void runPreview()}>Preview</Button>
            </div>
          </div>

          {preview && !preview.ok && (
            <p className="text-sm text-destructive" role="alert">{payoutErrorText(preview.error_code)}</p>
          )}
          {preview && (preview.commissions.length > 0 || preview.clawbacks.length > 0) && (
            <div className="space-y-3">
              <div className="rounded border divide-y text-sm">
                {preview.commissions.map((c) => (
                  <div key={c.id} className="p-2 flex justify-between gap-2">
                    <span>{c.society_name ?? '—'} <span className="text-xs text-muted-foreground">{c.invoice_no} · {fmtDate(c.invoice_date)}</span></span>
                    <span>{formatPaise(c.commission_paise)}</span>
                  </div>
                ))}
                {preview.clawbacks.map((k) => (
                  <div key={`k${k.id}`} className="p-2 flex justify-between gap-2 text-red-700">
                    <span>Clawback: {k.reason}</span><span>−{formatPaise(k.amount_paise)}</span>
                  </div>
                ))}
              </div>
              {preview.ok && (
                <>
                  <div className="grid gap-1 text-sm sm:max-w-md">
                    <div className="flex justify-between"><span>Commission</span><span>{formatPaise(preview.credit_paise)}</span></div>
                    {Number(preview.clawback_paise) > 0 && <div className="flex justify-between"><span>Clawback</span><span>−{formatPaise(preview.clawback_paise)}</span></div>}
                    <div className="flex justify-between font-medium"><span>आधार रकम</span><span>{formatPaise(preview.base_paise)}</span></div>
                    <div className="flex justify-between">
                      <span>TDS {Number(preview.tds_rate_pct)}% {preview.pan_on_file ? '' : '(PAN नहीं — ऊँची दर)'}</span>
                      <span>−{formatPaise(preview.tds_paise)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-1"><span>भेजनी है</span><span>{formatPaise(preview.net_paise)}</span></div>
                    <p className="text-xs text-muted-foreground">
                      इस साल ({preview.fy}) पहले: आधार {formatPaise(preview.fy_base_before_paise)}, TDS {formatPaise(preview.fy_tds_before_paise)} · सीमा {formatPaise(preview.fy_threshold_paise)} · {preview.section_ref}
                    </p>
                  </div>
                  <div className="rounded bg-muted/50 p-2 text-sm">
                    {preview.details && (preview.details.account_no || preview.details.upi_id) ? (
                      <>भेजें: {preview.details.account_name ?? ''} {preview.details.account_no ? `· खाता ${preview.details.account_no} · ${preview.details.ifsc}` : ''} {preview.details.upi_id ? `· UPI ${preview.details.upi_id}` : ''}</>
                    ) : (
                      <span className="text-amber-800">इस partner का बैंक/UPI दर्ज नहीं — "PAN / बैंक" से जोड़ें।</span>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label>तरीका</Label>
                      <Select value={method} onValueChange={(v) => setMethod(v as 'bank' | 'upi' | 'other')}>
                        <SelectTrigger aria-label="भुगतान का तरीका"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="utr">UTR / reference (ज़रूरी)</Label>
                      <Input id="utr" value={utr} onChange={(e) => setUtr(e.target.value)} maxLength={40} className="font-mono" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pay-note">नोट</Label>
                      <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">पहले अपने बैंक/UPI से ठीक {formatPaise(preview.net_paise)} भेजें, फिर UTR लिखकर दर्ज करें। सिस्टम पैसा नहीं भेजता।</p>
                  <Button onClick={() => void record()} disabled={saving || utr.trim().length < 6}>{saving ? 'दर्ज हो रहा है…' : 'भुगतान दर्ज करें'}</Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* payouts + TDS register */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">भुगतान और TDS register</CardTitle>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger className="w-32" aria-label="वित्त वर्ष"><SelectValue /></SelectTrigger>
              <SelectContent>{fyOptions.map((f) => <SelectItem key={f} value={f}>FY {f}</SelectItem>)}</SelectContent>
            </Select>
            <Badge variant="outline">आधार {formatPaise(fyTotals.base)}</Badge>
            <Badge variant="outline">TDS {formatPaise(fyTotals.tds)}</Badge>
            <Badge variant="outline">भेजा {formatPaise(fyTotals.net)}</Badge>
            <Button size="sm" variant="ghost" className="ml-auto gap-1" onClick={exportRegister} disabled={fyPayouts.length === 0}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> TDS register CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {fyPayouts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">इस वित्त वर्ष में कोई भुगतान नहीं।</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>तारीख़</TableHead><TableHead>Partner / PAN</TableHead><TableHead className="text-right">आधार</TableHead>
                  <TableHead className="text-right">TDS</TableHead><TableHead className="text-right">भेजा</TableHead><TableHead>UTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fyPayouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="align-top">{fmtDate(p.payout_date)}<div className="text-xs text-muted-foreground">{p.commission_count} commission</div></TableCell>
                    <TableCell className="align-top">{p.partner_name}<div className="text-xs font-mono text-muted-foreground">{p.pan_at_payout ?? 'PAN नहीं'}</div></TableCell>
                    <TableCell className="align-top text-right">{formatPaise(p.base_paise)}{Number(p.clawback_paise) > 0 && <div className="text-xs text-red-700">clawback −{formatPaise(p.clawback_paise)}</div>}</TableCell>
                    <TableCell className="align-top text-right">{formatPaise(p.tds_paise)}<div className="text-xs text-muted-foreground">{Number(p.tds_rate_pct)}%</div></TableCell>
                    <TableCell className="align-top text-right font-medium">{formatPaise(p.net_paise)}</TableCell>
                    <TableCell className="align-top text-xs"><span className="font-mono">{p.utr}</span><div className="text-muted-foreground">{METHOD_LABEL[p.method]} · {p.created_by} · {fmtDateTime(p.created_at)}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* TDS rule dialog */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>नया TDS नियम</DialogTitle>
            <DialogDescription>
              दर और सीमा नीचे repo के उस नियम से भरी हैं जो Act के पाठ (धारा 393(1) Table Sl. No. 1(ii)) से मिलाया गया है। "PAN न होने पर दर" का स्रोत
              यहाँ नहीं पढ़ा गया — वह CA से पूछकर, स्रोत सहित भरें। आप पर TDS लागू है या नहीं, यह भी CA से पक्का करें। नियम बाद में बदला नहीं जा सकता।
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="t-from">किस तारीख़ से लागू</Label><Input id="t-from" type="date" value={tFrom} onChange={(e) => setTFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="t-th">साल की सीमा (₹)</Label><Input id="t-th" value={tThreshold} onChange={(e) => setTThreshold(e.target.value)} inputMode="decimal" /></div>
            <div className="space-y-1"><Label htmlFor="t-rate">दर, PAN होने पर (%)</Label><Input id="t-rate" type="number" min={0} max={30} step="0.01" value={tRate} onChange={(e) => setTRate(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="t-nopan">दर, PAN न होने पर (%)</Label><Input id="t-nopan" type="number" min={0} max={40} step="0.01" value={tNoPan} onChange={(e) => setTNoPan(e.target.value)} placeholder="CA से पूछें" /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="t-sec">धारा (ज़रूरी)</Label><Input id="t-sec" value={tSection} onChange={(e) => setTSection(e.target.value)} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="t-src">स्रोत — Act / circular का link या नंबर (ज़रूरी)</Label><Input id="t-src" value={tSource} onChange={(e) => setTSource(e.target.value)} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="t-note">नोट</Label><Input id="t-note" value={tNote} onChange={(e) => setTNote(e.target.value)} placeholder="जैसे: CA श्री … की सलाह, दिनांक …" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>रद्द</Button>
            <Button onClick={() => void addRule()} disabled={saving}>{saving ? 'सेव हो रहा है…' : 'TDS नियम सेव करें'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* payment details dialog */}
      <Dialog open={!!detailsFor} onOpenChange={(o) => { if (!o) setDetailsFor(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>भुगतान जानकारी — {detailsFor?.name}</DialogTitle>
            <DialogDescription>PAN न होने पर TDS ऊँची दर से कटेगा। यह जानकारी सिर्फ़ admin देख सकते हैं; partner को केवल "PAN दर्ज है/नहीं" दिखता है।</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ['pan', 'PAN', 'ABCDE1234F'], ['pan_name', 'PAN पर नाम', ''], ['account_name', 'खाताधारक का नाम', ''],
              ['account_no', 'खाता नंबर', ''], ['ifsc', 'IFSC', 'SBIN0001234'], ['upi_id', 'UPI ID', 'name@okaxis'], ['gstin', 'GSTIN (अगर है)', ''],
            ] as [keyof Details, string, string][]).map(([k, label, ph]) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={`d-${k}`}>{label}</Label>
                <Input id={`d-${k}`} value={details[k]} placeholder={ph} autoComplete="off"
                  onChange={(e) => setDetails((d) => ({ ...d, [k]: e.target.value }))} className={['pan', 'account_no', 'ifsc', 'gstin'].includes(k) ? 'font-mono' : ''} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsFor(null)}>रद्द</Button>
            <Button onClick={() => void saveDetails()} disabled={saving}>{saving ? 'सेव हो रहा है…' : 'सेव करें'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
