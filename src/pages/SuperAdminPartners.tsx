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
import { asDbArgs } from '@/lib/dbRow';
import { Link } from '@/components/LocalLink';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RefreshCw, Handshake, AlertTriangle, History, FileSpreadsheet, Mail, MessageCircle, AtSign } from 'lucide-react';
import { fmtDateTime } from '@/lib/dateUtils';
import { downloadCSV } from '@/lib/exportUtils';
import { referralErrorText, normalizeReferralCode, categoryLabel, partnerWelcomeWhatsAppUrl } from '@/lib/referral/referralCode';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminCommissionsPanel from '@/components/partners/AdminCommissionsPanel';
import AdminPayoutsPanel from '@/components/partners/AdminPayoutsPanel';
import AdminDetailRequests from '@/components/partners/AdminDetailRequests';

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

const STATUS_BADGE: Record<PartnerRow['status'], { label: string; labelEn: string; cls: string }> = {
  pending: { label: 'जाँच बाकी', labelEn: 'Pending review', cls: 'bg-amber-100 text-amber-900' },
  approved: { label: 'मंज़ूर', labelEn: 'Approved', cls: 'bg-green-100 text-green-900' },
  rejected: { label: 'अस्वीकार', labelEn: 'Rejected', cls: 'bg-red-100 text-red-900' },
  suspended: { label: 'रोका गया', labelEn: 'Suspended', cls: 'bg-muted text-foreground' },
};

const SOURCE_LABEL: Record<ReferralRow['source'], string> = { link: 'Link से', code: 'Code लिखा', admin: 'Admin ने जोड़ा' };
const SOURCE_LABEL_EN: Record<ReferralRow['source'], string> = { link: 'Via link', code: 'Code entered', admin: 'Added by admin' };

const DECIDE_ERRORS: Record<string, string> = {
  invalid_status: 'ग़लत स्थिति।',
  not_found: 'आवेदन नहीं मिला।',
  already_rejected: 'अस्वीकार हुआ आवेदन दोबारा मंज़ूर नहीं होता — व्यक्ति नया आवेदन करे।',
  has_societies: 'इस partner से समितियाँ जुड़ी हैं — अस्वीकार नहीं, "रोकें" चुनें।',
};
const DECIDE_ERRORS_EN: Record<string, string> = {
  invalid_status: 'Invalid status.',
  not_found: 'Application not found.',
  already_rejected: 'A rejected application cannot be approved again — the person must apply afresh.',
  has_societies: 'Societies are linked to this partner — choose "Suspend", not reject.',
};

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
const ACTION_LABEL_EN: Record<EventRow['action'], string> = { attach: 'Attached', change: 'Changed', remove: 'Removed' };

type DecideTarget = { partner: PartnerRow; status: 'approved' | 'rejected' | 'suspended' };
type SetTarget = { societyId: string; societyName: string; currentCode: string | null };

