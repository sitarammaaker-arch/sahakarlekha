-- Rollback for 062_blog_views.sql
begin;
drop function if exists public.increment_blog_view(text);
drop table if exists public.blog_post_views;
commit;
