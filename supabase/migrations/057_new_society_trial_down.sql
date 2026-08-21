-- 057 down — remove the auto-trial trigger. Existing trial rows are left as-is
-- (harmless; drop them manually if desired). No new society gets an auto-trial after this.
drop trigger if exists trg_new_society_trial on public.societies;
drop function if exists public.tg_new_society_trial();
