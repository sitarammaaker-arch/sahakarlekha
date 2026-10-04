/**
 * Verifiable report identity (R2, docs/research/REPORT-UNIFORMITY-STANDARD.md).
 *
 *     SL-<TYPE>-<society tag>-<yyyymmdd>-<fingerprint>      e.g.  SL-BS-0062406-20261004-3F9A21C4B7
 *
 * The old ID ended in four RANDOM characters, so the same report printed twice got two IDs and a doctored
 * print could not be told from a genuine one. The fingerprint is a hash of the document's own drawn
 * content, so: the same figures on the same day give the same ID; any changed figure gives a different one.
 *
 * It is a FINGERPRINT, not a signature — it detects a print that does not match a re-run of the report,
 * it is not tamper-proof against someone who regenerates the whole file. PURE and dependency-free.
 */

/** cyrb53 — a fast, well-distributed 53-bit string hash. Not cryptographic, and does not need to be. */
export function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** PURE — 10 upper-case hex characters of the content hash. */
export function contentFingerprint(content: string): string {
  return cyrb53(content).toString(16).toUpperCase().padStart(14, '0').slice(-10);
}

/** PURE — a short, ASCII tag identifying the society inside an ID (registration no.'s last 7 chars). */
export function societyIdTag(society: { registrationNo?: string; name?: string } | undefined | null): string {
  const reg = (society?.registrationNo ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (reg) return reg.slice(-7);
  const fromName = contentFingerprint(society?.name ?? 'society').slice(0, 6);
  return `N${fromName}`;
}

/** PURE — assemble the ID. `date` is the local calendar date the report was prepared on. */
export function makeReportId(opts: {
  code: string;
  society: { registrationNo?: string; name?: string } | undefined | null;
  date: Date;
  content: string;
}): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const ymd = `${opts.date.getFullYear()}${p(opts.date.getMonth() + 1)}${p(opts.date.getDate())}`;
  const code = opts.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'RPT';
  return `SL-${code}-${societyIdTag(opts.society)}-${ymd}-${contentFingerprint(opts.content)}`;
}
