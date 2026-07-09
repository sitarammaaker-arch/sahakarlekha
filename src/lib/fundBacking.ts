/**
 * Fund backing-investment coverage (ECR-27). Cooperative rules generally require statutory
 * funds (reserve / sinking / building / education) to be BACKED by earmarked investments
 * (FDRs, securities) rather than left in the running cash/bank balance. This compares the
 * total statutory-fund corpus against the total held in investment accounts and reports the
 * coverage — so an under-backed position (funds on paper, not invested) is visible.
 * PURE → unit-tested by scripts/test-fund-backing.mjs.
 */
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface FundBacking {
  fundsTotal: number;        // Σ statutory-fund corpus
  investmentsTotal: number;  // Σ investment-account balances (FDR / securities)
  coveragePct: number;       // investments ÷ funds × 100 (100 when there are no funds)
  shortfall: number;         // max(0, funds − investments) — the un-backed amount
  backed: boolean;           // investments ≥ funds (within ₹1)
}

export function fundBackingCoverage(fundsTotal: number, investmentsTotal: number): FundBacking {
  const funds = round2(fundsTotal);
  const investments = round2(investmentsTotal);
  const coveragePct = funds < 0.005 ? 100 : round2((investments / funds) * 100);
  const shortfall = round2(Math.max(0, funds - investments));
  return {
    fundsTotal: funds,
    investmentsTotal: investments,
    coveragePct,
    shortfall,
    backed: investments >= funds - 1,   // ₹1 rounding tolerance
  };
}
