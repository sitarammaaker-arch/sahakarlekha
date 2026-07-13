/**
 * scheduled-backup — server-side `.slbak` backup (D1 / EXP-12).
 *
 * Runs on Supabase's servers (Deno). Builds the EXACT same verified `.slbak` the browser
 * builds — via `../_shared/backup-core.mjs`, an esbuild bundle of the real client backup
 * code, so a server backup passes the client's own `/verify-backup`. (Proven format-correct
 * by scripts/test-backup-core-bundle.mjs before this was ever deployed.)
 *
 * It READS every society-scoped table (service-role, RLS bypassed as a server job must,
 * still filtered by society_id), builds the archive, and UPLOADS it to the private
 * `backups` Storage bucket at `<societyId>/<filename>`. It never mutates a society's data.
 *
 * Two ways to invoke:
 *   • Manual test:  POST { "societyId": "<id>" }   → backs up one society.
 *   • Weekly cron:  no body                        → backs up every society.
 *
 * NO PARTIAL BACKUPS: buildArchive throws if any table can't be read in full, and that
 * society is reported failed rather than getting a half-archive that looks complete.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildArchive, archiveFileName, planArchive, REGISTRY, BACKUP_FORMAT_VERSION } from '../_shared/backup-core.mjs';

const PAGE = 1000;
// Per-table row ceiling. A table above this makes buildArchive refuse (no partial backups),
// which — before this slice — silently dropped the biggest societies from the weekly backup.
// Env-overridable so the cap can be raised without a redeploy (Slice 2) and so the failure
// path can be exercised on an ordinary society by setting it low (e.g. BACKUP_MAX_ROWS=10).
const MAX_ROWS = Number(Deno.env.get('BACKUP_MAX_ROWS')) || 150_000;
// Cumulative in-memory budget (raw ndjson bytes) for ONE society's backup. readAllRows holds every
// table's rows at once and zipSync then assembles the archive in memory, so peak ≈ 2-3× the data.
// An OOM (or the 150s timeout) crashes the whole Deno isolate and is NOT catchable by the per-society
// try/catch, so this bounds a society's combined size: once exceeded it fails GRACEFULLY (recorded
// via recordBackupFailure) instead of OOM-crashing the entire run. Env-tunable. The real fix for very
// large societies is per-entity streaming (T-27); until then they fail loudly at this budget.
const MAX_BYTES = Number(Deno.env.get('BACKUP_MAX_BYTES')) || 50 * 1024 * 1024;
const BUCKET = 'backups';
// How many tables to read at once. The free tier caps a request at 150s wall-clock, and
// reading ~87 tables one-at-a-time blows past it. Reading in parallel batches turns ~87
// sequential round-trips into ~11, without overwhelming the connection pool.
const READ_CONCURRENCY = 8;

type FetchResult = { rows: any[]; truncated: boolean; fetched: number; error: string | null };

/** Faithful port of src/lib/export/source.ts fetchEntityRows — society-scoped, paginated,
 *  ordered by the natural key, and REFUSING (truncated:true) rather than silently capping. */
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
      if (probe.error) return { rows, truncated: true, fetched: rows.length, error: probe.error };
      return { rows, truncated: probe.data.length > 0, fetched: rows.length, error: null };
    }
    const size = Math.min(PAGE, remaining);
    const page = await readPage(from, from + size - 1);
    if (page.error) return { rows, truncated: false, fetched: rows.length, error: page.error };
    rows.push(...page.data);
    if (page.data.length < size) return { rows, truncated: false, fetched: rows.length, error: null };
    from += size;
  }
}

/** Estimate an entity's in-memory footprint (~its ndjson byte size). The rows are already resident,
 *  so this only measures them — cheap next to the DB reads — so a society can't silently OOM the run. */
function estimateBytes(rows: any[]): number {
  let n = 0;
  for (const r of rows) n += JSON.stringify(r).length + 1;
  return n;
}

/** Read every backup-able table for one society, in parallel batches, into a cache. Between batches it
 *  tallies the cumulative bytes read and ABORTS once a society's combined data exceeds MAX_BYTES —
 *  loud + graceful (the throw is recorded by recordBackupFailure) rather than letting the isolate OOM
 *  and take the whole invocation (and every other society in it) down with no trace. */
async function readAllRows(supabase: any, societyId: string, entities: any[]): Promise<Record<string, FetchResult>> {
  const cache: Record<string, FetchResult> = {};
  let totalBytes = 0;
  for (let i = 0; i < entities.length; i += READ_CONCURRENCY) {
    const chunk = entities.slice(i, i + READ_CONCURRENCY);
    await Promise.all(chunk.map(async (entity) => {
      cache[entity.key] = await readEntity(supabase, entity, societyId);
    }));
    for (const entity of chunk) {
      const res = cache[entity.key];
      if (res.error || res.truncated) continue; // these already abort buildArchive, loudly
      totalBytes += estimateBytes(res.rows);
    }
    if (totalBytes > MAX_BYTES) {
      throw new Error(
        `society exceeds the in-memory backup budget ` +
        `(${Math.round(totalBytes / 1048576)} MB > ${Math.round(MAX_BYTES / 1048576)} MB) — ` +
        `too large for a single-pass server backup; needs per-entity streaming (T-27)`,
      );
    }
  }
  return cache;
}

