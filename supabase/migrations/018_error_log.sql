-- 018 · error_log — durable runtime-error sink (production-audit P0: operators were blind to
-- failing saves; errors only reached the browser console). The client `reportError()` seam
-- (src/lib/errorReporting.ts) inserts full message + stack here, so failures can be queried.
--
-- Insert is open to anon + authenticated (errors happen before login too). There is NO select
-- policy, so tenants can never read the log (it may hold another society's error text); only
-- the service role / project owner reads it — query it in the SQL editor. An in-app admin
-- viewer (via a SECURITY DEFINER RPC, like the platform-admin dashboards) is a follow-up.
--
-- Run once in the Supabase SQL editor after deploying the error-monitoring client change.

create table if not exists error_log (
  id          text primary key,
  society_id  text,
  source      text,
  message     text,
  stack       text,
  context     jsonb,
  url         text,
  actor_name  text,
  created_at  timestamptz not null default now()
);

alter table error_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'error_log' and policyname = 'error_log_insert') then
    create policy "error_log_insert" on error_log for insert to anon, authenticated with check (true);
  end if;
end $$;

create index if not exists error_log_created_idx on error_log (created_at desc);
