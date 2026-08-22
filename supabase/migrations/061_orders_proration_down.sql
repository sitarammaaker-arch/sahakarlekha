-- 061 down — drop the proration columns from orders.
alter table orders drop column if exists set_period_end;
alter table orders drop column if exists kind;
