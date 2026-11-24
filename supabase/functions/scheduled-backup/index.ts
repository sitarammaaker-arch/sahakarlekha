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
 *   • All:          no body / {}                   → backs up every society.
 *   • Hourly cron:  { "due": true, "limit": 4 }    → backs up up to 4 societies whose last
 *                   successful backup is > 6 days old (see _shared/backup-due.mjs, migration 174).
 *
 * NO PARTIAL BACKUPS: buildArchive throws if any table can't be read in full, and that
 * society is reported failed rather than getting a half-archive that looks complete.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { buildArchive, archiveFileName, planArchive, REGISTRY, BACKUP_FORMAT_VERSION, evaluate321, resolveJurisdiction, encryptArchive } from '../_shared/backup-core.mjs';
import { planRetention } from '../_shared/retention-plan.mjs';
import { resolvePlacements } from '../_shared/placement-config.mjs';
import { pickDueSocieties, attemptsFromAuditRows } from '../_shared/backup-due.mjs';
import { billOffsiteKey, billOffsitePrefix, planBillCopies, parseListPage } from '../_shared/bill-offsite.mjs';

const PAGE = 1000;
// DB-10 (audit 2026-11-17): the platform backup key. When set, every scheduled archive is sealed with it
// (AES-256-GCM, PBKDF2-SHA256 600k — the SAME `.slbak` container the browser writes, src/lib/backup/crypto.ts) BEFORE it
// is uploaded to Storage or replicated off-vendor, so neither copy is readable without the key. The founder keeps
// an offline copy of it; Restore Center / Verify Backup open the file with it. Unset → plain archives (as before),
// reported as `encrypted: false` in the result and the audit row so the gap stays visible.
const ENC_PASSPHRASE = Deno.env.get('BACKUP_ENCRYPTION_PASSPHRASE') ?? '';
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
// ── T-36 · the off-vendor copy (DP-P4 / BK-3) ────────────────────────────────────────────────
// A backup whose every copy sits with ONE vendor is one outage — or one ransomware event, or one
// vendor's bankruptcy — from total loss. So the archive is replicated to a SECOND, independent
// provider. Cloudflare R2 / AWS S3 / Backblaze B2 all speak the S3 API, so WHICH vendor is
// configuration, not code. Unset ⇒ no second copy and Backup Health honestly reports the
// single-vendor placement (it cannot go green — see src/lib/backup/health.ts).
const S3_ENDPOINT = Deno.env.get('BACKUP_S3_ENDPOINT') ?? '';
const S3_BUCKET = Deno.env.get('BACKUP_S3_BUCKET') ?? '';
const S3_REGION = Deno.env.get('BACKUP_S3_REGION') ?? 'auto';
const S3_KEY_ID = Deno.env.get('BACKUP_S3_ACCESS_KEY_ID') ?? '';
const S3_SECRET = Deno.env.get('BACKUP_S3_SECRET_ACCESS_KEY') ?? '';
const S3_PROVIDER = Deno.env.get('BACKUP_S3_PROVIDER') ?? '';        // label for the placement, e.g. 'cloudflare-r2'
const S3_JURISDICTION = Deno.env.get('BACKUP_S3_JURISDICTION') ?? ''; // where that bucket physically is
const S3_ENABLED = !!(S3_ENDPOINT && S3_BUCKET && S3_KEY_ID && S3_SECRET);
// Where the PRIMARY (Supabase) copy physically lives. Only the operator knows this — it is never
// guessed (see _shared/placement-config.mjs). Unset ⇒ the placement is reported UNEVALUATED rather
// than claiming a residency we cannot prove.
const PRIMARY_PROVIDER = Deno.env.get('BACKUP_PRIMARY_PROVIDER') ?? '';
const PRIMARY_REGION = Deno.env.get('BACKUP_PRIMARY_REGION') ?? '';
const PRIMARY_JURISDICTION = Deno.env.get('BACKUP_PRIMARY_JURISDICTION') ?? '';

