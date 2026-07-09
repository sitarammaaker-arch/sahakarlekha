/**
 * Share-certificate lifecycle validation (ECR-16).
 *
 * A member's share certificate is issued, may be reissued (loss/damage), and can be
 * cancelled (on exit / consolidation). Pure & deterministic → unit-tested by
 * scripts/test-share-certificate.mjs.
 */
import type { ShareCertStatus } from '@/types';

export interface CertInput {
  status: ShareCertStatus;
  certNo?: string;
  count?: number;
  reason?: string;
}

export interface CertValidation {
  ok: boolean;
  error?: string;
}

/**
 * Validate a certificate action:
 *  - issued / reissued → need a certificate number and a positive share count.
 *  - reissued / cancelled → need a reason (why the change).
 */
export function validateCertificate(input: CertInput): CertValidation {
  const { status, certNo, count, reason } = input;
  if (status === 'issued' || status === 'reissued') {
    if (!certNo?.trim()) return { ok: false, error: 'प्रमाणपत्र संख्या ज़रूरी है / Certificate number required' };
    if (!(Number(count) > 0)) return { ok: false, error: 'शेयर संख्या 0 से ज़्यादा होनी चाहिए / Share count must be greater than 0' };
  }
  if ((status === 'reissued' || status === 'cancelled') && !reason?.trim()) {
    return { ok: false, error: 'कारण ज़रूरी है / Reason required' };
  }
  return { ok: true };
}
