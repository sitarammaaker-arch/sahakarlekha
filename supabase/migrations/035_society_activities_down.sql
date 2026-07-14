-- 035 down · drop the Activities table. Safe — it is dormant (no consumer until T-11), so nothing
-- depends on it and no data is lost in a real sense (societies start with zero declared activities).
drop table if exists society_activities;
