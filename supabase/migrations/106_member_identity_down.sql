-- 106 undo · drops member_identity and its gate function. members.aadhaar/pan are untouched by 106,
-- so nothing is lost UNLESS Phase 2 was live and PII was edited after 106 ran — in that case first copy
-- member_identity back into members (update members m set aadhaar=i.aadhaar, pan=i.pan from member_identity i
-- where i.society_id=m.society_id and i.member_id=m.id) before running this file.

begin;

drop table if exists public.member_identity;
drop function if exists public.jwt_can_read_pii();
delete from public.app_migrations where version = '106';

commit;