/**
 * Replicate the archive to the off-vendor, S3-compatible store. Returns ok/error — it NEVER throws,
 * because a replication failure must not fail the backup: the primary bytes are already safe, and
 * the missing copy shows up honestly in the placement verdict instead.
 */
async function replicateOffVendor(path: string, bytes: Uint8Array): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = new AwsClient({ accessKeyId: S3_KEY_ID, secretAccessKey: S3_SECRET, service: 's3', region: S3_REGION });
    const url = `${S3_ENDPOINT.replace(/\/+$/, '')}/${S3_BUCKET}/${path}`;
    const res = await client.fetch(url, { method: 'PUT', body: bytes, headers: { 'content-type': 'application/zip' } });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `${res.status} ${detail}`.trim().slice(0, 300) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
// ── Bill copies off-site (migration 207's private bucket 'voucher-docs') ─────────────────────
// The archive carries the LIST of bills (voucher_attachments), not the files. Each run also copies this society's bill
// files that are not yet in the off-site store, sealed with the backup key — at most BILL_FILES_PER_RUN new ones, so a
// society with many bills catches up over a few runs instead of blowing the function's time budget. Best effort: a
// failure here is recorded, never a failed backup (the bills are still safe in Supabase).
const BILL_BUCKET = 'voucher-docs';
const BILL_FILES_PER_RUN = Number(Deno.env.get('BACKUP_BILL_FILES_PER_RUN')) || 40;

type BillCopyResult = { total: number; alreadyThere: number; copied: number; failed: number; deferred: number; error?: string };

async function listOffsiteKeys(client: AwsClient, prefix: string): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | null = null;
  for (let page = 0; page < 200; page++) {
    const q = new URLSearchParams({ 'list-type': '2', prefix, ...(token ? { 'continuation-token': token } : {}) });
    const res = await client.fetch(`${S3_ENDPOINT.replace(/\/+$/, '')}/${S3_BUCKET}?${q.toString()}`, { method: 'GET' });
    if (!res.ok) throw new Error(`list ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
    const { keys: got, next } = parseListPage(await res.text());
    for (const k of got) keys.add(k);
    if (!next) break;
    token = next;
  }
  return keys;
}

async function replicateBillFiles(supabase: any, societyId: string, encrypted: boolean, meta: { societyName: string; registrationNo: string }): Promise<BillCopyResult> {
  const out: BillCopyResult = { total: 0, alreadyThere: 0, copied: 0, failed: 0, deferred: 0 };
  try {
    const { data: rows, error } = await supabase.from('voucher_attachments').select('path').eq('society_id', societyId).limit(100000);
    if (error) {
      if (isMissingTableError(error.message, 'voucher_attachments')) return out;   // migration 207 not run here
      throw new Error(error.message);
    }
    const client = new AwsClient({ accessKeyId: S3_KEY_ID, secretAccessKey: S3_SECRET, service: 's3', region: S3_REGION });
    const present = await listOffsiteKeys(client, billOffsitePrefix(societyId));
    const plan = planBillCopies((rows ?? []).map((r: { path: string }) => r.path), present, encrypted, BILL_FILES_PER_RUN);
    Object.assign(out, { total: plan.total, alreadyThere: plan.alreadyThere, deferred: plan.deferred });
    for (const path of plan.toCopy) {
      try {
        const { data: blob, error: dlErr } = await supabase.storage.from(BILL_BUCKET).download(path);
        if (dlErr || !blob) throw new Error(`download: ${dlErr?.message ?? 'empty'}`);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const body = encrypted
          ? await encryptArchive(bytes, ENC_PASSPHRASE, {
              formatVersion: 'bill-1', societyName: meta.societyName, registrationNo: meta.registrationNo,
              financialYear: '', createdAt: new Date().toISOString(), trigger: `bill-copy:${path}`,
            })
          : bytes;
        const res = await client.fetch(`${S3_ENDPOINT.replace(/\/+$/, '')}/${S3_BUCKET}/${billOffsiteKey(path, encrypted)}`, {
          method: 'PUT', body, headers: { 'content-type': encrypted ? 'application/octet-stream' : (blob.type || 'application/octet-stream') },
        });
        if (!res.ok) throw new Error(`put ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
        out.copied++;
      } catch (e) {
        out.failed++;
        out.error ??= e instanceof Error ? e.message : String(e);
      }
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
  }
  return out;
}

