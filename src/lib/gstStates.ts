/**
 * GST state codes (first 2 digits of a GSTIN). Used to resolve the place-of-supply
 * / recipient state code for an e-Way Bill: prefer the party's GSTIN prefix; fall
 * back to their state NAME when they're unregistered (URP).
 */
export const GST_STATE_CODES: Record<string, string> = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03',
  'chandigarh': '04', 'uttarakhand': '05', 'haryana': '06', 'delhi': '07',
  'rajasthan': '08', 'uttar pradesh': '09', 'bihar': '10', 'sikkim': '11',
  'arunachal pradesh': '12', 'nagaland': '13', 'manipur': '14', 'mizoram': '15',
  'tripura': '16', 'meghalaya': '17', 'assam': '18', 'west bengal': '19',
  'jharkhand': '20', 'odisha': '21', 'orissa': '21', 'chhattisgarh': '22',
  'madhya pradesh': '23', 'gujarat': '24', 'daman and diu': '26',
  'dadra and nagar haveli and daman and diu': '26', 'maharashtra': '27',
  'karnataka': '29', 'goa': '30', 'lakshadweep': '31', 'kerala': '32',
  'tamil nadu': '33', 'puducherry': '34', 'pondicherry': '34',
  'andaman and nicobar islands': '35', 'telangana': '36', 'andhra pradesh': '37',
  'ladakh': '38',
};

/** State code from a GSTIN (its first 2 digits), or '' if not a plausible GSTIN. */
export function stateCodeFromGstin(gstin?: string): string {
  const g = (gstin || '').trim().toUpperCase();
  return /^[0-3][0-9][A-Z0-9]{13}$/.test(g) ? g.slice(0, 2) : '';
}

/** State code from a state name (case-insensitive), or '' if unknown. */
export function stateCodeFromName(name?: string): string {
  return GST_STATE_CODES[(name || '').trim().toLowerCase()] || '';
}

/**
 * Best-effort recipient state code: GSTIN prefix first (registered), else the
 * state name (unregistered), else '' so the caller can flag it as missing.
 */
export function resolveStateCode(gstin?: string, stateName?: string): string {
  return stateCodeFromGstin(gstin) || stateCodeFromName(stateName);
}
