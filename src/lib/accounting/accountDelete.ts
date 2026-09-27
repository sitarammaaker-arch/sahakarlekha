/**
 * Account deletion safety (Phase-3 M1-4a). PURE — no I/O.
 *
 * Before account_roles is seeded (M1-4c), every way the app deletes an `accounts` row must cope
 * with the database REFUSING the delete: account_roles has a foreign key to accounts, so an
 * account that plays a role cannot be deleted (Postgres 23503). Today the delete paths remove the
 * row from local state first and only log the cloud error, so the account vanished on screen and
 * came back on F5 (RULE 1). These helpers decide what the user is told and what a COA reset may
 * safely delete.
 */

export interface DeleteResult {
  error: { code?: string; message: string } | null;
  /** Rows the DELETE actually removed (RLS turns a forbidden delete into 0 rows, not an error). */
  deleted: number | null;
}

/**
 * null when the delete really happened; otherwise the Hindi-first description for the
 * destructive toast. A 0-row delete counts as a failure — the row is still in the cloud.
 */
export function accountDeleteFailure(accountName: string, r: DeleteResult): string | null {
  const name = `"${accountName}"`;
  if (r.error) {
    if (r.error.code === '23503') {
      return `${name} किसी accounting role या दूसरे record से जुड़ा है, इसलिए cloud ने मिटाने से मना कर दिया। `
        + 'खाता वापस दिखा दिया गया है — कुछ lose नहीं हुआ। (Linked to an accounting role / another record.)';
    }
    return `${name} cloud पर नहीं मिटा — खाता वापस दिखा दिया गया है, refresh पर भी रहेगा। (${r.error.message})`;
  }
  if (r.deleted === 0) {
    return `${name} cloud पर नहीं मिटा (अनुमति नहीं मिली या पहले ही बदल चुका) — खाता वापस दिखा दिया गया है। (Nothing was deleted.)`;
  }
  return null;
}

export interface LegRef { debitAccountId?: string | null; creditAccountId?: string | null; lines?: { accountId: string }[] | null }
export interface PartyRef { name: string; accountId?: string | null }
export interface AccountRef { id: string; name: string }

export interface ResetBlocker { id: string; name: string; reason: 'voucher' | 'supplier' | 'customer' }

/**
 * A COA reset deletes every account of the society and re-inserts the template. Accounts whose id
 * is IN the template come back with the same id, so vouchers pointing at them stay valid. An
 * account OUTSIDE the template that any voucher (including cancelled ones — audits still read them,
 * RULE 3) or any supplier/customer points at would be orphaned. Returns those; empty = safe.
 */
export function coaResetBlockers(
  templateIds: ReadonlySet<string>,
  accounts: readonly AccountRef[],
  vouchers: readonly LegRef[],
  suppliers: readonly PartyRef[],
  customers: readonly PartyRef[],
): ResetBlocker[] {
  const reason = new Map<string, ResetBlocker['reason']>();
  const mark = (id: string | null | undefined, why: ResetBlocker['reason']) => {
    if (id && !templateIds.has(id) && !reason.has(id)) reason.set(id, why);
  };
  for (const v of vouchers) {
    mark(v.debitAccountId, 'voucher');
    mark(v.creditAccountId, 'voucher');
    for (const l of v.lines || []) mark(l.accountId, 'voucher');
  }
  for (const s of suppliers) mark(s.accountId, 'supplier');
  for (const c of customers) mark(c.accountId, 'customer');
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  return [...reason.entries()].map(([id, why]) => ({ id, name: names.get(id) || id, reason: why }));
}
