-- 087 undo · restores the pre-087 issue_certificate exactly (re-opens the holder-name overwrite).

begin;

CREATE OR REPLACE FUNCTION public.issue_certificate(p_cert_no text, p_holder_name text, p_email text, p_society_name text, p_parts_passed integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  insert into guide_certificates(cert_no, holder_name, email, society_name, parts_passed)
  values (
    p_cert_no,
    btrim(p_holder_name),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_society_name, '')), ''),
    coalesce(p_parts_passed, 0)
  )
  on conflict (cert_no) do update set
    holder_name  = excluded.holder_name,
    email        = coalesce(excluded.email, guide_certificates.email),
    society_name = coalesce(excluded.society_name, guide_certificates.society_name),
    parts_passed = greatest(excluded.parts_passed, guide_certificates.parts_passed);
end;
$function$;

delete from public.app_migrations where version = '087';

commit;
