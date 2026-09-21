-- ============================================================
-- SahakarLekha — Blog post view counter. Run in Supabase SQL Editor.
--
-- Public blog (no auth). Each post has a shared, persistent view count.
--   • blog_post_views : one row per slug (slug + views).
--   • increment_blog_view(slug) : anon-callable RPC, bumps the count (upsert).
--       Client calls it once per browser session per post (sessionStorage guard).
--   • SELECT is public (safe: only slug + a number) so /blog can read + sort.
-- Writes go ONLY through the RPC (no client INSERT/UPDATE/DELETE policy).
-- ============================================================

begin;

create table if not exists public.blog_post_views (
  slug       text primary key,
  views      bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.blog_post_views enable row level security;

-- Public read (counts are non-sensitive).
drop policy if exists blog_views_public_select on public.blog_post_views;
create policy blog_views_public_select on public.blog_post_views
  for select using (true);

grant select on public.blog_post_views to anon, authenticated;

-- Increment (upsert) a slug's view count. SECURITY DEFINER so anon can bump it
-- without any table write privilege. Guards against junk slugs.
create or replace function public.increment_blog_view(p_slug text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v bigint;
begin
  if p_slug is null or length(p_slug) = 0 or length(p_slug) > 200 then
    return 0;
  end if;
  insert into public.blog_post_views (slug, views, updated_at)
    values (p_slug, 1, now())
  on conflict (slug) do update
    set views = public.blog_post_views.views + 1, updated_at = now()
  returning views into v;
  return v;
end;
$$;

revoke all on function public.increment_blog_view(text) from public;
grant execute on function public.increment_blog_view(text) to anon, authenticated;

commit;

-- Test:
--   select public.increment_blog_view('trial-balance-explained');  -- returns new count
--   select slug, views from public.blog_post_views order by views desc;
