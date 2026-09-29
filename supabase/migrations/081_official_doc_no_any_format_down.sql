-- 081 down · restore 080's _official_doc_no (3-part BOOK/FY/SEQ only).
begin;

-- search_path = public (not ''): next_document_number (T-03, mig 016) names document_sequences
-- unqualified, so it must resolve in the caller's path. This helper is private (no client grant).
create or replace function public._official_doc_no(p_sid text, p_provisional text, p_table text, p_column text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_book  text := split_part(coalesce(p_provisional, ''), '/', 1);
  v_fy    text := split_part(coalesce(p_provisional, ''), '/', 2);
  v_seq   text := split_part(coalesce(p_provisional, ''), '/', 3);
  v_width int;
  v_n     bigint;
  v_try   text;
  v_taken boolean;
begin
  if v_book = '' or v_fy = '' or v_seq !~ '^[0-9]+$' or split_part(p_provisional, '/', 4) <> '' then
    return p_provisional;
  end if;
  v_width := length(v_seq);
  for i in 1..50 loop
    v_n := public.next_document_number(p_sid, v_book, v_fy);
    if v_n is null or v_n <= 0 then return p_provisional; end if;
    v_try := v_book || '/' || v_fy || '/' || lpad(v_n::text, greatest(v_width, length(v_n::text)), '0');
    execute format('select exists (select 1 from public.%I where society_id::text = $1 and %I = $2)', p_table, p_column)
      into v_taken using p_sid, v_try;
    if not v_taken then return v_try; end if;
  end loop;
  raise exception 'post_voucher:no_free_number';
end;
$$;
revoke all on function public._official_doc_no(text, text, text, text) from public, anon, authenticated;

delete from public.app_migrations where version = '081';
commit;
