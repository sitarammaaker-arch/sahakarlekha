// Shared glue for the payroll ledger functions (pay-post / pay-pay / pay-rollback) — P1.
//
// The money logic is NOT here: the legs, the post_voucher payload, the ids and the messages are the PURE
// functions bundled in pay-core.mjs (src/lib/pay/posting/runPosting.ts, tested by test:pay-run-posting).
// This file is only the I/O around them: calling the posting service as the signed-in user, and reading the
// run's totals and the society's account_roles.
import { PAYROLL_ROLES, headsFromRoles, postVoucherErrorCode, postVoucherMessage } from './pay-core.mjs';

export interface RpcResult { ok: boolean; data?: Record<string, unknown>; code?: string | null; message?: string }

/**
 * Call a posting-service function (post_voucher / cancel_voucher) AS THE USER.
 * The user's own JWT is forwarded, so the DATABASE decides the society (from the token, never the payload),
 * requires the role claim, and enforces FY-lock / period-lock / open-FY / balance — exactly what the app's
 * own posting enforces. The function never writes a voucher itself.
 */
export async function rpc(supaUrl: string, anonKey: string, jwt: string, fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  let res: Response;
  try {
    res = await fetch(`${supaUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anonKey, authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch (e) {
    return { ok: false, code: null, message: `could not reach the posting service: ${String((e as Error)?.message ?? e)}` };
  }
  let body: Record<string, unknown> = {};
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (res.ok) return { ok: true, data: body };
  const raw = String(body.message ?? body.error ?? body.hint ?? `HTTP ${res.status}`);
  const code = postVoucherErrorCode(raw);
  return { ok: false, code, message: postVoucherMessage(code, raw) };
}

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

/** The society's payroll heads from account_roles, plus the roles that are missing. */
export async function loadHeads(sql: Sql, societyText: string, need: readonly string[]) {
  const roleNames = Object.values(PAYROLL_ROLES) as string[];
  const rows = await sql`select role, account_id from public.account_roles where society_id = ${societyText} and role = any(${roleNames})`;
  const heads = headsFromRoles(rows as { role: string; account_id: string }[]);
  const have = new Set(rows.map((r) => String(r.role)));
  const missing = need.filter((r) => !have.has(r));
  return { heads, missing };
}

/** A locked run's money, per component, from its payslips (paise) — the input of buildRunAccrual. */
export async function runTotals(sql: Sql, runId: string, periodMonth: string) {
  const lines = await sql`
    select cc.code, cv.kind, coalesce(sum(pl.computed_minor), 0)::bigint as amount
    from pay_calc.payslip_line pl
    join pay_calc.payslip p on p.id = pl.payslip_id
    join pay_config.component_catalog cc on cc.id = pl.component_id
    join lateral (select kind from pay_config.component_version v
                  where v.component_id = cc.id and v.status = 'active' and v.effective_from <= ${periodMonth}
                  order by v.effective_from desc limit 1) cv on true
    where p.pay_run_id = ${runId}
    group by cc.code, cv.kind`;
  const [net] = await sql`select coalesce(sum(net_minor), 0)::bigint as n from pay_calc.payslip where pay_run_id = ${runId}`;
  return {
    lines: lines.map((l) => ({ code: String(l.code), kind: String(l.kind), amountMinor: Number(l.amount) })),
    netMinor: Number(net.n),
  };
}
