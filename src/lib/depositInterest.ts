/**
 * Deposit interest calculators (Deposits module — SB/FD/RD).
 *
 * Interest a society PAYS on member deposits is an expense (Dr Interest expense / Cr the
 * deposit liability, crediting it to the member's account). These are the standard simple
 * formulas used across cooperative deposit products. Pure → unit-tested by
 * scripts/test-deposit-interest.mjs.
 */

import { toMinor, toRupees, addMinor, roundMinor } from '@/lib/money';

/** Simple interest on a principal for a number of days (365-day year). */
export function simpleInterest(principal: number, ratePct: number, days: number): number {
  // T-02: exact paise base + one disciplined rounding (roundMinor) instead of Math.round.
  return toRupees(roundMinor(toMinor(Number(principal) || 0) * (ratePct / 100) * (days / 365)));
}

/** SB — interest on the balance held for a period (days). */
export const sbInterest = (balance: number, ratePct: number, days: number): number =>
  simpleInterest(balance, ratePct, days);

/** FD — simple interest portion over a term in months. */
export function fdInterest(principal: number, ratePct: number, months: number): number {
  return toRupees(roundMinor(toMinor(Number(principal) || 0) * (ratePct / 100) * (months / 12)));
}
/** FD — maturity value = principal + interest. */
export const fdMaturityValue = (principal: number, ratePct: number, months: number): number =>
  toRupees(addMinor(toMinor(Number(principal) || 0), toMinor(fdInterest(principal, ratePct, months))));

/**
 * RD — total interest on a monthly installment R paid for n months at ratePct p.a.
 * Each installment earns interest for its remaining term (monthly rest):
 *   Σ interest = R × (rate/100/12) × n(n+1)/2
 */
export function rdInterest(installment: number, ratePct: number, months: number): number {
  return toRupees(roundMinor(toMinor(Number(installment) || 0) * (ratePct / 100 / 12) * (months * (months + 1) / 2)));
}
/** RD — maturity value = total installments + interest. */
export const rdMaturityValue = (installment: number, ratePct: number, months: number): number =>
  toRupees(addMinor(toMinor(Number(installment) || 0) * months, toMinor(rdInterest(installment, ratePct, months))));
