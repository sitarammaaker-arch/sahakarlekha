/**
 * Customer / supplier field rules for the QUICK create (picker dialog) — the same patterns the Customers
 * and Suppliers pages validate with, so a party made inline is never weaker than one made on its page.
 * GSTIN → state (place of supply) is derived exactly as Customers.tsx does; a GSTIN without a state would
 * send the wrong place of supply to GSTR-1, so a GSTIN always yields a state here. PURE.
 */
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const MOBILE_RE = /^[6-9][0-9]{9}$/;

export const STATES_IN: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman & Diu' }, { code: '26', name: 'Dadra & Nagar Haveli' },
  { code: '27', name: 'Maharashtra' }, { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' }, { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' },
];

export function stateFromGstin(gstin: string | null | undefined): string {
  const code = String(gstin ?? '').trim().slice(0, 2);
  return STATES_IN.find((s) => s.code === code)?.name ?? '';
}

export interface QuickParty { name: string; mobile?: string; gstin?: string; state?: string }

/** The error to show (Hindi first), or null when the quick party is valid. */
export function validateQuickParty(p: QuickParty, hi = true): string | null {
  if (!p.name.trim()) return hi ? 'नाम आवश्यक है' : 'Name is required';
  if (p.mobile && !MOBILE_RE.test(p.mobile)) return hi ? 'मोबाइल 10 अंक का (6-9 से शुरू)' : 'Mobile must be 10 digits (starting 6-9)';
  if (p.gstin) {
    if (!GSTIN_RE.test(p.gstin)) return hi ? 'GSTIN का format गलत है (15 अक्षर)' : 'Invalid GSTIN format (15 chars)';
    if (!stateFromGstin(p.gstin)) return hi ? 'GSTIN के पहले दो अंकों से राज्य नहीं मिला' : 'State not found from the GSTIN prefix';
  }
  return null;
}
