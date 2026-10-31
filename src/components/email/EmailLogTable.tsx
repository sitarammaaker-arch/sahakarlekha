import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDateTime } from '@/lib/dateUtils';

/** One row of society_email_log / admin_email_log (migration 144). Never carries the payload. */
export interface EmailLogRow {
  created_at: string;
  template_key: string;
  recipient: string;
  status: string;
  attempts: number;
  sent_at: string | null;
  delivery_status: string | null;
  last_error: string | null;
  society_id?: string | null;
  society_name?: string | null;
}

export const TEMPLATE_HI: Record<string, string> = {
  email_verify: 'ईमेल verify',
  user_invite: 'नया यूज़र (स्वागत)',
  role_changed: 'भूमिका बदली',
  fy_unlock_requested: 'FY अनलॉक अनुरोध',
  fy_unlocked: 'FY अनलॉक हुआ',
  compliance_due: 'Compliance रिमाइंडर',
  weekly_digest: 'हफ़्ते की रिपोर्ट',
};

/** status + delivery_status → one Hindi label and a badge tone. Delivery (what happened after Resend) wins. */
export function emailStateHi(r: Pick<EmailLogRow, 'status' | 'delivery_status'>): { label: string; tone: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (r.delivery_status === 'bounced') return { label: 'बाउंस (पता ग़लत)', tone: 'destructive' };
  if (r.delivery_status === 'complained') return { label: 'spam शिकायत', tone: 'destructive' };
  if (r.delivery_status === 'delivered') return { label: 'पहुँच गया', tone: 'default' };
  if (r.delivery_status === 'delayed') return { label: 'देरी हो रही है', tone: 'outline' };
  switch (r.status) {
    case 'sent': return { label: 'भेजा गया', tone: 'default' };
    case 'pending': return { label: 'भेजना बाकी', tone: 'secondary' };
    case 'sending': return { label: 'भेजा जा रहा है', tone: 'secondary' };
    case 'skipped': return { label: 'नहीं भेजा — ईमेल verify नहीं', tone: 'outline' };
    case 'suppressed': return { label: 'नहीं भेजा — पता ब्लॉक (bounce/शिकायत)', tone: 'destructive' };
    case 'failed': return { label: 'फेल', tone: 'destructive' };
    default: return { label: r.status, tone: 'outline' };
  }
}

export function EmailLogTable({ rows, showSociety = false }: { rows: EmailLogRow[]; showSociety?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>समय</TableHead>
            {showSociety && <TableHead>समिति</TableHead>}
            <TableHead>प्रकार</TableHead>
            <TableHead>किसे</TableHead>
            <TableHead>स्थिति</TableHead>
            <TableHead>विवरण</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const st = emailStateHi(r);
            return (
              <TableRow key={`${r.created_at}-${r.recipient}-${i}`}>
                <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(r.created_at)}</TableCell>
                {showSociety && <TableCell className="text-xs">{r.society_name || r.society_id || '—'}</TableCell>}
                <TableCell className="text-xs">{TEMPLATE_HI[r.template_key] ?? r.template_key}</TableCell>
                <TableCell className="text-xs break-all">{r.recipient}</TableCell>
                <TableCell><Badge variant={st.tone} className="text-[10px] whitespace-nowrap">{st.label}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate" title={r.last_error ?? ''}>
                  {r.attempts > 1 ? `${r.attempts} कोशिश · ` : ''}{r.last_error ?? ''}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
