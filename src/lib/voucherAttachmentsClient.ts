// Browser side of the bill copy (migration 207): shrink a photo, upload, record the row, open, remove.
// Order (RULE 1): the FILE goes up first, then its ROW; if the row fails the file is removed again, so the bucket never
// keeps a file the app cannot list. Removing is a soft delete of the row — the file stays for the audit trail.
// The caller runs the page guards (guardPageWrite) first; the storage / table policies refuse a login that cannot write.
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/errorReporting';
import type { VoucherAttachment } from '@/types';
import {
  VOUCHER_DOCS_BUCKET, ATTACHMENT_MAX_BYTES, attachmentFileError, attachmentPath, fitAttachment, isImageType,
} from '@/lib/voucherAttachments';
import { tr } from '@/lib/uiLang';

/** Decode a photo, fit its long side to 1800 px and re-encode it as JPEG (quality 0.78). */
async function shrinkImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitAttachment(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.fillStyle = '#ffffff';                  // a transparent PNG would turn black in JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.78));
}

export type UploadResult = { ok: true; row: VoucherAttachment } | { ok: false; error: string };

export async function uploadVoucherAttachment(input: { societyId: string; voucherId: string; file: File; by?: string }): Promise<UploadResult> {
  const { societyId, voucherId, file } = input;
  if (!societyId) return { ok: false, error: tr('समिति नहीं मिली — दोबारा login करें।', 'Society not found — please log in again.') };
  const bad = attachmentFileError(file);
  if (bad) return { ok: false, error: bad };

  let body: Blob = file;
  let mimeType = file.type || 'application/pdf';
  let ext = 'pdf';
  if (isImageType(file.type)) {
    try { body = await shrinkImage(file); mimeType = 'image/jpeg'; ext = 'jpg'; }
    catch { return { ok: false, error: tr('फ़ोटो खुल नहीं पाई — दूसरी फ़ोटो या PDF चुनें।', 'The photo could not be read — choose another photo or a PDF.') }; }
  }
  if (body.size > ATTACHMENT_MAX_BYTES) return { ok: false, error: tr('छोटी करने के बाद भी फ़ाइल 5 MB से बड़ी है।', 'The file is still over 5 MB after shrinking.') };

  const id = crypto.randomUUID();
  const path = attachmentPath(societyId, voucherId, id, ext);
  const up = await supabase.storage.from(VOUCHER_DOCS_BUCKET).upload(path, body, { upsert: false, contentType: mimeType, cacheControl: '3600' });
  if (up.error) {
    reportError('voucher-attachment', up.error.message, { at: 'upload', voucherId });
    return { ok: false, error: tr(`बिल upload नहीं हुआ — ${up.error.message}`, `The bill did not upload — ${up.error.message}`) };
  }
  const row: VoucherAttachment = {
    id, voucherId, path, fileName: file.name?.slice(0, 200) || undefined, mimeType, sizeBytes: body.size,
    uploadedBy: input.by, uploadedAt: new Date().toISOString(),
  };
  const ins = await supabase.from('voucher_attachments').insert({ ...row, society_id: societyId });
  if (ins.error) {
    // RULE 1: the row is what the app lists — without it the file would be an orphan. Take the file back out.
    await supabase.storage.from(VOUCHER_DOCS_BUCKET).remove([path]);
    reportError('voucher-attachment', ins.error.message, { at: 'row insert', voucherId });
    return { ok: false, error: tr(`बिल सेव नहीं हुआ — ${ins.error.message}`, `The bill was not saved — ${ins.error.message}`) };
  }
  return { ok: true, row };
}

/** A link that works for 10 minutes (the bucket is private). */
export async function openVoucherAttachment(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(VOUCHER_DOCS_BUCKET).createSignedUrl(path, 600);
  if (error) { reportError('voucher-attachment', error.message, { at: 'signed url' }); return null; }
  return data?.signedUrl ?? null;
}

/** Soft delete: the row is marked removed; the file is kept for the audit trail. Resolves an error message or null. */
export async function removeVoucherAttachment(id: string, by?: string): Promise<string | null> {
  const { data, error } = await supabase.from('voucher_attachments')
    .update({ isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: by ?? null })
    .eq('id', id).select('id');
  const msg = error?.message ?? (data && data.length ? null : 'remove matched 0 rows');
  if (msg) reportError('voucher-attachment', msg, { at: 'soft delete', id });
  return msg;
}
