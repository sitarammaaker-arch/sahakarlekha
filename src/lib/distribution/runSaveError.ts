/**
 * MEM-05 (product audit 2026-11-17): how did saving a dividend run fail? PURE.
 *
 * The page posted the dividend "the old way" whenever the error text mentioned the table name — and a unique-index
 * violation ('duplicate key value violates unique constraint "member_distribution_runs_…"') mentions it too. So when a
 * run for the year already existed (another tab, another user, a double click) a SECOND dividend journal was posted.
 *   'duplicate'     → a run for this year already exists: post NOTHING; refresh.
 *   'table-missing' → migration 066 not run (undefined table / not in the schema cache): the old path is allowed.
 *   'other'         → post nothing; retry.
 */
import { isMissingTableError } from '@/lib/export/missingTable';

export type RunSaveFailure = 'duplicate' | 'table-missing' | 'other';

export function classifyRunSaveError(err: { error?: string; code?: string }, table = 'member_distribution_runs'): RunSaveFailure {
  const msg = err.error || '';
  if (err.code === '23505' || /duplicate key|unique constraint|already exists/i.test(msg)) return 'duplicate';
  if (err.code === '42P01' || err.code === 'PGRST205' || isMissingTableError(msg, table)) return 'table-missing';
  return 'other';
}
