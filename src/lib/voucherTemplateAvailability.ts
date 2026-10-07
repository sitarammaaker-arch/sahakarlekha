/**
 * Which quick-entry voucher templates can this society actually use? PURE.
 *
 * The 15 templates in storage.ts (VOUCHER_TEMPLATES) name fixed account ids — but a society's chart depends on its TYPE, and not
 * every chart has every id (e.g. no 4201 commission in PACS / consumer / sugar, no 4401 rent in PACS, no 5304 telephone in housing /
 * sugar). The page used to show all 15 to everyone and fill the ids blindly, so the button left an empty or invalid account box and
 * said nothing. A template is available only when BOTH of its accounts exist in THIS society's chart and are postable (not a group).
 *
 * The bank is a special case: a template that names the default bank id is filled with the society's REAL bank account (the page
 * swaps it in), so it is usable as soon as the society has any bank account at all.
 */
export interface TemplateLike { debitAccountId: string; creditAccountId: string }
export interface AccountLike { id: string; isGroup?: boolean }

export function templateAvailable(
  tmpl: TemplateLike,
  accounts: readonly AccountLike[],
  bankAccountIds: readonly string[],
  defaultBankId: string,
): boolean {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const usable = (id: string): boolean => {
    if (id === defaultBankId && bankAccountIds.length > 0) return true;   // the real bank account is swapped in
    const a = byId.get(id);
    return !!a && !a.isGroup;
  };
  return usable(tmpl.debitAccountId) && usable(tmpl.creditAccountId);
}

/** The templates this society can use. An empty chart (not loaded yet) shows them all rather than flashing an empty screen. */
export function availableTemplates<T extends TemplateLike>(
  templates: readonly T[],
  accounts: readonly AccountLike[],
  bankAccountIds: readonly string[],
  defaultBankId: string,
): T[] {
  if (accounts.length === 0) return [...templates];
  return templates.filter((t) => templateAvailable(t, accounts, bankAccountIds, defaultBankId));
}
