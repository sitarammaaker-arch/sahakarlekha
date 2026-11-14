/**
 * AdminDetailRequests — PAN / bank / UPI / GSTIN changes that partners filed from the portal (migration 168).
 * Nothing a partner types is applied until the admin approves it here (admin_detail_request_decide), so a stolen portal
 * session cannot redirect a payout. Check the partner's PAN card and cancelled cheque / passbook before approving.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { IdCard } from 'lucide-react';
import { fmtDateTime } from '@/lib/dateUtils';
import { payoutErrorText } from '@/lib/referral/referralCode';

interface RequestRow {
  id: number; partner_id: string; partner_name: string; partner_code: string | null;
  pan: string | null; pan_name: string | null; account_name: string | null; account_no: string | null; ifsc: string | null;
  upi_id: string | null; gstin: string | null; created_at: string;
  current_pan: string | null; current_account_no: string | null; current_upi_id: string | null;
}

export default function AdminDetailRequests() {
  const { toast } = useToast();
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reject, setReject] = useState<RequestRow | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('admin_detail_requests_list');
      if (err) {
        setError(/function .* does not exist|schema cache/i.test(err.message)
          ? 'Migration 168 अभी नहीं चली — Supabase SQL Editor में 168_partner_portal_otp.sql चलाएँ।'
          : `लोड नहीं हुआ: ${err.message}`);
        return;
      }
      setRows((data ?? []) as RequestRow[]);
    } catch {
      setError('लोड नहीं हुआ — इंटरनेट जाँचें।');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (r: RequestRow, decision: 'approved' | 'rejected', reason?: string) => {
    setBusy(r.id);
    try {
      const { data, error: err } = await supabase.rpc('admin_detail_request_decide', { p_id: r.id, p_decision: decision, p_note: reason ?? null });
      const res = (data ?? {}) as { ok?: boolean; error_code?: string };
      if (err || !res.ok) {
        const why = res.error_code === 'reason_required' ? 'अस्वीकार करने का कारण लिखें।'
          : res.error_code === 'not_pending' ? 'यह माँग पहले ही निपट चुकी है।' : err?.message ?? payoutErrorText(res.error_code);
        toast({ title: 'सेव नहीं हुआ', description: why, variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: decision === 'approved' ? 'जानकारी लागू हो गई ✓' : 'माँग अस्वीकार की गई' });
      setReject(null);
      setNote('');
      await load();
    } catch {
      toast({ title: 'सेव नहीं हुआ', description: 'इंटरनेट जाँचें।', variant: 'destructive', duration: 10000 });
    } finally {
      setBusy(null);
    }
  };

  if (error) return <Card className="border-destructive/50"><CardContent className="p-4 text-destructive text-sm">{error}</CardContent></Card>;
  if (!rows || rows.length === 0) return null;

  const line = (label: string, next: string | null, current?: string | null) => next ? (
    <div className="text-sm"><span className="text-muted-foreground">{label}:</span> <span className="font-mono">{next}</span>
      {current !== undefined && current && current !== next && <span className="text-xs text-amber-700"> (अभी: <span className="font-mono">{current}</span>)</span>}
    </div>
  ) : null;

  return (
    <Card className="border-amber-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><IdCard className="h-4 w-4" /> PAN / बैंक बदलाव की माँग <Badge className="bg-amber-100 text-amber-900">{rows.length}</Badge></CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">मंज़ूर करने से पहले partner का PAN card और cancelled cheque / passbook देखकर नाम और नंबर मिलाएँ। ख़ाली छोड़े खाने पुरानी जानकारी ही रखेंगे।</p>
        {rows.map((r) => (
          <div key={r.id} className="rounded border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{r.partner_name}</strong><span className="text-xs font-mono text-muted-foreground">{r.partner_code ?? ''}</span>
              <span className="text-xs text-muted-foreground ml-auto">{fmtDateTime(r.created_at)}</span>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {line('PAN', r.pan, r.current_pan)}
              {line('PAN पर नाम', r.pan_name)}
              {line('खाताधारक', r.account_name)}
              {line('खाता नंबर', r.account_no, r.current_account_no)}
              {line('IFSC', r.ifsc)}
              {line('UPI', r.upi_id, r.current_upi_id)}
              {line('GSTIN', r.gstin)}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void decide(r, 'approved')} disabled={busy === r.id}>मंज़ूर करें</Button>
              <Button size="sm" variant="outline" onClick={() => { setReject(r); setNote(''); }} disabled={busy === r.id}>अस्वीकार</Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!reject} onOpenChange={(o) => { if (!o) setReject(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>माँग अस्वीकार करें — {reject?.partner_name}</DialogTitle>
            <DialogDescription>कारण partner को portal पर दिखेगा।</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="dr-note">कारण (ज़रूरी)</Label>
            <Input id="dr-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="जैसे: PAN पर नाम खाते के नाम से नहीं मिलता" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>वापस</Button>
            <Button variant="destructive" disabled={!reject || note.trim().length < 3 || busy === reject?.id} onClick={() => reject && void decide(reject, 'rejected', note.trim())}>अस्वीकार करें</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
