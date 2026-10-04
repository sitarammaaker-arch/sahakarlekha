/**
 * Report status — is this statement INTERIM (financial year still open / not audit-locked) or FINAL?
 *
 * A statement generated mid-year (e.g. FY 2026-27 printed on 4 Oct 2026) must not look like the
 * year-end audited accounts, and must not carry the auditor's "true and fair view as on 31st March"
 * certificate. `society.fyLocked` (the audit lock) is the one switch that makes a statement final.
 * Pure — no React, no DOM — so the PDF layer and the tests share it.
 */

export interface ReportStatus {
  final: boolean;
  /** FY end as ISO yyyy-mm-dd, or '' when the FY label cannot be parsed. */
  fyEnd: string;
  /** True when the year-end date has already passed but the audit lock is not applied yet. */
  yearEnded: boolean;
  en: string;
  hi: string;
}

/** "2026-27" → "2027-03-31". Also accepts "2026-2027". */
export function fyEndIso(financialYear: string | undefined): string {
  const m = /^(\d{4})\s*-\s*(\d{2}|\d{4})$/.exec((financialYear || '').trim());
  if (!m) return '';
  const start = Number(m[1]);
  const end = m[2].length === 2 ? Math.floor(start / 100) * 100 + Number(m[2]) : Number(m[2]);
  if (end !== start + 1) return '';
  return `${end}-03-31`;
}

const todayIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function reportStatus(
  society: { financialYear?: string; fyLocked?: boolean } | undefined,
  now: Date = new Date(),
): ReportStatus {
  const fyEnd = fyEndIso(society?.financialYear);
  const final = society?.fyLocked === true;
  const yearEnded = !!fyEnd && todayIso(now) > fyEnd;
  if (final) {
    return { final, fyEnd, yearEnded, en: 'Status: Final — FY closed (audit-locked)', hi: 'स्थिति: अंतिम — वर्ष बंद (ऑडिट-लॉक)' };
  }
  return {
    final, fyEnd, yearEnded,
    en: yearEnded
      ? 'Status: Interim / Unaudited — year ended, audit pending'
      : 'Status: Interim / Unaudited — financial year still open',
    hi: yearEnded
      ? 'स्थिति: अंतरिम / अलेखापरीक्षित — वर्ष समाप्त, ऑडिट शेष'
      : 'स्थिति: अंतरिम / अलेखापरीक्षित — वित्त वर्ष अभी चालू',
  };
}

/** Reports that are financial statements / books and therefore carry the status line. */
export const STATUS_REPORT_CODES: ReadonlySet<string> = new Set(['TB', 'TA', 'IE', 'RP', 'BS', 'CB', 'BB']);