// Retention (opt-in destructive): the bucket otherwise grows ~1 file/society/week forever.
// Policy is computed by the CI-tested pure planner (_shared/retention-plan.mjs): keep the
// newest BACKUP_KEEP_RECENT files (default 12) + the newest file of each calendar month for
// BACKUP_KEEP_MONTHS months (default 12). DRY-RUN by default — files are actually removed
// ONLY when BACKUP_RETENTION=delete, and only ever AFTER that society's fresh backup succeeded.
const RETENTION_MODE = (Deno.env.get('BACKUP_RETENTION') ?? 'dry-run').toLowerCase();
const KEEP_RECENT = Number(Deno.env.get('BACKUP_KEEP_RECENT')) || 12;
const KEEP_MONTHS = Number(Deno.env.get('BACKUP_KEEP_MONTHS')) || 12;
// How many tables to read at once. The free tier caps a request at 150s wall-clock, and
// reading ~87 tables one-at-a-time blows past it. Reading in parallel batches turns ~87
// sequential round-trips into ~11, without overwhelming the connection pool.
const READ_CONCURRENCY = 8;

type FetchResult = { rows: any[]; truncated: boolean; fetched: number; error: string | null };

/** Faithful port of src/lib/export/source.ts fetchEntityRows — society-scoped, paginated,
 *  ordered by the natural key, and REFUSING (truncated:true) rather than silently capping. */
