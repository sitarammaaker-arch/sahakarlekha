-- 087 · issue_certificate: a re-issue can no longer rewrite an existing certificate (Phase-2 A5, P2).
--
-- issue_certificate is anon-callable by design (the guide is backend-free; anyone who passes the quiz
-- records a certificate). But its ON CONFLICT branch overwrote holder_name, so anyone could take a
-- genuine certificate number and rename its holder — verify_certificate(cert_no, real name) then
-- fails for the real holder. The number is a checksum of (name, date) (src/lib/guideCertId.ts), so the
-- same number with a different name is never legitimate.
--
-- After: an existing row keeps its holder_name, email and society_name (first write wins); only
-- parts_passed may grow. New certificates are recorded exactly as before.
-- Idempotent. Undo: 087_issue_certificate_no_overwrite_down.sql.

begin;

create or replace function public.issue_certificate(p_cert_no text, p_holder_name text, p_email text, p_society_name text, p_parts_passed integer)
returns void language plpgsql security definer
set search_path = public, extensions as $function$
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
    email        = coalesce(guide_certificates.email, excluded.email),
    society_name = coalesce(guide_certificates.society_name, excluded.society_name),
    parts_passed = greatest(excluded.parts_passed, guide_certificates.parts_passed)
  -- only the SAME holder may re-issue (e.g. more parts passed); a different name changes nothing
  where lower(btrim(regexp_replace(guide_certificates.holder_name, '\s+', ' ', 'g')))
      = lower(btrim(regexp_replace(excluded.holder_name, '\s+', ' ', 'g')));
end;
$function$;

insert into public.app_migrations (version, name) values ('087', 'issue_certificate_no_overwrite')
  on conflict (version) do nothing;

commit;
