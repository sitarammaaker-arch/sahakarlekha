-- Down for 186 — drops activate_order() and orders.activated_at. Run only after the webhook is back on its old
-- two-step code (otherwise it calls a function that no longer exists).

begin;

drop function if exists public.activate_order(text, text, bigint);
alter table public.orders drop column if exists activated_at;

delete from public.app_migrations where version = '186';

commit;
