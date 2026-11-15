/**
 * SuperAdminEmails — the notification outbox across every society (email slices 1–3, migrations 142–144).
 *
 *   • Counts by state for the loaded rows, then the log itself (admin_email_log — no payload, so no tokens).
 *   • The suppression list (bounces / spam complaints from the resend-webhook, or manual) with "हटाएँ" to lift
 *     an entry once the address has been corrected.
 *   • Migration 148: a "सिस्टम की सेहत" card from admin_email_health() — the same reading the email-health
 *     alert email gives.
 * Every read/write is a SECURITY DEFINER RPC gated on is_platform_admin(). Nothing here sends an email.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/components/LocalLink';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mail, RefreshCw, AlertTriangle, Ban, HeartPulse } from 'lucide-react';
import { EmailLogTable, emailStateHi, type EmailLogRow } from '@/components/email/EmailLogTable';
import { fmtDateTime } from '@/lib/dateUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface SuppressionRow { email: string; reason: string; detail: string | null; created_at: string }

/** admin_email_health() (migration 148). Sections the DB could not read come back null. */
interface EmailHealth {
  level: 'ok' | 'warn' | 'alert';
  checked_at: string;
  stalled: number; stuck: number; failed_24h: number; bounced_24h: number; complained_24h: number;
  http_errors_6h: number | null; http_last_error: string | null;
  cron_failed_24h: number | null; missing_jobs: string[] | null;
  last_alert: { sent_at: string; resolved_at: string | null } | null;
}

const REASON_HI: Record<string, string> = { bounce: 'बाउंस', complaint: 'spam शिकायत', manual: 'हाथ से' };
const REASON_EN: Record<string, string> = { bounce: 'Bounce', complaint: 'Spam complaint', manual: 'Manual' };

/** One line per non-zero signal (Hindi or English) — the same reading the email-health alert email gives. */
function healthLines(h: EmailHealth, hi = true): string[] {
  const L = (a: string, b: string) => (hi ? a : b);
  const out: string[] = [];
  if (h.stalled > 0) out.push(L(`${h.stalled} ईमेल 15 मिनट से ज़्यादा से भेजे जाने के इंतज़ार में रुके हैं — send-worker नहीं चल रहा।`, `${h.stalled} emails have been waiting to send for over 15 minutes — the send-worker is not running.`));
  if (h.stuck > 0) out.push(L(`${h.stuck} ईमेल "भेजा जा रहा है" में अटके हैं।`, `${h.stuck} emails are stuck in "Sending".`));
  if ((h.http_errors_6h ?? 0) > 0) out.push(L(`पिछले 6 घंटे में cron की ${h.http_errors_6h} HTTP call fail हुई (आख़िरी: ${h.http_last_error ?? '-'})।`, `${h.http_errors_6h} cron HTTP calls failed in the last 6 hours (last: ${h.http_last_error ?? '-'}).`));
  if ((h.cron_failed_24h ?? 0) > 0) out.push(L(`पिछले 24 घंटे में ${h.cron_failed_24h} cron run fail हुए।`, `${h.cron_failed_24h} cron runs failed in the last 24 hours.`));
  if (h.missing_jobs?.length) out.push(L(`ये cron job बंद या ग़ायब हैं: ${h.missing_jobs.join(', ')}।`, `These cron jobs are off or missing: ${h.missing_jobs.join(', ')}.`));
  if (h.complained_24h > 0) out.push(L(`पिछले 24 घंटे में ${h.complained_24h} spam शिकायत।`, `${h.complained_24h} spam complaints in the last 24 hours.`));
  if (h.failed_24h > 0) out.push(L(`पिछले 24 घंटे में ${h.failed_24h} ईमेल fail हुए।`, `${h.failed_24h} emails failed in the last 24 hours.`));
  if (h.bounced_24h > 0) out.push(L(`पिछले 24 घंटे में ${h.bounced_24h} ईमेल bounce हुए।`, `${h.bounced_24h} emails bounced in the last 24 hours.`));
  return out;
}