/** Same rule as src/lib/export/source.ts isMissingTableError — keep the two in step. */
function isMissingTableError(message: string | null | undefined, table: string): boolean {
  const m = (message || '').toLowerCase();
  return m.includes(table.toLowerCase()) && (m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find'));
}

async function readEntity(supabase: any, entity: any, societyId: string): Promise<FetchResult> {
  const order: string[] = entity.naturalKey ?? [];
  const rows: any[] = [];
  let from = 0;
  // optionalTable (e.g. member_identity before migration 106): a missing table is an empty table, not a failed backup.
  const missingOk = (err: string | null) => !!entity.optionalTable && isMissingTableError(err, entity.table);
  const empty: FetchResult = { rows: [], truncated: false, fetched: 0, error: null };

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
      if (probe.error) return missingOk(probe.error) ? empty : { rows, truncated: true, fetched: rows.length, error: probe.error };
      return { rows, truncated: probe.data.length > 0, fetched: rows.length, error: null };
    }
    const size = Math.min(PAGE, remaining);
    const page = await readPage(from, from + size - 1);
    if (page.error) return missingOk(page.error) ? empty : { rows, truncated: false, fetched: rows.length, error: page.error };
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
  // DB-10: seal the archive before ANY copy leaves this function (both copies get the same sealed bytes).
  const encrypted = !!ENC_PASSPHRASE;
  const stored: Uint8Array = encrypted
    ? await encryptArchive(archive, ENC_PASSPHRASE, {
        formatVersion: BACKUP_FORMAT_VERSION,
        societyName: meta.societyName,
        registrationNo: meta.registrationNo,
        financialYear: meta.financialYear,
        createdAt,
        trigger: 'scheduled',
      })
    : archive;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, stored, { contentType: encrypted ? 'application/octet-stream' : 'application/zip', upsert: false });
  if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

  // ── T-36 · the second, off-vendor copy ─────────────────────────────────────
  // Best effort by design: the primary bytes are already safe, so a replication failure is recorded
  // and surfaced in the placement verdict — it never fails the backup.
  let secondaryLanded: { provider: string; region: string; jurisdiction: string } | null = null;
  let offVendor = 'not configured';
  if (S3_ENABLED) {
    const rep = await replicateOffVendor(path, stored);
    if (rep.ok) { secondaryLanded = { provider: S3_PROVIDER, region: S3_REGION, jurisdiction: S3_JURISDICTION }; offVendor = 'landed'; }
    else { offVendor = `failed: ${rep.error}`; }
  }
  // The bill files themselves (the archive above carries only their list). Best effort, recorded below.
  let billFiles: BillCopyResult | null = null;
  if (S3_ENABLED) {
    billFiles = await replicateBillFiles(supabase, societyId, encrypted, { societyName: meta.societyName, registrationNo: meta.registrationNo });
  }

  // Grade the placement with the SAME policy the client's Backup Health uses (evaluate321) — one
  // policy, never a server-side second opinion. A copy whose location the operator has not declared,
  // or a society whose jurisdiction does not resolve, leaves the placement UNEVALUATED (honest) —
  // we never fabricate a region/jurisdiction, because a guessed one would silently suppress a real
  // residency deficiency (ADR-0009) and turn the card green on nothing.
  const placementCfg = resolvePlacements({
    primary: { provider: PRIMARY_PROVIDER, region: PRIMARY_REGION, jurisdiction: PRIMARY_JURISDICTION },
    secondary: secondaryLanded,
  });
  const tenantJurisdiction = resolveJurisdiction(soc?.state);
  const unevaluatedReasons = [
    ...placementCfg.reasons,
    ...(tenantJurisdiction ? [] : ['the society has no resolvable jurisdiction (state unset) — residency cannot be checked']),
  ];
  const placement = placementCfg.evaluable && tenantJurisdiction
    ? evaluate321(placementCfg.copies, tenantJurisdiction)
    : null;

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
        trigger: 'scheduled', filename, path, byteSize: stored.length,
        encrypted,   // DB-10 — never the key itself
        entityCount: manifest.totals.entityCount, rowCount: manifest.totals.rowCount,
        manifestHash: manifest.manifestHash,
        // T-36: where the copies actually landed, and how that placement grades (DP-P4).
        offVendor,
        billFiles,   // bill copies sent off-site this run: { total, alreadyThere, copied, failed, deferred, error? } (null ⇒ no off-site store)
        placement,                                                        // null ⇒ unevaluated
        placementUnevaluated: placement ? null : unevaluatedReasons,      // …and exactly why
      },
      reason: 'scheduled server backup',
      source: 'edge-function',
      created_at: createdAt,
    });
    if (error) recorded = false;
  } catch { recorded = false; }

  return { societyId, ok: true, filename, path, bytes: stored.length, encrypted, entities: manifest.totals.entityCount, rows: manifest.totals.rowCount, recorded, billFiles };
}

/**
 * Prune old backups per the retention policy — called ONLY after this society's fresh backup
 * succeeded, so retention can never reduce protection below the just-written archive. NEVER
 * throws: a retention hiccup must not turn a successful backup into a reported failure.
 *
 * DRY-RUN by default (reports what WOULD be deleted in the HTTP result); set
 * BACKUP_RETENTION=delete to actually remove files. Deletions are recorded in audit_log
 * (WORM custody, same trail the Backup Health card reads).
 */
