// Bill copy with the voucher (migration 207): paths, validation, vouchers without a bill.
// Imports the REAL src/lib/voucherAttachments.ts via the "@/" loader.
// Run: node scripts/test-voucher-attachments.mjs
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathResolve(HERE, '..', 'src');
const abs = (rel) => pathToFileURL(pathResolve(HERE, rel)).href;

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath, pathToFileURL } from 'node:url';
      import { resolve as PR } from 'node:path';
      const SRC = ${JSON.stringify(SRC)};
      const EXTS = ['.ts', '.tsx', '.js', '.mjs', '.json'];
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith('@/')) {
          const b = PR(SRC, spec.slice(2));
          for (const q of [b + '.ts', b + '.tsx', b + '/index.ts', b]) if (existsSync(q)) return { url: pathToFileURL(q).href, shortCircuit: true };
        }
        if (spec.startsWith('.') && !EXTS.some((e) => spec.endsWith(e))) {
          for (const q of [spec + '.ts', spec + '/index.ts']) { const u = new URL(q, ctx.parentURL); if (existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; }
        }
        return next(spec, ctx);
      }
    `),
);

const L = await import(abs('../src/lib/voucherAttachments.ts'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗', m); } };
const MB = 1024 * 1024;

// ── paths ──
ok(L.attachmentPath('SOC-9', 'v/1', 'a1', 'JPG') === 'SOC-9/v_1/a1.jpg', 'path: society first, unsafe chars replaced, ext lower-case');
ok(L.attachmentPath('S', 'V', 'A', '') === 'S/V/A.bin', 'empty extension → bin');
ok(L.attachmentPath('../x', 'V', 'A', 'pdf').startsWith('___x/'), 'no path climbing from the society part');

// ── validation ──
ok(L.attachmentFileError(undefined) !== null, 'no file');
ok(L.attachmentFileError({ type: 'application/pdf', size: 4 * MB }) === null, 'PDF under 5 MB is fine');
ok(L.attachmentFileError({ type: 'application/pdf', size: 6 * MB }) !== null, 'PDF over 5 MB refused');
ok(L.attachmentFileError({ type: '', name: 'bill.PDF', size: 1 * MB }) === null, 'PDF known by its name when the type is empty');
ok(L.attachmentFileError({ type: 'image/jpeg', size: 12 * MB }) === null, 'a 12 MB photo is fine (it is shrunk)');
ok(L.attachmentFileError({ type: 'image/png', size: 25 * MB }) !== null, 'a 25 MB photo refused');
ok(L.attachmentFileError({ type: 'image/heic', size: 2 * MB, name: 'IMG.HEIC' }) !== null, 'HEIC refused with a clear message');
ok(L.attachmentFileError({ type: 'application/msword', size: 1000, name: 'x.doc' }) !== null, 'Word file refused');
ok(L.attachmentFileError({ type: 'image/gif', size: 1000 }) !== null, 'GIF refused');

// ── shrink size ──
const f = L.fitAttachment(4000, 3000);
ok(f.width === 1800 && f.height === 1350, `4000×3000 → 1800×1350 (got ${f.width}×${f.height})`);
const g = L.fitAttachment(1000, 600);
ok(g.width === 1000 && g.height === 600, 'never upscales');
ok(L.fitAttachment(3000, 6000).height === 1800, 'portrait: the long side is height');

ok(L.formatBytes(500) === '500 B' && L.formatBytes(2048) === '2 KB' && L.formatBytes(3.5 * MB) === '3.5 MB', 'formatBytes');

// ── grouping and the without-bill list ──
const att = (id, voucherId, o = {}) => ({ id, voucherId, path: `S/${voucherId}/${id}.jpg`, uploadedAt: `2026-05-0${id.slice(-1)}T00:00:00Z`, ...o });
const attachments = [att('a2', 'v1'), att('a1', 'v1'), att('a3', 'v2', { isDeleted: true }), att('a4', 'v4')];
const by = L.attachmentsByVoucher(attachments);
ok(by.get('v1').map(a => a.id).join() === 'a1,a2', 'grouped per voucher, oldest first');
ok(!by.has('v2'), 'a removed file does not count');

const v = (id, o = {}) => ({ id, voucherNo: id, type: 'payment', date: '2026-05-10', debitAccountId: 'x', creditAccountId: 'y', amount: 1, narration: '', createdAt: '', createdBy: '', ...o });
const vouchers = [
  v('v1'),                                   // has a bill
  v('v2'),                                   // its only bill was removed → missing
  v('v3', { type: 'purchase' }),             // purchase, no bill → missing
  v('v4', { type: 'receipt' }),              // receipt — not expected
  v('v5', { isDeleted: true }),              // cancelled
  v('v6', { approvalStatus: 'rejected' }),   // rejected
  v('v7', { date: '2026-07-01' }),           // outside a May range
  v('v8', { approvalStatus: 'pending' }),    // pending still needs its bill
];
const missing = L.vouchersWithoutBill({ vouchers, attachments });
ok(missing.map(x => x.id).join() === 'v2,v3,v7,v8', `missing: v2, v3, v7, v8 (got ${missing.map(x => x.id)})`);
ok(L.vouchersWithoutBill({ vouchers, attachments, from: '2026-05-01', to: '2026-05-31' }).map(x => x.id).join() === 'v2,v3,v8', 'date range');
ok(L.vouchersWithoutBill({ vouchers, attachments, types: ['receipt'] }).length === 0, 'a receipt with a file is not missing');

// ── the dialog never relies on a native confirm (it did nothing in the desktop app's browser pane, live 2026-11-24) ──
{
  const { readFileSync } = await import('node:fs');
  const dlg = readFileSync(new URL('../src/components/VoucherAttachmentsDialog.tsx', import.meta.url), 'utf8');
  ok(!/window\.confirm\(|[^.\w]confirm\(/.test(dlg.replace(/\/\/.*$/gm, '')), 'remove asks in the row (no window.confirm)');
  ok(dlg.includes('setConfirmId(a.id)') && dlg.includes('onClick={() => remove(a)}'), 'trash → "Remove?" → yes removes');
}

console.log(`\nVoucher attachments: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
