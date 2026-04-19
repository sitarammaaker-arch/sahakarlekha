/**
 * Proforma 3 — Financial Result of Cooperative Marketing Societies
 * (District annexure — one row per society).
 *
 * Pulls live numbers from P1 (turnover, net P/L, admin expenses) and
 * P5 (sanctioned, regular, outsourced employees), plus member split
 * (farmers vs non-farmers) + society contact details.
 *
 * When used at district level (future Federation role), the parent
 * caller passes an array of {society, p1, p5, members} tuples and
 * this calculator builds the full table.
 */
import type { SocietySettings, Member } from '@/types';
import type { P1Result } from './p1Calculator';
import type { P5Result } from './p5Calculator';

export interface P3Row {
  sNo: number;
  societyName: string;
  turnover: number;              // total (from P1 row 18)
  netProfitLoss: number;         // P1 row 14
  adminExp: number;              // P1 row 12 admn + office
  sanctionedStrength: number;
  regularEmployees: number;      // society own (non-outsourced, non-deputed)
  outsourcedEmployees: number;
  businessType: string;          // Wholesale / Retail / Both
  memberFarmers: number;
  memberNonFarmers: number;
  address: string;
  email: string;
  phone: string;
  remarks: string;
}

export interface P3Inputs {
  society: SocietySettings;
  p1: P1Result;
  p5: P5Result;
  members: Member[];
  remarks?: string;
}

/** Heuristic: members whose occupation mentions farmer/किसान/कृषि/agri
 *  are counted as farmers. Others (Service/Business/etc.) are non-farmers.
 *  Undefined occupation defaults to farmer (Marketing societies are farmer-
 *  dominant by definition). */
function isFarmer(occupation?: string): boolean {
  if (!occupation) return true;
  const o = occupation.toLowerCase();
  if (/farmer|किसान|कृषि|agri|kisan|krishak|cultiv/.test(o)) return true;
  if (/service|business|clerk|teacher|driver|labour|mazdoor|नौकरी|व्यापार/.test(o)) return false;
  return true;  // default = farmer
}

export function calculateP3Row(input: P3Inputs): P3Row {
  const { society, p1, p5, members, remarks = '' } = input;

  const approved = members.filter(m =>
    (!m.approvalStatus || m.approvalStatus === 'approved') && m.status === 'active'
  );
  const memberFarmers    = approved.filter(m => isFarmer(m.occupation)).length;
  const memberNonFarmers = approved.length - memberFarmers;

  // Admin expenses = admn + office overhead
  const adminExp = p1.expenses.admn + p1.expenses.office;

  const btMap: Record<string, string> = {
    wholesale: 'Wholesale', retail: 'Retail', both: 'Both',
  };

  // Build full address from society fields
  const addressParts = [
    society.address,
    society.phone ? `Tel: ${society.phone}` : '',
  ].filter(Boolean);

  return {
    sNo: 1,
    societyName: society.name,
    turnover:           p1.turnoverTotal,
    netProfitLoss:      p1.netProfitLoss,
    adminExp,
    sanctionedStrength: p5.summary.sanctionedStrength,
    regularEmployees:   p5.summary.societyEmployees + p5.summary.hafedDeputed,
    outsourcedEmployees: p5.summary.outsourced,
    businessType:       btMap[society.businessType || ''] || '-',
    memberFarmers,
    memberNonFarmers,
    address:            addressParts.join(', '),
    email:              society.email || '',
    phone:              society.phone || '',
    remarks,
  };
}
