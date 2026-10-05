/**
 * pay-pay — disburse a POSTED payroll run: the payment voucher, through the posting service (P1).
 *
 *   Dr  Salary payable                 net pay           (clears what pay-post accrued)
 *   Cr  the bank / cash account        net pay           (chosen by the caller — NOT a made-up payroll account)
 *
 * Like pay-post, this function writes NO voucher itself: it builds the legs (pure, tested — runPosting.ts) and
 * calls public.post_voucher AS THE USER, so FY-lock / period-lock / open-FY / balance / the journal event are
 * enforced by the database. The voucher id is derived from the run id (idempotent on retry).
 *
 * Body: { runId, paidFrom: <bank/cash account id>, paidDate?: 'YYYY-MM-DD' (default today) }.
 *
 * Staff-advance recovery is credited against the loan ONLY here, where the money actually leaves — a run that is
 * cancelled or reversed must never reduce what an employee still owes (pay-rollback undoes it if a PAID run is
 * reversed).
 *
 * Gate: PAY_LEDGER_POSTING_ENABLED must be 'true'. Auth: verified JWT → society + admin role.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
import { canTransition, buildRunPayment, makePostVoucherPayload, payrollDocIds, PAYROLL_ROLES } from '../_shared/pay-core.mjs';
import { rpc, loadHeads } from '../_shared/pay-ledger.ts';

const mfaPending = (t: string): boolean => {
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).mfa_pending === true; } catch { return true; }
};

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
  if ((Deno.env.get('PAY_LEDGER_POSTING_ENABLED') ?? '').toLowerCase() !== 'true') {
    return json(503, { error: 'Payroll की बही-posting अभी चालू नहीं है — admin इसे चालू करेगा। (Payroll ledger posting is not enabled.)', code: 'PAY_LEDGER_POSTING_DISABLED' }, CORS);
  }

  const supaUrl = Deno.env.get('SUPABASE_URL') ?? '', anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const dbUrl = Deno.env.get('PAY_DB_URL') ?? Deno.env.get('SUPABASE_DB_URL') ?? '';
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!jwt) return json(401, { error: 'missing bearer token' }, CORS);
  if (mfaPending(jwt)) return json(403, { error: '2FA required — finish the 2FA step and sign in again' }, CORS);
  const { data: { user } } = await createClient(supaUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } }).auth.getUser();
  if (!user?.email) return json(401, { error: 'invalid session' }, CORS);

  if ((Deno.env.get('PAY_REQUIRE_AAL2') ?? '').toLowerCase() === 'true') {
    let aal = '';
    try { aal = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).aal ?? ''; } catch { /* malformed → treat as no MFA */ }
    if (aal !== 'aal2') return json(403, { error: 'MFA (AAL2) required to disburse payroll — step up your session' }, CORS);
  }

  let body: { runId?: string; paidFrom?: string; paidDate?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'bad JSON' }, CORS); }
  if (!body.runId) return json(400, { error: 'runId required' }, CORS);
  if (!body.paidFrom) return json(400, { error: 'भुगतान किस बैंक / नकद खाते से हुआ — paidFrom चुनें। / paidFrom (bank or cash account) required' }, CORS);
  const paidDate = (body.paidDate ?? '').trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) return json(400, { error: 'paidDate must be YYYY-MM-DD' }, CORS);

  const sql = postgres(dbUrl, { prepare: false, max: 3 });
  try {
    const [su] = await sql`select id, society_id, role from public.society_users where email = ${user.email} and is_active = true limit 1`;
    if (!su) return json(403, { error: 'not a society user' }, CORS);
    if (su.role !== 'admin') return json(403, { error: 'only admin may disburse payroll' }, CORS);
    const societyId = su.society_id as string;
    const societyText = String(societyId);

    const [run] = await sql`select id, society_id, state, run_no from pay_calc.payroll_run where id = ${body.runId} limit 1`;
    if (!run) return json(404, { error: 'run not found' }, CORS);
    if (run.society_id !== societyId) return json(403, { error: 'run belongs to another society' }, CORS);
    if (!canTransition(run.state, 'paid')) return json(409, { error: `cannot pay a run in state '${run.state}' (must be 'posted')` }, CORS);

    // the account the money leaves from: must be this society's, and an asset (a bank / cash head)
    const [from] = await sql`select id, type from public.accounts where society_id::text = ${societyText} and id = ${body.paidFrom} limit 1`;
    if (!from) return json(400, { error: `खाता '${body.paidFrom}' इस समिति में नहीं है। / paidFrom account not found in this society` }, CORS);
    if (from.type !== 'asset') return json(400, { error: 'भुगतान सिर्फ़ बैंक / नकद (asset) खाते से हो सकता है। / paidFrom must be a bank or cash (asset) account' }, CORS);

    const [tot] = await sql`select coalesce(sum(net_minor),0)::bigint n from pay_calc.payslip where pay_run_id = ${body.runId}`;
    const netMinor = Number(tot.n);
    const { heads, missing } = await loadHeads(sql, societyText, [PAYROLL_ROLES.salaryPayable]);
    if (missing.length || !heads.salaryPayable) {
      return json(409, { error: `इस समिति के खातों में ये भूमिकाएँ तय नहीं हैं: ${PAYROLL_ROLES.salaryPayable} — पहले Ledger Heads में तय करें। / account role not mapped`, code: 'PAY-POST-HEAD', missingHeads: missing }, CORS);
    }

    const built = buildRunPayment(netMinor, heads.salaryPayable, String(body.paidFrom));
    if (!built.ok) return json(409, { error: built.message, code: built.code }, CORS);

    const ids = payrollDocIds(body.runId);
    const payload = makePostVoucherPayload({
      id: ids.paymentVoucherId, eventId: ids.paymentEventId, voucherNo: `PAYMT-${run.run_no}`, type: 'payment',
      date: paidDate, narration: `Salary payment ${run.run_no}`, createdBy: user.email, occurredAt: new Date().toISOString(), legs: built.legs,
    });
    const posted = await rpc(supaUrl, anonKey, jwt, 'post_voucher', payload);
    if (!posted.ok) return json(409, { error: posted.message, code: posted.code ? `post_voucher:${posted.code}` : 'PAY-POST-REFUSED' }, CORS);
    const voucherId = String(posted.data?.id ?? ids.paymentVoucherId);

    await sql.begin(async (tx: postgres.TransactionSql) => {
      const [{ nextseq }] = await tx`select coalesce(max(sequence),0)+1 as nextseq from pay_calc.pay_event where aggregate_id = ${body.runId}`;
      await tx`insert into pay_calc.pay_event(society_id,aggregate_type,aggregate_id,sequence,event_type,producer_kind,actor_email,payload)
        values(${societyId},'pay_run',${body.runId},${nextseq},'paid'::pay_core.pay_event_type,'human',${user.email},${JSON.stringify({ voucher: voucherId, net: rup(netMinor), paidFrom: body.paidFrom, paidDate, via: 'post_voucher' })})`;
      // Credit staff-advance recovery — ONLY here, where the money actually leaves.
      await tx`
        with rec as (
          select p.employee_id, sum(pl.computed_minor)::bigint as amt
          from pay_calc.payslip p
          join pay_calc.payslip_line pl on pl.payslip_id = p.id
          join pay_config.component_catalog cc on cc.id = pl.component_id and cc.code = 'LOAN_RECOVERY'
          where p.pay_run_id = ${body.runId}
          group by p.employee_id
        )
        update pay_calc.employee_loan l set
          recovered_minor = least(l.principal_minor, l.recovered_minor + rec.amt),
          status    = case when l.recovered_minor + rec.amt >= l.principal_minor then 'closed' else l.status end,
          closed_on = case when l.recovered_minor + rec.amt >= l.principal_minor then current_date else l.closed_on end,
          updated_at = now(), updated_by = ${su.id}
        from rec
        where l.employee_id = rec.employee_id and l.society_id = ${societyId} and l.status = 'active' and rec.amt > 0`;
      await tx`update pay_calc.payslip set status = 'paid'::pay_core.payslip_status where pay_run_id = ${body.runId}`;
      await tx`update pay_calc.payroll_run set state = 'paid'::pay_core.pay_run_state, updated_at = now(), updated_by = ${su.id} where id = ${body.runId}`;
    });

    return json(200, { ok: true, runId: body.runId, state: 'paid', voucherId, voucherNo: `PAYMT-${run.run_no}`, net: rup(netMinor), status: String(posted.data?.status ?? 'posted') }, CORS);
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) }, CORS);
  } finally {
    await sql.end();
  }
});