export default function SuperAdminEmails() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const L = (h: string, e: string) => (hi ? h : e);
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [supp, setSupp] = useState<SuppressionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<EmailHealth | null>(null);
  const [healthError, setHealthError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [log, sup, hl] = await Promise.all([
      supabase.rpc('admin_email_log', { p_limit: 300 }),
      supabase.rpc('admin_email_suppression'),
      supabase.rpc('admin_email_health'),
    ]);
    setLoading(false);
    // Health is separate: before migration 148 it fails on its own without hiding the log.
    setHealth(hl.error ? null : (hl.data as EmailHealth | null));
    setHealthError(hl.error ? hl.error.message : '');
    const e = log.error || sup.error;
    if (e) { setError(e.message); return; }
    setError('');
    setRows((log.data as EmailLogRow[] | null) ?? []);
    setSupp((sup.data as SuppressionRow[] | null) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const unsuppress = async (email: string) => {
    if (!window.confirm(L(`${email} को ब्लॉक सूची से हटाएँ? अगला ईमेल फिर इस पते पर जाएगा — पहले पक्का करें कि पता ठीक कर दिया गया है।`, `Remove ${email} from the block list? The next email will go to this address again — first make sure the address has been corrected.`))) return;
    const { error: e } = await supabase.rpc('admin_unsuppress_email', { p_email: email });
    if (e) {
      toast({ title: L('हटाया नहीं जा सका', 'Could not remove'), description: e.message, variant: 'destructive', duration: 10000 });
      return;
    }
    toast({ title: L('ब्लॉक सूची से हटाया', 'Removed from the block list'), description: email });
    load();
  };

  // Counts by the same label the table shows.
  const counts = rows.reduce<Record<string, number>>((m, r) => {
    const k = emailStateHi(r, hi).label;
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <Link to="/super-admin" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> {L('डैशबोर्ड', 'Dashboard')}
      </Link>
      <div className="flex items-center gap-2 flex-wrap">
        <Mail className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Email Outbox</h1>
        <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive flex items-start gap-1.5">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {L('लोड नहीं हुआ', 'Could not load')}: {error}
        </p>
      )}

      <Card className={health?.level === 'alert' ? 'border-red-400' : health?.level === 'warn' ? 'border-amber-300' : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            {health?.level === 'ok' ? <HeartPulse className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
            {L('सिस्टम की सेहत', 'System health')}
            {health && (
              <Badge variant={health.level === 'alert' ? 'destructive' : health.level === 'warn' ? 'outline' : 'secondary'}>
                {health.level === 'alert' ? L('गड़बड़', 'Problem') : health.level === 'warn' ? L('ध्यान दें', 'Needs attention') : L('सब ठीक', 'All OK')}
              </Badge>
            )}
            {health && <span className="text-xs font-normal text-muted-foreground ml-auto">{L('जाँच', 'Checked')}: {fmtDateTime(health.checked_at)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {healthError ? (
            <p className="text-muted-foreground">{L('सेहत की जाँच अभी उपलब्ध नहीं (migration 148 चलाएँ)', 'Health check not available yet (run migration 148)')}: {healthError}</p>
          ) : !health ? (
            <p className="text-muted-foreground">{L('लोड हो रहा है…', 'Loading…')}</p>
          ) : healthLines(health, hi).length === 0 ? (
            <p className="text-green-700">{L('ईमेल भेजे जा रहे हैं, कोई cron fail नहीं, कोई ईमेल अटका नहीं।', 'Emails are going out, no cron failures, no email stuck.')}</p>
          ) : (
            <ul className="list-disc ml-5 space-y-0.5">
              {healthLines(health, hi).map((l) => <li key={l}>{l}</li>)}
            </ul>
          )}
          {health?.last_alert && (
            <p className="text-xs text-muted-foreground">
              {L('आख़िरी अलर्ट', 'Last alert')}: {fmtDateTime(health.last_alert.sent_at)}
              {health.last_alert.resolved_at ? ` · ${L('ठीक हुआ', 'Resolved')}: ${fmtDateTime(health.last_alert.resolved_at)}` : L(' · अभी खुला है', ' · still open')}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {Object.entries(counts).map(([k, n]) => (
          <Badge key={k} variant="secondary" className="text-xs">{k}: {n}</Badge>
        ))}
        {rows.length === 0 && !error && <p className="text-sm text-muted-foreground">{L('अभी तक कोई ईमेल नहीं बना।', 'No email created yet.')}</p>}
      </div>

      <Card className={supp.length ? 'border-amber-300' : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="h-4 w-4" /> {L('ब्लॉक सूची (suppression)', 'Block list (suppression)')} <Badge variant={supp.length ? 'destructive' : 'secondary'}>{supp.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {supp.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">{L('कोई पता ब्लॉक नहीं है।', 'No address is blocked.')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{L('पता', 'Address')}</TableHead>
                    <TableHead>{L('कारण', 'Reason')}</TableHead>
                    <TableHead>{L('विवरण', 'Details')}</TableHead>
                    <TableHead>{L('कब', 'When')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supp.map((s) => (
                    <TableRow key={s.email}>
                      <TableCell className="text-xs break-all">{s.email}</TableCell>
                      <TableCell className="text-xs">{(hi ? REASON_HI : REASON_EN)[s.reason] ?? s.reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate" title={s.detail ?? ''}>{s.detail}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(s.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => unsuppress(s.email)}>{L('हटाएँ', 'Remove')}</Button>
                      </TableCell>
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
          <CardTitle className="text-base">{L('ईमेल लॉग', 'Email log')} <span className="text-xs font-normal text-muted-foreground">{L('(नए पहले, अधिकतम 300)', '(newest first, up to 300)')}</span></CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length > 0 && <EmailLogTable rows={rows} showSociety hi={hi} />}
        </CardContent>
      </Card>
    </div>
  );
}
