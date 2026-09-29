#!/usr/bin/env node
// S3-d-2 · the app side of edit_voucher / cancel_voucher: unit tests of buildEditVoucherPayload plus
// static checks of the updateVoucher / cancelVoucher wiring (flag-gated, revert on failure, server
// events swapped in) and of restore being disabled everywhere (founder decision A). CI-safe.
// The same payload against a real restored DB: scripts/db-harness/tests/s3d-edit-cancel-voucher.mjs.
//
// Run: node scripts/test-s3d2-wire-edit-cancel.mjs

import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
register('data:text/javascript,' + encodeURIComponent(`
  import { existsSync } from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { resolve as PR } from 'node:path';
  const SRC = ${JSON.stringify(SRC)}; const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const b = PR(SRC, spec.slice(2)); for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true }; }
    if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) { for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } }
    return next(spec, ctx);
  }`));
const { buildEditVoucherPayload, postVoucherMessage } = await import(pathToFileURL(pathResolve(SRC, 'lib/ledger/postVoucherClient.ts')).href);

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

console.log('buildEditVoucherPayload');
const v = { id: 'v1', voucherNo: 'JV/1', type: 'journal', date: '2026-06-10', debitAccountId: '5301', creditAccountId: '3301', amount: 12.34, narration: 'n',
  memberId: 'm1', editHistory: [{ editedAt: 'x' }], society_id: 'SPOOF', isDeleted: false, createdBy: 'u', origin: 'manual', reversedBy: undefined };
const p = buildEditVoucherPayload(v);
ok('carries only the editable fields', Object.keys(p.p_voucher).sort().join() === ['amount', 'creditAccountId', 'date', 'debitAccountId', 'editHistory', 'id', 'memberId', 'narration', 'type'].join(), Object.keys(p.p_voucher).join());
ok('never sends society_id / isDeleted / voucherNo / createdBy', !['society_id', 'isDeleted', 'voucherNo', 'createdBy', 'origin'].some((k) => k in p.p_voucher));
ok('legs from getVoucherLines: Dr 5301 / Cr 3301, 1234 paise', p.p_lines.length === 2 && p.p_lines[0].accountId === '5301' && p.p_lines[0].drCr === 'Dr'
  && p.p_lines[1].drCr === 'Cr' && p.p_lines.every((l) => l.amountMinor === 1234));
const m = buildEditVoucherPayload({ ...v, amount: 3, lines: [{ id: 'a', accountId: '5301', type: 'Dr', amount: 1.5 }, { id: 'b', accountId: '5202', type: 'Dr', amount: 1.5 }, { id: 'c', accountId: '3301', type: 'Cr', amount: 3 }] });
ok('multi-line: lines kept in the voucher, 3 balanced legs with their ids', Array.isArray(m.p_voucher.lines) && m.p_lines.map((l) => `${l.id}:${l.drCr}:${l.amountMinor}`).join() === 'a:Dr:150,b:Dr:150,c:Cr:300');
ok('new refusal codes have Hindi messages', ['role_cannot_delete', 'voucher_not_found', 'voucher_cancelled', 'voucher_reversed', 'engine_voucher', 'voucher_in_closed_fy']
  .every((c) => /[ऀ-ॿ]/.test(postVoucherMessage(c))));

