import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, RefreshCw } from 'lucide-react';
import { EmailLogTable, type EmailLogRow } from './EmailLogTable';

/**
 * Email slice 3 — the society admin's own email log (society_email_log, migration 144). Shown on User
 * Management to admins only (the RPC refuses everyone else). Read-only.
 */
export default function SocietyEmailLog({ hi }: { hi: boolean }) {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase.rpc('society_email_log', { p_limit: 50 });
    setLoading(false);
    if (e) { setError(e.message); return; }
    setError('');
    setRows((data as EmailLogRow[] | null) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" /> {hi ? 'ईमेल लॉग' : 'Email log'}
          <Button variant="ghost" size="sm" className="ml-auto h-7 gap-1" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {hi
            ? 'समिति से भेजी गई सूचनाएँ। "ईमेल verify नहीं" वाले यूज़र को कहें: ऊपर यूज़र मेन्यू → ईमेल verify।'
            : 'Notifications sent for this society. Ask users whose address is not verified to use user menu → Email verification.'}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <p className="px-4 pb-4 text-sm text-destructive">{hi ? 'लॉग लोड नहीं हुआ: ' : 'Could not load the log: '}{error}</p>
        ) : rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">{hi ? 'अभी कोई ईमेल नहीं।' : 'No emails yet.'}</p>
        ) : (
          <EmailLogTable rows={rows} />
        )}
      </CardContent>
    </Card>
  );
}
