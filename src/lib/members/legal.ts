/**
 * Member-area re-audit 2026-10-17, stage C — the remaining Haryana Co-operative Societies Act 1984 / Rules 1989 checks,
 * as WARNINGS (founder rule: legal checks warn, never block). Every rule here was read in the text before it was
 * encoded (Act: official coop.haryana.gov.in consolidation to 2007 + Act 10 of 2013; Rules: the Indian Kanoon copy
 * of the 1989 Rules — the official PDF is a scan). PURE — scripts/test-member-stage-c.mjs.
 *
 *  • s.16(a) — an individual member must be "competent to contract" (Indian Contract Act s.11: of the age of majority,
 *    18 under the Majority Act). Warn below 18.
 *  • s.2(p) — "producer society" (producing and disposing of goods as collective property; includes collective
 *    disposal of members' labour). r.17 (one-month decision) and s.114(1)(c) (appeal against refusal) do NOT apply.
 *  • r.16 — no admission within fourteen days before the date of the annual general meeting.
 *  • s.22 — a share is transferred only after it has been held two years: counted per share, oldest first.
 *  • r.18(3) — refund base = paid-up share capital EXCLUDING Government contributions (so 1102 + 1103, not 1101).
 *  • s.114(1)(d), (2) — an expelled member may appeal within sixty days of the decision.
 *  • s.23(1)(ii), (iii) — limited liability: the share is TRANSFERRED to a qualified nominee/heir (or a qualified person
 *    they name within one month of the death); no transfer or payment without the nominee's consent.
 *  • s.40 proviso — an individual member of a primary society reports a change of photo / address to the Registrar
 *    within fifteen days.
 *  • r.27(a) — a person in default of any sum due to the society cannot stand for the committee.
 */
