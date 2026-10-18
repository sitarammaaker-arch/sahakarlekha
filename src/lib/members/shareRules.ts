/**
 * Member-audit M3 (2026-10-17) — the statutory share rules, as WARNINGS (other states' Acts differ; the founder chose
 * "warn, never block" for legal checks). PURE — scripts/test-member-m3.mjs.
 *
 *  • Haryana Act 1984 s.6 — no member (other than Government / a society) holds more than one-fifth of the share
 *    capital, or more than ₹5 lakh, whichever is less. (The "prescribed portion" below one-fifth: no rule found.)
 *  • Act s.22 — a share is transferred only after it has been held for at least two years.
 *  • Rules 1989 r.18(3) — in a limited-liability society, share capital is refunded only from a share-transfer fund,
 *    and in a year not beyond 5% of the paid-up capital (Government excluded) as on the previous 31 March.
 *  • Rules r.21 — the number of nominees shall not exceed the number of shares held.
 * Data rules that ARE enforced (not law): shares go only to an active, approved member.
 */

export const SHARE_CAP_FRACTION = 1 / 5;
export const SHARE_CAP_RUPEES = 500_000;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** s.6: the most one member may hold, given the society's total share capital AFTER the move. */
export function shareHoldingLimit(totalShareCapital: number): number {
  return r2(Math.min(Math.max(0, totalShareCapital) * SHARE_CAP_FRACTION, SHARE_CAP_RUPEES));
}

/** s.6 warning for a member's holding after a purchase / transfer-in / admission. */
export function shareCapWarning(memberCapitalAfter: number, totalCapitalAfter: number): string | null {
  // A one- or two-member society always trips "one-fifth" — only meaningful once the register has some size.
  if (!(memberCapitalAfter > 0)) return null;
  const limit = shareHoldingLimit(totalCapitalAfter);
  if (memberCapitalAfter <= limit + 0.005) return null;
  const byRupees = limit >= SHARE_CAP_RUPEES - 0.005;
  return `इस सदस्य की शेयर पूँजी ₹${memberCapitalAfter.toLocaleString('en-IN')} हो जाएगी — सीमा ₹${limit.toLocaleString('en-IN')} (${byRupees ? '₹5 लाख' : 'कुल शेयर पूँजी का 1/5'}) से ज़्यादा। हरियाणा अधिनियम धारा 6: कोई सदस्य (सरकार/समिति को छोड़) 1/5 या ₹5 लाख, जो कम हो, से अधिक शेयर नहीं रख सकता।`;
}

