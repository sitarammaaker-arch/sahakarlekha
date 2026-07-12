/**
 * scheduled-rehearsal — server-side restore rehearsal (T-35, server half).
 *
 * A backup is only trustworthy if restoring it reproduces today's BOOKS. The browser proves
 * this when an operator opens Restore Center (client half); this function proves it
 * automatically, on a schedule, so the proof stays fresh with no human in the loop — the
 * remaining half of T-35 (decision D1).
 *
 * For each society it: finds the LATEST `.slbak` in the private `backups` bucket, downloads
 * it, and runs the SAME pure rehearsal the browser runs (../_shared/rehearsal-core.mjs — an
 * esbuild bundle of the real client proof, so the verdict is identical: RULE 2, one posting
 * rule). It then writes an append-only `rehearse` evidence row to the WORM `audit_log` that
 * `backupHealth` projects into a green/amber verdict across reloads.
 *
 * IT READS, IT NEVER WRITES SOCIETY DATA. The only write is the evidence row, and that
 * carries STATUS + COUNTS + TIMESTAMPS only — never a figure, an account/member id, or any
 * per-record detail (Canonical CL-6, ADR-0007). A failed evidence write is reported, never
 * a rolled-back anything: the rehearsal already ran read-only.
 *
 * Invoke:
 *   • Manual test:  POST { "societyId": "<id>" }   → rehearses one society.
 *   • Cron:         no body                          → rehearses every society.
 *     (schedule it AFTER scheduled-backup so the archive being rehearsed is fresh.)
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { REGISTRY, loadArchive, runRehearsal } from '../_shared/rehearsal-core.mjs';

const PAGE = 1000;
const MAX_ROWS = 50_000;
const BUCKET = 'backups';

type FetchResult = { rows: any[]; truncated: boolean; error: string | null };

/** Faithful port of src/lib/export/source.ts fetchEntityRows — society-scoped, paginated,
 *  ordered by the natural key, and REFUSING (truncated:true) rather than silently capping.
 *  Identical semantics to scheduled-backup's readEntity; the rehearsal reads only the three
 *  books-signature tables (voucher, stock_item, stock_movement), so this is called ≤3×. */
async function readEntity(supabase: any, entity: any, societyId: string): Promise<FetchResult> {
  const order: string[] = entity.naturalKey ?? [];
  const rows: any[] = [];
  let from = 0;

  const readPage = async (a: number, b: number) => {
    let q = supabase.from(entity.table).select('*').eq('society_id', societyId);
    for (const col of order) q = q.order(col);
    const { data, error } = await q.range(a, b);
    return { data: data ?? [], error: error?.message ?? null };
  };

  for (;;) {
    const remaining = MAX_ROWS - rows.length;
    if (remaining <= 0) {
      const probe = await readPage(MAX_ROWS, MAX_ROWS);
      if (probe.error) return { rows, truncated: true, error: probe.error };
      return { rows, truncated: probe.data.length > 0, error: null };
    }
    const size = Math.min(PAGE, remaining);
    const page = await readPage(from, from + size - 1);
    if (page.error) return { rows, truncated: false, error: page.error };
    rows.push(...page.data);
    if (page.data.length < size) return { rows, truncated: false, error: null };
    from += size;
  }
}

