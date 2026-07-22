/**
 * pay-pay — disburse a POSTED payroll run (record the net-salary payment). Closes the cycle.
 * Built with the user's explicit authorisation (2026-07-22); STAGING-verified only.
 *
 * A posted run's Salaries Payable is settled from the bank: a payment voucher clears the liability,
 * the WORM 'paid' event is appended, and the run moves to 'paid'. Double-entry, balanced:
 *
 *   Dr  Salaries Payable  = net   (clear the liability raised at posting)
 *   Cr  Bank / Cash       = net   (money paid out)
 *
 * ⚠ FOR THE SOCIETY'S REVIEW before real books: the "Bank / Cash" account is auto-created with a
 * standard name — map it to the ACTUAL bank/cash account you pay salaries from. Amounts in rupees.
 * FINANCIAL PATH — gated on MFA (ADR-0012) for production.
 *
 * Auth: verified JWT → society + admin role. Caller only pays their own society's runs.
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
    if (su.role !== 'admin') return json(403, { error: 'only admin may disburse payroll' }, CORS);
    const societyId = su.society_id as string;
    const societyText = String(societyId);

    const [run] = await sql`select id, society_id, state, run_no, period_month from pay_calc.payroll_run where id = ${body.runId} limit 1`;
    if (!run) return json(404, { error: 'run not found' }, CORS);
    if (run.society_id !== societyId) return json(403, { error: 'run belongs to another society' }, CORS);
    if (!canTransition(run.state, 'paid')) return json(409, { error: `cannot pay a run in state '${run.state}' (must be 'posted')` }, CORS);

    const [tot] = await sql`select coalesce(sum(net_minor),0)::bigint n from pay_calc.payslip where pay_run_id = ${body.runId}`;
    const net = Number(tot.n);
    if (net <= 0) return json(400, { error: 'nothing to pay (zero net)' }, CORS);

    const acc = { pay: `${societyText}:PAY-SALPAY`, bank: `${societyText}:PAY-BANK` };
    const out = await sql.begin(async (tx: postgres.TransactionSql) => {
      await tx`insert into public.accounts(id,society_id,name,"nameHi",type,"isSystem") values
        (${acc.bank},${societyText},'Bank / Cash (Payroll)','बैंक / नकद (पेरोल)','asset',true)
        on conflict (id) do nothing`;
      const vId = crypto.randomUUID();
      await tx`insert into public.vouchers(id,society_id,"voucherNo",date,type,amount,narration,"createdBy")
        values(${vId},${societyText},${'PAYMT-' + run.run_no},${String(run.period_month)},'payment',${rup(net)},${`Salary payment ${run.run_no}`},${String(su.id)})`;
      const line = (accId: string, dr: number, cr: number, n: string) =>
        tx`insert into public.voucher_entries(id,"voucherId","accountId",dr,cr,narration,society_id) values(${crypto.randomUUID()},${vId},${accId},${dr},${cr},${n},${societyText})`;
      await line(acc.pay, rup(net), 0, 'Clear salaries payable');
      await line(acc.bank, 0, rup(net), 'Net salaries paid');

      const [{ nextseq }] = await tx`select coalesce(max(sequence),0)+1 as nextseq from pay_calc.pay_event where aggregate_id = ${body.runId}`;
      await tx`insert into pay_calc.pay_event(society_id,aggregate_type,aggregate_id,sequence,event_type,producer_kind,actor_email,payload)
        values(${societyId},'pay_run',${body.runId},${nextseq},'paid'::pay_core.pay_event_type,'human',${user.email},${JSON.stringify({ voucher: vId, net: rup(net) })})`;
      await tx`update pay_calc.payroll_run set state = 'paid'::pay_core.pay_run_state, updated_at = now(), updated_by = ${su.id} where id = ${body.runId}`;
      return { voucherId: vId };
    });

    return json(200, { ok: true, runId: body.runId, state: 'paid', voucherId: out.voucherId, net: rup(net) }, CORS);
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) }, CORS);
  } finally {
    await sql.end();
  }
});
