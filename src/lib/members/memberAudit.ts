/**
 * Member-audit M1 (D4, 2026-10-16) — the audit row for a member edit: only the fields that changed, before and
 * after. Aadhaar / PAN are personal identifiers, so the row says that they changed (and whether a value is set),
 * never the number itself. PURE — scripts/test-member-m1.mjs.
 */
const PII = new Set(['aadhaar', 'pan']);
const SKIP = new Set(['id']);

const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if ((a === undefined || a === null || a === '') && (b === undefined || b === null || b === '')) return true;
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return false;
};

export function memberAuditDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (SKIP.has(key) || same(before[key], after[key])) continue;
    if (PII.has(key)) {
      b[key] = before[key] ? '(set)' : null;
      a[key] = after[key] ? '(changed)' : null;
    } else {
      b[key] = before[key] ?? null;
      a[key] = after[key] ?? null;
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}
