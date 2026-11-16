/**
 * Loan sureties (guarantors) — who stands surety for a member's loan, and the surety register built from it.
 *
 * A surety is recorded ON the loan (loans.sureties, jsonb): usually another member (memberId), sometimes a person
 * outside the society (name only). The register answers two questions an auditor and the committee ask:
 *   - loan-wise: who guarantees each live loan;
 *   - surety-wise: for how many loans, and how much outstanding, each person stands surety.
 *
 * Nothing here is a statutory limit. How many sureties a loan needs, and for how much one member may stand surety,
 * come from the society's bye-laws and loan rules — this module records and adds up; it does not enforce a number.
 *
 * PURE — unit-tested by scripts/test-surety-register.mjs.
 */
import type { Loan, LoanSurety } from '@/types';
import type { LedgerTable } from '@/lib/registers/ledgerTables';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const clean = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

/** Sureties as stored: a list, whatever the column held (null before the migration, a list after). */
export function loanSureties(loan: Pick<Loan, 'sureties'>): LoanSurety[] {
  return Array.isArray(loan.sureties) ? loan.sureties.filter((s) => s && (clean(s.memberId) || clean(s.name))) : [];
}

/** Trim, drop empty rows, drop repeats of the same member. What gets saved. */
export function normalizeSureties(list: readonly LoanSurety[] | undefined | null): LoanSurety[] {
  const out: LoanSurety[] = [];
  const seen = new Set<string>();
  for (const s of list ?? []) {
    const memberId = clean(s?.memberId), name = clean(s?.name), phone = clean(s?.phone), address = clean(s?.address);
    if (!memberId && !name) continue;
    const key = memberId ? `m:${memberId}` : `n:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const row: LoanSurety = { name };
    if (memberId) row.memberId = memberId;
    if (phone) row.phone = phone;
    if (address) row.address = address;
    out.push(row);
  }
  return out;
}

export type SuretyProblem = 'self' | 'duplicate' | 'noName';

/**
 * Why a surety list cannot be saved as typed, or null when it can:
 *   self      — the borrower is listed as their own surety;
 *   duplicate — the same member twice;
 *   noName    — an outside surety (no member chosen) without a name.
 */
export function suretyProblem(borrowerMemberId: string, list: readonly LoanSurety[] | undefined | null): SuretyProblem | null {
  const seen = new Set<string>();
  for (const s of list ?? []) {
    const memberId = clean(s?.memberId), name = clean(s?.name);
    if (!memberId && !name) continue;   // an empty row is simply dropped on save
    if (memberId && memberId === borrowerMemberId) return 'self';
    if (memberId) { if (seen.has(memberId)) return 'duplicate'; seen.add(memberId); }
  }
  // A row where the user started typing details but gave neither a member nor a name.
  for (const s of list ?? []) if (!clean(s?.memberId) && !clean(s?.name) && (clean(s?.phone) || clean(s?.address))) return 'noName';
  return null;
}

/** A loan that still needs its sureties: not deleted, not cleared, something outstanding. */
export function isLiveLoan(loan: Pick<Loan, 'amount' | 'repaidAmount' | 'status' | 'isDeleted'>): boolean {
  return !loan.isDeleted && loan.status !== 'cleared' && loan.amount - (loan.repaidAmount || 0) > 0.005;
}

type LoanIn = Pick<Loan, 'id' | 'loanNo' | 'memberId' | 'amount' | 'repaidAmount' | 'status' | 'isDeleted' | 'sureties'>;

/** How many live loans a member stands surety for (used to stop the member being deleted while they do). */
export function liveLoansGuaranteedBy(loans: readonly LoanIn[], memberId: string): number {
  return loans.filter((l) => isLiveLoan(l) && loanSureties(l).some((s) => s.memberId === memberId)).length;
}

export interface SuretyExposure {
  key: string;            // 'm:<memberId>' or 'n:<name>'
  memberId?: string;
  name: string;           // outside surety's name; for a member the caller resolves the name
  loans: number;          // live loans guaranteed
  outstanding: number;    // their outstanding, added up
  loanNos: string[];
}

/** Surety-wise: every person standing surety for a live loan, with the count and the outstanding guaranteed. */
export function suretyExposure(loans: readonly LoanIn[]): SuretyExposure[] {
  const map = new Map<string, SuretyExposure>();
  for (const l of loans) {
    if (!isLiveLoan(l)) continue;
    const outstanding = r2(l.amount - (l.repaidAmount || 0));
    for (const s of loanSureties(l)) {
      const key = s.memberId ? `m:${s.memberId}` : `n:${clean(s.name).toLowerCase()}`;
      let e = map.get(key);
      if (!e) { e = { key, memberId: s.memberId, name: clean(s.name), loans: 0, outstanding: 0, loanNos: [] }; map.set(key, e); }
      e.loans += 1; e.outstanding = r2(e.outstanding + outstanding); e.loanNos.push(l.loanNo);
    }
  }
  return [...map.values()].sort((a, b) => b.outstanding - a.outstanding || a.key.localeCompare(b.key));
}

/** The counts under the register's title: live loans, how many of them have no surety, and distinct sureties. */
export function suretySummary(loans: readonly LoanIn[]): { liveLoans: number; withoutSurety: number; sureties: number } {
  const live = loans.filter(isLiveLoan);
  return { liveLoans: live.length, withoutSurety: live.filter((l) => loanSureties(l).length === 0).length, sureties: suretyExposure(loans).length };
}

type MemberOf = (memberId: string) => { memberNo: string; name: string } | undefined;
const suretyName = (s: { memberId?: string; name: string }, memberOf: MemberOf) => {
  const m = s.memberId ? memberOf(s.memberId) : undefined;
  return { no: m?.memberNo ?? (s.memberId ? '' : 'Non-member'), name: m?.name || s.name || s.memberId || '' };
};

/** Loan-wise register: one line per surety of each live loan; a live loan with no surety gets one line saying so. */
export function suretyRegisterTable(loans: readonly LoanIn[], memberOf: MemberOf): LedgerTable {
  const live = loans.filter(isLiveLoan).sort((a, b) => a.loanNo.localeCompare(b.loanNo, undefined, { numeric: true }));
  const rows: (string | number)[][] = [];
  let without = 0;
  for (const l of live) {
    const b = memberOf(l.memberId);
    const outstanding = r2(l.amount - (l.repaidAmount || 0));
    const list = loanSureties(l);
    if (list.length === 0) { without++; rows.push([l.loanNo, b?.memberNo ?? '', b?.name ?? l.memberId, l.amount, outstanding, '', '— no surety recorded —']); continue; }
    list.forEach((s, i) => {
      const n = suretyName(s, memberOf);
      // Amounts only on the loan's first line, so the column adds up to the loans, not loans × sureties.
      rows.push([i === 0 ? l.loanNo : '', i === 0 ? (b?.memberNo ?? '') : '', i === 0 ? (b?.name ?? l.memberId) : '', i === 0 ? l.amount : '', i === 0 ? outstanding : '', n.no, n.name]);
    });
  }
  const totalAmount = r2(live.reduce((s, l) => s + l.amount, 0));
  const totalOut = r2(live.reduce((s, l) => s + (l.amount - (l.repaidAmount || 0)), 0));
  return {
    title: 'Surety Register — Loan-wise', titleHi: 'ज़मानतदार रजिस्टर — ऋण-वार',
    subtitle: `${live.length} live loan(s) · ${without} without a surety`,
    columns: [
      { en: 'Loan No.', hi: 'ऋण सं.' }, { en: 'Borrower No.', hi: 'ऋणी सं.' }, { en: 'Borrower', hi: 'ऋणी' },
      { en: 'Loan Amount', hi: 'ऋण राशि', num: true }, { en: 'Outstanding', hi: 'बकाया', num: true },
      { en: 'Surety No.', hi: 'ज़मानतदार सं.' }, { en: 'Surety', hi: 'ज़मानतदार' },
    ],
    rowsEn: rows, rowsHi: rows,
    totals: ['Total', '', '', totalAmount, totalOut, '', ''],
    notes: [
      { en: 'Live loans only: not deleted, not cleared, with something outstanding.', hi: 'केवल चालू ऋण: जो हटाए नहीं गए, चुकता नहीं हुए और जिन पर बकाया है।' },
      { en: 'How many sureties a loan needs is set by the society\'s bye-laws and loan rules; this register records what was entered.', hi: 'एक ऋण पर कितने ज़मानतदार चाहिए, यह समिति की उपविधि और ऋण नियम तय करते हैं; यह रजिस्टर वही दिखाता है जो दर्ज किया गया।' },
    ],
  };
}

/** Surety-wise register: each person, the live loans they stand surety for and the outstanding guaranteed. */
export function suretyExposureTable(loans: readonly LoanIn[], memberOf: MemberOf): LedgerTable {
  const ex = suretyExposure(loans);
  const rows = ex.map((e, i) => { const n = suretyName(e, memberOf); return [i + 1, n.no, n.name, e.loans, e.loanNos.join(', '), e.outstanding]; });
  return {
    title: 'Surety Register — Surety-wise', titleHi: 'ज़मानतदार रजिस्टर — ज़मानतदार-वार',
    subtitle: `${ex.length} surety(ies) on live loans`,
    columns: [
      { en: 'S.No.', hi: 'क्र.' }, { en: 'Surety No.', hi: 'ज़मानतदार सं.' }, { en: 'Surety', hi: 'ज़मानतदार' },
      { en: 'Loans', hi: 'ऋण', num: true }, { en: 'Loan Nos.', hi: 'ऋण संख्याएँ' }, { en: 'Outstanding Guaranteed', hi: 'ज़मानत में बकाया', num: true },
    ],
    rowsEn: rows, rowsHi: rows,
    // No money total: a loan with two sureties is counted under both, so the column is not a sum of loans.
    totals: ['', '', '', '', '', ''],
    notes: [
      { en: 'A loan with more than one surety appears under each of them, so this column does not add up to the total of loans.', hi: 'जिस ऋण पर एक से ज़्यादा ज़मानतदार हैं वह हर एक के नाम में गिना जाता है, इसलिए इस खाने का जोड़ कुल ऋण के बराबर नहीं होता।' },
      { en: 'Any limit on how much one member may stand surety for is set by the bye-laws; none is applied here.', hi: 'एक सदस्य कितनी राशि की ज़मानत दे सकता है, इसकी सीमा उपविधि तय करती है; यहाँ कोई सीमा लागू नहीं की गई।' },
    ],
  };
}
