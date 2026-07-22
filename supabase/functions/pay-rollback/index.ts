/**
 * pay-rollback — reverse a POSTED or PAID payroll run (append-only correction). Built with the user's
 * explicit authorisation (2026-07-22); STAGING-verified only.
 *
 * The lifecycle allows posted→rolled_back and paid→rolled_back as the ONLY post-post correction
 * (cancel is pre-post only). This function does not delete anything: for each voucher the run posted,
 * it writes a NEW mirror voucher with every leg's Dr/Cr SWAPPED, so the ledger nets to zero while the
 * original + its reversal both remain for audit. Then it appends the WORM 'reversed' event and moves
 * the run to 'rolled_back'.
 *
 *   posted → reverse the accrual journal (Dr↔Cr).
 *   paid   → reverse BOTH the payment voucher AND the accrual journal (money + liability unwound).
 *
 * Reversal is idempotent by construction: a rolled_back run has no outgoing transition, so a second
 * call is refused (409). Amounts mirror the ORIGINAL entries exactly — nothing is recomputed.
 *
 * FINANCIAL PATH — direct DB connection bypasses RLS, so MFA is enforced in-function via the JWT `aal`
 * claim (PAY_REQUIRE_AAL2=true after MFA go-live, ADR-0012); admin-JWT + role gate it meanwhile.
 *
 * Auth: verified JWT → society + admin role. A caller only rolls back their own society's runs.
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

  // MFA gate (see pay-post): direct-DB writes bypass the aal2 RLS gate, so enforce AAL2 in-function.
  if ((Deno.env.get('PAY_REQUIRE_AAL2') ?? '').toLowerCase() === 'true') {
    let aal = '';
    try { aal = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).aal ?? ''; } catch { /* malformed */ }
    if (aal !== 'aal2') return json(403, { error: 'MFA (AAL2) required to reverse payroll — step up your session' }, CORS);
  }

  let body: { runId?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'bad JSON' }, CORS); }
  if (!body.runId) return json(400, { error: 'runId required' }, CORS);

  const sql = postgres(dbUrl, { prepare: false, max: 3 });
  try {
    const [su] = await sql`select id, society_id, role from public.society_users where email = ${user.email} and is_active = true limit 1`;
    if (!su) return json(403, { error: 'not a society user' }, CORS);
    if (su.role !== 'admin') return json(403, { error: 'only admin may reverse payroll' }, CORS);
    const societyId = su.society_id as string;
    const societyText = String(societyId);

    const [run] = await sql`select id, society_id, state, run_no from pay_calc.payroll_run where id = ${body.runId} limit 1`;
    if (!run) return json(404, { error: 'run not found' }, CORS);
    if (run.society_id !== societyId) return json(403, { error: 'run belongs to another society' }, CORS);
    if (!canTransition(run.state, 'rolled_back')) return json(409, { error: `cannot reverse a run in state '${run.state}' (must be 'posted' or 'paid')` }, CORS);
    const wasPaid = run.state === 'paid';

    // collect the vouchers this run posted — mirror their ACTUAL entries (never recompute).
    // accrual journal: linked via posting_link(basis 'accrual'); payment: by the 'PAYMT-' convention.
    const [accrual] = await sql`
      select v.id, v."voucherNo", v.type, v.amount, v.date
      from pay_calc.posting_link pl join public.vouchers v on v.id = pl.voucher_ref
      where pl.pay_run_id = ${body.runId} and pl.basis = 'accrual' limit 1`;
    if (!accrual) return json(500, { error: 'cannot find the posted journal voucher to reverse' }, CORS);
    const originals = [accrual];
    if (wasPaid) {
      const [payment] = await sql`select id, "voucherNo", type, amount, date from public.vouchers where society_id = ${societyText} and "voucherNo" = ${'PAYMT-' + run.run_no} limit 1`;
      if (!payment) return json(500, { error: 'run is paid but the payment voucher is missing' }, CORS);
      originals.push(payment);
    }

    const reversed: { of: string; rev: string; amount: number }[] = [];
    await sql.begin(async (tx: postgres.TransactionSql) => {
      for (const orig of originals) {
        const entries = await tx`select "accountId", dr, cr, narration from public.voucher_entries where "voucherId" = ${orig.id}`;
        const revNo = `REV-${orig.voucherNo}`;
        const revId = crypto.randomUUID();
        await tx`insert into public.vouchers(id,society_id,"voucherNo",date,type,amount,narration,"createdBy")
          values(${revId},${societyText},${revNo},${String(orig.date)},${String(orig.type)},${orig.amount},${`Reversal of ${orig.voucherNo} (run ${run.run_no} rolled back)`},${String(su.id)})`;
        for (const e of entries) {
          // swap Dr/Cr — the defining move of a reversal
          await tx`insert into public.voucher_entries(id,"voucherId","accountId",dr,cr,narration,society_id)
            values(${crypto.randomUUID()},${revId},${e.accountId},${e.cr},${e.dr},${`Reversal: ${e.narration ?? ''}`},${societyText})`;
        }
        reversed.push({ of: orig.voucherNo as string, rev: revNo, amount: Number(orig.amount) });
      }

      const [{ nextseq }] = await tx`select coalesce(max(sequence),0)+1 as nextseq from pay_calc.pay_event where aggregate_id = ${body.runId}`;
      await tx`insert into pay_calc.pay_event(society_id,aggregate_type,aggregate_id,sequence,event_type,producer_kind,actor_email,payload)
        values(${societyId},'pay_run',${body.runId},${nextseq},'reversed'::pay_core.pay_event_type,'human',${user.email},${JSON.stringify({ from: run.state, reversed })})`;
      await tx`update pay_calc.payroll_run set state = 'rolled_back'::pay_core.pay_run_state, updated_at = now(), updated_by = ${su.id} where id = ${body.runId}`;
    });

    return json(200, { ok: true, runId: body.runId, state: 'rolled_back', from: run.state, reversed }, CORS);
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) }, CORS);
  } finally {
    await sql.end();
  }
});
