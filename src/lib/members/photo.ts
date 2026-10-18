/**
 * Member-audit M6 (2026-10-17) — the member's photograph (Haryana Act 1984 s.40 proviso: every individual member of a
 * primary society furnishes a photograph, a permanent address and a correspondence address). Stored in the PRIVATE
 * storage bucket 'member-photos' at `<society id>/<member row id>.jpg`; the bucket's policies (migration 119) let a
 * society's own users read it and its writers change it. Pure path + validation helpers, plus a browser-only
 * downscale to a small JPEG so a phone photo (3–8 MB) becomes ~30–80 KB. Tested: scripts/test-member-m6.mjs.
 */
export const MEMBER_PHOTO_BUCKET = 'member-photos';
export const MEMBER_PHOTO_MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MEMBER_PHOTO_MAX_SIDE = 480;

/** `<society id>/<member row id>.jpg` — the first folder is what the storage policy checks against the user's society. */
export function memberPhotoPath(societyId: string, memberRowId: string): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '_');
  return `${safe(societyId)}/${safe(memberRowId)}.jpg`;
}

/**
 * Refuse what is not an image, or absurdly large, before reading it. HEIC/HEIF (iPhone's default) is refused up front:
 * most browsers cannot decode it, so the downscale would fail later with no useful message.
 */
export function photoFileError(file: { type?: string; size?: number; name?: string } | undefined): string | null {
  if (!file) return 'फ़ोटो चुनें। (Choose a photo.)';
  if (/^image\/hei[cf]/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '')) {
    return 'HEIC/HEIF फ़ोटो यहाँ नहीं खुलती। iPhone में Settings → Camera → Formats → "Most Compatible" चुनें, या फ़ोटो का screenshot लेकर JPG चुनें। (HEIC is not supported — use JPG / PNG.)';
  }
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || '')) return 'सिर्फ़ फ़ोटो (JPG / PNG / WEBP) चुनें। (Images only.)';
  if ((file.size || 0) > MEMBER_PHOTO_MAX_INPUT_BYTES) return 'फ़ोटो 10 MB से छोटी होनी चाहिए। (Max 10 MB.)';
  return null;
}

/** The scaled size that fits `max` on the longer side (never upscales). */
export function fitWithin(width: number, height: number, max = MEMBER_PHOTO_MAX_SIDE): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(width, height || 1));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** Browser only: decode, downscale to MEMBER_PHOTO_MAX_SIDE, re-encode as JPEG. */
export async function downscalePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.82));
}

/** Browser only: the downscaled photo as a JPEG data URL (for printing it on the application PDF). */
export async function photoDataUrl(file: Blob): Promise<string> {
  const small = await downscalePhoto(file);
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(small);
  });
}

/** Browser only: a stored photo (signed URL) as a data URL, for printing it on a PDF; null when it cannot be read. */
export async function urlToDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}
