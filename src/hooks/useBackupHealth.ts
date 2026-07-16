/**
 * useBackupHealth (T-35) — is this society's latest backup PROVEN restorable, right now?
 *
 * This is the read half of the persisted rehearsal. A rehearsal (Restore Center) writes an
 * append-only `rehearse` evidence row to `audit_log`; this hook reads the LATEST one and
 * projects it into a health verdict through the SAME pure gate the rehearsal used
 * (healthFromRehearsalRows → backupHealth). Because the evidence is persisted, the verdict
 * survives reloads — which is precisely what lets the UI stop saying "export" and honestly
 * say "backup".
 *
 * READ-ONLY. It reads one row and computes; it never writes. `proven` is true ONLY when a
 * fresh, passing rehearsal exists — the health gate cannot be talked into green by a missing
 * or stale rehearsal (see lib/backup/health.ts, "NEVER GREEN ON MISSING DATA").
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  healthFromRehearsalRows,
  placementFromBackupRows,
  type BackupAuditRow,
  type BackupHealth,
  type RehearsalAuditRow,
} from '@/lib/backup/health';

export interface UseBackupHealth {
  /** Null while loading; otherwise the projected verdict. */
  health: BackupHealth | null;
  /** True only when a fresh, passing rehearsal is on record. Gates the "export"→"backup" copy. */
  proven: boolean;
  loading: boolean;
  /** Non-null if the evidence could not be read — surfaced, never rendered as "unproven". */
  error: string | null;
  /** Re-read after a new rehearsal is recorded. */
  refresh: () => void;
}

export function useBackupHealth(): UseBackupHealth {
  const { user } = useAuth();
  const [rows, setRows] = useState<RehearsalAuditRow[] | null>(null);
  // T-36: the placement verdict the LATEST scheduled backup recorded for itself. Without this the
  // card could never report anything but "placement never evaluated" — the server grades the copies
  // (step B) and this is the wire that carries that verdict to the gate (step A).
  const [backupRows, setBackupRows] = useState<BackupAuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const societyId = user?.societyId;
    if (!societyId) return;
    let cancelled = false;
    void supabase
      .from('audit_log')
      .select('created_at, after')
      .eq('society_id', societyId)
      .eq('action', 'rehearse')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error: qErr }) => {
        if (cancelled) return;
        if (qErr) {
          setError(qErr.message);
          setRows([]); // a read error is not proof of "never rehearsed" — health stays amber, error surfaced
          return;
        }
        setError(null);
        setRows((data ?? []) as RehearsalAuditRow[]);
      });
    // The scheduled backup is the run that actually places the copies, so its row carries the
    // verdict. A read failure leaves the placement unknown ⇒ amber, never a green guess.
    void supabase
      .from('audit_log')
      .select('created_at, after')
      .eq('society_id', societyId)
      .eq('action', 'export')
      .eq('actor_name', 'scheduled-backup')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        setBackupRows((data ?? []) as BackupAuditRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.societyId, tick]);

  // `now` is read here (a side-effecting hook, not a pure module) and injected into the pure gate.
  const placement = backupRows === null ? null : placementFromBackupRows(backupRows);
  const health = rows === null ? null : healthFromRehearsalRows(rows, new Date().toISOString(), undefined, placement);

  return {
    health,
    proven: health?.proven ?? false,
    loading: rows === null,
    error,
    refresh,
  };
}
