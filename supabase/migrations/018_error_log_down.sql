-- 018 DOWN · Drop the error_log sink. Safe: it holds only operational error records, no
-- society financial data. (Revert the client reportError wiring too, else inserts will fail —
-- harmlessly, since reportError swallows its own failures.)
drop table if exists error_log;
