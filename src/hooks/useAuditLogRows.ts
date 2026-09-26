/**
 * Reads the society's append-only audit_log for a date window (Detailed Audit Trail).
 * Paged in 1000-row pages (PostgREST's per-request cap silently truncates otherwise) up to a
 * hard ceiling; `truncated` says when the ceiling was hit, so the page never passes off a partial
 * trail as complete. RLS scopes the read to the caller's society.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { AuditLogRow } from '@/lib/auditTrail';

const PAGE = 1000;
const CEILING = 20000;

export function useAuditLogRows(from: string, to: string) {
  const { user } = useAuth();
  const societyId = user?.societyId;
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!societyId) { setRows([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const all: AuditLogRow[] = [];
      let hitCeiling = false;
      for (let off = 0; ; off += PAGE) {
        const { data, error: qErr } = await supabase
          .from('audit_log')
          .select('created_at, actor_name, actor_email, actor_role, entity_type, entity_id, action, before, after, reason, source')
          .eq('society_id', societyId)
          .gte('created_at', `${from}T00:00:00`)
          .lte('created_at', `${to}T23:59:59.999`)
          .order('created_at', { ascending: false })
          .range(off, off + PAGE - 1);
        if (cancelled) return;
        if (qErr) { setError(qErr.message); setRows(all); setLoading(false); return; }
        all.push(...((data ?? []) as AuditLogRow[]));
        if (!data || data.length < PAGE) break;
        if (all.length >= CEILING) { hitCeiling = true; break; }
      }
      setError(null);
      setRows(all);
      setTruncated(hitCeiling);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [societyId, from, to]);

  return { rows, loading, error, truncated };
}