export default function SuperAdminPartners() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  const [tab, setTab] = useState<'partners' | 'societies' | 'commissions' | 'payouts'>('partners');
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ hi: string; en: string } | null>(null);
  const [filter, setFilter] = useState<'all' | PartnerRow['status']>('all');

  const [decide, setDecide] = useState<DecideTarget | null>(null);
  const [decideNote, setDecideNote] = useState('');
  const [setTarget, setSetTarget] = useState<SetTarget | null>(null);
  const [setCode, setSetCode] = useState('');
  const [setReason, setSetReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ societyName: string; rows: EventRow[] | 'error' | null } | null>(null);
  const [emailTarget, setEmailTarget] = useState<PartnerRow | null>(null);
  const [emailValue, setEmailValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, r] = await Promise.all([supabase.rpc('admin_partners_list'), supabase.rpc('admin_referrals_list')]);
      if (p.error || r.error) {
        const msg = (p.error ?? r.error)?.message ?? '';
        setError(/function .* does not exist|schema cache/i.test(msg)
          ? { hi: 'Migration 164 अभी नहीं चली — Supabase SQL Editor में 164_referral_partners.sql चलाएँ।', en: 'Migration 164 has not run yet — run 164_referral_partners.sql in the Supabase SQL Editor.' }
          : { hi: `लोड नहीं हुआ: ${msg}`, en: `Could not load: ${msg}` });
        return;
      }
      setPartners((p.data ?? []) as PartnerRow[]);
      setReferrals((r.data ?? []) as ReferralRow[]);
    } catch {
      setError({ hi: 'लोड नहीं हुआ — इंटरनेट जाँचें।', en: 'Could not load — check your internet.' });
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
      toast({ title: L('कॉपी हो गया ✓', 'Copied ✓') });
    } catch {
      toast({ title: L('कॉपी नहीं हुआ', 'Could not copy'), variant: 'destructive' });
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

  /** Partner portal welcome email (Edge Function partner-auth, action 'welcome'). Never throws; returns a toast. */
  const sendWelcome = async (p: { id: string; name: string }, quiet = false) => {
    try {
      const { data, error: err } = await supabase.functions.invoke('partner-auth', { body: { action: 'welcome', partner_id: p.id } });
      const res = (data ?? {}) as { ok?: boolean; sent?: boolean; reason?: string };
      if (err || !res.ok) {
        const why = res.reason === 'no_email' ? L('इस partner का ईमेल दर्ज नहीं — "ईमेल" बटन से जोड़ें।', 'No email on file for this partner — add one with the "Email" button.')
          : res.reason === 'email_not_configured' ? L('Email भेजने की सेटिंग (RESEND) नहीं मिली।', 'Email sending setting (RESEND) not found.')
          : res.reason === 'not_approved' ? L('Partner मंज़ूर नहीं है।', 'Partner is not approved.')
          : L('Email नहीं गया — partner-auth function deploy हुआ है, यह जाँचें। WhatsApp बटन से भेज सकते हैं।', 'Email not sent — check that the partner-auth function is deployed. You can send it with the WhatsApp button.');
        toast({ title: L('स्वागत email नहीं गया', 'Welcome email not sent'), description: why, variant: 'destructive', duration: 12000 });
        return;
      }
      if (!quiet) toast({ title: L(`स्वागत email भेज दिया ✓`, 'Welcome email sent ✓'), description: L(`${p.name} को code, referral link और portal का पता भेजा गया।`, `Code, referral link and portal address sent to ${p.name}.`) });
    } catch {
      toast({ title: L('स्वागत email नहीं गया', 'Welcome email not sent'), description: L('इंटरनेट जाँचें। WhatsApp बटन से भेज सकते हैं।', 'Check your internet. You can send it with the WhatsApp button.'), variant: 'destructive', duration: 12000 });
    }
  };

  const saveEmail = async () => {
    if (!emailTarget) return;
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_partner_set_email', { p_id: emailTarget.id, p_email: emailValue.trim() });
      const res = (data ?? {}) as { ok?: boolean; error_code?: string };
      if (err || !res.ok) {
        const why = res.error_code === 'duplicate_email' ? L('यह ईमेल किसी दूसरे partner का है।', 'This email belongs to another partner.') : res.error_code === 'invalid_email' ? L('ईमेल सही नहीं है।', 'The email is not valid.') : err?.message ?? L('दोबारा कोशिश करें।', 'Please try again.');
        toast({ title: L('ईमेल सेव नहीं हुआ', 'Email not saved'), description: why, variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: L('ईमेल सेव हो गया ✓', 'Email saved ✓'), description: L('Partner अब इसी ईमेल से portal पर login करेगा।', 'The partner will now log in to the portal with this email.') });
      setEmailTarget(null);
      await load();
    } catch {
      toast({ title: L('ईमेल सेव नहीं हुआ', 'Email not saved'), description: L('इंटरनेट जाँचें।', 'Check your internet.'), variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  const exportPartners = () => downloadCSV(
    ['Name', 'Phone', 'Email', 'Category', 'District', 'State', 'Status', 'Code', 'Societies', 'Applied', 'Decided', 'Decided by', 'Admin note', 'Declaration'],
    partners.map((p) => [p.name, p.phone, p.email ?? '', categoryLabel(p.category, language), p.district ?? '', p.state ?? '', p.status, p.code ?? '',
      p.societies_count, fmtDateTime(p.created_at), p.decided_at ? fmtDateTime(p.decided_at) : '', p.decided_by ?? '', p.admin_note ?? '', p.declaration_version]),
    'referral-partners',
  );

  const exportReferrals = () => downloadCSV(
    ['Society', 'Society ID', 'Partner', 'Code', 'How', 'Attributed', 'By', 'Paid'],
    referrals.map((r) => [r.society_name ?? '', r.society_id, r.partner_name, r.code, (language === 'hi' ? SOURCE_LABEL : SOURCE_LABEL_EN)[r.source], fmtDateTime(r.attributed_at), r.attributed_by, r.has_paid ? 'Yes' : 'No']),
    'referral-societies',
  );

  const submitDecide = async () => {
    if (!decide) return;
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_partner_decide', asDbArgs({ p_id: decide.partner.id, p_status: decide.status, p_note: decideNote.trim() || null }));
      const res = (data ?? {}) as { ok?: boolean; error_code?: string; code?: string | null };
      if (err || !res.ok) {
        toast({ title: L('बदलाव सेव नहीं हुआ', 'Change not saved'), description: (language === 'hi' ? DECIDE_ERRORS : DECIDE_ERRORS_EN)[res.error_code ?? ''] ?? err?.message ?? L('दोबारा कोशिश करें।', 'Please try again.'), variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: L('सेव हो गया ✓', 'Saved ✓'), description: res.code && decide.status === 'approved' ? `Code: ${res.code}` : undefined });
      const approved = decide.status === 'approved' ? decide.partner : null;
      setDecide(null);
      setDecideNote('');
      await load();
      // Approval → the partner gets their code, referral link and portal address by email at once.
      if (approved && approved.email) await sendWelcome(approved);
    } catch {
      toast({ title: L('बदलाव सेव नहीं हुआ', 'Change not saved'), description: L('इंटरनेट जाँचें।', 'Check your internet.'), variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  const submitSet = async () => {
    if (!setTarget) return;
    setSaving(true);
    try {
      const { data, error: err } = await supabase.rpc('admin_referral_set', asDbArgs({
        p_society_id: setTarget.societyId.trim(), p_code: normalizeReferralCode(setCode) || null, p_reason: setReason.trim(),
      }));
      const res = (data ?? {}) as { ok?: boolean; error_code?: string };
      if (err || !res.ok) {
        toast({ title: L('बदलाव सेव नहीं हुआ', 'Change not saved'), description: err?.message ?? referralErrorText(res.error_code, language), variant: 'destructive', duration: 10000 });
        return;
      }
      toast({ title: L('सेव हो गया ✓', 'Saved ✓') });
      setSetTarget(null);
      setSetCode('');
      setSetReason('');
      await load();
    } catch {
      toast({ title: L('बदलाव सेव नहीं हुआ', 'Change not saved'), description: L('इंटरनेट जाँचें।', 'Check your internet.'), variant: 'destructive', duration: 10000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/super-admin"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" /> {L('वापस', 'Back')}</Button></Link>
        <Handshake className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">{L('रेफ़रल पार्टनर', 'Referral Partners')}</h1>
        {pendingCount > 0 && <Badge className="bg-amber-100 text-amber-900">{pendingCount} {L('आवेदन जाँच बाकी', 'applications pending review')}</Badge>}
        <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {L('रिफ़्रेश', 'Refresh')}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 flex items-start gap-2 text-destructive"><AlertTriangle className="h-4 w-4 mt-0.5" /> {L(error.hi, error.en)}</CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant={tab === 'partners' ? 'default' : 'outline'} size="sm" onClick={() => setTab('partners')}>{L('पार्टनर', 'Partners')} ({partners.length})</Button>
        <Button variant={tab === 'societies' ? 'default' : 'outline'} size="sm" onClick={() => setTab('societies')}>{L('समितियाँ', 'Societies')} ({referrals.length})</Button>
        <Button variant={tab === 'commissions' ? 'default' : 'outline'} size="sm" onClick={() => setTab('commissions')}>{L('कमीशन', 'Commission')}</Button>
        <Button variant={tab === 'payouts' ? 'default' : 'outline'} size="sm" onClick={() => setTab('payouts')}>{L('भुगतान / TDS', 'Payouts / TDS')}</Button>
      </div>

      {tab === 'partners' && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{L('आवेदन और partners', 'Applications and partners')}</CardTitle>
              <Button size="sm" variant="ghost" className="gap-1" onClick={exportPartners} disabled={partners.length === 0}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
              </Button>
              <div className="ml-auto flex flex-wrap gap-1">
                {(['all', 'pending', 'approved', 'suspended', 'rejected'] as const).map((f) => (
                  <Button key={f} size="sm" variant={filter === f ? 'secondary' : 'ghost'} onClick={() => setFilter(f)}>
                    {f === 'all' ? L('सभी', 'All') : L(STATUS_BADGE[f].label, STATUS_BADGE[f].labelEn)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{loading ? L('लोड हो रहा है…', 'Loading…') : L('कोई आवेदन नहीं।', 'No applications.')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{L('नाम / संपर्क', 'Name / contact')}</TableHead>
                    <TableHead>{L('काम / जगह', 'Work / place')}</TableHead>
                    <TableHead>{L('स्थिति', 'Status')}</TableHead>
                    <TableHead>{L('कोड', 'Code')}</TableHead>
                    <TableHead className="text-right">{L('समितियाँ', 'Societies')}</TableHead>
                    <TableHead>{L('कार्य', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="align-top">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.phone}{p.email ? ` · ${p.email}` : ''}</div>
                        <div className="text-xs text-muted-foreground">{L('आवेदन', 'Applied')}: {fmtDateTime(p.created_at)} · {L('घोषणा', 'Declaration')} {p.declaration_version}</div>
                        {p.note && <div className="text-xs mt-1 max-w-xs whitespace-pre-wrap">“{p.note}”</div>}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {categoryLabel(p.category, language)}
                        <div className="text-xs text-muted-foreground">{[p.district, p.state].filter(Boolean).join(', ') || '—'}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge className={STATUS_BADGE[p.status].cls}>{L(STATUS_BADGE[p.status].label, STATUS_BADGE[p.status].labelEn)}</Badge>
                        {p.admin_note && <div className="text-xs text-muted-foreground mt-1 max-w-[12rem]">{p.admin_note}</div>}
                      </TableCell>
                      <TableCell className="align-top font-mono text-sm">{p.code ?? '—'}</TableCell>
                      <TableCell className="align-top text-right">{p.societies_count}</TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                          {p.status !== 'approved' && p.status !== 'rejected' && (
                            <Button size="sm" onClick={() => { setDecide({ partner: p, status: 'approved' }); setDecideNote(''); }}>{L('मंज़ूर करें', 'Approve')}</Button>
                          )}
                          {p.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => { setDecide({ partner: p, status: 'rejected' }); setDecideNote(''); }}>{L('अस्वीकार', 'Reject')}</Button>
                          )}
                          {p.status === 'approved' && (
                            <Button size="sm" variant="outline" onClick={() => { setDecide({ partner: p, status: 'suspended' }); setDecideNote(''); }}>{L('रोकें', 'Suspend')}</Button>
                          )}
                          {p.status === 'approved' && p.code && p.email && (
                            <Button size="sm" variant="ghost" className="gap-1" title={L('Code, referral link और portal का पता ईमेल पर दोबारा भेजें', 'Re-send the code, referral link and portal address by email')}
                              onClick={() => void sendWelcome(p)}>
                              <Mail className="h-3.5 w-3.5" /> {L('स्वागत email', 'Welcome email')}
                            </Button>
                          )}
                          {p.status === 'approved' && p.code && (
                            <a href={partnerWelcomeWhatsAppUrl(p.phone, p.name, p.code)} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="gap-1" title={L('तैयार संदेश के साथ partner का WhatsApp खोलें', "Open the partner's WhatsApp with a ready message")}>
                                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                              </Button>
                            </a>
                          )}
                          <Button size="sm" variant="ghost" className="gap-1" title={L('Portal login का ईमेल जोड़ें / बदलें', 'Add / change the portal login email')}
                            onClick={() => { setEmailTarget(p); setEmailValue(p.email ?? ''); }}>
                            <AtSign className="h-3.5 w-3.5" /> {L('ईमेल', 'Email')}
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
              <CardTitle className="text-base">{L('किस समिति को कौन लाया', 'Who brought which society')}</CardTitle>
              <Button size="sm" variant="ghost" className="gap-1" onClick={exportReferrals} disabled={referrals.length === 0}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button size="sm" variant="outline" className="ml-auto"
                onClick={() => { setSetTarget({ societyId: '', societyName: '', currentCode: null }); setSetCode(''); setSetReason(''); }}>
                {L('समिति पर partner जोड़ें', 'Attach a partner to a society')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{loading ? L('लोड हो रहा है…', 'Loading…') : L('अभी कोई समिति किसी partner से नहीं जुड़ी।', 'No society is linked to a partner yet.')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{L('समिति', 'Society')}</TableHead>
                    <TableHead>{L('पार्टनर', 'Partner')}</TableHead>
                    <TableHead>{L('कैसे जुड़ी', 'How linked')}</TableHead>
                    <TableHead>{L('भुगतान', 'Payment')}</TableHead>
                    <TableHead>{L('कार्य', 'Actions')}</TableHead>
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
                        {L(SOURCE_LABEL[r.source], SOURCE_LABEL_EN[r.source])}
                        <div className="text-xs text-muted-foreground">{fmtDateTime(r.attributed_at)}{r.source === 'admin' ? ` · ${r.attributed_by}` : ''}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        {r.has_paid ? <Badge className="bg-green-100 text-green-900">{L('भुगतान हुआ · locked', 'Paid · locked')}</Badge> : <Badge variant="outline">{L('अभी नहीं', 'Not yet')}</Badge>}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => void openHistory(r)}>
                          <History className="h-3.5 w-3.5" /> {L('इतिहास', 'History')}
                        </Button>
                        {!r.has_paid && (
                          <Button size="sm" variant="outline"
                            onClick={() => { setSetTarget({ societyId: r.society_id, societyName: r.society_name ?? r.society_id, currentCode: r.code }); setSetCode(r.code); setSetReason(''); }}>
                            {L('बदलें / हटाएँ', 'Change / remove')}
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
      {tab === 'payouts' && (<><AdminDetailRequests /><AdminPayoutsPanel /></>)}

      {/* approve / reject / suspend */}
      <Dialog open={!!decide} onOpenChange={(o) => { if (!o) setDecide(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decide?.status === 'approved' ? L('Partner मंज़ूर करें', 'Approve partner') : decide?.status === 'rejected' ? L('आवेदन अस्वीकार करें', 'Reject application') : L('Partner रोकें', 'Suspend partner')}
            </DialogTitle>
            <DialogDescription>
              {decide?.partner.name} · {decide?.partner.phone}
              {decide?.status === 'approved' && L(' — मंज़ूरी पर code अपने-आप बनेगा। पहले जाँच लें कि व्यक्ति सरकारी कर्मचारी या उनका प्रतिनिधि नहीं है।', ' — the code is created automatically on approval. First check that the person is not a government employee or their representative.')}
              {decide?.status === 'suspended' && L(' — रोकने पर उनका code नई समितियों पर काम नहीं करेगा। पहले से जुड़ी समितियाँ उन्हीं के नाम रहेंगी।', ' — once suspended, their code will not work for new societies. Societies already linked stay in their name.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decide-note">{L('नोट (वैकल्पिक, सिर्फ़ admin को दिखेगा)', 'Note (optional, visible to admin only)')}</Label>
            <Input id="decide-note" value={decideNote} onChange={(e) => setDecideNote(e.target.value)} maxLength={300} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecide(null)}>{L('रद्द', 'Cancel')}</Button>
            <Button onClick={() => void submitDecide()} disabled={saving} variant={decide?.status === 'approved' ? 'default' : 'destructive'}>
              {saving ? L('सेव हो रहा है…', 'Saving…') : L('पक्का करें', 'Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* attribution history of one society */}
      <Dialog open={!!history} onOpenChange={(o) => { if (!o) setHistory(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{L('इतिहास', 'History')} — {history?.societyName}</DialogTitle>
            <DialogDescription>{L('इस समिति पर partner कब, किसने, किस कारण जोड़ा या बदला।', 'When, by whom and why a partner was attached to or changed on this society.')}</DialogDescription>
          </DialogHeader>
          {history?.rows === null && <p className="text-sm text-muted-foreground">{L('लोड हो रहा है…', 'Loading…')}</p>}
          {history?.rows === 'error' && <p className="text-sm text-destructive">{L('इतिहास लोड नहीं हुआ। Migration 165 चली है, यह जाँचें।', 'History could not be loaded. Check that migration 165 has run.')}</p>}
          {history && Array.isArray(history.rows) && (
            history.rows.length === 0
              ? <p className="text-sm text-muted-foreground">{L('कोई इतिहास नहीं।', 'No history.')}</p>
              : (
                <ol className="space-y-2 text-sm max-h-[60vh] overflow-y-auto">
                  {history.rows.map((e) => (
                    <li key={e.id} className="rounded border p-2">
                      <div className="font-medium">
                        {L(ACTION_LABEL[e.action], ACTION_LABEL_EN[e.action])}:{e.old_partner_name ? `${e.old_partner_name} (${e.old_code ?? '—'})` : '—'} → {e.new_partner_name ? `${e.new_partner_name} (${e.new_code ?? '—'})` : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDateTime(e.created_at)} · {e.actor}{e.source ? ` · ${e.source}` : ''}
                      </div>
                      {e.reason && <div className="text-xs mt-1">{L('कारण', 'Reason')}: {e.reason}</div>}
                    </li>
                  ))}
                </ol>
              )
          )}
        </DialogContent>
      </Dialog>

      {/* portal login email */}
      <Dialog open={!!emailTarget} onOpenChange={(o) => { if (!o) setEmailTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{L('Portal login ईमेल', 'Portal login email')} — {emailTarget?.name}</DialogTitle>
            <DialogDescription>
              {L('Partner इसी ईमेल पर आए कोड से portal पर login करेगा। ईमेल बदलने पर उसके सारे खुले login बंद हो जाएँगे।', 'The partner logs in to the portal with a code sent to this email. Changing the email signs out all their open sessions.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="partner-email">{L('ईमेल', 'Email')}</Label>
            <Input id="partner-email" type="email" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailTarget(null)}>{L('रद्द', 'Cancel')}</Button>
            <Button onClick={() => void saveEmail()} disabled={saving || !emailValue.trim()}>{saving ? L('सेव हो रहा है…', 'Saving…') : L('सेव करें', 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* attach / change / remove a society's partner */}
      <Dialog open={!!setTarget} onOpenChange={(o) => { if (!o) setSetTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{setTarget?.currentCode ? L('Partner बदलें या हटाएँ', 'Change or remove partner') : L('समिति पर partner जोड़ें', 'Attach a partner to a society')}</DialogTitle>
            <DialogDescription>
              {L('हर बदलाव कारण और आपके नाम के साथ दर्ज होता है। समिति का भुगतान हो जाने के बाद partner नहीं बदलता।', 'Every change is recorded with the reason and your name. Once the society has paid, the partner cannot be changed.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="set-society">{L('समिति ID', 'Society ID')}</Label>
              {setTarget?.currentCode
                ? <p className="text-sm"><strong>{setTarget.societyName}</strong> <span className="font-mono text-xs text-muted-foreground">{setTarget.societyId}</span></p>
                : <Input id="set-society" value={setTarget?.societyId ?? ''} placeholder={L('Super Admin Dashboard से समिति की ID', 'Society ID from the Super Admin Dashboard')}
                    onChange={(e) => setSetTarget((t) => (t ? { ...t, societyId: e.target.value } : t))} className="font-mono text-xs" />}
            </div>
            <div className="space-y-1">
              <Label htmlFor="set-code">{L('पार्टनर कोड', 'Partner code')} {setTarget?.currentCode && L('(ख़ाली छोड़ें = partner हटाएँ)', '(leave blank = remove partner)')}</Label>
              <Input id="set-code" value={setCode} onChange={(e) => setSetCode(e.target.value.toUpperCase())} placeholder="SL-ABC234" className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="set-reason">{L('कारण (ज़रूरी)', 'Reason (required)')}</Label>
              <Input id="set-reason" value={setReason} onChange={(e) => setSetReason(e.target.value)} maxLength={300}
                placeholder={L('जैसे: समिति ने बताया कि उन्हें रमेश जी लाए थे', 'e.g. The society said Ramesh ji brought them')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetTarget(null)}>{L('रद्द', 'Cancel')}</Button>
            <Button onClick={() => void submitSet()} disabled={saving || setReason.trim().length < 5 || !setTarget?.societyId.trim()}>
              {saving ? L('सेव हो रहा है…', 'Saving…') : L('सेव करें', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
