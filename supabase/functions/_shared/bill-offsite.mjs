// Off-site copy of bill files (migration 207's private bucket 'voucher-docs') — pure planning helpers used by
// scheduled-backup. The bills go to the same S3-compatible store as the archives (Backblaze B2), under
// `voucher-docs/<storage path>`, sealed with the backup key when one is set (then `.slbak` is added).
// A file already there is never sent again; each run sends at most `limit` new ones so the function stays inside its
// time budget — the rest go on the next run. Tested: scripts/test-bill-offsite.mjs.

/** The object key of a bill in the off-site bucket. */
export function billOffsiteKey(path, encrypted) {
  return `voucher-docs/${String(path).replace(/^\/+/, '')}${encrypted ? '.slbak' : ''}`;
}

/** The prefix that lists one society's bills off-site. */
export function billOffsitePrefix(societyId) {
  return `voucher-docs/${String(societyId).replace(/[^A-Za-z0-9_-]/g, '_')}/`;
}

/**
 * Which stored bills to send now. `paths` are storage paths (every row, removed bills included — their files are kept);
 * `present` is the set of keys already off-site. Returns the paths to copy (at most `limit`), and the counts.
 */
export function planBillCopies(paths, present, encrypted, limit) {
  const unique = [...new Set(paths.filter(Boolean))].sort();
  const missing = unique.filter(p => !present.has(billOffsiteKey(p, encrypted)));
  const n = Math.max(0, Math.floor(Number(limit) || 0));
  return {
    total: unique.length,
    alreadyThere: unique.length - missing.length,
    toCopy: missing.slice(0, n),
    deferred: Math.max(0, missing.length - n),
  };
}

/** Keys from one S3 ListObjectsV2 XML page, and the token for the next page (null at the end). */
export function parseListPage(xml) {
  const keys = [...String(xml).matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map(m => m[1]
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(String(xml));
  const token = truncated ? ((String(xml).match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/) || [])[1] ?? null) : null;
  return { keys, next: token };
}
