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

/** English names for the same templates (society admins may use the app in English). */
export const TEMPLATE_EN: Record<string, string> = {
  email_verify: 'Email verify',
  user_invite: 'New user (welcome)',
  role_changed: 'Role changed',
  fy_unlock_requested: 'FY unlock request',
  fy_unlocked: 'FY unlocked',
  compliance_due: 'Compliance reminder',
  weekly_digest: 'Weekly report',
};

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
export function emailStateHi(r: Pick<EmailLogRow, 'status' | 'delivery_status'>, hi = true): { label: string; tone: 'default' | 'secondary' | 'destructive' | 'outline' } {
  const L = (h: string, e: string) => (hi ? h : e);
  if (r.delivery_status === 'bounced') return { label: L('बाउंस (पता ग़लत)', 'Bounced (bad address)'), tone: 'destructive' };
  if (r.delivery_status === 'complained') return { label: L('spam शिकायत', 'Spam complaint'), tone: 'destructive' };
  if (r.delivery_status === 'delivered') return { label: L('पहुँच गया', 'Delivered'), tone: 'default' };
  if (r.delivery_status === 'delayed') return { label: L('देरी हो रही है', 'Delayed'), tone: 'outline' };
  switch (r.status) {
    case 'sent': return { label: L('भेजा गया', 'Sent'), tone: 'default' };
    case 'pending': return { label: L('भेजना बाकी', 'Waiting to send'), tone: 'secondary' };
    case 'sending': return { label: L('भेजा जा रहा है', 'Sending'), tone: 'secondary' };
    case 'skipped': return { label: L('नहीं भेजा — ईमेल verify नहीं', 'Not sent — email not verified'), tone: 'outline' };
    case 'suppressed': return { label: L('नहीं भेजा — पता ब्लॉक (bounce/शिकायत)', 'Not sent — address blocked (bounce/complaint)'), tone: 'destructive' };
    case 'failed': return { label: L('फेल', 'Failed'), tone: 'destructive' };
    default: return { label: r.status, tone: 'outline' };
  }
}

export function EmailLogTable({ rows, showSociety = false, hi = true }: { rows: EmailLogRow[]; showSociety?: boolean; hi?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{hi ? 'समय' : 'Time'}</TableHead>
            {showSociety && <TableHead>{hi ? 'समिति' : 'Society'}</TableHead>}
            <TableHead>{hi ? 'प्रकार' : 'Type'}</TableHead>
            <TableHead>{hi ? 'किसे' : 'To'}</TableHead>
            <TableHead>{hi ? 'स्थिति' : 'Status'}</TableHead>
            <TableHead>{hi ? 'विवरण' : 'Details'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const st = emailStateHi(r, hi);
            return (
              <TableRow key={`${r.created_at}-${r.recipient}-${i}`}>
                <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(r.created_at)}</TableCell>
                {showSociety && <TableCell className="text-xs">{r.society_name || r.society_id || '—'}</TableCell>}
                <TableCell className="text-xs">{(hi ? TEMPLATE_HI : TEMPLATE_EN)[r.template_key] ?? r.template_key}</TableCell>
                <TableCell className="text-xs break-all">{r.recipient}</TableCell>
                <TableCell><Badge variant={st.tone} className="text-[10px] whitespace-nowrap">{st.label}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate" title={r.last_error ?? ''}>
                  {r.attempts > 1 ? `${r.attempts} ${hi ? 'कोशिश' : 'attempts'} · ` : ''}{r.last_error ?? ''}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
