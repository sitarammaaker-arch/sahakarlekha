-- ============================================================
-- SahakarLekha — Ratings & reviews (Phase 2). Run in Supabase SQL Editor.
--
-- Reviews are just `feedback` rows with type='review' + a rating. Anyone can
-- submit (existing feedback_insert policy). They stay private until an admin
-- approves them (is_public=true) in the inbox; only then do they show on the
-- homepage — via public_reviews(), which returns ONLY safe columns (no email).
-- ============================================================

-- Public: approved reviews only, safe columns only (NO email/page_url).
create or replace function public.public_reviews()
returns table (id uuid, name text, rating int, message text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, rating, message, created_at
  from public.feedback
  where is_public = true and type = 'review' and rating is not null
  order by created_at desc
  limit 24;
$$;

revoke all on function public.public_reviews() from public;
grant execute on function public.public_reviews() to anon, authenticated;

-- Admin: approve / unpublish a review (or any feedback row).
create or replace function public.admin_feedback_set_public(
  p_email text, p_password text, p_id uuid, p_is_public boolean
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from public.verify_platform_admin(p_email, p_password)) then
    raise exception 'not authorized';
  end if;
  update public.feedback set is_public = p_is_public where id = p_id;
end;
$$;

revoke all on function public.admin_feedback_set_public(text, text, uuid, boolean) from public;
grant execute on function public.admin_feedback_set_public(text, text, uuid, boolean) to anon, authenticated;

-- Test:
--   select * from public_reviews();  -- only approved reviews (safe columns)
