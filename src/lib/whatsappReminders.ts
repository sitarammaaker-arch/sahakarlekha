/**
 * WhatsApp share — batch 2 (loan / KCC reminder, customer bills reminder, milk slip, milk settlement,
 * meeting notice, maintenance bill). PURE, same rules as whatsappShare.ts: Hindi-first, only what the
 * recipient already owns, never a PIN / Aadhaar / PAN / bank detail / free-text narration or remarks.
 *
 * Tested by scripts/test-whatsapp-share.mjs.
 */
import { greet, rupees, signOff } from './whatsappShare.ts';

export function loanReminderMessage(p: {
  memberName?: string; societyName?: string; loanNo: string;
  /** 'loan' = member loan (Loan Register), 'kcc' = KCC loan. */
  kind: 'loan' | 'kcc';
  /** Loan type or crop, already in Hindi where available. */
  label?: string;
  outstanding: number; interestDue?: number; dueDate?: string; overdue?: boolean;
}): string {
  const interest = Number(p.interestDue) || 0;
  const what = p.kind === 'kcc' ? 'KCC ऋण' : 'ऋण';
  return [
    greet(p.memberName),
    p.overdue ? `आपके ${what} की देय तिथि निकल चुकी है। कृपया जल्द भुगतान करें।` : `आपके ${what} के भुगतान की याद:`,
    ``,
    `ऋण नं.: ${p.loanNo}${p.label?.trim() ? ` (${p.label.trim()})` : ''}`,
    `मूलधन बकाया: ${rupees(p.outstanding)}`,
    ...(interest >= 0.005 ? [`ब्याज देय: ${rupees(interest)}`, `कुल देय: ${rupees(p.outstanding + interest)}`] : []),
    ...(p.dueDate?.trim() ? [`देय तिथि: ${p.dueDate.trim()}`] : []),
    ``,
    `भुगतान पर रसीद ज़रूर लें। कोई अंतर लगे तो समिति कार्यालय से संपर्क करें।`,
    ...signOff(p.societyName),
  ].join('\n');
}

/** Most bill lines one reminder lists; the rest are counted. */
const BILLS_MAX = 10;

/** One customer's open credit bills (as Bills Outstanding lists them) and their total. */
export function billsReminderMessage(p: {
  partyName?: string; societyName?: string; asOf: string;
  bills: { no: string; date: string; balance: number }[];
}): string {
  const bills = p.bills.filter(b => (Number(b.balance) || 0) >= 0.005);
  const total = bills.reduce((s, b) => s + (Number(b.balance) || 0), 0);
  const shown = bills.slice(0, BILLS_MAX);
  return [
    greet(p.partyName),
    `${p.asOf} तक आपके उधार बिलों का बकाया:`,
    ``,
    ...shown.map(b => `• ${b.no} (${b.date}): ${rupees(b.balance)}`),
    ...(bills.length > shown.length ? [`• और ${bills.length - shown.length} बिल`] : []),
    ``,
    `कुल बकाया: ${rupees(total)}`,
    ``,
    `कृपया समय पर भुगतान करें। भुगतान हो चुका हो तो यह संदेश अनदेखा करें।`,
    ...signOff(p.societyName),
  ].join('\n');
}

const fix = (n: number | undefined, d: number) => (Number(n) || 0).toFixed(d);

export function milkSlipMessage(p: {
  memberName?: string; societyName?: string; date: string; shift: string;
  qty: number; fat?: number; snf?: number; rate: number; amount: number;
  quality?: string;
}): string {
  const rejected = p.quality === 'rejected';
  return [
    greet(p.memberName),
    `दूध संग्रह की पर्ची:`,
    ``,
    `तारीख: ${p.date} (${p.shift === 'evening' ? 'शाम' : 'सुबह'})`,
    `मात्रा: ${fix(p.qty, 1)} लीटर`,
    ...(Number(p.fat) ? [`फ़ैट: ${fix(p.fat, 1)}%`] : []),
    ...(Number(p.snf) ? [`SNF: ${fix(p.snf, 1)}%`] : []),
    ...(rejected
      ? [``, `यह दूध गुणवत्ता जाँच में अस्वीकृत हुआ — इसका भुगतान नहीं बनेगा।`]
      : [
        `दर: ${rupees(p.rate)} प्रति लीटर`,
        `राशि: ${rupees(p.amount)}`,
        ...(p.quality === 'accepted_cut' ? [`(गुणवत्ता के कारण कटौती लगी है)`] : []),
      ]),
    ``,
    `धन्यवाद।`,
    ...signOff(p.societyName),
  ].join('\n');
}

