-- ============================================================
-- SahakarLekha — Feedback / Contact inbox (Phase 1)
-- Run this in Supabase SQL Editor → New query.
--
-- One table backs the public Contact form, ratings/reviews, and
-- in-app bug/suggestion reports. RLS: ANYONE may INSERT (public can
-- submit), but only active platform admins may READ / UPDATE — so
-- messages (which contain names, emails) are never anon-readable.
-- ============================================================

create table if not exists feedback (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  type          text not null default 'message',   -- message | bug | suggestion | review | helpful
  name          text,
  email         text,
  society_name  text,
  message       text,
  rating        int,                                -- 1..5 (nullable)
  page_url      text,
  user_email    text,                               -- set when submitted by a logged-in user
  society_id    text,
  status        text not null default 'new',        -- new | seen | resolved
  is_public     boolean not null default false      -- approved reviews can later show as testimonials
);

alter table feedback enable row level security;

-- Public (anon + logged-in) can submit. The client inserts WITHOUT
-- .select(), so no read-back is needed and nothing leaks.
drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback
  for insert with check (true);

-- Only active platform admins can read the inbox.
drop policy if exists feedback_admin_select on feedback;
create policy feedback_admin_select on feedback
  for select using (
    exists (
      select 1 from platform_admins
      where email = auth.jwt()->>'email' and is_active = true
    )
  );

-- Only active platform admins can update status / approve reviews.
drop policy if exists feedback_admin_update on feedback;
create policy feedback_admin_update on feedback
  for update using (
    exists (
      select 1 from platform_admins
      where email = auth.jwt()->>'email' and is_active = true
    )
  );

create index if not exists idx_feedback_created on feedback(created_at desc);
create index if not exists idx_feedback_status  on feedback(status);

-- Done. Test:
--   insert into feedback (type, name, message) values ('message','Test','hello');  -- should succeed (anon-style)
--   select * from feedback;  -- should return rows ONLY when logged in as a platform admin
