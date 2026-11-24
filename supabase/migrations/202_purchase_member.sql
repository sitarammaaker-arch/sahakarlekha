-- 202 · Purchase from a member (सदस्य से खरीद).
--
-- WHY: the HAFED Accounts Manual (1976, paras 10.1, 10.23; heads 31.10 / 31.11) keeps purchases from members and from
-- non-members apart, because profit on marketing members' produce is exempt from income tax. That exemption is now
-- section 149 of the Income-tax Act 2025 (formerly 80P). A sale already carries the member who bought (sales.memberId);
-- a purchase had nothing, so the "member / non-member turnover" report could not tell who sold to the society.
--
-- WHAT: one nullable column. No existing row changes and no ledger is touched — it is a tag on the bill that only the
-- report reads. No foreign key, the same as sales.memberId: members are only soft-deleted, and a Replace restore must
-- not be refused by an old bill naming a member row that is gone.
--
-- Run BEFORE deploying the code: post_stock_document ignores a key with no column, so a purchase saved earlier would
-- lose its member tag without a word. Reversible: 202_purchase_member_down.sql.

alter table public.purchases add column if not exists "memberId" text;

notify pgrst, 'reload schema';

insert into public.app_migrations (version, name) values ('202', 'purchase_member')
  on conflict do nothing;

-- VERIFY: expect 1.
select count(*) as new_columns from information_schema.columns
 where table_schema = 'public' and table_name = 'purchases' and column_name = 'memberId';
