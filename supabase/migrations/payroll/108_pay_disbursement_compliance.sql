-- =====================================================================================
-- Migration 108 — Disbursement, compliance, posting linkage
-- -------------------------------------------------------------------------------------
-- PURPOSE      : Payment batches/lines, statutory liabilities & challans & returns, and the
--                POSTING LINK — a reference into the reused public.vouchers / public.ledger_events
--                (NO payroll GL). Analytical dimensions ride on the posting link.
-- DEPENDENCIES : 100-107, and existing public.vouchers(id), public.ledger_events.
-- ROLLBACK     : 999.
-- VERIFY       : paid_minor <= payable_minor; posting_link.voucher_ref FKs public.vouchers.
-- NOTE         : voucher_ref/ledger_event_ref are the ONLY cross-schema links into the app''s GL;
--                these are the "one line that, if wrong, shows one society another''s cash" — RLS
--                on public.vouchers still governs; this table only references.
-- =====================================================================================

-- ── Posting link (payroll → reused ledger; carries dimensions) ──────────────────────
create table pay_calc.posting_link (
  id              uuid primary key default gen_random_uuid(),
  society_id      uuid not null references societies(id) on delete restrict,
  pay_run_id      uuid not null references pay_calc.payroll_run(id) on delete restrict,
  voucher_ref     text,                                      -- FK → public.vouchers(id) [text] (engine voucher)
  ledger_event_ref text,                                     -- correlation id into public.ledger_events(event_id) [text]
  basis           pay_core.pay_basis not null,
  cost_centre     text,
  project_ref     uuid,
  fund_ref        uuid,
  posted_at       timestamptz not null default now(),
  constraint posting_run_uq unique (pay_run_id, basis)
);
comment on table pay_calc.posting_link is 'Reference from a posted run into the reused ledger + analytical dimensions. Payroll owns NO GL.';
-- FK into the existing app GL (public.vouchers.id is uuid).
alter table pay_calc.posting_link
  add constraint posting_voucher_fk foreign key (voucher_ref) references public.vouchers(id) on delete restrict;
alter table pay_calc.payroll_run
  add constraint run_posting_fk foreign key (posting_ref) references pay_calc.posting_link(id);

-- ── Payment batch + lines (disbursement) ────────────────────────────────────────────
create table pay_calc.payment_batch (
  id                  uuid primary key default gen_random_uuid(),
  society_id          uuid not null references societies(id) on delete restrict,
  pay_run_id          uuid not null references pay_calc.payroll_run(id) on delete restrict,
  mode                text not null references pay_core.payment_mode(code),
  bank_account_ref    text,                                  -- society bank ledger account id
  advice_no           text,
  payment_voucher_ref text references public.vouchers(id),   -- public.vouchers.id is text
  status              text not null default 'created' check (status in ('created','released','cleared','cancelled')),
  total_minor         pay_core.amount_minor not null default 0 check (total_minor >= 0),
  created_at          timestamptz not null default now(),
  created_by          uuid not null
);

create table pay_calc.payment_line (
  id              uuid primary key default gen_random_uuid(),
  society_id      uuid not null references societies(id) on delete restrict,
  payment_batch_id uuid not null references pay_calc.payment_batch(id) on delete cascade,
  employee_id     uuid not null references pay_core.employee(id),
  net_minor       pay_core.amount_minor not null check (net_minor >= 0),
  bank_mandate_id uuid references pay_core.bank_mandate(id),
  created_at      timestamptz not null default now()
);
create index payline_batch_idx on pay_calc.payment_line (payment_batch_id);

-- ── Statutory liability + challan + return + certificate ────────────────────────────
create table pay_calc.statutory_liability (
  id            uuid primary key default gen_random_uuid(),
  society_id    uuid not null references societies(id) on delete restrict,
  pay_run_id    uuid references pay_calc.payroll_run(id) on delete restrict,
  head          text not null references pay_core.statutory_head(code),
  period        pay_core.period_ym not null,
  payable_minor pay_core.amount_minor not null default 0 check (payable_minor >= 0),
  paid_minor    pay_core.amount_minor not null default 0 check (paid_minor >= 0),
  created_at    timestamptz not null default now(),
  created_by    uuid not null,
  updated_at    timestamptz,
  updated_by    uuid,
  constraint statliab_paid_ck check (paid_minor <= payable_minor)
);
create unique index statliab_uq
  on pay_calc.statutory_liability (society_id, head, period,
     coalesce(pay_run_id,'00000000-0000-0000-0000-000000000000'::uuid));
comment on table pay_calc.statutory_liability is 'Amount owed per statutory head/period. Head-agnostic (new head = a reference row, no new columns).';

create table pay_calc.challan (
  id                  uuid primary key default gen_random_uuid(),
  society_id          uuid not null references societies(id) on delete restrict,
  statutory_liability_id uuid not null references pay_calc.statutory_liability(id) on delete restrict,
  challan_no          text not null,
  amount_minor        pay_core.amount_minor not null check (amount_minor > 0),
  deposit_voucher_ref text references public.vouchers(id),   -- public.vouchers.id is text
  deposited_on        date,
  created_at          timestamptz not null default now(),
  created_by          uuid not null
);

create table pay_calc.return_filing (
  id            uuid primary key default gen_random_uuid(),
  society_id    uuid not null references societies(id) on delete restrict,
  form          text not null references pay_core.return_form(code),
  period        text not null,                               -- month or quarter
  prepared_on   date,
  filed_on      date,
  ack_ref       text,
  status        text not null default 'prepared' check (status in ('prepared','filed','acknowledged','revised')),
  created_at    timestamptz not null default now(),
  created_by    uuid not null,
  constraint return_uq unique (society_id, form, period)
);

create table pay_calc.statutory_certificate (
  id            uuid primary key default gen_random_uuid(),
  society_id    uuid not null references societies(id) on delete restrict,
  employee_id   uuid not null references pay_core.employee(id),
  form          text not null references pay_core.return_form(code),
  fy            text not null,
  document_ref  uuid,                                        -- reused document system
  issued_on     date,
  created_at    timestamptz not null default now(),
  created_by    uuid not null,
  constraint cert_uq unique (society_id, employee_id, form, fy)
);

-- ── Reconciliation snapshot (subsidiary ↔ GL parity, L2) ────────────────────────────
create table pay_calc.reconciliation_snapshot (
  id                uuid primary key default gen_random_uuid(),
  society_id        uuid not null references societies(id) on delete restrict,
  period            pay_core.period_ym not null,
  subsidiary_minor  pay_core.amount_minor not null,
  gl_minor          pay_core.amount_minor not null,
  drift_minor       pay_core.amount_minor generated always as (subsidiary_minor - gl_minor) stored,
  created_at        timestamptz not null default now(),
  constraint recon_uq unique (society_id, period)
);
comment on table pay_calc.reconciliation_snapshot is 'Ties payroll subsidiary totals to GL per period (L2). drift_minor must be 0 (tolerance enforced in app/CI).';

-- audit triggers
do $$
declare t text;
begin
  foreach t in array array['pay_calc.payment_batch','pay_calc.statutory_liability','pay_calc.challan','pay_calc.return_filing']
  loop
    execute format('create trigger %s_audit after insert or update or delete on %s for each row execute function pay_core.tg_pay_audit()', split_part(t,'.',2), t);
  end loop;
end$$;
