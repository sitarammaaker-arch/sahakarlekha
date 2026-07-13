-- 028 down · remove the custom access token hook. FIRST un-select it in Dashboard → Authentication →
-- Hooks (else GoTrue still references a dropped function and login breaks), THEN run this.
drop function if exists public.custom_access_token_hook(jsonb);