const DEDUCTION_HI: Record<string, string> = { Feed: 'पशु आहार', Medicine: 'दवा', Advance: 'अग्रिम', Loan: 'ऋण किस्त', Other: 'अन्य' };

/** An APPROVED farmer settlement: gross − recoveries = net, then what is paid and what is still to come. */
export function milkSettlementMessage(p: {
  memberName?: string; societyName?: string; settlementNo?: string; from: string; to: string;
  gross: number; deductions: { type: string; amount: number }[]; netPayable: number; paid?: number;
}): string {
  const paid = Number(p.paid) || 0;
  const remaining = Math.max(0, +(p.netPayable - paid).toFixed(2));
  return [
    greet(p.memberName),
    `दूध भुगतान का हिसाब (${p.from} से ${p.to}):`,
    ...(p.settlementNo?.trim() ? [`हिसाब नं.: ${p.settlementNo.trim()}`] : []),
    ``,
    `दूध की कुल राशि: ${rupees(p.gross)}`,
    ...p.deductions
      .filter(d => (Number(d.amount) || 0) >= 0.005)
      .map(d => `घटाया — ${DEDUCTION_HI[d.type] ?? d.type}: ${rupees(d.amount)}`),
    `नेट देय: ${rupees(p.netPayable)}`,
    ...(paid >= 0.005 ? [`भुगतान हो चुका: ${rupees(paid)}`] : []),
    remaining >= 0.005 ? `अभी मिलना बाकी: ${rupees(remaining)}` : `पूरा भुगतान हो चुका है।`,
    ``,
    `धन्यवाद।`,
    ...signOff(p.societyName),
  ].join('\n');
}

/** Agenda longer than this is cut — the whole text rides in the wa.me URL. */
export const AGENDA_MAX = 800;

/** A scheduled meeting's notice, meant for the members' WhatsApp group (no fixed recipient). */
export function meetingNoticeMessage(p: {
  societyName?: string; typeLabel: string; meetingNo?: string; date: string; time?: string; venue?: string; agenda?: string;
}): string {
  const agenda = (p.agenda ?? '').trim();
  return [
    `सूचना — ${p.typeLabel}`,
    ...(p.societyName?.trim() ? [p.societyName.trim()] : []),
    ``,
    `सभी सदस्यों को सूचित किया जाता है कि बैठक इस प्रकार होगी:`,
    `तारीख: ${p.date}`,
    ...(p.time?.trim() ? [`समय: ${p.time.trim()}`] : []),
    ...(p.venue?.trim() ? [`स्थान: ${p.venue.trim()}`] : []),
    ...(p.meetingNo?.trim() ? [`बैठक नं.: ${p.meetingNo.trim()}`] : []),
    ...(agenda
      ? [``, `कार्यसूची:`, agenda.length > AGENDA_MAX ? `${agenda.slice(0, AGENDA_MAX)}… (पूरी कार्यसूची समिति कार्यालय में देखें)` : agenda]
      : []),
    ``,
    `कृपया समय पर उपस्थित हों।`,
  ].join('\n');
}

const MONTHS_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];

/** "2026-07" → "जुलाई 2026"; anything else is returned as it is. */
export function periodHi(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period || '');
  const i = m ? Number(m[2]) - 1 : -1;
  return m && i >= 0 && i < 12 ? `${MONTHS_HI[i]} ${m[1]}` : period;
}

export function maintenanceBillMessage(p: {
  memberName?: string; societyName?: string; billNo: string; flatNo?: string; period: string;
  amount: number; lines?: { name: string; amount: number }[]; paid?: number;
}): string {
  const paid = Number(p.paid) || 0;
  const outstanding = Math.max(0, +(p.amount - paid).toFixed(2));
  const lines = (p.lines ?? []).filter(l => l.name?.trim());
  return [
    greet(p.memberName),
    `रखरखाव बिल — ${periodHi(p.period)}`,
    ``,
    `बिल नं.: ${p.billNo}`,
    ...(p.flatNo?.trim() ? [`फ्लैट: ${p.flatNo.trim()}`] : []),
    ...(lines.length > 1 ? lines.map(l => `• ${l.name.trim()}: ${rupees(l.amount)}`) : []),
    `बिल राशि: ${rupees(p.amount)}`,
    ...(paid >= 0.005 ? [`भुगतान हो चुका: ${rupees(paid)}`] : []),
    outstanding >= 0.005 ? `अभी बाकी: ${rupees(outstanding)}` : `पूरा भुगतान हो चुका है। धन्यवाद।`,
    ...(outstanding >= 0.005 ? [``, `कृपया समय पर भुगतान करें।`] : []),
    ...signOff(p.societyName),
  ].join('\n');
}
