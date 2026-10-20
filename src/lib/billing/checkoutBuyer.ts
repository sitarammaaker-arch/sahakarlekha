/**
 * Checkout buyer details for the tax invoice — the client-side check. The server (create-order →
 * _shared/invoice-core.mjs validateBuyer) is authoritative; scripts/test-checkout-buyer.mjs keeps the two
 * agreeing on every case. Relative .ts import: the test runs this file in plain Node.
 */
import { stateCodeFromGstin } from '../gstStates.ts';

export interface CheckoutBuyer {
  name: string;
  gstin: string;
  stateCode: string; // 2-digit GST state code
  address: string;
}

/** The first problem with these details, in the user's language; '' = fine. */
export function buyerProblem(b: CheckoutBuyer, hi: boolean): string {
  if (!b.name.trim()) return hi ? 'समिति का नाम भरें' : 'Enter the society name';
  if (!b.stateCode) return hi ? 'राज्य चुनें' : 'Choose the state';
  const g = b.gstin.trim().toUpperCase();
  if (g) {
    const gs = stateCodeFromGstin(g);
    if (!gs) return hi ? 'GSTIN सही नहीं — 15 अक्षर, जैसे 06AAAAA0000A1Z5' : 'GSTIN is not valid (15 characters, e.g. 06AAAAA0000A1Z5)';
    if (gs !== b.stateCode) return hi ? 'GSTIN के पहले 2 अंक चुने गए राज्य से मेल नहीं खाते' : 'The GSTIN’s first 2 digits do not match the chosen state';
  }
  return '';
}

