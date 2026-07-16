-- 050 DOWN · remove the FY-close governance-authority columns (T-23).
alter table society_settings drop column if exists "fyCloseAuthorityRequired";
alter table society_settings drop column if exists "fyCloseAuthority";
