/**
 * Share-transfer premium cap (ECR-16 / MS-11) — the pure cap logic, extracted from
 * DataContext.transferShareCapital and the ShareRegister UI so it is unit-testable in one place
 * and both sites share ONE formula (CLAUDE.md RULE 2). PURE — no React, no Supabase; the society's
 * cap percentage is passed in. A premium is a payment ABOVE face value on a share transfer, capped
 * at maxPct% of the face-value amount transferred.
 */

/** Maximum premium (₹, 2dp) allowed on a transfer of `faceAmount` at a `maxPct`% cap. */
export function premiumCap(faceAmount: number, maxPct: number | undefined): number {
  return Math.round((faceAmount * (maxPct || 0) / 100) * 100) / 100;
}

/**
 * The transfer-time guard: a premium is accepted only when a cap is set (>0) AND premium ≤ cap.
 * A zero premium (plain face-value transfer) always passes, whatever the cap.
 */
export function premiumAllowed(premium: number, faceAmount: number, maxPct: number | undefined): boolean {
  const prem = Math.round(Math.max(0, premium || 0) * 100) / 100;
  if (prem === 0) return true;
  return (maxPct || 0) > 0 && prem <= premiumCap(faceAmount, maxPct);
}
