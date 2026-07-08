/**
 * Nominee validation (ECR-16 — multiple nominees).
 *
 * A member may nominate several nominees, each taking a share (%) of benefits on the
 * member's death. Cooperative rules: at least one nominee, each with a name + relation,
 * and the shares must not exceed 100%. Pure & deterministic → unit-tested by
 * scripts/test-nominees.mjs.
 */
import type { Nominee } from '@/types';

/** Sum of nominee benefit shares (%). */
export function nomineeShareTotal(nominees: Pick<Nominee, 'sharePercent'>[] | undefined): number {
  return +(nominees || []).reduce((sum, n) => sum + (n.sharePercent || 0), 0).toFixed(2);
}

export interface NomineeValidation {
  ok: boolean;
  error?: string;
  total: number;
}

/**
 * Validate a nominee list. Empty is allowed here (mandatory-at-least-one is enforced by
 * the caller, since edits of legacy members may predate nominees). Each nominee needs a
 * name + relation + positive share, and the total share must not exceed 100%.
 */
export function validateNominees(nominees: Nominee[] | undefined): NomineeValidation {
  const list = nominees || [];
  const total = nomineeShareTotal(list);
  for (const n of list) {
    if (!n.name?.trim() || !n.relation?.trim()) return { ok: false, error: 'हर नामांकित का नाम और रिश्ता ज़रूरी है / Each nominee needs a name and relation', total };
    if (!(n.sharePercent > 0)) return { ok: false, error: 'हर नामांकित का हिस्सा (%) 0 से ज़्यादा होना चाहिए / Each nominee needs a share % greater than 0', total };
  }
  if (total > 100) return { ok: false, error: `नामांकितों का कुल हिस्सा ${total}% है — 100% से ज़्यादा नहीं हो सकता / Nominee shares total ${total}% — cannot exceed 100%`, total };
  return { ok: true, total };
}