// No imports: node tests load this file directly (same date rules as shareRules.addTwoYears / cessation.addMonths).
function addMonths(date: string, n: number): string {
  const y0 = +date.slice(0, 4), m0 = +date.slice(5, 7) - 1 + n, d = +date.slice(8, 10);
  const y = y0 + Math.floor(m0 / 12), m = ((m0 % 12) + 12) % 12 + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
const addTwoYears = (from: string) => addMonths(from, 24);

export const MIN_MEMBER_AGE = 18;

const isIso = (d?: string): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
const DAY = 86_400_000;
const t = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const dmy = (d: string) => d.split('-').reverse().join('/');

/** Whole years on `onDate` from a date of birth. */
function yearsOn(dob: string, onDate: string): number {
  let a = +onDate.slice(0, 4) - +dob.slice(0, 4);
  if (onDate.slice(5) < dob.slice(5)) a -= 1;
  return a;
}

/** s.16(a): the applicant would be under 18 on the admission date (DOB preferred; else the recorded age). */
export function minorWarning(p: { dateOfBirth?: string; age?: number }, onDate: string): string | null {
  let age: number | undefined;
  if (isIso(p.dateOfBirth) && isIso(onDate)) age = yearsOn(p.dateOfBirth, onDate);
  else if (typeof p.age === 'number' && p.age > 0) age = p.age;
  if (age === undefined || age >= MIN_MEMBER_AGE) return null;
  return `आयु ${age} वर्ष — धारा 16(a): सदस्य "अनुबंध करने में सक्षम" होना चाहिए (भारतीय संविदा अधिनियम धारा 11: 18 वर्ष या अधिक)। नाबालिग को सदस्य न बनाएँ। (Under 18 — not competent to contract.)`;
}

/** s.2(p): a producer society (labour societies included by the definition). */
export const isProducerSociety = (societyType?: string) => societyType === 'producer' || societyType === 'labour';

/** r.16: an annual general meeting falls 0–14 days after the admission date. */
export function agmBlackoutWarning(admissionDate: string, meetings: readonly { type?: string; date?: string; status?: string }[]): string | null {
  if (!isIso(admissionDate)) return null;
  const hit = meetings
    .filter((m) => m.type === 'AGM' && m.status !== 'cancelled' && isIso(m.date))
    .map((m) => m.date as string)
    .filter((d) => { const gap = (t(d) - t(admissionDate)) / DAY; return gap >= 0 && gap <= 14; })
    .sort()[0];
  if (!hit) return null;
  return `वार्षिक आम सभा ${dmy(hit)} को है — नियम 16: आम सभा से 14 दिन पहले के भीतर किसी को सदस्य नहीं बनाया जा सकता। दाख़िला आम सभा के बाद करें। (No admission within 14 days before the AGM.)`;
}

/**
 * s.22, per share and oldest first: of a member's share-capital khata (credits = shares acquired, debits = shares
 * given up — the oldest are used up first), the amount held for at least two years on `transferDate`.
 */
export function shareHeldTwoYears(rows: readonly { date: string; credit: number; debit: number }[], transferDate: string): number {
  if (!isIso(transferDate)) return 0;
  let oldEnough = 0, out = 0;
  for (const r of rows) {
    if (!isIso(r.date)) continue;
    if (r.credit > 0 && addTwoYears(r.date) <= transferDate) oldEnough += r.credit;
    if (r.debit > 0 && r.date <= transferDate) out += r.debit;
  }
  return Math.max(0, Math.round((oldEnough - out) * 100) / 100);
}

/** s.22 warning: the transfer exceeds the shares held two years or more. */
export function transferTwoYearWarning(amount: number, heldTwoYears: number): string | null {
  if (!(amount > 0) || amount <= heldTwoYears + 0.005) return null;
  return `2 साल से पुराने शेयर सिर्फ़ ₹${heldTwoYears.toLocaleString('en-IN')} के हैं, हस्तांतरण ₹${amount.toLocaleString('en-IN')} का — हरियाणा अधिनियम धारा 22: कम से कम 2 साल रखे शेयर ही हस्तांतरित हो सकते हैं।`;
}

/** r.18(3): the share-capital heads that make the refund base — every share-capital head except Government (1101). */
export const REFUND_BASE_ACCOUNTS = ['1102', '1103'] as const;

/** s.114(1)(d), (2): the last day for an expelled member's appeal. */
export function expulsionAppealLastDate(decidedOn?: string): string | undefined {
  return isIso(decidedOn) ? new Date(t(decidedOn) + 60 * DAY).toISOString().slice(0, 10) : undefined;
}

/** s.23(1)(ii): in a limited-liability society, a qualified nominee/heir may name another qualified person within a month. */
export function deathNomineeChoiceUntil(dateOfDeath?: string): string | undefined {
  return isIso(dateOfDeath) ? addMonths(dateOfDeath, 1) : undefined;
}

/** s.40 proviso: fields whose change the member must report to the Registrar within fifteen days. */
export const S40_FIELDS = ['address', 'correspondenceAddress', 'photoPath'] as const;

export function s40ChangeReminder(changed: readonly string[]): string | null {
  if (!changed.some((f) => (S40_FIELDS as readonly string[]).includes(f))) return null;
  return 'धारा 40: फ़ोटो / पता / पत्राचार पता बदला है — सदस्य को यह बदलाव 15 दिन के भीतर रजिस्ट्रार को बताना होता है। (Report the change to the Registrar within 15 days.)';
}

/** r.27(a): candidates who may not stand because they are not on the voters roll for the election date. */
export function candidateDisqualifications<T extends { id: string; name: string }>(
  candidateIds: readonly string[],
  roll: { voters: readonly T[]; excluded: readonly { member: T; reason: string }[] },
): { id: string; name: string; reason: string }[] {
  const out: { id: string; name: string; reason: string }[] = [];
  for (const id of candidateIds) {
    if (!id || roll.voters.some((v) => v.id === id)) continue;
    const ex = roll.excluded.find((e) => e.member.id === id);
    if (!ex) continue;
    const why = ex.reason === 'defaulter' ? 'नियम 27(a): समिति का बक़ायेदार' : ex.reason === 'nominal' ? 'सहयोगी/नाममात्र सदस्य — मत का अधिकार नहीं' : ex.reason === 'ceased' ? 'सदस्यता समाप्त' : 'मतदाता सूची में नहीं';
    out.push({ id, name: ex.member.name, reason: why });
  }
  return out;
}

/** Result sanity: total of candidate votes vs votes cast vs voters, and a tie for the top place. */
export function electionResultIssues(votes: readonly number[], votesCast: number, totalVoters: number): string[] {
  const issues: string[] = [];
  const sum = votes.reduce((s, v) => s + (v || 0), 0);
  if (totalVoters > 0 && votesCast > totalVoters) issues.push(`डाले गए मत (${votesCast}) कुल मतदाताओं (${totalVoters}) से ज़्यादा हैं।`);
  if (votesCast > 0 && sum > votesCast) issues.push(`उम्मीदवारों के मतों का जोड़ (${sum}) डाले गए मतों (${votesCast}) से ज़्यादा है।`);
  const sorted = [...votes].sort((a, b) => b - a);
  if (sorted.length > 1 && sorted[0] > 0 && sorted[0] === sorted[1]) issues.push('सबसे ज़्यादा मत बराबर हैं — विजेता अपने-आप तय नहीं होगा; उपनियम / निर्वाचन नियमों के अनुसार तय करके टिप्पणी में लिखें।');
  return issues;
}
