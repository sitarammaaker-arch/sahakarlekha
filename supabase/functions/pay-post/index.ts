/**
 * pay-post — post a LOCKED payroll run to the general ledger THROUGH THE POSTING SERVICE (P1).
 *
 * This function no longer writes a voucher. It builds the legs (pure, tested: lib/pay/posting/runPosting.ts,
 * bundled in _shared/pay-core.mjs), then calls public.post_voucher AS THE SIGNED-IN USER, so the database —
 * not this function — decides the society (from the JWT), requires the role claim, and enforces FY-lock,
 * period-lock, an OPEN financial year, ΣDr = ΣCr and the journal event. One atomic write: voucher, its lines,
 * its entries and the `voucher.posted` journal event, or nothing.
 *
 *   Dr  Salary expense                 earnings − loss of pay
 *   Cr  Salary payable                 net pay
 *   Cr  PF / ESI / PT / TDS payable    each deduction, to its own head
 *   Cr  Employee advance               loan recovered from pay
 *
 * Heads come from the society's account_roles (never account ids chosen here). A missing head, an unknown
 * deduction or a net that does not reconcile REFUSES the posting (409) — nothing is written.
 *
 * IDEMPOTENT: the voucher id is derived from the run id, so a retry after a dropped connection posts the same
 * voucher again (post_voucher answers 'exists') and then finishes linking it — never a second salary voucher.
 *
 * Replaces the direct-DB writer that was switched OFF on 2026-09-27 (M0 finding R23, #551): it wrote no
 * `lines`, no journal event, no FY / period-lock check, and bypassed RLS.
 *
 * Gate: PAY_LEDGER_POSTING_ENABLED must be 'true' (an operational switch, off by default — turned on per
 * project once the path is verified there).
 * Auth: verified JWT → society + admin role.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
import { canTransition, buildRunAccrual, makePostVoucherPayload, payrollDocIds, PAYROLL_ROLES } from '../_shared/pay-core.mjs';
import { rpc, loadHeads, runTotals } from '../_shared/pay-ledger.ts';

// SEC-03 (migration 085): a token that still owes a 2FA code gets nothing. getUser() verifies the
// token; its payload is read only to refuse more (unreadable → pending).
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
  // Operational switch (off by default). Checked before any auth or DB work.
  if ((Deno.env.get('PAY_LEDGER_POSTING_ENABLED') ?? '').toLowerCase() !== 'true') {
    return json(503, { error: 'Payroll की बही-posting अभी बंद है — admin इसे चालू करेगा। (Payroll ledger posting is switched off.)', code: 'PAY_LEDGER_POSTING_DISABLED' }, CORS);
  }

  const supaUrl = Deno.env.get('SUPABASE_URL') ?? '', anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const dbUrl = Deno.env.get('PAY_DB_URL') ?? Deno.env.get('SUPABASE_DB_URL') ?? '';
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!jwt) return json(401, { error: 'missing bearer token' }, CORS);
  if (mfaPending(jwt)) return json(403, { error: '2FA required — finish the 2FA step and sign in again' }, CORS);
  const { data: { user } } = await createClient(supaUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } }).auth.getUser();
  if (!user?.email) return json(401, { error: 'invalid session' }, CORS);

  // MFA gate for this FINANCIAL action: enforced from the verified JWT's `aal` claim when PAY_REQUIRE_AAL2=true
  // (off by default so it cannot fail-close before MFA go-live — ADR-0012).
  if ((Deno.env.get('PAY_REQUIRE_AAL2') ?? '').toLowerCase() === 'true') {
    let aal = '';
    try { aal = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).aal ?? ''; } catch { /* malformed → treat as no MFA */ }
    if (aal !== 'aal2') return json(403, { error: 'MFA (AAL2) required to post payroll — step up your session' }, CORS);
  }

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

    const [run] = await sql`select id, society_id, state, run_no, period_month::text as period_month,
                                   (date_trunc('month', period_month) + interval '1 month - 1 day')::date::text as period_end
                            from pay_calc.payroll_run where id = ${body.runId} limit 1`;
    if (!run) return json(404, { error: 'run not found' }, CORS);
    if (run.society_id !== societyId) return json(403, { error: 'run belongs to another society' }, CORS);
    if (!canTransition(run.state, 'posted')) return json(409, { error: `cannot post a run in state '${run.state}' (must be 'locked')` }, CORS);

    // 1. the run's money, and the society's heads
    const { lines, netMinor } = await runTotals(sql, body.runId, String(run.period_month));
    const { heads, missing: missingCore } = await loadHeads(sql, societyText, [PAYROLL_ROLES.salaryExpense, PAYROLL_ROLES.salaryPayable]);
    if (missingCore.length) {
      return json(409, { error: `इस समिति के खातों में ये भूमिकाएँ तय नहीं हैं: ${missingCore.join(', ')} — पहले Ledger Heads में तय करें। / account roles not mapped`, code: 'PAY-POST-HEAD', missingHeads: missingCore }, CORS);
    }

    // 2. the legs (pure) — refuses a missing head, an unknown deduction, an unreconciled net
    const built = buildRunAccrual(lines, netMinor, heads);
    if (!built.ok) return json(409, { error: built.message, code: built.code, missingHeads: built.missingHeads, unknown: built.unknown }, CORS);

    // 3. the posting service, as the user. Deterministic ids ⇒ a retry returns 'exists', never a second voucher.
    const ids = payrollDocIds(body.runId);
    const payload = makePostVoucherPayload({
      id: ids.accrualVoucherId, eventId: ids.accrualEventId, voucherNo: `PAY-${run.run_no}`, type: 'journal',
      date: String(run.period_end), narration: `Payroll ${run.run_no}`, createdBy: user.email, occurredAt: new Date().toISOString(), legs: built.legs,
    });
    const posted = await rpc(supaUrl, anonKey, jwt, 'post_voucher', payload);
    if (!posted.ok) return json(409, { error: posted.message, code: posted.code ? `post_voucher:${posted.code}` : 'PAY-POST-REFUSED' }, CORS);
    const voucherId = String(posted.data?.id ?? ids.accrualVoucherId);

    // 4. link the voucher to the run and move it to 'posted' (one transaction; safe to repeat)
    await sql.begin(async (tx: postgres.TransactionSql) => {
      const [already] = await tx`select id from pay_calc.posting_link where pay_run_id = ${body.runId} and basis = 'accrual' limit 1`;
      const plId = already
        ? already.id
        : (await tx`insert into pay_calc.posting_link(society_id,pay_run_id,voucher_ref,basis) values(${societyId},${body.runId},${voucherId},'accrual') returning id`)[0].id;
      const [{ nextseq }] = await tx`select coalesce(max(sequence),0)+1 as nextseq from pay_calc.pay_event where aggregate_id = ${body.runId}`;
      await tx`insert into pay_calc.pay_event(society_id,aggregate_type,aggregate_id,sequence,event_type,producer_kind,actor_email,payload)
        values(${societyId},'pay_run',${body.runId},${nextseq},'posted'::pay_core.pay_event_type,'human',${user.email},${JSON.stringify({ voucher: voucherId, expense: rup(built.expenseMinor), deductions: rup(built.deductionsMinor), net: rup(built.netMinor), via: 'post_voucher' })})`;
      await tx`update pay_calc.payslip set status = 'posted'::pay_core.payslip_status where pay_run_id = ${body.runId}`;
      await tx`update pay_calc.payroll_run set state = 'posted'::pay_core.pay_run_state, posting_ref = ${plId}, updated_at = now(), updated_by = ${su.id} where id = ${body.runId}`;
    });

    return json(200, {
      ok: true, runId: body.runId, state: 'posted', voucherId, voucherNo: `PAY-${run.run_no}`,
      expense: rup(built.expenseMinor), net: rup(built.netMinor), statutory: rup(built.expenseMinor - built.netMinor),   // expense = net + statutory (+ recoveries)
      status: String(posted.data?.status ?? 'posted'),
    }, CORS);
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) }, CORS);
  } finally {
    await sql.end();
  }
});
