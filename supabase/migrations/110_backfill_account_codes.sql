-- 110 · Backfill readable ledger codes for EVERY society in one run (no per-society button clicks).
--
-- 109 added accounts.code; new accounts get a code on create (app, #706). This migration codes the
-- accounts that existed before 109: every account whose id is a UUID and whose code is NULL.
--
-- The rule is the SAME as the app's planner (src/lib/accountCode.ts → planMissingCodes):
--   * parent code: the parent's stored code, else the parent's id when it is not a UUID; a
--     parentless account — or an orphan whose UUID parent group was deleted — uses its type's root
--     group (equity 1000 · liability 2000 · asset 3000 · income 4000 · expense 5000); a UUID parent
--     that exists but has no code → skipped (stays NULL).
--   * parent 'X000': groups X100…X900, ledgers X001…X099; parent 'XY00': XY01…XY99;
--     otherwise / range full: '<parent>-01', '-02', … (unbounded, never truncated).
--   * codes unique within the society (non-UUID ids + stored codes + codes assigned in this run).
--   * order: depth in the group tree (parents first, so a child derives from its group's new
--     code), then name, then id — both COLLATE "C" (the planner uses the same code-unit order).
--
-- Only NULL codes are written; ids (what vouchers reference) are never touched. Idempotent: a re-run
-- finds nothing left to code. The function stays for later use (e.g. after restoring an old backup):
--   select * from public.assign_missing_account_codes();                    -- preview, writes nothing
--   select * from public.assign_missing_account_codes(null, true);          -- apply, all societies
--   select * from public.assign_missing_account_codes('<society_id>', true); -- apply, one society
-- Not callable by app users (execute revoked from public/anon/authenticated).

begin;

create or replace function public.assign_missing_account_codes(
  p_society_id text default null,
  p_apply boolean default false
)
returns table (soc text, account_id text, new_code text)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_soc   text;
  v_used  jsonb;   -- set of codes in use in this society
  v_codes jsonb;   -- account id → readable code (null when it has none yet)
  r       record;
  v_pc    text;
  v_root  text;
  v_base  int;
  v_i     int;
  v_cand  text;
  v_found text;
begin
  for v_soc in
    select distinct a.society_id::text
      from public.accounts a
     where (p_society_id is null or a.society_id::text = p_society_id)
       and a.id ~* uuid_re and a.code is null
     order by 1
  loop
    select coalesce(jsonb_object_agg(x.c, true), '{}'::jsonb) into v_used
      from (select a.id as c from public.accounts a where a.society_id::text = v_soc and a.id !~* uuid_re
            union
            select a.code from public.accounts a where a.society_id::text = v_soc and a.code is not null) x;

    select coalesce(jsonb_object_agg(a.id, coalesce(a.code, case when a.id ~* uuid_re then null else a.id end)), '{}'::jsonb)
      into v_codes
      from public.accounts a where a.society_id::text = v_soc;

    for r in
      with recursive chain as (
        select m.id as start_id, m."parentId" as pid, 0 as d, array[]::text[] as seen
          from public.accounts m
         where m.society_id::text = v_soc and m.id ~* uuid_re and m.code is null
        union all
        select c.start_id, p."parentId", c.d + 1, c.seen || p.id
          from chain c
          join public.accounts p on p.society_id::text = v_soc and p.id = c.pid
         where c.pid is not null and c.pid <> '' and not (p.id = any(c.seen))
      )
      select m.id, m."parentId" as parent_id, coalesce(m."isGroup", false) as is_group, m.type,
             coalesce(m.name, '') as name,
             (select max(ch.d) from chain ch where ch.start_id = m.id) as depth
        from public.accounts m
       where m.society_id::text = v_soc and m.id ~* uuid_re and m.code is null
       order by depth, coalesce(m.name, '') collate "C", m.id collate "C"
    loop
      v_root := case r.type when 'equity' then '1000' when 'liability' then '2000' when 'asset' then '3000'
                            when 'income' then '4000' when 'expense' then '5000' end;
      if r.parent_id is null or r.parent_id = '' then
        v_pc := v_root;
      elsif v_codes ? r.parent_id then
        v_pc := v_codes ->> r.parent_id;
      else
        -- orphan: its UUID parent group no longer exists → the type's root range
        v_pc := case when r.parent_id ~* uuid_re then v_root else r.parent_id end;
      end if;
      continue when v_pc is null or v_pc = '';

      v_found := null;
      if v_pc ~ '^[0-9]000$' then
        v_base := v_pc::int;
        if r.is_group then
          for v_i in 1..9 loop
            v_cand := (v_base + v_i * 100)::text;
            if not (v_used ? v_cand) then v_found := v_cand; exit; end if;
          end loop;
        else
          for v_i in 1..99 loop
            v_cand := (v_base + v_i)::text;
            if not (v_used ? v_cand) then v_found := v_cand; exit; end if;
          end loop;
        end if;
      elsif v_pc ~ '^[0-9][0-9]00$' then
        v_base := v_pc::int;
        for v_i in 1..99 loop
          v_cand := (v_base + v_i)::text;
          if not (v_used ? v_cand) then v_found := v_cand; exit; end if;
        end loop;
      end if;
      if v_found is null then
        for v_i in 1..99999 loop
          v_cand := v_pc || '-' || case when v_i < 10 then '0' || v_i::text else v_i::text end;
          if not (v_used ? v_cand) then v_found := v_cand; exit; end if;
        end loop;
      end if;
      continue when v_found is null;

      v_used  := v_used  || jsonb_build_object(v_found, true);
      v_codes := v_codes || jsonb_build_object(r.id, v_found);
      if p_apply then
        update public.accounts a set code = v_found
         where a.society_id::text = v_soc and a.id = r.id and a.code is null;
      end if;
      soc := v_soc; account_id := r.id; new_code := v_found;
      return next;
    end loop;
  end loop;
end;
$$;

revoke all on function public.assign_missing_account_codes(text, boolean) from public, anon, authenticated;

-- Apply to every society now. The result row shows how many accounts were coded.
select count(*) as accounts_coded from public.assign_missing_account_codes(null, true);

commit;
