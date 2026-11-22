// Types for formulas.js (TEST-04, strict TypeScript). formulas.js stays plain JS because the prerender (Node) imports
// it too; this file describes exactly what it returns. Keep the two in step when a formula changes.

export function inr(n: number, dp?: number): string;
export function num(n: number, dp?: number): string;
export function pct(n: number, dp?: number): string;

export interface DepreciationRow { year: number; opening: number; depreciation: number; closing: number }
export function depreciation(method: 'slm' | 'wdv' | string, cost: number, ratePct: number, years: number, salvage?: number):
  { schedule: DepreciationRow[]; totalDep: number; closingValue?: number };

export function simpleInterest(principal: number, ratePct: number, years: number): { interest: number; total: number };

export interface CompoundRow { year: number; amount: number; interest: number }
export function compoundInterest(principal: number, ratePct: number, years: number, freq?: number):
  { interest: number; total: number; schedule: CompoundRow[] };

export function shareCapital(faceValue: number, numShares: number, paidPct: number, authorisedShares?: number):
  { authorised: number | null; issued: number; subscribed: number; paidUp: number };

export function gst(amount: number, ratePct: number, mode?: 'exclusive' | 'inclusive' | string):
  { base: number; gst: number; total: number; cgst: number; sgst: number };

export function tds(amount: number, ratePct: number): { tds: number; net: number };

export interface EmiMonth { month: number; principal: number; interest: number; balance: number }
export interface EmiYear { year: number; principal: number; interest: number; balance: number }
export function emi(principal: number, annualRatePct: number, months: number):
  { emi: number; interest: number; total: number; schedule: EmiMonth[]; yearly: EmiYear[] };

export function cashDifference(bookBalance: number, physicalCash: number):
  { difference: number; signed?: number; status: 'excess' | 'short' | 'match' };

export function percentage(mode: string, a: number, b: number): { result: number; change: number };

export function workingCapital(currentAssets: number, currentLiabilities: number):
  { workingCapital: number; currentRatio: number | null };
