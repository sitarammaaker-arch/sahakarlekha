/**
 * Re-audit 2026-10-17, stage B — the plain-Hindi reason when the SERVER refuses a member write (migration 120):
 * the one-live-number-per-society index, the FY-lock trigger, or the role-scoped RLS. Anything else falls back to
 * the generic cloud-failure text with the database message. PURE.
 */
export interface DbError { code?: string; message?: string }

export function memberWriteErrorText(error: DbError | null | undefined): string | null {
  const msg = String(error?.message ?? '');
  if (error?.code === '23505' || msg.includes('members_society_memberid_live_uq')) {
    return 'यह सदस्य संख्या पहले से किसी दूसरे सदस्य की है — नई संख्या दें। (Member number already in use.)';
  }
  if (msg.includes('members:fy_locked')) {
    return 'वित्तीय वर्ष audit-lock है — सदस्य का बदलाव नहीं हो सकता। (Financial Year is audit-locked.)';
  }
  if (error?.code === '42501' || /row-level security/i.test(msg)) {
    return 'आपकी भूमिका (role) सदस्य का रिकॉर्ड नहीं बदल सकती — admin / secretary / accountant / manager से करवाएँ। (Your role cannot change member records.)';
  }
  return null;
}
