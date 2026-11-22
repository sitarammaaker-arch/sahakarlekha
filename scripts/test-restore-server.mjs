// Restore through the server in one transaction (migration 178 · audit NEW-01 / NEW-02 / BKP-01, 2026-11-17).
// The SQL of 178 was run end-to-end on Postgres (PGlite) while building: an edited voucher restored with its
// journal reversed + reposted, a voucher cancelled after the backup revived under a new id, a voucher created
// after the backup cancelled, voucher_entries / voucher_lines / journal all agreeing; a closed-year change, a row
// of another society and a non-backup table each rolled the WHOLE restore back. This file pins the shape and
// exercises the browser half with spies.
// Run: node scripts/test-restore-server.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(HERE, '..');
const SRC = pathResolve(ROOT, 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs';
  import { fileURLToPath, pathToFileURL } from 'node:url';
  import { resolve as pathResolve } from 'node:path';
  const SRC = ${JSON.stringify(SRC)};
  const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'];
  const SUPABASE = pathToFileURL(pathResolve(SRC, 'lib', 'supabase.ts')).href;
  export async function resolve(spec, ctx, next) {
    if (spec === '@/lib/supabase') return { url: SUPABASE, shortCircuit: true };
    if (spec.startsWith('@/')) { const base = pathResolve(SRC, spec.slice(2)); for (const c of [base + '.ts', base + '.tsx', base + '/index.ts', base]) if (existsSync(c)) return { url: pathToFileURL(c).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const c of [spec + '.ts', spec + '.tsx', spec + '/index.ts']) { const u = new URL(c, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (url === SUPABASE) return { format: 'module', shortCircuit: true, source: 'export const supabase = {}; export const supabaseLoose = supabase;' };
    return next(url, ctx);
  }
`));
const imp = (rel) => import(pathToFileURL(pathResolve(ROOT, rel)).href);
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8');

const W = await imp('src/lib/restore/serverWriter.ts');
const { commitRestoreLive } = await imp('src/lib/restore/commitLive.ts');
const { makeRestoreWriter } = await imp('src/lib/restore/rowWriter.ts');
const { REGISTRY } = await imp('src/lib/export/registry.ts');
const { buildVoucherEntries } = await imp('src/lib/voucherUtils.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

// ── 1. The server allowlist IS the registry's 'full' backup tables ──
{
  const m = read('supabase/migrations/178_restore_commit_server.sql');
  const block = m.slice(m.indexOf('insert into public.restore_tables (table_name) values'), m.indexOf('create or replace function public.restore_stage'));
  const sqlTables = new Set([...block.matchAll(/\('([a-z0-9_]+)'\)/g)].map((x) => x[1]));
  // Tables added to the allowlist by later migrations (e.g. 195 party_identity) count too.
  const { readdirSync } = await import('node:fs');
  for (const f of readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter((x) => /^\d{3}_.*\.sql$/.test(x) && !x.endsWith('_down.sql') && x > '178')) {
    for (const mm of read(`supabase/migrations/${f}`).matchAll(/insert into public\.restore_tables \(table_name\) values \('([a-z0-9_]+)'\)/g)) sqlTables.add(mm[1]);
  }
  const full = new Set(REGISTRY.filter((e) => e.backupPolicy === 'full' && e.scope === 'society').map((e) => e.table));
  const missing = [...full].filter((t) => !sqlTables.has(t));
  const extra = [...sqlTables].filter((t) => !full.has(t));
  ok(missing.length === 0 && extra.length === 0, `restore_tables = registry full tables (missing: ${missing.join(',') || '-'}; extra: ${extra.join(',') || '-'})`);
  ok(!sqlTables.has('society_users') && !sqlTables.has('ledger_events') && !sqlTables.has('voucher_entries') && !sqlTables.has('audit_log'), 'logins, the journal, derived entries and the audit log are never restorable');
}

// ── 2. Migration 178 shape ──
{
  const m = read('supabase/migrations/178_restore_commit_server.sql').replace(/--.*$/gm, '');
  const d = read('supabase/migrations/178_restore_commit_server_down.sql');
  ok(/revoke all on table public\.restore_staging from public, anon, authenticated/.test(m), 'staging table is closed to clients');
  ok(/revoke execute on function public\.restore_commit\(uuid, int, text, text, jsonb\) from public, anon/.test(m) && /revoke execute on function public\.restore_stage\(uuid, int, jsonb\) from public, anon/.test(m), 'anon cannot stage or commit');
  ok((m.match(/if not public\.is_society_admin\(v_sid\) then raise exception 'restore:admin_only/g) || []).length === 2, 'both functions are admin-only for the caller\'s own society');
  ok(/x \|\| jsonb_build_object\('society_id', v_sid\)/.test(m), 'every written row is stamped with the caller\'s society');
  ok(/update set %s where t\.society_id::text = %L/.test(m) && /restore:foreign_row/.test(m), 'an upsert can never overwrite another society\'s row');
  ok(/if v_t = 'vouchers' then\s+update public\.vouchers t set "isDeleted" = true/.test(m), 'a voucher is cancelled, never deleted');
  ok(/not exists \(select 1 from public\.voucher_lines l/.test(m), 'an account history still references is kept');
  ok(/restore:closed_year/.test(m) && /f\.status in \('closed', 'audited'\)/.test(m), 'a change inside a closed / audited year undoes the restore');
  ok(/restore:revived_voucher/.test(m), 'a revived voucher the browser did not re-key undoes the restore');
  ok(!/update public\.ledger_events|delete from public\.ledger_events/.test(m), 'the journal is append-only (never updated or deleted)');
  ok(/'voucher\.posted'/.test(m) && /'voucher\.reversed'/.test(m) && /'voucher\.reposted'/.test(m) && /'voucher\.cancelled'/.test(m), 'the journal is brought level with posted / reversed + reposted / cancelled');
  ok(/delete from public\.voucher_entries where society_id::text = v_sid;/.test(m), 'voucher_entries are rebuilt for the society');
  ok(/update public\.voucher_lines set status = 'reversed'/.test(m) && /'restore'\s*\n?\s*from jsonb_array_elements\(r\.legs\)/.test(m), 'voucher_lines are reversed and re-posted where the legs changed');
  ok(/restore:incomplete_upload/.test(m), 'a missing upload chunk refuses the commit');
  ok(/drop function if exists public\.restore_commit/.test(d) && /drop table if exists public\.restore_staging/.test(d), 'down removes everything');
}

// ── 2b. Migration 179: production's vouchers."createdAt" is a timestamp. 178 built the derived-rows loop as a
// UNION whose second branch types "createdAt" as text, so every real commit failed with
// "UNION types timestamp without time zone and text cannot be matched" (trial restore, 2026-11-18; nothing written).
// 179 = 178's restore_commit with _rv carrying "createdAt" as text — and no other change.
{
  const fnOf = (sql) => {
    const s = sql.replace(/\r\n/g, '\n');
    const a = s.indexOf('create or replace function public.restore_commit(');
    const end = 'grant execute on function public.restore_commit(uuid, int, text, text, jsonb) to authenticated;';
    return s.slice(a, s.indexOf(end) + end.length);
  };
  const f178 = fnOf(read('supabase/migrations/178_restore_commit_server.sql'));
  const f179 = fnOf(read('supabase/migrations/179_restore_commit_createdat_text.sql'));
  const d179 = fnOf(read('supabase/migrations/179_restore_commit_createdat_text_down.sql'));
  const rv = f179.slice(f179.indexOf('create temp table _rv'), f179.indexOf('from public.vouchers v where'));
  ok(/v\."createdAt"::text as "createdAt"/.test(rv), '179: _rv carries "createdAt" as text, matching the UNION\'s null::text branch');
  const loop = f179.slice(f179.indexOf('for r in'), f179.indexOf('loop\n', f179.indexOf('for r in')));
  ok(/union all/.test(loop) && /null::date, null::text, null::text, null::text, false, '\[\]'::jsonb/.test(loop), '179: the loop\'s second UNION branch is unchanged (text "createdAt")');
  ok(f179 === f178.replace('v."createdBy", v."createdAt",\n', 'v."createdBy", v."createdAt"::text as "createdAt",\n'), '179 changes exactly one line of 178\'s restore_commit');
  ok(d179 === f178, '179 down puts back 178\'s restore_commit verbatim');
  const m179 = read('supabase/migrations/179_restore_commit_createdat_text.sql');
  ok(/^begin;/m.test(m179) && /^commit;/m.test(m179) && /values \('179', 'restore_commit_createdat_text'\)/.test(m179), '179 runs in one transaction and registers itself');
}

// ── 3. The recording client turns the writer's calls into server operations ──
{
  const vEntity = REGISTRY.find((e) => e.key === 'voucher');
  const { client, ops } = W.makeRecordingClient();
  const write = makeRestoreWriter(client, 'S1', { voucher: [{ id: 'old', voucherNo: 'JV/9' }, { id: 'a', voucherNo: 'JV/1' }] });
  await write(vEntity, [{ id: 'a', voucherNo: 'JV/1', amount: 5 }], 'replace');
  ok(ops.length === 2 && ops[0].kind === 'delete' && ops[0].table === 'vouchers' && JSON.stringify(ops[0].keys) === JSON.stringify([{ voucherNo: 'JV/9' }]), 'a Replace orphan becomes a delete op by natural key (no society_id in the key)');
  ok(ops[1].kind === 'upsert' && ops[1].rows[0].society_id === 'S1' && ops[1].rows[0].id === 'a', 'the archive rows become an upsert op');
  const { client: c2, ops: o2 } = W.makeRecordingClient({ missingTables: new Set(['member_identity']) });
  const r = await c2.from('member_identity').upsert([{ member_id: 'm' }]);
  ok(!!r.error && /does not exist/.test(r.error.message) && o2.length === 0, 'a missing table answers like the database (keeps the PII legacy fallback)');
}

// ── 4. Chunking keeps every row and the order ──
{
  const rows = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, pad: 'x'.repeat(100) }));
  const ops = [{ table: 'accounts', kind: 'delete', keys: [{ id: 'z' }] }, { table: 'vouchers', kind: 'upsert', rows }, { table: 'members', kind: 'upsert', rows: [{ id: 'm' }] }];
  const chunks = W.chunkOps(ops, 1500);
  const flat = chunks.flat();
  ok(chunks.length > 2, 'a large plan is split into several chunks');
  ok(flat[0].table === 'accounts' && flat[flat.length - 1].table === 'members', 'order is kept across chunks');
  ok(flat.filter((o) => o.table === 'vouchers').flatMap((o) => o.rows).map((r) => r.id).join() === rows.map((r) => r.id).join(), 'every row arrives once, in order');
}

// ── 5. Revived vouchers are re-keyed with every reference ──
{
  const archive = {
    voucher: [{ id: 'V3', voucherNo: 'JV/3', isDeleted: false }, { id: 'V1', voucherNo: 'JV/1', isDeleted: false }],
    sale: [{ id: 'S', voucherId: 'V3', gstVoucherIds: ['V3', 'G'], narration: 'V3 note' }],
    salary_record: [{ id: 'X', accrualVoucherId: 'V1' }],
  };
  const out = W.rekeyRevivedVouchers(archive, [{ id: 'V3-L1', voucherId: 'V3' }], [{ id: 'V3', isDeleted: true }, { id: 'V1', isDeleted: false }], () => 'NEW');
  ok(JSON.stringify(out.revived) === JSON.stringify({ V3: 'NEW' }), 'only a voucher cancelled today but live in the backup is revived');
  ok(out.archiveRows.voucher[0].id === 'NEW' && out.archiveRows.voucher[0].voucherNo === 'JV/3' && out.archiveRows.voucher[1].id === 'V1', 'it gets a new id and keeps its number');
  ok(out.archiveRows.sale[0].voucherId === 'NEW' && JSON.stringify(out.archiveRows.sale[0].gstVoucherIds) === JSON.stringify(['NEW', 'G']), 'references (scalar and array) follow it');
  ok(out.archiveRows.sale[0].narration === 'V3 note' && out.archiveRows.salary_record[0].accrualVoucherId === 'V1', 'only exact id values change');
  ok(out.archivedEntries[0].voucherId === 'NEW' && out.archivedEntries[0].id === 'NEW-L1', 'the replay assertion sees the same re-keyed vouchers (entry id follows too)');
  ok(archive.voucher[0].id === 'V3', 'the input is not mutated');
}

// ── 6. commitRestoreLive goes to the server, and a refusal writes NOTHING ──
{
  const voucher = { id: 'V1', voucherNo: 'V-0001', isDeleted: false, amount: 0, lines: [{ id: 'L1', accountId: '1101', type: 'Dr', amount: 1500 }, { id: 'L2', accountId: '4101', type: 'Cr', amount: 1500 }] };
  const archivedEntries = buildVoucherEntries(voucher, 'SOC1').map((e) => ({ ...e, dr: e.dr.toFixed(2), cr: e.cr.toFixed(2) }));
  const backup = { filename: 'pre.slbak', bytes: 1, createdAt: '2026-11-18T00:00:00Z', manifestHash: 'BK' };
  const mkRpc = (fail) => { const calls = []; return { calls, rpc(fn, args) { calls.push({ fn, args }); return Promise.resolve(fn === 'restore_commit' && fail ? { data: null, error: { message: fail } } : { data: { status: 'committed' }, error: null }); } }; };
  let n = 0;
  const base = (rpc, over = {}) => ({ mode: 'replace', fyLocked: false, archiveRows: { voucher: [voucher] }, currentRows: { voucher: [{ ...voucher, isDeleted: true }] }, archivedEntries,
    societyId: 'SOC1', sourceManifestHash: 'H', preRestoreBackup: backup, auditContext: { societyId: 'SOC1', actor: { name: 'A' } }, rpc, newId: () => `id${++n}`, recordAttempt: async () => {}, ...over });

  const okRpc = mkRpc(null);
  const recorded = [];
  const out = await commitRestoreLive(base(okRpc, { recordAttempt: async (r) => { recorded.push(r); } }));
  ok(out.status === 'committed', `a gated restore commits through the server (${out.status} ${JSON.stringify(out.diff?.problems ?? out.message ?? out.verdict ?? '')})`);
  ok(okRpc.calls[0].fn === 'restore_stage' && okRpc.calls[okRpc.calls.length - 1].fn === 'restore_commit', 'the plan is staged, then committed');
  const commitArgs = okRpc.calls[okRpc.calls.length - 1].args;
  ok(commitArgs.p_mode === 'replace' && commitArgs.p_chunks === okRpc.calls.length - 1 && commitArgs.p_manifest_hash === 'H', 'commit carries mode, chunk count and the source manifest');
  ok(JSON.stringify(commitArgs.p_revived) === JSON.stringify({ V1: 'id1' }), 'the voucher cancelled since the backup is revived under a new id');
  const staged = okRpc.calls.filter((c) => c.fn === 'restore_stage').flatMap((c) => c.args.p_ops);
  ok(staged.some((o) => o.table === 'vouchers' && o.kind === 'upsert' && o.rows[0].id === 'id1'), 'the staged plan carries the re-keyed voucher');
  ok(!staged.some((o) => o.table === 'voucher_entries'), 'voucher_entries are never sent (the server rebuilds them)');
  ok(recorded.length === 1 && recorded[0].outcome === 'committed', 'one trail record for the committed restore');

  const badRpc = mkRpc('restore:closed_year — वाउचर JV/1 बंद वर्ष का है');
  const rec2 = [];
  const out2 = await commitRestoreLive(base(badRpc, { recordAttempt: async (r) => { rec2.push(r); } }));
  ok(out2.status === 'server-refused' && /बंद वर्ष/.test(out2.message), 'a server refusal is reported as server-refused, with the Hindi reason');
  ok(rec2.length === 1 && rec2[0].outcome === 'server-refused' && rec2[0].rowsWritten === 0, 'and recorded — with nothing written');

  const mergeRpc = mkRpc(null);
  await commitRestoreLive(base(mergeRpc, { mode: 'merge' }));
  ok(JSON.stringify(mergeRpc.calls[mergeRpc.calls.length - 1].args.p_revived) === '{}', 'Merge never re-keys (it keeps the rows the society has)');

  const lockedRpc = mkRpc(null);
  const out3 = await commitRestoreLive(base(lockedRpc, { fyLocked: true }));
  ok(out3.status === 'fy-locked' && lockedRpc.calls.length === 0, 'an FY-locked society never reaches the server');
}

// ── 7. Restore Center: a backup that differs from today can be restored (BKP-01) ──
{
  const page = read('src/pages/RestoreCenter.tsx');
  ok(/const rehearsalPassed = rehearsal\?\.status === 'passed' \|\| \(rehearsal\?\.status === 'failed' && rehearsal\.restored\.balanced\);/.test(page), 'the gate is "the backup rebuilds balanced books", not "the backup equals today"');
  ok(/data-testid="rehearsal-differs-info"/.test(page), 'the difference from today is shown as information');
  ok((page.match(/rehearsalDiffers \? 'amber'|rehearsalDiffers \? 'text-amber-900'/g) || []).length >= 2, 'a balanced backup that differs is amber (information), not red (failure)');
  ok(!/from '@\/lib\/supabase'/.test(page), 'the page still never imports the database client');
  ok(/const canDryRun = \(stage === 'verified' \|\| stage === 'dry-run'\)/.test(page) && /onClick=\{handleRehearse\} disabled=\{busy \|\| !canDryRun\}/.test(page),
    'Rehearse (and a re-run of the dry run) stay available after the first dry run');
}

console.log(`restore through the server: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
