-- 081 · _official_doc_no — a free number for ANY voucher/document number format (S3-f-1 fix,
-- 2026-09-29).
--
-- WHY: the Rania pilot's first sale through post_stock_document (080) was refused with
-- `uniq_vouchers_society_no`. Voucher numbers there are FOUR-part — `RV/2026/27/914` (the FY written
-- with a slash) — and 080's helper only understood `BOOK/FY/SEQ`, so it returned the client's
-- provisional number unchanged, which was already taken. (The old client path hides this with a
-- renumber-and-retry on 23505; the one-transaction path has no retry.) Nothing was written — the
-- transaction rolled back whole — but no sale could be posted.
--
-- NOW, for a provisional `<prefix>/<digits>` (any number of '/'-separated parts):
--   1. a 3-part BOOK/FY/SEQ → the server sequence next_document_number (T-03), skipping taken numbers
--      (up to 20 tries — a sequence far behind the real numbers falls through to step 3)
--   2. the provisional number itself, if free
--   3. max(existing SEQ for the same prefix) + 1, keeping the zero-pad width — always free (the society's
--      rows are read inside this transaction)
-- Anything without a trailing /<digits> comes back unchanged. Same signature, same privacy as 080.
--
-- Replaces the function body only. Reversible: 081_official_doc_no_any_format_down.sql restores 080's.

begin;

create or replace function public._official_doc_no(p_sid text, p_provisional text, p_table text, p_column text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text := substring(coalesce(p_provisional, '') from '^(.*)/[0-9]+$');
  v_seq    text := substring(coalesce(p_provisional, '') from '/([0-9]+)$');
  v_width  int;
  v_n      bigint;
  v_try    text;
  v_taken  boolean;
  v_parts  int;
begin
  if v_prefix is null or v_prefix = '' or v_seq is null then return p_provisional; end if;
  v_width := length(v_seq);
  v_parts := array_length(string_to_array(p_provisional, '/'), 1);

  -- 1. The server sequence, for the BOOK/FY/SEQ shape it was built for.
  if v_parts = 3 then
    for i in 1..20 loop
      v_n := public.next_document_number(p_sid, split_part(p_provisional, '/', 1), split_part(p_provisional, '/', 2));
      exit when v_n is null or v_n <= 0;
      v_try := v_prefix || '/' || lpad(v_n::text, greatest(v_width, length(v_n::text)), '0');
      execute format('select exists (select 1 from public.%I where society_id::text = $1 and %I = $2)', p_table, p_column)
        into v_taken using p_sid, v_try;
      if not v_taken then return v_try; end if;
    end loop;
  end if;

  -- 2. The provisional number, if nobody has it.
  execute format('select exists (select 1 from public.%I where society_id::text = $1 and %I = $2)', p_table, p_column)
    into v_taken using p_sid, p_provisional;
  if not v_taken then return p_provisional; end if;

  -- 3. Highest number in use for this prefix, plus one.
  execute format(
    'select coalesce(max((substring(%I from ''/([0-9]+)$''))::bigint), 0) from public.%I
      where society_id::text = $1 and substring(%I from ''^(.*)/[0-9]+$'') = $2', p_column, p_table, p_column)
    into v_n using p_sid, v_prefix;
  for i in 1..50 loop
    v_n := v_n + 1;
    v_try := v_prefix || '/' || lpad(v_n::text, greatest(v_width, length(v_n::text)), '0');
    execute format('select exists (select 1 from public.%I where society_id::text = $1 and %I = $2)', p_table, p_column)
      into v_taken using p_sid, v_try;
    if not v_taken then return v_try; end if;
  end loop;
  raise exception 'post_voucher:no_free_number';
end;
$$;
revoke all on function public._official_doc_no(text, text, text, text) from public, anon, authenticated;

insert into public.app_migrations (version, name) values ('081', 'official_doc_no_any_format')
  on conflict (version) do nothing;

commit;
