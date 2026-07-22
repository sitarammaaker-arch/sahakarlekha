/**
 * pay-post — post a LOCKED payroll run to the general ledger (the accounting integration).
 * Built with the user's explicit authorisation (2026-07-22); STAGING-verified only.
 *
 * A locked run creates ONE balanced journal voucher (public.vouchers / voucher_entries), links it
 * via pay_calc.posting_link, appends the WORM 'posted' pay_event, and moves the run to 'posted'.
 * Double-entry, balanced by construction:
 *
 *   Dr  Salary & Wages           = gross earnings − LOP   (actual expense for days worked)
 *   Cr  Statutory Deductions Pay = PF etc. (liabilities the society holds to remit)
 *   Cr  Salaries Payable         = net pay (owed to employees)
 *   (Dr = Cr, since gross − LOP = statutory + net.)
 *
 * ⚠ ACCOUNTING MODEL — FOR THE SOCIETY'S REVIEW before real books:
 *   • the 3 GL accounts are auto-created with standard names (map to your chart as needed);
 *   • LOP is treated as an expense reduction (not a liability); all other deductions as statutory
 *     liabilities in one "Statutory Deductions Payable";
 *   • amounts are posted in RUPEES (paise ÷ 100).
 * FINANCIAL PATH — gated on MFA (ADR-0012) for production (the 'posted' pay_event hits the aal2 gate).
 *
 * Auth: verified JWT → society + admin role. A caller only posts their own society's runs.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
import { canTransition } from '../_shared/pay-core.mjs';

const corsFor = (req: Request) => ({
  'access-control-allow-origin': '*',
  'access-control-allow-headers': req.headers.get('access-control-request-headers') ?? 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
});
const json = (s: number, b: unknown, c: Record<string, string>) => new Response(JSON.stringify(b), { status: s, headers: { ...c, 'content-type': 'application/json' } });
const rup = (minor: number) => Math.round(minor) / 100;

Deno.serve(async (req: Request) => {
  const CORS = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' }, CORS);

  const supaUrl = Deno.env.get('SUPABASE_URL') ?? '', anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const dbUrl = Deno.env.get('PAY_DB_URL') ?? Deno.env.get('SUPABASE_DB_URL') ?? '';
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!jwt) return json(401, { error: 'missing bearer token' }, CORS);
  const { data: { user } } = await createClient(supaUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } }).auth.getUser();
  if (!user?.email) return json(401, { error: 'invalid session' }, CORS);

  let body: { runId?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'bad JSON' }, CORS); }
  if (!body.runId) return json(400, { error: 'runId required' }, CORS);

  const sql = postgres(dbUrl, { prepare: false, max: 3 });
  try {
    const [su] = await sql`select id, society_id, role from public.society_users where email = ${user.email} and is_active = true limit 1`;
    if (!su) return json(403, { error: 'not a society user' }, CORS);
    if (su.role !== 'admin') return json(403, { error: 'only admin may post payroll' }, CORS);
    const societyId = su.society_id as string;
    const societyText = String(societyId);

    const [run] = await sql`select id, society_id, state, run_no, period_month from pay_calc.payroll_run where id = ${body.runId} limit 1`;
    if (!run) return json(404, { error: 'run not found' }, CORS);
    if (run.society_id !== societyId) return json(403, { error: 'run belongs to another society' }, CORS);
    if (!canTransition(run.state, 'posted')) return json(409, { error: `cannot post a run in state '${run.state}' (must be 'locked')` }, CORS);

    const [tot] = await sql`select coalesce(sum(gross_minor),0)::bigint g, coalesce(sum(deductions_minor),0)::bigint d, coalesce(sum(net_minor),0)::bigint n from pay_calc.payslip where pay_run_id = ${body.runId}`;
    const [lopRow] = await sql`select coalesce(sum(pl.computed_minor),0)::bigint lop from pay_calc.payslip_line pl join pay_calc.payslip p on p.id = pl.payslip_id join pay_config.component_catalog cc on cc.id = pl.component_id where p.pay_run_id = ${body.runId} and cc.code = 'LOP'`;
    const gross = Number(tot.g), ded = Number(tot.d), net = Number(tot.n), lop = Number(lopRow.lop);
    const expense = gross - lop;   // Dr Salary & Wages
    const statutory = ded - lop;   // Cr Statutory Payable
    if (expense !== statutory + net) return json(500, { error: `imbalance: expense ${expense} ≠ statutory ${statutory} + net ${net}` }, CORS);
    if (expense <= 0) return json(400, { error: 'nothing to post (zero expense)' }, CORS);

    const acc = { exp: `${societyText}:PAY-SALEXP`, pay: `${societyText}:PAY-SALPAY`, stat: `${societyText}:PAY-STATPAY` };
    const out = await sql.begin(async (tx: postgres.TransactionSql) => {
      await tx`insert into public.accounts(id,society_id,name,"nameHi",type,"isSystem") values
        (${acc.exp},${societyText},'Salary & Wages','वेतन एवं मज़दूरी','expense',true),
        (${acc.pay},${societyText},'Salaries Payable','देय वेतन','liability',true),
        (${acc.stat},${societyText},'Statutory Deductions Payable','देय सांविधिक कटौती','liability',true)
        on conflict (id) do nothing`;
      const vId = crypto.randomUUID();
      await tx`insert into public.vouchers(id,society_id,"voucherNo",date,type,amount,narration,"createdBy")
        values(${vId},${societyText},${'PAY-' + run.run_no},${String(run.period_month)},'journal',${rup(expense)},${`Payroll ${run.run_no}`},${String(su.id)})`;
      const line = (accId: string, dr: number, cr: number, n: string) =>
        tx`insert into public.voucher_entries(id,"voucherId","accountId",dr,cr,narration,society_id) values(${crypto.randomUUID()},${vId},${accId},${dr},${cr},${n},${societyText})`;
      await line(acc.exp, rup(expense), 0, 'Salary & wages (net of LOP)');
      if (statutory > 0) await line(acc.stat, 0, rup(statutory), 'Statutory deductions payable');
      await line(acc.pay, 0, rup(net), 'Net salaries payable');

      const [pl] = await tx`insert into pay_calc.posting_link(society_id,pay_run_id,voucher_ref,basis) values(${societyId},${body.runId},${vId},'accrual') returning id`;
      const [{ nextseq }] = await tx`select coalesce(max(sequence),0)+1 as nextseq from pay_calc.pay_event where aggregate_id = ${body.runId}`;
      await tx`insert into pay_calc.pay_event(society_id,aggregate_type,aggregate_id,sequence,event_type,producer_kind,actor_email,payload)
        values(${societyId},'pay_run',${body.runId},${nextseq},'posted'::pay_core.pay_event_type,'human',${user.email},${JSON.stringify({ voucher: vId, expense: rup(expense), statutory: rup(statutory), net: rup(net) })})`;
      // payroll_run.posting_ref → the posting_link id (FK run_posting_fk); the voucher id lives on posting_link.voucher_ref
      await tx`update pay_calc.payroll_run set state = 'posted'::pay_core.pay_run_state, posting_ref = ${pl.id}, updated_at = now(), updated_by = ${su.id} where id = ${body.runId}`;
      return { voucherId: vId };
    });

    return json(200, { ok: true, runId: body.runId, state: 'posted', voucherId: out.voucherId, expense: rup(expense), statutory: rup(statutory), net: rup(net) }, CORS);
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) }, CORS);
  } finally {
    await sql.end();
  }
});
