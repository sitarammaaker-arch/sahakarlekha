/**
 * GST state codes (first 2 digits of a GSTIN). Used to resolve the place-of-supply
 * / recipient state code for an e-Way Bill: prefer the party's GSTIN prefix; fall
 * back to their state NAME when they're unregistered (URP).
 */
import { INDIAN_STATES } from './constants.ts'; // relative + .ts: imported by plain-node tests (no @/ loader)

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

/** State code from a state name (case-insensitive; "Jammu & Kashmir" = "jammu and kashmir"), or '' if unknown. */
export function stateCodeFromName(name?: string): string {
  return GST_STATE_CODES[(name || '').trim().toLowerCase().replace(/\s*&\s*/g, ' and ')] || '';
}

/** State code for a Society Setup state value ('hr' — INDIAN_STATES.value), or '' if unknown. */
export function stateCodeFromSetupValue(value?: string): string {
  return stateCodeFromName(INDIAN_STATES.find((s) => s.value === value)?.label);
}

/**
 * Best-effort recipient state code: GSTIN prefix first (registered), else the
 * state name (unregistered), else '' so the caller can flag it as missing.
 */
export function resolveStateCode(gstin?: string, stateName?: string): string {
  return stateCodeFromGstin(gstin) || stateCodeFromName(stateName);
}

/** The party's GSTIN, accepting both field names (`gstin` is current, `gstNo` legacy). */
export function partyGstin(party?: { gstin?: string; gstNo?: string } | null): string {
  return ((party?.gstin || party?.gstNo) || '').trim().toUpperCase();
}

/**
 * The society's OWN GST state code: GSTIN prefix first, else its state name. '' when
 * neither resolves — callers must refuse to build a GSTR-1 rather than guess a state
 * (audit C-11: the export used to hard-code '09', Uttar Pradesh, for every society).
 */
export function societyStateCode(society: { gstin?: string; state?: string }, stateLabel?: string): string {
  return stateCodeFromGstin(society.gstin) || stateCodeFromName(stateLabel || society.state);
}

/**
 * Place of supply for one outward invoice: the recipient's state (GSTIN prefix, then
 * state name), else the supplier's own state (intra-state default for an unregistered
 * recipient with no recorded location).
 */
export function placeOfSupply(recipientGstin: string | undefined, recipientState: string | undefined, supplierCode: string): string {
  return resolveStateCode(recipientGstin, recipientState) || supplierCode;
}

/**
 * RPT-09 (audit 2026-11-17): is this supply inter-state? Derived from the society's state and the party's place of
 * supply — never from the typed CGST/SGST/IGST percentages. False when either state is unknown (no basis to call it
 * inter-state; the intra-state default of placeOfSupply).
 */
export function isInterState(societyCode: string, partyGstin?: string, partyState?: string): boolean {
  if (!societyCode) return false;
  const pos = placeOfSupply(partyGstin, partyState, societyCode);
  return !!pos && pos !== societyCode;
}

/** RPT-09: the typed tax heads disagree with the place of supply (IGST on an intra-state supply or CGST/SGST across states). */
export function taxHeadMismatch(interState: boolean, heads: { cgst?: number; sgst?: number; igst?: number }): boolean {
  const local = (Number(heads.cgst) || 0) > 0.005 || (Number(heads.sgst) || 0) > 0.005;
  const inter = (Number(heads.igst) || 0) > 0.005;
  return interState ? local : inter;
}

const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();   // m = 1..12; UTC — no IST day-shift

/** RPT-08: "YYYY-MM-DD" of a month's last day, built by hand (toISOString of a local midnight lands on the day before in IST). */
export function monthLastDay(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDayOf(y, m)).padStart(2, '0')}`;
}

/**
 * RPT-08 (audit 2026-11-17): the GST return period (GSTN "MMYYYY") of a date range — only when the range is exactly ONE
 * month (1st → last day) or one calendar quarter (QRMP: the quarter's last month). The JSON used to take the from-date's
 * month whatever the range, so a whole financial year was filed as April and a 15-Jul → 14-Aug range as July.
 */
export function gstReturnPeriod(from: string, to: string): { fp: string } | { error: string } {
  const re = /^(\d{4})-(\d{2})-(\d{2})$/;
  const a = re.exec(from || ''), b = re.exec(to || '');
  if (!a || !b) return { error: 'dates' };
  const [fy, fm, fd] = [Number(a[1]), Number(a[2]), Number(a[3])];
  const [ty, tm, td] = [Number(b[1]), Number(b[2]), Number(b[3])];
  if (fd !== 1 || td !== lastDayOf(ty, tm)) return { error: 'not_whole_months' };
  const months = (ty - fy) * 12 + (tm - fm) + 1;
  const quarterStart = fm === 4 || fm === 7 || fm === 10 || fm === 1;
  if (months === 1 || (months === 3 && quarterStart)) return { fp: `${String(tm).padStart(2, '0')}${ty}` };
  return { error: 'not_one_period' };
}
