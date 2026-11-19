/**
 * Refusal codes of the S3 posting service (migrations 077+) and their Hindi-first messages. PURE and
 * dependency-free so the payroll Edge Functions can bundle it (pay-core.entry.ts) without pulling in the
 * voucher/store code. postVoucherClient.ts re-exports these — the messages have ONE home.
 */
import { uiLanguage } from '../uiLang.ts';

/** The `post_voucher:<code>` a refusal carries, or null for other errors. */
export function postVoucherErrorCode(message: string | undefined | null): string | null {
  const m = String(message ?? '').match(/post_voucher:(\w+)/);
  return m ? m[1] : null;
}

const MESSAGES: Record<string, string> = {
  not_a_society_user: 'आपका login किसी समिति से जुड़ा नहीं है।',
  no_role_claim: 'आपकी भूमिका (role) पता नहीं चली — एक बार logout करके फिर login करें।',
  role_cannot_write: 'आपकी भूमिका को वाउचर बनाने की अनुमति नहीं है।',
  fy_locked: 'वित्तीय वर्ष audit-locked है — वाउचर नहीं बन सकता।',
  period_locked: 'यह तारीख़ लॉक हुई अवधि में है — वाउचर नहीं बन सकता।',
  no_open_fy_for_date: 'यह तारीख़ चालू (खुले) वित्तीय वर्ष में नहीं है।',
  unbalanced: 'नाम (Dr) और जमा (Cr) बराबर नहीं हैं।',
  too_few_legs: 'वाउचर में कम से कम दो पंक्तियाँ चाहिए।',
  negative_amount: 'राशि ऋणात्मक नहीं हो सकती।',
  legs_do_not_match_voucher: 'पंक्तियों का जोड़ वाउचर की राशि से मेल नहीं खाता।',
  event_lines_differ: 'वाउचर की पंक्तियाँ और बही की entry मेल नहीं खातीं।',
  bad_event: 'बही की entry सही नहीं बनी।',
  pending_not_supported: 'स्वीकृति के लिए रुका वाउचर अभी इस रास्ते से नहीं बनता।',
  voucher_id_taken: 'यह वाउचर id पहले से किसी और का है।',
  role_cannot_delete: 'आपकी भूमिका को वाउचर रद्द करने की अनुमति नहीं है।',
  group_account: 'ग्रुप खाते में एंट्री नहीं हो सकती — इसके नीचे का कोई ledger खाता चुनें।',
  voucher_not_found: 'यह वाउचर cloud पर नहीं मिला — page refresh करें।',
  voucher_cancelled: 'यह वाउचर रद्द हो चुका है — बदला नहीं जा सकता।',
  voucher_reversed: 'यह वाउचर reverse हो चुका है — बदला या रद्द नहीं हो सकता।',
  voucher_is_reversal: 'यह reversal वाउचर है — मूल वाउचर के बराबर रहना चाहिए, edit नहीं हो सकता।',
  engine_voucher: 'सिस्टम (engine) वाउचर — सुधार केवल reversal से होता है।',
  system_voucher: 'वर्ष-समापन या Payroll run का वाउचर — यहाँ से बदला, रद्द या reverse नहीं होता। सुधार चालू वर्ष में नए वाउचर से (या Payroll पेज पर Rollback से) करें।',
  voucher_in_closed_fy: 'यह वाउचर बंद वित्तीय वर्ष का है — बदला या रद्द नहीं हो सकता।',
  self_approval: 'आप अपना ही बनाया वाउचर approve नहीं कर सकते — कोई दूसरा अधिकारी approve करे।',
  not_pending: 'यह वाउचर स्वीकृति के लिए रुका हुआ नहीं है।',
  // 183 / SEC-06
  needs_approval: 'समिति के नियम के अनुसार यह वाउचर स्वीकृति के बाद ही post होगा — page refresh करके फिर से save करें, यह स्वीकृति के लिए रुकेगा।',
  not_an_approver: 'आपकी भूमिका वाउचर approve / reject नहीं कर सकती — यह काम admin, सचिव, प्रबंधक, अध्यक्ष या बोर्ड सदस्य करते हैं।',
  no_email_claim: 'आपके login की email पता नहीं चली — एक बार logout करके फिर login करें।',
};

const MESSAGES_EN: Record<string, string> = {
  not_a_society_user: 'Your login is not linked to any society.',
  no_role_claim: 'Your role could not be found — log out once and log in again.',
  role_cannot_write: 'Your role is not allowed to create vouchers.',
  fy_locked: 'The financial year is audit-locked — the voucher cannot be created.',
  period_locked: 'This date falls in a locked period — the voucher cannot be created.',
  no_open_fy_for_date: 'This date is not in the current (open) financial year.',
  unbalanced: 'Debit (Dr) and Credit (Cr) are not equal.',
  too_few_legs: 'A voucher needs at least two lines.',
  negative_amount: 'The amount cannot be negative.',
  legs_do_not_match_voucher: 'The total of the lines does not match the voucher amount.',
  event_lines_differ: 'The voucher lines and the ledger entry do not match.',
  bad_event: 'The ledger entry was not built correctly.',
  pending_not_supported: 'A voucher waiting for approval cannot be created this way yet.',
  voucher_id_taken: 'This voucher id already belongs to another voucher.',
  role_cannot_delete: 'Your role is not allowed to cancel vouchers.',
  group_account: 'A group account cannot take entries — choose a ledger account under it.',
  voucher_not_found: 'This voucher was not found on the cloud — refresh the page.',
  voucher_cancelled: 'This voucher is already cancelled — it cannot be changed.',
  voucher_reversed: 'This voucher has been reversed — it cannot be changed or cancelled.',
  voucher_is_reversal: 'This is a reversal voucher — it must match the original voucher and cannot be edited.',
  engine_voucher: 'System (engine) voucher — it can be corrected only by a reversal.',
  system_voucher: 'A year-close or payroll-run voucher — it cannot be changed, cancelled or reversed here. Correct it with a new voucher in the open year (or by Rollback on the Payroll page).',
  voucher_in_closed_fy: 'This voucher belongs to a closed financial year — it cannot be changed or cancelled.',
  self_approval: 'You cannot approve a voucher you created — another officer must approve it.',
  not_pending: 'This voucher is not waiting for approval.',
  // 183 / SEC-06
  needs_approval: "Under the society's rules this voucher posts only after approval — refresh the page and save it again; it will wait for approval.",
  not_an_approver: 'Your role cannot approve or reject vouchers — an admin, secretary, manager, chairman or board member does this.',
  no_email_claim: 'Your login email could not be found — log out once and log in again.',
};

export function postVoucherMessage(code: string | null, raw?: string): string {
  const en = uiLanguage() === 'en';
  const msg = code && (en ? MESSAGES_EN[code] : MESSAGES[code]);
  if (msg) return `${msg} (${code})`;
  return en ? `The cloud refused the voucher — ${raw ?? 'unknown error'}` : `Cloud ने वाउचर मना किया — ${raw ?? 'unknown error'}`;
}
