/**
 * Refusal codes of the S3 posting service (migrations 077+) and their Hindi-first messages. PURE and
 * dependency-free so the payroll Edge Functions can bundle it (pay-core.entry.ts) without pulling in the
 * voucher/store code. postVoucherClient.ts re-exports these — the messages have ONE home.
 */

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
  voucher_not_found: 'यह वाउचर cloud पर नहीं मिला — page refresh करें।',
  voucher_cancelled: 'यह वाउचर रद्द हो चुका है — बदला नहीं जा सकता।',
  voucher_reversed: 'यह वाउचर reverse हो चुका है — बदला या रद्द नहीं हो सकता।',
  voucher_is_reversal: 'यह reversal वाउचर है — मूल वाउचर के बराबर रहना चाहिए, edit नहीं हो सकता।',
  engine_voucher: 'सिस्टम (engine) वाउचर — सुधार केवल reversal से होता है।',
  voucher_in_closed_fy: 'यह वाउचर बंद वित्तीय वर्ष का है — बदला या रद्द नहीं हो सकता।',
  self_approval: 'आप अपना ही बनाया वाउचर approve नहीं कर सकते — कोई दूसरा अधिकारी approve करे।',
  not_pending: 'यह वाउचर स्वीकृति के लिए रुका हुआ नहीं है।',
};

export function postVoucherMessage(code: string | null, raw?: string): string {
  const hi = code && MESSAGES[code];
  return hi ? `${hi} (${code})` : `Cloud ने वाउचर मना किया — ${raw ?? 'unknown error'}`;
}
