-- 122 · PII Phase 3: Aadhaar / PAN leave the members table for good
--       (member-area re-audit 2026-10-17, stage B — H-5; design: docs/reports-audit/design/MEMBER-PII-ROLE-SCOPED-READ.md).
--
-- RUN LAST, and only when ALL of these hold:
--   (a) 106 and 107 are applied, and the app has been reloaded since (it then runs in SPLIT mode: members upserts
--       never carry aadhaar / pan);
--   (b) a fresh full backup exists (this BLANKS data; the down file cannot bring it back);
--   (c) the PREVIEW below shows 0 rows of "legacy PII with no member_identity row" — or the founder has looked at them.
--
-- WHY: members SELECT is tenant-only, so every staff role (cashier, viewer, …) can read members.aadhaar / pan
-- straight from PostgREST. 106 copied them to the role-scoped member_identity but left the originals in place, and a
-- cleared Aadhaar came back after F5 from that stale column (memberIdentity.ts / 107 fall back to it).
--
-- WHAT:
--   (1) refuses to run without 106;
--   (2) copies any legacy PII that has NO member_identity row yet (never overwrites an existing identity row — it is
--       newer);
--   (3) members_pii_redirect: a BEFORE INSERT/UPDATE trigger — if a stale legacy-mode browser tab still sends
--       aadhaar / pan, they are moved into member_identity and blanked on the row, so the members table never holds
--       PII again;
--   (4) blanks members.aadhaar / members.pan. The columns stay (older app builds still name them).
--
-- PREVIEW (run first, read-only):
--   select m.society_id, m.id, m."memberId" from public.members m
--    where (coalesce(m.aadhaar,'') <> '' or coalesce(m.pan,'') <> '')
--      and not exists (select 1 from public.member_identity i where i.society_id = m.society_id and i.member_id = m.id);
-- Undo: 122_member_pii_phase3_down.sql removes the trigger only — the blanked values come back only from a backup.

begin;

do $$
begin
  if to_regclass('public.member_identity') is null then
    raise exception '122 needs migration 106 (member_identity) first';
  end if;
end;
$$;

-- (2) nothing is lost: legacy PII without an identity row is copied first
insert into public.member_identity (society_id, member_id, aadhaar, pan)
select m.society_id, m.id, nullif(m.aadhaar, ''), nullif(m.pan, '')
  from public.members m
 where coalesce(m.aadhaar, '') <> '' or coalesce(m.pan, '') <> ''
on conflict (society_id, member_id) do nothing;

-- (3) a stale tab can never put PII back on the members row
create or replace function public.members_pii_redirect() returns trigger
  language plpgsql security definer set search_path to ''
as $$
begin
  if coalesce(new.aadhaar, '') <> '' or coalesce(new.pan, '') <> '' then
    insert into public.member_identity (society_id, member_id, aadhaar, pan)
    values (new.society_id, new.id, nullif(new.aadhaar, ''), nullif(new.pan, ''))
    on conflict (society_id, member_id) do update
      set aadhaar = coalesce(excluded.aadhaar, public.member_identity.aadhaar),
          pan     = coalesce(excluded.pan, public.member_identity.pan),
          updated_at = now();
  end if;
  new.aadhaar := null;
  new.pan := null;
  return new;
end;
$$;

-- A trigger function: never callable through the API (firing a trigger does not need EXECUTE).
revoke execute on function public.members_pii_redirect() from public, anon, authenticated;

drop trigger if exists members_pii_redirect on public.members;
create trigger members_pii_redirect
  before insert or update on public.members
  for each row execute function public.members_pii_redirect();

-- (4) blank the originals
update public.members set aadhaar = null, pan = null
 where coalesce(aadhaar, '') <> '' or coalesce(pan, '') <> '';

insert into public.app_migrations (version, name) values ('122', 'member_pii_phase3')
  on conflict (version) do nothing;

commit;

-- VERIFY: select count(*) from public.members where coalesce(aadhaar,'') <> '' or coalesce(pan,'') <> '';  → 0
--         select count(*) from public.member_identity;  → at least the PREVIEW-time count of members with PII
