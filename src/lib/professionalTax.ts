/**
 * Professional Tax by state (ECR-14 — PT auto-slab).
 *
 * PT is a state levy with different monthly slabs per state; several states (Haryana, UP,
 * Rajasthan, Delhi, Punjab, Bihar, …) have NO PT. This resolves the society's state to a
 * key and returns the monthly PT for a gross salary. Slabs are the common/simplified
 * monthly figures and the value is editable in the UI. Pure → unit-tested by
 * scripts/test-professional-tax.mjs.
 */
export type PtState = 'maharashtra' | 'karnataka' | 'westbengal' | 'madhyapradesh' | 'gujarat' | 'andhra' | 'telangana' | 'tamilnadu' | 'none';

/**
 * RM-22: society_settings.state holds the INDIAN_STATES CODE ('mh', 'ka' … — src/lib/constants.ts),
 * not the name. Matching names only made every PT state resolve to 'none', so PT always
 * auto-filled ₹0 (production 2026-09-27: 8 mh, 2 mp, 1 gj, 1 ka societies).
 */
const STATE_CODE_TO_KEY: Record<string, PtState> = {
  mh: 'maharashtra', ka: 'karnataka', wb: 'westbengal', mp: 'madhyapradesh',
  gj: 'gujarat', ap: 'andhra', tg: 'telangana', tn: 'tamilnadu',
};

/** Map a state code ('mh') or English/Hindi state name to a PT slab key ('none' = no slab known). */
export function resolveStateKey(state?: string): PtState {
  const code = (state || '').trim().toLowerCase();
  if (STATE_CODE_TO_KEY[code]) return STATE_CODE_TO_KEY[code];
  const s = code.replace(/\s+/g, '');
  const has = (...keys: string[]) => keys.some(k => s.includes(k));
  if (has('maharashtra', 'महाराष्ट्र')) return 'maharashtra';
  if (has('karnataka', 'कर्नाटक')) return 'karnataka';
  if (has('westbengal', 'बंगाल')) return 'westbengal';
  if (has('madhyapradesh', 'मध्यप्रदेश')) return 'madhyapradesh';
  if (has('gujarat', 'गुजरात')) return 'gujarat';
  if (has('telangana', 'तेलंगाना', 'तेलंगान')) return 'telangana';
  if (has('andhra', 'आंध्र')) return 'andhra';
  if (has('tamilnadu', 'तमिलनाडु')) return 'tamilnadu';
  return 'none';
}

/** Monthly professional tax for a gross salary in a given state key. */
export function professionalTax(gross: number, stateKey: PtState): number {
  const g = Math.max(0, gross || 0);
  switch (stateKey) {
    case 'maharashtra':   return g <= 7500 ? 0 : g <= 10000 ? 175 : 200;
    case 'karnataka':     return g < 25000 ? 0 : 200;
    case 'westbengal':    return g <= 10000 ? 0 : g <= 15000 ? 110 : g <= 25000 ? 130 : g <= 40000 ? 150 : 200;
    case 'madhyapradesh': return g <= 18750 ? 0 : g <= 25000 ? 125 : g <= 33333 ? 167 : 208;
    case 'gujarat':       return g < 12000 ? 0 : 200;
    case 'andhra':
    case 'telangana':     return g <= 15000 ? 0 : g <= 20000 ? 150 : 200;
    case 'tamilnadu':     return g <= 21000 ? 0 : g <= 30000 ? 100 : g <= 45000 ? 235 : 500;
    case 'none':
    default:              return 0;
  }
}

/** Convenience: PT for a gross salary given the society's state string (raw slab, unverified). */
export function professionalTaxForState(gross: number, state?: string): number {
  return professionalTax(gross, resolveStateKey(state));
}

/**
 * Slabs checked against the state's Act / notification TEXT, with the URL — a slab is only
 * auto-filled once it is here. EMPTY today: the figures above are simplified and unsourced
 * (RM-22 decision A, 2026-09-27), so no state auto-fills yet.
 */
export const PT_SLAB_SOURCES: Partial<Record<PtState, string>> = {};

export interface PtAutoFill {
  stateKey: PtState;
  /** The state has a PT slab in this file (it levies PT). */
  levies: boolean;
  /** That slab is verified against a source (PT_SLAB_SOURCES). */
  verified: boolean;
  /** What the salary row starts with: the slab when verified, otherwise ₹0 for the user to enter. */
  amount: number;
}

/** The PT a salary row should START with — never an unsourced statutory figure. */
export function ptAutoFill(gross: number, state?: string): PtAutoFill {
  const stateKey = resolveStateKey(state);
  const levies = stateKey !== 'none';
  const verified = levies && !!PT_SLAB_SOURCES[stateKey];
  return { stateKey, levies, verified, amount: verified ? professionalTax(gross, stateKey) : 0 };
}
