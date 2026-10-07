/**
 * The ONE way to show an account's name. In Hindi mode prefer nameHi, but fall back to name — accounts
 * created on Ledger Heads (and older rows) often have an empty nameHi, and showing nameHi alone left a
 * blank label in the voucher account picker and the Trial Balance. PURE.
 */
export function accountDisplayName(
  acc: { name?: string | null; nameHi?: string | null } | null | undefined,
  hi: boolean,
): string {
  if (!acc) return '';
  const en = (acc.name || '').trim();
  const hn = (acc.nameHi || '').trim();
  return hi ? (hn || en) : (en || hn);
}
