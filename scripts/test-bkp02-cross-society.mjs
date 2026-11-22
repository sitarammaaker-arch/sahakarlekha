// BKP-02 (product audit 2026-11-17) — an archive could not be restored into a RE-CREATED society.
// After a project loss the society registers again with a NEW id, so every archive read "different society" and the
// Restore Center refused it at the first gate — exactly when the backup is needed. Now: a different-society archive
// may be restored ONLY into a society whose books are empty (no live voucher, no member), ONLY after the archive's
// society name is typed, and its rows are moved onto the new society's id first (society_settings is KEYED by the
// society id). The server keeps refusing any row that belongs to another society (178 restore_commit, foreign_row).
// Run: node scripts/test-bkp02-cross-society.mjs
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

const A = await imp('src/lib/restore/archive.ts');
const { commitRestoreLive } = await imp('src/lib/restore/commitLive.ts');
const { buildVoucherEntries } = await imp('src/lib/voucherUtils.ts');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const OLD = '11111111-1111-4111-8111-111111111111';
const NEW = '22222222-2222-4222-8222-222222222222';
const manifest = { societyId: OLD, societyName: 'Kisan  Sewa Samiti', financialYear: '2026-27' };

// ── The gate ──
{
  const compat = A.checkCompatibility(manifest, { id: NEW, financialYear: '2026-27' });
  ok(compat.status === 'different-society' && !compat.safe && compat.archiveSocietyId === OLD, 'a re-created society still reads "different society" — never silently safe');
  const g = (o) => A.crossSocietyGate({ compat, liveVouchers: 0, liveMembers: 0, typedName: 'kisan sewa samiti', ...o });
  ok(g({}).allowed, 'empty books + the archive\'s society name typed (case / spaces ignored) → allowed');
  ok(g({ liveVouchers: 1 }).reason === 'books-not-empty' && g({ liveMembers: 3 }).reason === 'books-not-empty', 'a society with any voucher or member is refused — a live society is never overwritten');
  ok(g({ typedName: '' }).reason === 'name-not-typed' && g({ typedName: 'Kisan Samiti' }).reason === 'name-not-typed', 'without the exact name typed it is refused');
  const same = A.checkCompatibility(manifest, { id: OLD, financialYear: '2026-27' });
  ok(A.crossSocietyGate({ compat: same, liveVouchers: 0, liveMembers: 0, typedName: 'Kisan Sewa Samiti' }).reason === 'not-different-society', 'the override exists only for a different-society archive');
  ok(A.crossSocietyGate({ compat: null, liveVouchers: 0, liveMembers: 0, typedName: 'x' }).allowed === false, 'no archive → nothing to allow');
}

// ── The rebase ──
{
  const rows = {
    society: [{ id: OLD, name: 'Kisan Sewa Samiti', society_id: OLD }],
    member: [{ id: 'M1', society_id: OLD, name: 'Ram', meta: { portal: { society: OLD, keep: 'x' } }, tags: [OLD, 'y'] }],
    voucher: [{ id: 'V1', society_id: OLD, narration: `paid ${OLD}`, amount: 5 }],
  };
  const out = A.rebaseArchiveRows(rows, OLD, NEW);
  ok(out.society[0].id === NEW && out.society[0].society_id === NEW, 'society_settings (keyed by the society id) moves onto the new id — no second settings row');
  ok(out.member[0].society_id === NEW && out.member[0].meta.portal.society === NEW && out.member[0].tags[0] === NEW, 'every exact old-id value moves, at any depth (objects and arrays)');
  ok(out.voucher[0].narration === `paid ${OLD}` && out.member[0].meta.portal.keep === 'x' && out.voucher[0].amount === 5, 'text that merely CONTAINS the id, and everything else, is untouched');
  ok(rows.society[0].id === OLD && rows.member[0].meta.portal.society === OLD, 'the input is not mutated');
}

// ── A cross-society restore commits through the server, as the new society, and says where it came from ──
{
  const voucher = { id: 'V1', voucherNo: 'V-0001', society_id: OLD, isDeleted: false, amount: 0, lines: [{ id: 'L1', accountId: '1101', type: 'Dr', amount: 1500 }, { id: 'L2', accountId: '4101', type: 'Cr', amount: 1500 }] };
  const archivedEntries = buildVoucherEntries(voucher, OLD).map((e) => ({ ...e, dr: e.dr.toFixed(2), cr: e.cr.toFixed(2) }));
  const rebased = A.rebaseArchiveRows({ voucher: [voucher] }, OLD, NEW);
  const calls = [];
  const rpc = { rpc(fn, args) { calls.push({ fn, args }); return Promise.resolve({ data: { status: 'committed' }, error: null }); } };
  const recorded = [];
  let n = 0;
  const out = await commitRestoreLive({
    mode: 'replace', fyLocked: false, archiveRows: rebased, currentRows: { voucher: [] }, archivedEntries,
    societyId: NEW, sourceSocietyId: OLD, sourceManifestHash: 'H',
    preRestoreBackup: { filename: 'pre.slbak', bytes: 1, createdAt: '2026-11-19T00:00:00Z', manifestHash: 'BK' },
    auditContext: { societyId: NEW, actor: { name: 'A' } }, rpc, newId: () => `id${++n}`, recordAttempt: async (r) => { recorded.push(r); },
  });
  ok(out.status === 'committed', `the cross-society restore commits (${out.status} ${out.message ?? ''})`);
  const staged = calls.filter((c) => c.fn === 'restore_stage').flatMap((c) => c.args.p_ops).flatMap((o) => o.rows ?? []);
  ok(staged.length > 0 && staged.every((r) => r.society_id === NEW), 'every row sent to the server is the new society\'s');
  ok(recorded[0]?.sourceSocietyId === OLD && recorded[0]?.outcome === 'committed', 'the trail records which society the archive came from');
}

// ── Wiring ──
{
  const page = read('src/pages/RestoreCenter.tsx');
  ok(/const cross = crossSocietyGate\(\{ compat, liveVouchers: liveVoucherCount, liveMembers: members\.length, typedName: crossName \}\);/.test(page), 'the page asks the gate with the live voucher / member counts and the typed name');
  ok(/const compatOk = !!compat\?\.safe \|\| cross\.allowed;/.test(page) && !/!!compat\?\.safe &&/.test(page), 'dry run, rehearse and commit open on compatOk — never on a raw different-society archive');
  ok(/rebaseArchiveRows\(rows, compat\.archiveSocietyId, user\.societyId\)/.test(page) && /diffRestore\(plan\.insert, restoreRows, current, mode\)/.test(page) && /archiveRows: restoreRows,/.test(page), 'the dry run and the commit both use the rebased rows (preview = commit)');
  ok(/sourceSocietyId: cross\.allowed \? compat\?\.archiveSocietyId : undefined,/.test(page), 'the commit passes the source society for the trail');
  ok(/data-testid="cross-society-restore"/.test(page) && /किताबें अभी ख़ाली हों/.test(page) && /books are still empty/.test(page), 'the page explains the rule (Hindi first)');
  ok(/restore:foreign_row/.test(read('supabase/migrations/178_restore_commit_server.sql')), 'the server still refuses any row of another society (178)');
}

console.log(`BKP-02 cross-society restore: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