async function applyRetention(supabase: any, societyId: string, justUploaded: string) {
  try {
    const { data: listing, error } = await supabase.storage
      .from(BUCKET)
      .list(societyId, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) return { mode: RETENTION_MODE, skipped: `list failed: ${error.message}` };
    const files = (listing ?? []).filter((f: any) => f?.name && !f.name.endsWith('/'));
    // Sanity: if the archive we JUST uploaded is not visible in the listing, the listing is
    // not trustworthy — do nothing rather than delete against a stale/partial view.
    if (!files.some((f: any) => f.name === justUploaded)) {
      return { mode: RETENTION_MODE, skipped: 'fresh upload not visible in listing' };
    }

    const plan = planRetention(
      files.map((f: any) => ({ name: f.name, createdAt: f.created_at ?? f.updated_at ?? null })),
      { keepRecent: KEEP_RECENT, keepMonths: KEEP_MONTHS },
    );
    if (plan.del.length === 0) return { mode: RETENTION_MODE, kept: plan.keep.length, deleted: 0 };

    if (RETENTION_MODE !== 'delete') {
      // Dry-run: report the plan, touch nothing. Enable with BACKUP_RETENTION=delete.
      return { mode: 'dry-run', kept: plan.keep.length, wouldDelete: plan.del.length, files: plan.del.slice(0, 20) };
    }

    const paths = plan.del.map((name) => `${societyId}/${name}`);
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
    if (rmErr) return { mode: 'delete', kept: plan.keep.length, deleted: 0, error: rmErr.message };

    try {
      await supabase.from('audit_log').insert({
        society_id: societyId,
        actor_name: 'scheduled-backup',
        actor_email: null,
        actor_role: 'system',
        entity_type: 'backup',
        entity_id: null,
        action: 'export',
        before: null,
        after: { trigger: 'retention', kept: plan.keep.length, deleted: plan.del.length, files: plan.del.slice(0, 50), keepRecent: KEEP_RECENT, keepMonths: KEEP_MONTHS },
        reason: 'backup retention pruning',
        source: 'edge-function',
        created_at: new Date().toISOString(),
      });
    } catch { /* best-effort — the prune already happened */ }

    return { mode: 'delete', kept: plan.keep.length, deleted: plan.del.length };
  } catch (e) {
    return { mode: RETENTION_MODE, skipped: e instanceof Error ? e.message : String(e) };
  }
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
  let body: any = null;
  try {
    body = await req.json();
    if (body?.societyId) societyIds = [String(body.societyId)];
  } catch { /* no body — cron path */ }

  let dueInfo: any = null;
  if (societyIds.length === 0) {
    const { data, error } = await supabase.from('society_settings').select('society_id');
    if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'content-type': 'application/json' } });
    societyIds = [...new Set((data ?? []).map((r: any) => r.society_id).filter(Boolean))];

    // BKP-00/BKP-07: { due: true } — the hourly cron. Back up only the few societies that are due
    // (oldest first), so one dead invocation costs an hour for a handful of societies, not a week
    // for all of them. Without `due` (old weekly cron, manual call) every society is backed up.
    if (body?.due) {
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const { data: rows, error: aErr } = await supabase
        .from('audit_log').select('society_id, created_at, after')
        .eq('entity_type', 'backup').eq('actor_name', 'scheduled-backup')
        .gte('created_at', since).limit(10000);
      if (aErr) return new Response(JSON.stringify({ ok: false, error: `audit read failed: ${aErr.message}` }), { status: 500, headers: { 'content-type': 'application/json' } });
      const limit = Math.min(20, Math.max(1, Number(body?.limit) || 4));
      dueInfo = pickDueSocieties(societyIds, attemptsFromAuditRows(rows ?? []), { limit });
      societyIds = dueInfo.due;
    }
  }

  const results: any[] = [];
  for (const societyId of societyIds) {
    try {
      const result = await backupSociety(supabase, societyId);
      // Retention runs ONLY on the success path — a failed backup must never trigger pruning.
      const retention = await applyRetention(supabase, societyId, result.filename);
      results.push({ ...result, retention });
    } catch (e) {
      // Durably record the failure (audit_log + error_log) — never silent again.
      const recorded = await recordBackupFailure(supabase, societyId, e);
      results.push({ societyId, ok: false, error: e instanceof Error ? e.message : String(e), recorded });
    }
  }

  const allOk = results.every((r) => r.ok);
  return new Response(JSON.stringify({ ok: allOk, count: results.length, due: dueInfo ? { remaining: dueInfo.dueTotal - results.length, fresh: dueInfo.fresh, backingOff: dueInfo.backingOff } : undefined, results }, null, 2), {
    status: allOk ? 200 : 207,
    headers: { 'content-type': 'application/json' },
  });
});