console.log('DataContext wiring');
const dc = readFileSync(pathResolve(SRC, 'contexts/DataContext.tsx'), 'utf8');
const between = (from, to) => { const a = dc.indexOf(from); return dc.slice(a, dc.indexOf(to, a)); };
const upd = between('const updateVoucher = useCallback(', 'const cancelVoucher = useCallback(');
const updRpc = upd.slice(upd.indexOf('// ── S3-d posting service'), upd.indexOf('// ── journal-first-write (slice 6)'));
ok('updateVoucher: RPC branch sits before the journal-first and default paths', updRpc.length > 200);
ok('updateVoucher: gated on the flag and a non-pending voucher', /if \(postingServiceRef\.current && current\.approvalStatus !== 'pending'\)/.test(updRpc));
ok("updateVoucher: calls edit_voucher with the lib payload", /supabase\.rpc\('edit_voucher', \{ \.\.\.p, p_producer:/.test(updRpc) && /buildEditVoucherPayload\(updatedVoucher\)/.test(updRpc));
ok('updateVoucher: error AND network rejection → revertEdit + destructive toast + reportError', (updRpc.match(/revertEdit\(\)/g) || []).length === 2 && /variant: 'destructive', duration: 15000/.test(updRpc) && /reportError\('voucher-edit-post-service'/.test(updRpc));
ok("updateVoucher: the server's events replace the optimistic edit events", /mapLedgerEventRows\(/.test(updRpc) && /filter\(e => !editEvents\.some\(x => x\.eventId === e\.eventId\)\), \.\.\.serverEvents\]/.test(updRpc));
ok('updateVoucher: RPC branch never calls persistVoucher / syncEntries / persistLedgerEvent', !/persistVoucher\(|syncEntries\(|persistLedgerEvent\(/.test(updRpc));
ok('updateVoucher: RPC branch returns true (guards already passed)', /return true;\s*\}\s*$/.test(updRpc));
ok('updateVoucher: flag-off default path unchanged', /persistVoucher\(updatedVoucher, \{\s*isUpdate: true,[\s\S]*?onBaseSuccess: \(\) => \{ for \(const e of editEvents\) persistLedgerEvent\(e\); \},\s*onBaseFail: revertEdit,/.test(upd));

const can = between('const cancelVoucher = useCallback(', 'const reverseVoucher = useCallback(');
const canRpc = can.slice(can.indexOf('// ── S3-d posting service'), can.indexOf('// ── journal-first-write (slice 6)'));
ok('cancelVoucher: RPC branch after every business guard and before the other paths', canRpc.length > 200 && can.indexOf('// ── S3-d posting service') > can.indexOf("current.refType === 'wage.accrual'"));
ok('cancelVoucher: calls cancel_voucher(id, reason, deletedBy)', /supabase\.rpc\('cancel_voucher', \{ p_id: id, p_reason: reason, p_deleted_by: deletedBy \?\? null \}\)/.test(canRpc));
ok('cancelVoucher: error AND network rejection → un-cancel + destructive toast + reportError', (canRpc.match(/undoCancel\(\)/g) || []).length === 2 && /variant: 'destructive', duration: 15000/.test(canRpc) && /reportError\('voucher-cancel-post-service'/.test(canRpc));
ok("cancelVoucher: the server's event replaces the optimistic cancel event", /filter\(e => e\.eventId !== cancelEvent\?\.eventId\), \.\.\.serverEvents\]/.test(canRpc));
ok('cancelVoucher: RPC branch never writes vouchers / voucher_entries / events itself', !/from\('vouchers'\)|deleteEntries\(|persistLedgerEvent\(|ensureVoucherCancelEvent\(/.test(canRpc));
ok('cancelVoucher: flag-off default path unchanged', /supabase\.from\('vouchers'\)\.update\(\{ isDeleted: true, deletedAt: cancelledVoucher\.deletedAt, deletedBy, deletedReason: reason \}\)\.eq\('id', id\)\.then\(\(\{ error \}\) => \{\s*if \(error\) \{/.test(can));

console.log('Restore disabled everywhere (founder decision A, 2026-09-29)');
const res = between('const restoreVoucher = useCallback(', 'const clearVoucher = useCallback(');
ok('restoreVoucher only refuses: Hindi toast + return false, no write at all', /const restoreVoucher = useCallback\(\(_id: string\): boolean =>/.test(res) && /रद्द वाउचर वापस नहीं आता/.test(res)
  && /return false;/.test(res) && !/supabase|syncEntries|setVouchersState|return true/.test(res));
ok('context type still returns boolean', /restoreVoucher: \(id: string\) => boolean;/.test(dc));
const dv = readFileSync(pathResolve(SRC, 'pages/DeletedVouchers.tsx'), 'utf8');
const vp = readFileSync(pathResolve(SRC, 'pages/Vouchers.tsx'), 'utf8');
ok('no Restore button on the Cancelled-vouchers page', !/restoreVoucher|RotateCcw|पुनर्स्थापित/.test(dv));
ok('no Restore button in the Vouchers list; cancel only for live vouchers', !/restoreVoucher|RotateCcw/.test(vp) && /\{canDelete && !cancelled && \(/.test(vp));
ok('bulk-cancel copy no longer promises a restore', !/restore हो सकते हैं|can be restored/.test(vp) && /restore नहीं होंगे/.test(vp));

console.log(`\nS3-d-2 edit/cancel wiring: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
