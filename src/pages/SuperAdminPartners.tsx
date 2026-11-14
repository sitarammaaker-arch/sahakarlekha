/**
 * SuperAdminPartners — referral partner program, slice 1 (migration 164).
 *
 *   • Partners tab: every application; approve (assigns the SL-XXXXXX code), reject, suspend, with a note.
 *   • Societies tab: which society came through which partner; attach / change / remove a partner with a written
 *     reason. Once a society has paid, the server refuses a change (locked_after_payment).
 * Reads and writes go through admin_partners_list / admin_partner_decide / admin_referrals_list /
 * admin_referral_set — SECURITY DEFINER, gated on is_platform_admin(). Nothing here touches a table directly, and
 * no row changes on screen unless the server said ok (the list is re-read after every write — RULE 1).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RefreshCw, Handshake, Copy, AlertTriangle, History, FileSpreadsheet, KeyRound } from 'lucide-react';
import { fmtDateTime } from '@/lib/dateUtils';
import { downloadCSV } from '@/lib/exportUtils';
import { referralErrorText, normalizeReferralCode, PARTNER_CATEGORIES } from '@/lib/referral/referralCode';
import AdminCommissionsPanel from '@/components/partners/AdminCommissionsPanel';

interface PartnerRow {
  id: string;
  code: string | null;
  token: string;
  name: string;
  phone: string;
  email: string | null;
  category: string;
  district: string | null;
  state: string | null;
  note: string | null;
  declaration_version: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  admin_note: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  societies_count: number;
}

interface ReferralRow {
  society_id: string;
  society_name: string | null;
  partner_id: string;
  partner_name: string;
  code: string;
  source: 'link' | 'code' | 'admin';
  attributed_at: string;
  attributed_by: string;
  has_paid: boolean;
}

const STATUS_BADGE: Record<PartnerRow['status'], { label: string; cls: string }> = {
  pending: { label: 'जाँच बाकी', cls: 'bg-amber-100 text-amber-900' },
  approved: { label: 'मंज़ूर', cls: 'bg-green-100 text-green-900' },
  rejected: { label: 'अस्वीकार', cls: 'bg-red-100 text-red-900' },
  suspended: { label: 'रोका गया', cls: 'bg-muted text-foreground' },
};

const SOURCE_LABEL: Record<ReferralRow['source'], string> = { link: 'Link से', code: 'Code लिखा', admin: 'Admin ने जोड़ा' };

const DECIDE_ERRORS: Record<string, string> = {
  invalid_status: 'ग़लत स्थिति।',
  not_found: 'आवेदन नहीं मिला।',
  already_rejected: 'अस्वीकार हुआ आवेदन दोबारा मंज़ूर नहीं होता — व्यक्ति नया आवेदन करे।',
  has_societies: 'इस partner से समितियाँ जुड़ी हैं — अस्वीकार नहीं, "रोकें" चुनें।',
};

const categoryLabel = (v: string) => PARTNER_CATEGORIES.find((c) => c.value === v)?.label ?? v;

interface EventRow {
  id: number;
  action: 'attach' | 'change' | 'remove';
  old_partner_name: string | null;
  old_code: string | null;
  new_partner_name: string | null;
  new_code: string | null;
  source: string | null;
  reason: string | null;
  actor: string;
  created_at: string;
}

const ACTION_LABEL: Record<EventRow['action'], string> = { attach: 'जोड़ा', change: 'बदला', remove: 'हटाया' };

type DecideTarget = { partner: PartnerRow; status: 'approved' | 'rejected' | 'suspended' };
type SetTarget = { societyId: string; societyName: string; currentCode: string | null };

export default function SuperAdminPartners() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'partners' | 'societies' | 'commissions'>('partners');
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | PartnerRow['status']>('all');

  const [decide, setDecide] = useState<DecideTarget | null>(null);
  const [decideNote, setDecideNote] = useState('');
  const [setTarget, setSetTarget] = useState<SetTarget | null>(null);
  const [setCode, setSetCode] = useState('');
  const [setReason, setSetReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ societyName: string; rows: EventRow[] | 'error' | null } | null>(null);
  const [rotateTarget, setRotateTarget] = useState<PartnerRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, r] = await Promise.all([supabase.rpc('admin_partners_list'), supabase.rpc('admin_referrals_list')]);
      if (p.error || r.error) {
        const msg = (p.error ?? r.error)?.message ?? '';
        setError(/function .* does not exist|schema cache/i.test(msg)
          ? 'Migration 164 अभी नहीं चली — Supabase SQL Editor में 164_referral_partners.sql चलाएँ।'
          : `लोड नहीं हुआ: ${msg}`);
        return;
      }
      setPartners((p.data ?? []) as PartnerRow[]);
      setReferrals((r.data ?? []) as ReferralRow[]);
    } catch {
      setError('लोड नहीं हुआ — इंटरनेट जाँचें।');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (filter === 'all' ? partners : partners.filter((p) => p.status === filter)), [partners, filter]);
  const pendingCount = partners.filter((p) => p.status === 'pending').length;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'कॉपी हो गया ✓' });
    } catch {
      toast({ title: 'कॉपी नहीं हुआ', variant: 'destructive' });
    }
  };

  const openHistory = async (r: ReferralRow) => {
    const societyName = r.society_name ?? r.society_id;
    setHistory({ societyName, rows: null });
    try {
      const { data, error: err } = await supabase.rpc('admin_referral_events', { p_society_id: r.society_id });
      setHistory({ societyName, rows: err ? 'error' : ((data ?? []) as EventRow[]) });
    } catch {
      setHistory({ societyName, rows: 'error' });
    }
  };

  const submitRotate = async () => {
    if (!rotateTarget) return;
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_partner_rotate_token', { p_id: rotateTarget.id });
      const res = (data ?? {}) as { ok?: boolean; token?: string; error_code?: string };
      if (err || !res.ok || !res.token) {
        toast({ title: 'नया link नहीं बना', description: err?.message ?? 'दोबारा कोशिश करें।', variant: 'destructive', duration: 10000 });
        return;
      }
      await copy(`${window.location.origin}/partner/status?t=${res.token}`);
      toast({ title: 'नया link बन गया और कॉपी हो गया ✓', description: 'पुराना link अब काम नहीं करेगा। नया link partner को WhatsApp करें।' });
      setRotateTarget(null);
      await load();
    } catch {
      toast({ title: 'नया link नहीं बना', description: 'इंटरनेट जाँचें।', variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  const exportPartners = () => downloadCSV(
    ['Name', 'Phone', 'Email', 'Category', 'District', 'State', 'Status', 'Code', 'Societies', 'Applied', 'Decided', 'Decided by', 'Admin note', 'Declaration'],
    partners.map((p) => [p.name, p.phone, p.email ?? '', categoryLabel(p.category), p.district ?? '', p.state ?? '', p.status, p.code ?? '',
      p.societies_count, fmtDateTime(p.created_at), p.decided_at ? fmtDateTime(p.decided_at) : '', p.decided_by ?? '', p.admin_note ?? '', p.declaration_version]),
    'referral-partners',
  );

  const exportReferrals = () => downloadCSV(
    ['Society', 'Society ID', 'Partner', 'Code', 'How', 'Attributed', 'By', 'Paid'],
    referrals.map((r) => [r.society_name ?? '', r.society_id, r.partner_name, r.code, SOURCE_LABEL[r.source], fmtDateTime(r.attributed_at), r.attributed_by, r.has_paid ? 'Yes' : 'No']),
    'referral-societies',
  );

  const submitDecide = async () => {
    if (!decide) return;
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_partner_decide', { p_id: decide.partner.id, p_status: decide.status, p_note: decideNote.trim() || null });
      const res = (data ?? {}) as { ok?: boolean; error_code?: string; code?: string | null };
      if (err || !res.ok) {
        toast({ title: 'बदलाव सेव नहीं हुआ', description: DECIDE_ERRORS[res.error_code ?? ''] ?? err?.message ?? 'दोबारा कोशिश करें।', variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: 'सेव हो गया ✓', description: res.code && decide.status === 'approved' ? `Code: ${res.code}` : undefined });
      setDecide(null);
      setDecideNote('');
      await load();
    } catch {
      toast({ title: 'बदलाव सेव नहीं हुआ', description: 'इंटरनेट जाँचें।', variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  const submitSet = async () => {
    if (!setTarget) return;
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_referral_set', {
        p_society_id: setTarget.societyId.trim(), p_code: normalizeReferralCode(setCode) || null, p_reason: setReason.trim(),
      });
      const res = (data ?? {}) as { ok?: boolean; error_code?: string };
      if (err || !res.ok) {
        toast({ title: 'बदलाव सेव नहीं हुआ', description: err?.message ?? referralErrorText(res.error_code), variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: 'सेव हो गया ✓' });
      setSetTarget(null);
      setSetCode('');
      setSetReason('');
      await load();
    } catch {
      toast({ title: 'बदलाव सेव नहीं हुआ', description: 'इंटरनेट जाँचें।', variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/super-admin"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> वापस</Button></Link>
        <Handshake className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Referral Partners</h1>
        {pendingCount > 0 && <Badge className="bg-amber-100 text-amber-900">{pendingCount} आवेदन जाँच बाकी</Badge>}
        <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 flex items-start gap-2 text-destructive"><AlertTriangle className="h-4 w-4 mt-0.5" /> {error}</CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant={tab === 'partners' ? 'default' : 'outline'} size="sm" onClick={() => setTab('partners')}>Partners ({partners.length})</Button>
        <Button variant={tab === 'societies' ? 'default' : 'outline'} size="sm" onClick={() => setTab('societies')}>समितियाँ ({referrals.length})</Button>
        <Button variant={tab === 'commissions' ? 'default' : 'outline'} size="sm" onClick={() => setTab('commissions')}>Commission</Button>
      </div>

      {tab === 'partners' && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">आवेदन और partners</CardTitle>
              <Button size="sm" variant="ghost" className="gap-1" onClick={exportPartners} disabled={partners.length === 0}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
              </Button>
              <div className="ml-auto flex flex-wrap gap-1">
                {(['all', 'pending', 'approved', 'suspended', 'rejected'] as const).map((f) => (
                  <Button key={f} size="sm" variant={filter === f ? 'secondary' : 'ghost'} onClick={() => setFilter(f)}>
                    {f === 'all' ? 'सभी' : STATUS_BADGE[f].label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{loading ? 'लोड हो रहा है…' : 'कोई आवेदन नहीं।'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>नाम / संपर्क</TableHead>
                    <TableHead>काम / जगह</TableHead>
                    <TableHead>स्थिति</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">समितियाँ</TableHead>
                    <TableHead>कार्य</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="align-top">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.phone}{p.email ? ` · ${p.email}` : ''}</div>
                        <div className="text-xs text-muted-foreground">आवेदन: {fmtDateTime(p.created_at)} · घोषणा {p.declaration_version}</div>
                        {p.note && <div className="text-xs mt-1 max-w-xs whitespace-pre-wrap">“{p.note}”</div>}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {categoryLabel(p.category)}
                        <div className="text-xs text-muted-foreground">{[p.district, p.state].filter(Boolean).join(', ') || '—'}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge className={STATUS_BADGE[p.status].cls}>{STATUS_BADGE[p.status].label}</Badge>
                        {p.admin_note && <div className="text-xs text-muted-foreground mt-1 max-w-[12rem]">{p.admin_note}</div>}
                      </TableCell>
                      <TableCell className="align-top font-mono text-sm">{p.code ?? '—'}</TableCell>
                      <TableCell className="align-top text-right">{p.societies_count}</TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                          {p.status !== 'approved' && p.status !== 'rejected' && (
                            <Button size="sm" onClick={() => { setDecide({ partner: p, status: 'approved' }); setDecideNote(''); }}>मंज़ूर करें</Button>
                          )}
                          {p.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => { setDecide({ partner: p, status: 'rejected' }); setDecideNote(''); }}>अस्वीकार</Button>
                          )}
                          {p.status === 'approved' && (
                            <Button size="sm" variant="outline" onClick={() => { setDecide({ partner: p, status: 'suspended' }); setDecideNote(''); }}>रोकें</Button>
                          )}
                          <Button size="sm" variant="ghost" className="gap-1" title="Partner का स्थिति-पेज link (WhatsApp पर भेजें)"
                            onClick={() => void copy(`${window.location.origin}/partner/status?t=${p.token}`)}>
                            <Copy className="h-3.5 w-3.5" /> स्थिति link
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1" title="पुराना link बंद करके नया link बनाएँ (link लीक होने पर)"
                            onClick={() => setRotateTarget(p)}>
                            <KeyRound className="h-3.5 w-3.5" /> नया link
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'societies' && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">किस समिति को कौन लाया</CardTitle>
              <Button size="sm" variant="ghost" className="gap-1" onClick={exportReferrals} disabled={referrals.length === 0}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button size="sm" variant="outline" className="ml-auto"
                onClick={() => { setSetTarget({ societyId: '', societyName: '', currentCode: null }); setSetCode(''); setSetReason(''); }}>
                समिति पर partner जोड़ें
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{loading ? 'लोड हो रहा है…' : 'अभी कोई समिति किसी partner से नहीं जुड़ी।'}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>समिति</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>कैसे जुड़ी</TableHead>
                    <TableHead>भुगतान</TableHead>
                    <TableHead>कार्य</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((r) => (
                    <TableRow key={r.society_id}>
                      <TableCell className="align-top">
                        <div className="font-medium">{r.society_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.society_id}</div>
                      </TableCell>
                      <TableCell className="align-top">{r.partner_name}<div className="text-xs font-mono text-muted-foreground">{r.code}</div></TableCell>
                      <TableCell className="align-top text-sm">
                        {SOURCE_LABEL[r.source]}
                        <div className="text-xs text-muted-foreground">{fmtDateTime(r.attributed_at)}{r.source === 'admin' ? ` · ${r.attributed_by}` : ''}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        {r.has_paid ? <Badge className="bg-green-100 text-green-900">भुगतान हुआ · locked</Badge> : <Badge variant="outline">अभी नहीं</Badge>}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => void openHistory(r)}>
                          <History className="h-3.5 w-3.5" /> इतिहास
                        </Button>
                        {!r.has_paid && (
                          <Button size="sm" variant="outline"
                            onClick={() => { setSetTarget({ societyId: r.society_id, societyName: r.society_name ?? r.society_id, currentCode: r.code }); setSetCode(r.code); setSetReason(''); }}>
                            बदलें / हटाएँ
                          </Button>
                        )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'commissions' && <AdminCommissionsPanel />}

      {/* approve / reject / suspend */}
      <Dialog open={!!decide} onOpenChange={(o) => { if (!o) setDecide(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decide?.status === 'approved' ? 'Partner मंज़ूर करें' : decide?.status === 'rejected' ? 'आवेदन अस्वीकार करें' : 'Partner रोकें'}
            </DialogTitle>
            <DialogDescription>
              {decide?.partner.name} · {decide?.partner.phone}
              {decide?.status === 'approved' && ' — मंज़ूरी पर code अपने-आप बनेगा। पहले जाँच लें कि व्यक्ति सरकारी कर्मचारी या उनका प्रतिनिधि नहीं है।'}
              {decide?.status === 'suspended' && ' — रोकने पर उनका code नई समितियों पर काम नहीं करेगा। पहले से जुड़ी समितियाँ उन्हीं के नाम रहेंगी।'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decide-note">नोट (वैकल्पिक, सिर्फ़ admin को दिखेगा)</Label>
            <Input id="decide-note" value={decideNote} onChange={(e) => setDecideNote(e.target.value)} maxLength={300} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecide(null)}>रद्द</Button>
            <Button onClick={() => void submitDecide()} disabled={saving} variant={decide?.status === 'approved' ? 'default' : 'destructive'}>
              {saving ? 'सेव हो रहा है…' : 'पक्का करें'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* attribution history of one society */}
      <Dialog open={!!history} onOpenChange={(o) => { if (!o) setHistory(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>इतिहास — {history?.societyName}</DialogTitle>
            <DialogDescription>इस समिति पर partner कब, किसने, किस कारण जोड़ा या बदला।</DialogDescription>
          </DialogHeader>
          {history?.rows === null && <p className="text-sm text-muted-foreground">लोड हो रहा है…</p>}
          {history?.rows === 'error' && <p className="text-sm text-destructive">इतिहास लोड नहीं हुआ। Migration 165 चली है, यह जाँचें।</p>}
          {history && Array.isArray(history.rows) && (
            history.rows.length === 0
              ? <p className="text-sm text-muted-foreground">कोई इतिहास नहीं।</p>
              : (
                <ol className="space-y-2 text-sm max-h-[60vh] overflow-y-auto">
                  {history.rows.map((e) => (
                    <li key={e.id} className="rounded border p-2">
                      <div className="font-medium">
                        {ACTION_LABEL[e.action]}: {e.old_partner_name ? `${e.old_partner_name} (${e.old_code ?? '—'})` : '—'} → {e.new_partner_name ? `${e.new_partner_name} (${e.new_code ?? '—'})` : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(e.created_at)} · {e.actor}{e.source ? ` · ${e.source}` : ''}
                      </div>
                      {e.reason && <div className="text-xs mt-1">कारण: {e.reason}</div>}
                    </li>
                  ))}
                </ol>
              )
          )}
        </DialogContent>
      </Dialog>

      {/* new status link */}
      <Dialog open={!!rotateTarget} onOpenChange={(o) => { if (!o) setRotateTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>नया स्थिति link बनाएँ</DialogTitle>
            <DialogDescription>
              {rotateTarget?.name} का पुराना link तुरंत बंद हो जाएगा। यह तभी करें जब link किसी और तक पहुँच गया हो। उनका referral code नहीं बदलेगा।
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateTarget(null)}>रद्द</Button>
            <Button onClick={() => void submitRotate()} disabled={saving}>{saving ? 'बन रहा है…' : 'नया link बनाएँ'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* attach / change / remove a society's partner */}
      <Dialog open={!!setTarget} onOpenChange={(o) => { if (!o) setSetTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{setTarget?.currentCode ? 'Partner बदलें या हटाएँ' : 'समिति पर partner जोड़ें'}</DialogTitle>
            <DialogDescription>
              हर बदलाव कारण और आपके नाम के साथ दर्ज होता है। समिति का भुगतान हो जाने के बाद partner नहीं बदलता।
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="set-society">समिति ID</Label>
              {setTarget?.currentCode
                ? <p className="text-sm"><strong>{setTarget.societyName}</strong> <span className="font-mono text-xs text-muted-foreground">{setTarget.societyId}</span></p>
                : <Input id="set-society" value={setTarget?.societyId ?? ''} placeholder="Super Admin Dashboard से समिति की ID"
                    onChange={(e) => setSetTarget((t) => (t ? { ...t, societyId: e.target.value } : t))} className="font-mono text-xs" />}
            </div>
            <div className="space-y-1">
              <Label htmlFor="set-code">Partner code {setTarget?.currentCode && '(ख़ाली छोड़ें = partner हटाएँ)'}</Label>
              <Input id="set-code" value={setCode} onChange={(e) => setSetCode(e.target.value.toUpperCase())} placeholder="SL-ABC234" className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="set-reason">कारण (ज़रूरी)</Label>
              <Input id="set-reason" value={setReason} onChange={(e) => setSetReason(e.target.value)} maxLength={300}
                placeholder="जैसे: समिति ने बताया कि उन्हें रमेश जी लाए थे" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetTarget(null)}>रद्द</Button>
            <Button onClick={() => void submitSet()} disabled={saving || setReason.trim().length < 5 || !setTarget?.societyId.trim()}>
              {saving ? 'सेव हो रहा है…' : 'सेव करें'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
