/**
 * RPT-14 (audit 2026-11-17) — the TDS rate when the deductee has NOT given a valid PAN.
 *
 * SOURCE (the same reading the partner-payout screen already cites — AdminPayoutsPanel NO_PAN_SOURCE): Income-tax Act
 * 2025 s.397(2)(b)(i), read on incometaxindia.gov.in/web/guest/w/section-397-5 on 2026-11-14 — tax "shall be deducted at
 * the higher of the following rates:— (a) at the rate specified in the relevant provision of this Act; or (b) at the
 * rate or rates in force; or (c) at the rate of 5% where tax is required to be deducted under section 393(1) [Table:
 * Sl. No. 8(ii) or 8(v)]; or 20% in any other case".
 *
 * So: the higher of the section's own rate and 5% (Table 8 Sl.(ii) / (v) — 194Q is 8(ii)) or 20% (every other case).
 * The 2025 Act applies from 01-04-2026; for an earlier date there is no sourced value here, so the answer is null —
 * the caller says "no rule" instead of guessing (the 1961 Act's s.206AA wording is NOT in this repo). PURE.
 */
import { resolveSectionRef } from './tdsSections';

export const NO_PAN_EFFECTIVE_FROM = '2026-04-01';
export const NO_PAN_CITE =
  'Income-tax Act 2025 s.397(2)(b)(i) — no valid PAN: the higher of the section rate, the rates in force, or 5% for ' +
  '393(1) Table Sl. No. 8(ii)/8(v), else 20%. SOURCE: incometaxindia.gov.in/web/guest/w/section-397-5 (read 2026-11-14).';

/** A PAN the department would accept: 5 letters, 4 digits, 1 letter. */
export const isValidPan = (pan?: string | null): boolean => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(pan ?? '').trim().toUpperCase());

/** The no-PAN floor for a section on a date: 5 or 20 (%), or null when no sourced rule applies (before 01-04-2026). */
export function noPanFloorPct(section: string, asOf: string): number | null {
  if (!asOf || asOf < NO_PAN_EFFECTIVE_FROM) return null;
  const ref = resolveSectionRef(section.toUpperCase() as never, asOf) as { table?: string; serial?: string };
  return ref?.table === '8' && (ref.serial === 'ii' || ref.serial === 'v') ? 5 : 20;
}

/** The rate to deduct without a valid PAN: max(section rate, no-PAN floor); null when no sourced rule applies. */
export function noPanRatePct(section: string, sectionRatePct: number, asOf: string): number | null {
  const floor = noPanFloorPct(section, asOf);
  return floor === null ? null : Math.max(Number(sectionRatePct) || 0, floor);
}