async function backupSociety(supabase: any, societyId: string) {
  const { data: soc } = await supabase
    .from('society_settings').select('*').eq('society_id', societyId).limit(1).maybeSingle();

  const createdAt = new Date().toISOString();
  const meta = {
    appVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: String(REGISTRY.length),
    societyId,
    societyName: soc?.name ?? 'society',
    registrationNo: soc?.registrationNo ?? '',
    financialYear: soc?.financialYear ?? '',
    createdAt,
    createdBy: { name: 'scheduled-backup', email: null, role: 'system' },
    trigger: 'scheduled',
    encryption: null,
  };

  // Read all tables in parallel FIRST (fast), then let buildArchive assemble from the cache.
  // buildArchive itself iterates entities one at a time; feeding it a pre-filled cache keeps
  // the slow part (dozens of DB round-trips) parallel while the archive format stays identical.
  const toRead = planArchive(REGISTRY).written.map((w: any) => w.entity);
  const cache = await readAllRows(supabase, societyId, toRead);

  // Same entity set the client passes, so the registry fingerprint matches exactly.
  const { archive, manifest } = await buildArchive({
    entities: REGISTRY,
    societyId,
    fetchRows: async (entity: any) => cache[entity.key] ?? { rows: [], truncated: false, fetched: 0, error: null },
    meta,
  });

  const filename = archiveFileName(meta.societyName, meta.financialYear, createdAt);
  const path = `${societyId}/${filename}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, archive, { contentType: 'application/zip', upsert: false });
  if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

  // Record it — WORM custody, best effort. The bytes are already safe in Storage; a failed
  // audit write must not be reported as a failed backup.
  let recorded = true;
  try {
    const { error } = await supabase.from('audit_log').insert({
      society_id: societyId,
      actor_name: 'scheduled-backup',
      actor_email: null,
      actor_role: 'system',
      entity_type: 'backup',
      entity_id: manifest.manifestHash,
      action: 'export',
      before: null,
      after: {
        trigger: 'scheduled', filename, path, byteSize: archive.length,
        entityCount: manifest.totals.entityCount, rowCount: manifest.totals.rowCount,
        manifestHash: manifest.manifestHash,
      },
      reason: 'scheduled server backup',
      source: 'edge-function',
      created_at: createdAt,
    });
    if (error) recorded = false;
  } catch { recorded = false; }

  return { societyId, ok: true, filename, path, bytes: archive.length, entities: manifest.totals.entityCount, rows: manifest.totals.rowCount, recorded };
}

/**
 * Record a backup FAILURE durably. Before this, a society whose biggest table outgrew MAX_ROWS
 * (or any read/upload error) threw, was reported only in the HTTP 207 body — which the fire-and-
 * forget cron never reads — and left NO durable trace, so the largest societies could stop being
 * backed up and nobody would know. Now every failure lands in BOTH:
 *   • audit_log  — the per-society WORM custody trail the Backup Health card already reads, so the
 *                  gap is visible next to the successes.
 *   • error_log  — the P0-2 error-monitoring sink, so it surfaces with every other operational
 *                  failure.
 * Best-effort and never throws: a failed record must not mask (or replace) the original failure.
 * Returns whether the custody (audit_log) write succeeded.
 */
async function recordBackupFailure(supabase: any, societyId: string, err: unknown): Promise<boolean> {
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
  const stack = err instanceof Error && err.stack ? err.stack.slice(0, 8000) : null;
  const createdAt = new Date().toISOString();
  let recorded = true;

  try {
    const { error } = await supabase.from('audit_log').insert({
      society_id: societyId,
      actor_name: 'scheduled-backup',
      actor_email: null,
      actor_role: 'system',
      entity_type: 'backup',
      entity_id: null,
      action: 'export',
      before: null,
      after: { trigger: 'scheduled', status: 'failed', error: message },
      reason: 'scheduled server backup FAILED',
      source: 'edge-function',
      created_at: createdAt,
    });
    if (error) recorded = false;
  } catch { recorded = false; }

  try {
    await supabase.from('error_log').insert({
      id: globalThis.crypto?.randomUUID?.() ?? `bkp-${createdAt}-${societyId}`,
      society_id: societyId,
      source: 'scheduled-backup',
      message,
      stack,
      context: { societyId, trigger: 'scheduled' },
      url: null,
      actor_name: 'scheduled-backup',
      created_at: createdAt,
    });
  } catch { /* swallow — the error sink must never mask the real failure */ }

  return recorded;
}

Deno.serve(async (req) => {
  // Secret gate — FAIL-CLOSED (matches scheduled-rehearsal; closes audit finding P1-7). This
  // service-role endpoint can back up EVERY society, so it must never be world-triggerable: when
  // BACKUP_CRON_SECRET is unset we refuse every call, and when it is set we require the cron job's
  // matching `x-backup-secret` header. (Previously it stayed OPEN while the secret was unset, which
  // let anyone who guessed the URL trigger a full backup.)
  // DEPLOY NOTE: set BACKUP_CRON_SECRET (supabase secrets set …) and have the cron send the header
  // BEFORE shipping this, or the weekly backup 500s.
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

  // Which societies? A body { societyId } backs up one (manual test); no body → all (cron).
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
      results.push(await backupSociety(supabase, societyId));
    } catch (e) {
      // Durably record the failure (audit_log + error_log) — never silent again.
      const recorded = await recordBackupFailure(supabase, societyId, e);
      results.push({ societyId, ok: false, error: e instanceof Error ? e.message : String(e), recorded });
    }
  }

  const allOk = results.every((r) => r.ok);
  return new Response(JSON.stringify({ ok: allOk, count: results.length, results }, null, 2), {
    status: allOk ? 200 : 207,
    headers: { 'content-type': 'application/json' },
  });
});
