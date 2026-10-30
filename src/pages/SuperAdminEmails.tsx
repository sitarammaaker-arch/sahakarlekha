/**
 * SuperAdminEmails — the notification outbox across every society (email slices 1–3, migrations 142–144).
 *
 *   • Counts by state for the loaded rows, then the log itself (admin_email_log — no payload, so no tokens).
 *   • The suppression list (bounces / spam complaints from the resend-webhook, or manual) with "हटाएँ" to lift
 *     an entry once the address has been corrected.
 * Every read/write is a SECURITY DEFINER RPC gated on is_platform_admin(). Nothing here sends an email.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Mail, RefreshCw, AlertTriangle, Ban } from 'lucide-react';
import { EmailLogTable, emailStateHi, type EmailLogRow } from '@/components/email/EmailLogTable';
import { fmtDateTime } from '@/lib/dateUtils';

interface SuppressionRow { email: string; reason: string; detail: string | null; created_at: string }

const REASON_HI: Record<string, string> = { bounce: 'बाउंस', complaint: 'spam शिकायत', manual: 'हाथ से' };

export default function SuperAdminEmails() {
  const { toast } = useToast();
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [supp, setSupp] = useState<SuppressionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [log, sup] = await Promise.all([
      supabase.rpc('admin_email_log', { p_limit: 300 }),
      supabase.rpc('admin_email_suppression'),
    ]);
    setLoading(false);
    const e = log.error || sup.error;
    if (e) { setError(e.message); return; }
    setError('');
    setRows((log.data as EmailLogRow[] | null) ?? []);
    setSupp((sup.data as SuppressionRow[] | null) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const unsuppress = async (email: string) => {
    if (!window.confirm(`${email} को ब्लॉक सूची से हटाएँ? अगला ईमेल फिर इस पते पर जाएगा — पहले पक्का करें कि पता ठीक कर दिया गया है।`)) return;
    const { error: e } = await supabase.rpc('admin_unsuppress_email', { p_email: email });
    if (e) {
      toast({ title: 'हटाया नहीं जा सका', description: e.message, variant: 'destructive', duration: 10000 });
      return;
    }
    toast({ title: 'ब्लॉक सूची से हटाया', description: email });
    load();
  };

  // Counts by the same label the table shows.
  const counts = rows.reduce<Record<string, number>>((m, r) => {
    const k = emailStateHi(r).label;
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <Link to="/super-admin" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> डैशबोर्ड
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
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> लोड नहीं हुआ: {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {Object.entries(counts).map(([k, n]) => (
          <Badge key={k} variant="secondary" className="text-xs">{k}: {n}</Badge>
        ))}
        {rows.length === 0 && !error && <p className="text-sm text-muted-foreground">अभी कोई ईमेल कतार में नहीं आया।</p>}
      </div>

      <Card className={supp.length ? 'border-amber-300' : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="h-4 w-4" /> ब्लॉक सूची (suppression) <Badge variant={supp.length ? 'destructive' : 'secondary'}>{supp.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {supp.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">कोई पता ब्लॉक नहीं है।</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>पता</TableHead>
                    <TableHead>कारण</TableHead>
                    <TableHead>विवरण</TableHead>
                    <TableHead>कब</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supp.map((s) => (
                    <TableRow key={s.email}>
                      <TableCell className="text-xs break-all">{s.email}</TableCell>
                      <TableCell className="text-xs">{REASON_HI[s.reason] ?? s.reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate" title={s.detail ?? ''}>{s.detail}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(s.created_at)}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => unsuppress(s.email)}>हटाएँ</Button>
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
          <CardTitle className="text-base">ईमेल लॉग <span className="text-xs font-normal text-muted-foreground">(नए पहले, अधिकतम 300)</span></CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length > 0 && <EmailLogTable rows={rows} showSociety />}
        </CardContent>
      </Card>
    </div>
  );
}
