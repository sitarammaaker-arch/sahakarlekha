/**
 * DB-06 (migration 199) — the plain-Hindi reason when the database refuses a voucher because it breaks a CHECK rule.
 * The raw Postgres text ('new row for relation "vouchers" violates check constraint "vouchers_date_iso"') means
 * nothing to a secretary. Anything else is returned unchanged. PURE.
 */
const REASONS: Record<string, string> = {
  vouchers_date_iso: 'तारीख़ सही नहीं है — YYYY-MM-DD (जैसे 2026-04-01) होनी चाहिए (Date must be YYYY-MM-DD)',
  vouchers_amount_nonneg: 'राशि ऋणात्मक (minus) नहीं हो सकती (Amount cannot be negative)',
  vouchers_type_known: 'वाउचर का प्रकार मान्य नहीं है (Unknown voucher type)',
  vouchers_approval_status_known: 'अनुमोदन स्थिति मान्य नहीं है (Unknown approval status)',
  voucher_entries_amounts: 'एक entry में Dr और Cr दोनों नहीं हो सकते, और कोई राशि ऋणात्मक नहीं हो सकती (An entry is either Dr or Cr, never negative)',
};

export function voucherCheckErrorText(msg: string): string {
  const s = String(msg ?? '');
  if (!/check constraint/i.test(s)) return s;
  for (const [name, reason] of Object.entries(REASONS)) if (s.includes(name)) return reason;
  return s;
}

export const VOUCHER_CHECK_NAMES = Object.keys(REASONS);
