-- ============================================================================
-- P0-3 (L3) · loans.voucherId — link a loan to its disbursement voucher by id
-- ============================================================================
-- deleteLoan previously matched the auto-generated disbursement voucher by
-- `narration.includes(loanNo)` — a fragile substring match: deleting loan
-- "L/2026-27/1" would also match "L/2026-27/10" (its narration contains the
-- shorter number), and an edited narration breaks the link entirely.
--
-- Storing the disbursement voucher's id on the loan lets deleteLoan cancel
-- exactly that voucher. Late-added, nullable column: addLoan writes it via a
-- best-effort step-2 update (RULE 1 — the base loan upsert stays safe before this
-- migration runs), and deleteLoan falls back to the legacy narration match for
-- pre-existing loans whose voucherId is null.
-- ============================================================================

begin;

alter table loans add column if not exists "voucherId" text;

commit;
