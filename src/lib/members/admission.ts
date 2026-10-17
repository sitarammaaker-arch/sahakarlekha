/**
 * Member-audit M2 (2026-10-16) — admission of members: the dates, the committee resolution, the refusal and the
 * clocks the Haryana Co-operative Societies Act / Rules start when an application arrives. PURE —
 * scripts/test-member-m2.mjs.
 *
 *  • Rules 1989 r.17 — an application is disposed of "as early as possible and in no case later than" one month from
 *    its receipt; a refusal is communicated with its reasons.
 *  • Act 1984 s.16, first proviso — in a credit and service society (PACS), an eligible applicant is deemed admitted
 *    60 days after the application reaches the society's office.
 *  • Act s.114(1)(c), (2) — an appeal against a refusal lies within 60 days of the decision.
 *  • Rules r.22(b) — the register records the date of entry: the admission date, not the application date.
 * The app WARNS on these (other states' rules differ); it never blocks a decision.
 */

/** Late-added member columns (migration 116). Never in the base upsert — saved in a separate step-2 update (RULE 1). */
export const MEMBER_ADMISSION_FIELDS = [
  'applicationDate', 'admissionDate', 'admissionResolutionNo', 'admissionResolutionDate', 'rejectionReason', 'decidedAt',
] as const;
export type MemberAdmissionField = typeof MEMBER_ADMISSION_FIELDS[number];

/** M5 (migration 118): gender + date of birth — also step-2, written by persistMemberProfile. */
export const MEMBER_PROFILE_FIELDS = ['gender', 'dateOfBirth'] as const;

/** Split a member row into the base columns and the step-2 admission columns (only those that carry a value). */
export function splitAdmissionFields<T extends Record<string, unknown>>(row: T): { base: Omit<T, MemberAdmissionField>; extras: Partial<Record<MemberAdmissionField, string>> } {
  const base: Record<string, unknown> = { ...row };
  const extras: Partial<Record<MemberAdmissionField, string>> = {};
  for (const f of MEMBER_ADMISSION_FIELDS) {
    if (f in base) {
      const v = base[f];
      if (v !== undefined && v !== null && v !== '') extras[f] = String(v);
      delete base[f];
    }
  }
  return { base: base as Omit<T, MemberAdmissionField>, extras };
}

const DAY = 86_400_000;
const parse = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const isIso = (d?: string): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Same day next month (clamped to the month's end): 31 Jan → 28/29 Feb. */
export function addOneMonth(date: string): string {
  const y = +date.slice(0, 4), m = +date.slice(5, 7), d = +date.slice(8, 10);
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export const isHaryana = (state?: string) => ['hr', 'haryana'].includes((state || '').trim().toLowerCase());

export interface AdmissionClock {
  receivedOn: string;
  days: number;              // whole days since receipt
  decideBy: string;          // r.17: one month from receipt
  overdue: boolean;          // past decideBy, still pending
  deemedOn?: string;         // s.16 proviso (PACS only): receipt + 60 days
  deemed: boolean;           // PACS and 60 days have passed
}

/** The r.17 / s.16 clock of a pending application, or null when no receipt date is known. */
export function admissionClock(receivedOn: string | undefined, today: string, opts: { societyType?: string } = {}): AdmissionClock | null {
  if (!isIso(receivedOn) || !isIso(today)) return null;
  const days = Math.max(0, Math.round((parse(today) - parse(receivedOn)) / DAY));
  const decideBy = addOneMonth(receivedOn);
  const pacs = opts.societyType === 'pacs';
  const deemedOn = pacs ? iso(parse(receivedOn) + 60 * DAY) : undefined;
  return { receivedOn, days, decideBy, overdue: today > decideBy, deemedOn, deemed: !!deemedOn && today >= deemedOn };
}

/** The date an application was received: the recorded one, else (older rows) the joinDate the form stamped. */
export const applicationReceivedOn = (m: { applicationDate?: string; joinDate?: string }) => m.applicationDate || m.joinDate;

export interface AdmissionDecision { admissionDate: string; resolutionNo?: string; resolutionDate?: string }

/** Approve: a real admission date (not before the application, not in the future); a missing resolution only warns. */
export function validateAdmission(d: AdmissionDecision, ctx: { receivedOn?: string; today: string }): { ok: boolean; error?: string; warnings: string[] } {
  const warnings: string[] = [];
  if (!isIso(d.admissionDate)) return { ok: false, error: 'दाख़िला तिथि भरें। (Enter the admission date.)', warnings };
  if (d.admissionDate > ctx.today) return { ok: false, error: 'दाख़िला तिथि आज के बाद की नहीं हो सकती। (Admission date cannot be in the future.)', warnings };
  if (isIso(ctx.receivedOn) && d.admissionDate < ctx.receivedOn) return { ok: false, error: 'दाख़िला तिथि आवेदन की तिथि से पहले की नहीं हो सकती। (Admission cannot precede the application.)', warnings };
  if (d.resolutionDate && !isIso(d.resolutionDate)) return { ok: false, error: 'प्रस्ताव तिथि सही नहीं है। (Invalid resolution date.)', warnings };
  if (d.resolutionDate && d.resolutionDate > ctx.today) return { ok: false, error: 'प्रस्ताव तिथि आज के बाद की नहीं हो सकती। (Resolution date cannot be in the future.)', warnings };
  if (!d.resolutionNo?.trim()) warnings.push('समिति प्रस्ताव संख्या नहीं भरी — रजिस्टर व ऑडिट के लिए भरना अच्छा रहेगा। (No committee resolution number.)');
  return { ok: true, warnings };
}

/** Reject: r.17 — the reasons are communicated, so a reason is required. */
export function validateRejection(reason: string): { ok: boolean; error?: string } {
  return reason.trim().length >= 5
    ? { ok: true }
    : { ok: false, error: 'अस्वीकृति का कारण लिखें (कम से कम 5 अक्षर) — नियम 17 के अनुसार आवेदक को कारण बताना ज़रूरी है।' };
}

/** s.114(1)(c), (2): last day to appeal against a refusal (60 days from the decision). */
export const appealLastDate = (decidedOn: string) => (isIso(decidedOn) ? iso(parse(decidedOn) + 60 * DAY) : undefined);
