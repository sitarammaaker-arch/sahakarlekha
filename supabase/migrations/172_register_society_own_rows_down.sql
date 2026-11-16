-- 172 down · restore 006's register_society body (the payload ids are trusted again).
-- Signup keeps working either way: the app sends the same ids 172 forces.
begin;

create or replace function public.register_society(
  p_society_id text,
  p_email      text,
  p_password   text,
  p_name       text,
  p_society    jsonb,
  p_settings   jsonb,
  p_accounts   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (select 1 from public.societies      where id::text = p_society_id)
     or exists (select 1 from public.society_users where society_id::text = p_society_id) then
    return jsonb_build_object('ok', false, 'error_code', 'society_exists',
                              'error_message', 'This society is already registered.');
  end if;

  if exists (select 1 from public.societies where registration_no = p_society->>'registration_no') then
    return jsonb_build_object('ok', false, 'error_code', 'duplicate_registration',
                              'error_message', 'Registration number already exists.');
  end if;

  insert into public.societies
    select * from jsonb_populate_record(null::public.societies, p_society);

  perform public.app_register_admin(
    p_email      => p_email,
    p_password   => p_password,
    p_name       => p_name,
    p_society_id => p_society_id
  );

  insert into public.society_settings
    select * from jsonb_populate_record(null::public.society_settings, p_settings);

  insert into public.accounts
    select * from jsonb_populate_recordset(null::public.accounts, p_accounts);

  return jsonb_build_object('ok', true, 'society_id', p_society_id);

exception
  when others then
    if SQLSTATE = '23505' or SQLERRM ilike '%already%' or SQLERRM ilike '%duplicate%' then
      return jsonb_build_object('ok', false, 'error_code', 'duplicate_email',
                                'error_message', SQLERRM);
    end if;
    return jsonb_build_object('ok', false, 'error_code', 'error', 'error_message', SQLERRM);
end;
$function$;

delete from public.app_migrations where version = '172';

commit;
