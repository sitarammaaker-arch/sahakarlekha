// Bill copy with the voucher (वाउचर के साथ बिल की कॉपी) — migration 207.
// Files live in the PRIVATE bucket 'voucher-docs' at `<society id>/<voucher id>/<attachment id>.<ext>`; the first
// folder is what the storage policies check. Photos are shrunk in the browser before upload (a 3–8 MB phone photo
// becomes ~150–400 KB); a PDF goes as it is, up to 5 MB.
//
// Pure: paths, validation, the "vouchers without a bill" list. No React, no Supabase (see voucherAttachmentsClient).
import type { Voucher, VoucherAttachment } from '@/types';
import { tr } from './uiLang.ts';

export const VOUCHER_DOCS_BUCKET = 'voucher-docs';
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;          // the bucket's own limit (migration 207)
export const ATTACHMENT_MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;  // a photo is shrunk first, so it may start bigger
export const ATTACHMENT_IMAGE_MAX_SIDE = 1800;                 // long side after shrinking — a bill stays readable
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_');

/** `<society>/<voucher>/<attachment>.<ext>` — every part made path-safe. */
export function attachmentPath(societyId: string, voucherId: string, attachmentId: string, ext: string): string {
  return `${safe(societyId)}/${safe(voucherId)}/${safe(attachmentId)}.${ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'}`;
}

export const isImageType = (type: string | undefined) => /^image\/(jpeg|png|webp)$/i.test(type || '');
export const isPdfType = (type: string | undefined, name?: string) => /^application\/pdf$/i.test(type || '') || (!type && /\.pdf$/i.test(name || ''));

/** Why this file cannot be added, or null. Images may be large (they are shrunk); a PDF must already fit 5 MB. */
export function attachmentFileError(file: { type?: string; size?: number; name?: string } | undefined): string | null {
  if (!file) return tr('फ़ाइल चुनें। (Choose a file.)', 'Choose a file.');
  if (/^image\/hei[cf]/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '')) {
    return tr('HEIC फ़ोटो यहाँ नहीं खुलती। iPhone में Settings → Camera → Formats → "Most Compatible" चुनें, या JPG / PDF चुनें।', 'HEIC photos do not open here. On iPhone choose Settings → Camera → Formats → "Most Compatible", or choose a JPG / PDF.');
  }
  const size = file.size || 0;
  if (isPdfType(file.type, file.name)) {
    return size > ATTACHMENT_MAX_BYTES ? tr('PDF 5 MB से छोटी होनी चाहिए। फ़ोन से बिल की फ़ोटो लें, वह अपने-आप छोटी हो जाती है।', 'The PDF must be under 5 MB. Take a photo of the bill instead — it is shrunk automatically.') : null;
  }
  if (isImageType(file.type)) {
    return size > ATTACHMENT_MAX_INPUT_IMAGE_BYTES ? tr('फ़ोटो 20 MB से छोटी होनी चाहिए।', 'The photo must be under 20 MB.') : null;
  }
  return tr('सिर्फ़ बिल की फ़ोटो (JPG / PNG / WEBP) या PDF जोड़ें।', 'Add only a photo of the bill (JPG / PNG / WEBP) or a PDF.');
}

/** The scaled size that fits `max` on the longer side (never upscales). */
export function fitAttachment(width: number, height: number, max = ATTACHMENT_IMAGE_MAX_SIDE): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(width, height || 1));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

export function formatBytes(n: number | undefined): string {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} GB`;
}

// ── storage limit per society (migration 208) ──
// The same numbers as voucher_docs_limit_bytes() in migration 208 — test:voucher-attachments keeps the two in step.
// Removed bills count too: their files are kept for the audit trail.
// Public plans: Starter / Plus / Pro. trial = Starter (the 30-day trial is Starter-equivalent); enterprise is the hidden
// contact-sales plan; legacy = the grandfathered free societies.
export const BILL_STORAGE_LIMIT_GB: Record<string, number> = { trial: 2, starter: 2, plus: 10, pro: 50, enterprise: 200, legacy: 5 };
export const DEFAULT_BILL_STORAGE_LIMIT_GB = 5;
export const billStorageLimitBytes = (plan: string | undefined): number =>
  (BILL_STORAGE_LIMIT_GB[plan ?? ''] ?? DEFAULT_BILL_STORAGE_LIMIT_GB) * 1024 * 1024 * 1024;

export interface BillStorageUsage { used: number; limit: number }

/** Why a file of `size` bytes would not fit, or null. */
export function storageLimitError(usage: BillStorageUsage | null | undefined, size: number): string | null {
  if (!usage || !(usage.limit > 0)) return null;
  if (usage.used + size <= usage.limit) return null;
  return tr(
    `बिल की storage सीमा पूरी हो गई (${formatBytes(usage.used)} / ${formatBytes(usage.limit)})। बड़ा plan लें, या support@sahakarlekha.com पर लिखें।`,
    `The bill storage limit is reached (${formatBytes(usage.used)} / ${formatBytes(usage.limit)}). Upgrade the plan, or write to support@sahakarlekha.com.`,
  );
}

/** Share of the limit in use, 0–100 (for the bar). */
export const storagePercent = (u: BillStorageUsage | null | undefined): number =>
  u && u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 1000) / 10) : 0;

/** Live attachments per voucher id. */
export function attachmentsByVoucher(rows: readonly VoucherAttachment[]): Map<string, VoucherAttachment[]> {
  const m = new Map<string, VoucherAttachment[]>();
  for (const a of rows) {
    if (a.isDeleted) continue;
    const list = m.get(a.voucherId) ?? [];
    list.push(a);
    m.set(a.voucherId, list);
  }
  for (const list of m.values()) list.sort((x, y) => x.uploadedAt.localeCompare(y.uploadedAt));
  return m;
}

/** The voucher types whose bill an auditor asks for. */
export const BILL_EXPECTED_TYPES: readonly Voucher['type'][] = ['payment', 'purchase'];

/** Vouchers in the books that should carry a bill and carry none (cancelled and rejected ones left out). */
export function vouchersWithoutBill(input: {
  vouchers: readonly Voucher[];
  attachments: readonly VoucherAttachment[];
  from?: string;
  to?: string;
  types?: readonly Voucher['type'][];
}): Voucher[] {
  const types = input.types ?? BILL_EXPECTED_TYPES;
  const has = attachmentsByVoucher(input.attachments);
  return input.vouchers.filter(v =>
    !v.isDeleted && v.approvalStatus !== 'rejected' && types.includes(v.type)
    && (!input.from || v.date >= input.from) && (!input.to || v.date <= input.to)
    && !has.get(v.id)?.length);
}