/** Newest `.slbak` for a society, by storage timestamp. null when the society has no backup. */
async function latestBackup(supabase: any, societyId: string): Promise<{ name: string; createdAt: string | null } | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(societyId, { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw new Error(`bucket list failed: ${error.message}`);
  const file = (data ?? []).find((f: any) => f.name && f.name.endsWith('.slbak')) ?? (data ?? [])[0];
  if (!file) return null;
  return { name: file.name, createdAt: file.created_at ?? file.updated_at ?? null };
}

async function rehearseSociety(supabase: any, societyId: string) {
  const latest = await latestBackup(supabase, societyId);
  if (!latest) return { societyId, ok: false, reason: 'no-backup', recorded: false };

  const path = `${societyId}/${latest.name}`;
  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
  if (dlErr || !blob) throw new Error(`download failed: ${dlErr?.message ?? 'no bytes'}`);
  const bytes = new Uint8Array(await blob.arrayBuffer());

  const now = new Date().toISOString();
  const outcome = await runRehearsal({
    bytes,
    societyId,
    entities: REGISTRY,
    loadArchive,
    fetchRows: (entity: any) => readEntity(supabase, entity, societyId),
    now,
    backupCreatedAt: latest.createdAt ?? now,
  });

  // Only passed|failed is a proof ABOUT the backup worth persisting. archive-invalid /
  // read-failed / error are operational problems, not a books verdict — reported, not
  // recorded (mirrors RestoreCenter.tsx, which persists evidence only for passed|failed).
  if (outcome.status !== 'passed' && outcome.status !== 'failed') {
    return { societyId, ok: false, reason: outcome.status, detail: (outcome as any).message ?? (outcome as any).problems ?? null, backup: latest.name, recorded: false };
  }

  // Append-only evidence — STATUS + COUNTS + TIMESTAMPS only (CL-6). Same shape as the
  // client's buildRehearsalAuditEvent (src/lib/auditLog.ts); inlined here exactly as
  // scheduled-backup inlines its 'export' row, so the Edge Function pulls in no client code.
  let recorded = true;
  try {
    const { error } = await supabase.from('audit_log').insert({
      society_id: societyId,
      actor_name: 'scheduled-rehearsal',
      actor_email: null,
      actor_role: 'system',
      entity_type: 'backup',
      entity_id: latest.name,
      action: 'rehearse',
      before: null,
      after: {
        passed: outcome.verdict.ok,
        backupCreatedAt: latest.createdAt ?? now,
        sourceBalanced: outcome.live.balanced,
        entryCount: outcome.live.entryCount,
        stockItemCount: outcome.live.stockItemCount,
        mismatchAccounts: outcome.verdict.accounts.length,
        mismatchItems: outcome.verdict.items.length,
      },
      reason: 'scheduled restore rehearsal',
      source: 'edge-function',
      created_at: now,
    });
    if (error) recorded = false;
  } catch { recorded = false; }

  return {
    societyId,
    ok: true,
    passed: outcome.verdict.ok,
    backup: latest.name,
    mismatchAccounts: outcome.verdict.accounts.length,
    mismatchItems: outcome.verdict.items.length,
    recorded,
  };
}

Deno.serve(async (req) => {
  // Secret gate — FAIL-CLOSED. Unlike the older scheduled-backup (which stayed open until a
  // secret was configured), this refuses every call when BACKUP_CRON_SECRET is unset, so the
  // service-role endpoint is never briefly world-triggerable (closes audit finding P1-7).
  const secret = Deno.env.get('BACKUP_CRON_SECRET') ?? '';
  if (!secret) {
    return new Response(JSON.stringify({ ok: false, error: 'BACKUP_CRON_SECRET not configured' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  if (req.headers.get('x-backup-secret') !== secret) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'missing service-role env' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
  const supabase = createClient(url, serviceKey);

  // Which societies? A body { societyId } rehearses one (manual test); no body → all (cron).
  let societyIds: string[] = [];
  try {
    const body = await req.json();
    if (body?.societyId) societyIds = [String(body.societyId)];
  } catch { /* no body — cron path */ }

  if (societyIds.length === 0) {
    const { data, error } = await supabase.from('society_settings').select('society_id');
    if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'content-type': 'application/json' } });
    societyIds = [...new Set((data ?? []).map((r: any) => r.society_id).filter(Boolean))];
  }

  const results: any[] = [];
  for (const societyId of societyIds) {
    try {
      results.push(await rehearseSociety(supabase, societyId));
    } catch (e) {
      results.push({ societyId, ok: false, error: e instanceof Error ? e.message : String(e), recorded: false });
    }
  }

  const allOk = results.every((r) => r.ok);
  return new Response(JSON.stringify({ ok: allOk, count: results.length, results }, null, 2), {
    status: allOk ? 200 : 207,
    headers: { 'content-type': 'application/json' },
  });
});
