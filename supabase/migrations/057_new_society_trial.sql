-- 057 · Phase 2a-4 — auto 30-day trial for every NEW society.
--
-- A trigger (not an RPC edit) so EVERY society-creation path is covered
-- (register_society, app_register_admin, admin provisioning) with one rule, and the
-- security-sensitive RPCs stay untouched. Fires only on rows inserted AFTER this
-- runs → the 19 existing 'legacy' societies never fire it, and `on conflict do
-- nothing` makes it safe even if a row already exists.
--
-- Trial = Starter-equivalent: 1 seat, 30 days. On expiry the app flips it to
-- read-only (a later slice); data is never deleted. Reversible via _down.

create or replace function public.tg_new_society_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions
    (society_id, plan, status, period_start, period_end, seats_limit, source, notes)
  values
    (new.id, 'trial', 'trialing', now(), now() + interval '30 days', 1, 'trial',
     'auto 30-day trial on signup')
  on conflict (society_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_new_society_trial on public.societies;
create trigger trg_new_society_trial
  after insert on public.societies
  for each row execute function public.tg_new_society_trial();
