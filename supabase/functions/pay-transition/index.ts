/**
 * pay-transition — advance a payroll run through its lifecycle (Deno Edge Function).
 *
 * draft → verified → approved → locked. Each step appends a WORM pay_event and updates the run
 * state, enforcing the state machine (canTransition, bundled from the pure runtime) — an invalid
 * jump is refused, never applied. Maker-checker: `verify` = admin/accountant; `approve`/`lock`/
 * `cancel` = admin only. POSTED / PAID are financial and are NOT handled here — they are gated on
 * MFA (ADR-0012) + ledger integration, a later phase.
 *
 * Auth: verified JWT → society_users → society + role. A caller only ever transitions their own
 * society's runs. Writes over a direct DB connection (PostgREST can't reach pay_*).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
import { canTransition } from '../_shared/pay-core.mjs';

const ACTIONS: Record<string, { event: string; target: string; roles: string[] }> = {
  verify: { event: 'verified', target: 'verified', roles: ['admin', 'accountant'] },
  approve: { event: 'approved', target: 'approved', roles: ['admin'] },
  lock: { event: 'locked', target: 'locked', roles: ['admin'] },
  cancel: { event: 'cancelled', target: 'cancelled', roles: ['admin'] },
};

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

  let body: { runId?: string; action?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'bad JSON' }, CORS); }
  const a = ACTIONS[body.action ?? ''];
  if (!a) return json(400, { error: "action must be verify / approve / lock / cancel" }, CORS);
  if (!body.runId) return json(400, { error: 'runId required' }, CORS);

  const sql = postgres(dbUrl, { prepare: false, max: 3 });
  try {
    const [su] = await sql`select id, society_id, role from public.society_users where email = ${user.email} and is_active = true limit 1`;
    if (!su) return json(403, { error: 'not a society user' }, CORS);
    if (!a.roles.includes(su.role)) return json(403, { error: `${body.action} requires role: ${a.roles.join(' / ')}` }, CORS);

    const [run] = await sql`select id, society_id, state from pay_calc.payroll_run where id = ${body.runId} limit 1`;
    if (!run) return json(404, { error: 'run not found' }, CORS);
    if (run.society_id !== su.society_id) return json(403, { error: 'run belongs to another society' }, CORS);
    if (!canTransition(run.state, a.target)) {
      return json(409, { error: `cannot ${body.action} a run in state '${run.state}'` }, CORS);
    }

    const [{ nextseq }] = await sql`select coalesce(max(sequence), 0) + 1 as nextseq from pay_calc.pay_event where aggregate_id = ${body.runId}`;
    await sql.begin(async (tx: postgres.TransactionSql) => {
      await tx`insert into pay_calc.pay_event(society_id,aggregate_type,aggregate_id,sequence,event_type,producer_kind,actor_email,payload)
        values(${run.society_id},'pay_run',${body.runId},${nextseq},${a.event}::pay_core.pay_event_type,'human',${user.email},${JSON.stringify({ action: body.action, from: run.state, to: a.target })})`;
      await tx`update pay_calc.payroll_run set state = ${a.target}::pay_core.pay_run_state, updated_at = now(), updated_by = ${su.id} where id = ${body.runId}`;
    });

    return json(200, { ok: true, runId: body.runId, state: a.target, from: run.state }, CORS);
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) }, CORS);
  } finally {
    await sql.end();
  }
});