const isIso = (d?: string): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** The date two years after `from` (29 Feb → 28 Feb). */
export function addTwoYears(from: string): string {
  const y = +from.slice(0, 4) + 2, m = +from.slice(5, 7), d = +from.slice(8, 10);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** s.22 warning: the transferor has held shares for less than two years on the transfer date. */
export function transferHoldingWarning(heldSince: string | undefined, transferDate: string): string | null {
  if (!isIso(heldSince) || !isIso(transferDate)) return null;
  const eligible = addTwoYears(heldSince);
  if (transferDate >= eligible) return null;
  return `शेयर ${heldSince.split('-').reverse().join('/')} से रखे हैं — 2 साल ${eligible.split('-').reverse().join('/')} को पूरे होंगे। हरियाणा अधिनियम धारा 22: कम से कम 2 साल रखे शेयर ही हस्तांतरित हो सकते हैं।`;
}

/** The date a member's shares are held from: the admission date, else the register's date of entry. */
export const sharesHeldSince = (m: { admissionDate?: string; joinDate?: string }) => m.admissionDate || m.joinDate;

/** Shares move only to / for a live member (data rule, enforced). */
export function canHoldShares(m: { status?: string; approvalStatus?: string; isDeleted?: boolean } | undefined): boolean {
  if (!m || m.isDeleted) return false;
  if (m.approvalStatus === 'pending' || m.approvalStatus === 'rejected') return false;
  return m.status === 'active' || m.status === 'inactive';
}

/** The previous 31 March for a date (the r.18(3) base date). */
export function previousMarch31(date: string): string {
  const y = +date.slice(0, 4), m = +date.slice(5, 7);
  return `${m >= 4 ? y : y - 1}-03-31`;
}

/** r.18(3) warning: refunds this year (incl. this one) beyond 5% of the paid-up capital on the previous 31 March. */
export function refundLimitWarning(opts: { paidUpOnBaseDate: number; refundedThisYear: number; thisRefund: number; baseDate: string }): string | null {
  const limit = r2(Math.max(0, opts.paidUpOnBaseDate) * 0.05);
  const total = r2(opts.refundedThisYear + opts.thisRefund);
  if (!(opts.paidUpOnBaseDate > 0) || total <= limit + 0.005) return null;
  return `इस वर्ष की कुल शेयर वापसी ₹${total.toLocaleString('en-IN')} हो जाएगी — ${opts.baseDate.split('-').reverse().join('/')} की चुकता पूँजी (₹${opts.paidUpOnBaseDate.toLocaleString('en-IN')}) के 5% (₹${limit.toLocaleString('en-IN')}) से ज़्यादा। हरियाणा नियम 18(3): सीमित दायित्व समिति में वापसी सिर्फ़ शेयर-हस्तांतरण कोष से और 5% तक।`;
}

/** r.21 warning: more nominees than shares held. */
export function nomineeCountWarning(nomineeCount: number, shareCount: number | undefined): string | null {
  if (!(shareCount && shareCount > 0) || nomineeCount <= shareCount) return null;
  return `${nomineeCount} नामांकित हैं पर शेयर सिर्फ़ ${shareCount} — नियम 21: नामांकितों की संख्या शेयरों की संख्या से ज़्यादा नहीं हो सकती।`;
}

/**
 * Re-audit leftovers (2026-10-18): the two short nominee editors (Share Register, Nomination Register) edit only the
 * primary nominee's name / relation / phone. Count the nominees as the Members form does (primary + additional), so
 * the same r.21 warning shows everywhere.
 */
export function nomineeCountAfterEdit(nominees: readonly { name?: string; role?: string }[] | undefined, primaryName: string): number {
  const additional = (nominees ?? []).filter((n) => n.role !== 'primary' && n.name?.trim()).length;
  return (primaryName.trim() ? 1 : 0) + additional;
}

/**
 * …and keep nominees[]'s primary entry (the canonical list the Members form writes) in step with the flat fields the
 * short editors change: update it, or drop it when the name is cleared. Without a primary entry nothing is added —
 * the full form (Members → edit) builds it with the father's name / age / address.
 */
export function syncPrimaryNominee<N extends { name: string; relation: string; phone?: string; role?: string }>(
  nominees: readonly N[] | undefined, edit: { name: string; relation: string; phone: string },
): N[] | undefined {
  if (!nominees?.some((n) => n.role === 'primary')) return undefined;
  const name = edit.name.trim();
  return nominees.flatMap((n) => (n.role !== 'primary' ? [n] : name ? [{ ...n, name, relation: edit.relation.trim(), phone: edit.phone.trim() || undefined }] : []));
}

/** Members page deep link that opens the member's full edit form (all nominee fields + checks). */
export const memberEditLink = (memberRowId: string) => `/members?edit=${encodeURIComponent(memberRowId)}`;

/** Share-certificate numbers are unique in a society (data rule): the other member already holding `certNo`. */
export function certificateNoTakenBy<M extends { id: string; shareCertNo?: string; isDeleted?: boolean }>(members: readonly M[], certNo: string, selfId: string): M | undefined {
  const key = certNo.trim().toLowerCase();
  if (!key) return undefined;
  return members.find((m) => m.id !== selfId && !m.isDeleted && (m.shareCertNo || '').trim().toLowerCase() === key);
}

/**
 * Final batch (prod read-only check 2026-10-18): two members' share khata disagreed with their share capital
 * because MANUAL vouchers (Vouchers page) on Share Capital 1102 were tagged to the member — a manual voucher never
 * moves member.shareCapital, so register and ledger drift apart. A member's share moves only through the Share
 * Register (purchase / refund / transfer / share operations), which posts the voucher AND moves the share.
 */
export function touchesShareCapital(v: { debitAccountId?: string; creditAccountId?: string; lines?: readonly { accountId: string }[] }, shareCapAccountId = '1102'): boolean {
  return v.debitAccountId === shareCapAccountId || v.creditAccountId === shareCapAccountId
    || (v.lines ?? []).some((l) => l.accountId === shareCapAccountId);
}

export const MANUAL_MEMBER_SHARE_VOUCHER_MESSAGE = 'सदस्य के नाम पर शेयर पूँजी (1102) का वाउचर यहाँ से नहीं बनता — सदस्य का शेयर "शेयर रजिस्टर" से ख़रीदें/वापस करें/हस्तांतरित करें, ताकि सदस्य की शेयर राशि और बही साथ बदलें। (Member share moves go through the Share Register.)';
