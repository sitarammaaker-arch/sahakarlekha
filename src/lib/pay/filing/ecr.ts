/**
 * PF ECR (EPFO Unified Portal) row building — PURE, so what gets filed can be tested.
 *
 * The layout itself is documented in supabase/migrations/payroll/STATUTORY-FILING-FORMATS.md and is
 * the society's to confirm against the current portal spec; nothing statutory is decided here. The
 * employer split rates are passed in (admin-entered, sourced), never hard-coded.
 */

export interface EcrLine { code: string; computedMinor: number }

export interface EcrMember {
  employeeCode: string;
  name: string;
  uan: string;
  grossMinor: number;
  paidDays: number;
  lines: EcrLine[];
}

export interface EcrRates {
  epsRate: number;              // employer EPS share, %
  employerPfRate: number;       // total employer PF share, %
  epsWageCeilingMinor: number;  // EPS wage ceiling, paise
}

export interface EcrResult {
  rows: string[];
  missingUan: string[];   // included but with no UAN — the portal will reject these
  skippedNoPf: string[];  // not EPF members this run, so not filed at all
  partMonth: string[];    // paid for less than a full month — see the note below
}

const SEP = '#~#';

/**
 * One line per EPF member. Two rules that are easy to get wrong and matter on upload:
 *
 * 1. An employee whose structure carries NO PF component is not an EPF member for this run and must
 *    not appear at all. Filing a zero row for a daily wager or an apprentice declares a membership
 *    that does not exist. A PF line that is present but zero (an admin pinned it) IS filed — that is
 *    the admin's declaration, not our inference.
 * 2. NCP is a count of days and must be a whole number. Since pay is pro-rated for a mid-month
 *    joiner, paidDays can be fractional (14.52), and an un-rounded 15.48 in this field is a file the
 *    portal will not take.
 *
 * EPF wages follow the same base the PF deduction is computed on: basic + DA (EPF & MP Act 1952 §6),
 * reduced to the paid portion of the month (EPFO counts PF on paid days only, the unpaid days being
 * the NCP reported alongside). So a part-month member's wages and their NCP tell one consistent
 * story. `partMonth` still names them, for the eye, not because anything is left undecided.
 */
export function buildEcr(members: EcrMember[], rates: EcrRates): EcrResult {
  const rows: string[] = [];
  const missingUan: string[] = [];
  const skippedNoPf: string[] = [];
  const partMonth: string[] = [];
  const rupees = (paise: number) => String(Math.round(paise / 100));

  for (const m of members) {
    const pfLine = m.lines.find((l) => l.code === 'PF');
    if (!pfLine) { skippedNoPf.push(m.employeeCode); continue; }

    const basicMinor = Number(m.lines.find((l) => l.code === 'BASIC')?.computedMinor ?? 0);
    const daMinor = Number(m.lines.find((l) => l.code === 'DA')?.computedMinor ?? 0);
    const paidFraction = Math.max(0, Math.min(30, Number(m.paidDays))) / 30;
    // basic + DA (the §6 base) for the days actually paid — the wages PF was computed on
    const epfWagesMinor = Math.round((basicMinor + daMinor) * paidFraction);
    const empPfMinor = Number(pfLine.computedMinor ?? 0);
    const epsWagesMinor = Math.min(epfWagesMinor, rates.epsWageCeilingMinor);
    const epsMinor = Math.round(epsWagesMinor * rates.epsRate / 100);
    const diffMinor = Math.max(0, Math.round(epfWagesMinor * rates.employerPfRate / 100) - epsMinor);
    const ncp = Math.min(30, Math.max(0, Math.round(30 - Number(m.paidDays))));

    if (!m.uan) missingUan.push(m.employeeCode);
    if (Number(m.paidDays) < 30) partMonth.push(m.employeeCode);

    rows.push([
      m.uan, m.name,
      rupees(Number(m.grossMinor)), rupees(epfWagesMinor), rupees(epsWagesMinor), rupees(epsWagesMinor),
      rupees(empPfMinor), rupees(epsMinor), rupees(diffMinor),
      String(ncp), '0',
    ].join(SEP));
  }

  return { rows, missingUan, skippedNoPf, partMonth };
}
