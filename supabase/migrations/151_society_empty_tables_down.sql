-- 151 down · remove society_empty_tables(). The app then fetches every table again (its fallback).
drop function if exists public.society_empty_tables(text, text[]);
