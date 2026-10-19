-- Rollback for 128_transport_operations.sql. Drops the transport document tables.
-- The trip / expense VOUCHERS are untouched, so the books are unchanged; only the vehicle tag
-- (which voucher belongs to which vehicle) is lost. Take a backup first if any rows exist.
begin;
drop table if exists public.transport_vehicle_expenses;
drop table if exists public.transport_trips;
drop table if exists public.transport_vehicles;
delete from public.app_migrations where version = '128';
commit;
