// The shared invoice issuer (supabase/functions/_shared/issue-invoice.mjs) driven with a FAKE service-role
// client, plus static guards on migration 131 and the admin-retry-invoice Edge Function (billing slice 3).
// Run: node scripts/test-issue-invoice.mjs   (npm run test:issue-invoice)
import { readFileSync } from 'node:fs';
import { issueInvoiceForOrder } from '../supabase/functions/_shared/issue-invoice.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (sql) => sql.replace(/--[^\n]*/g, '');

/** A tiny PostgREST stand-in: tables are arrays of rows; rpc answers come from `rpc`. Records every write. */
function fakeClient({ tables, rpc, failUpdate = false, throwOn = null }) {
  const calls = { rpc: [], updates: [] };
  const from = (table) => {
    const q = { table, filters: [], patch: null };
    const rows = () => (tables[table] ?? []).filter((r) => q.filters.every(([k, v]) => r[k] === v));
    const api = {
      select: () => api,
      eq: (k, v) => { q.filters.push([k, v]); return api; },
      limit: () => api,
      maybeSingle: async () => {
        if (throwOn === table) throw new Error(`boom on ${table}`);
        return { data: rows()[0] ?? null, error: null };
      },
      update: (patch) => { q.patch = patch; return api; },
      then: (res, rej) => {
        // awaited update(): record it
        calls.updates.push({ table, patch: q.patch, filters: q.filters });
        const out = failUpdate ? Promise.reject(new Error('column "invoice_error" does not exist')) : Promise.resolve({ data: null, error: null });
        return out.then(res, rej);
      },
    };
    return api;
  };
  return {
    calls,
    from,
    rpc: async (name, args) => { calls.rpc.push({ name, args }); return rpc(name, args); },
  };
}

const ORDER = { id: 'order_1', society_id: 'SOC1', amount: 1499, status: 'paid' };
const SELLER = { id: true, legal_name: 'S', gstin: '06ABCDE1234F1Z5', address: 'A', state_code: '06', sac: 'X', gst_rate_pct: 18 };
const SOC = { society_id: 'SOC1', name: 'Kisan PACS', address: 'Assandh', district: 'Karnal', state: 'hr' }; // Setup stores the short value
const issued = () => ({ data: { status: 'issued', invoice_no: 'SL/2026-27/0001' }, error: null });

// ── 1. Happy path ────────────────────────────────────────────────────────────
{
  const c = fakeClient({ tables: { orders: [ORDER], billing_seller: [SELLER], society_settings: [SOC] }, rpc: issued });
  const r = await issueInvoiceForOrder(c, 'order_1');
  ok(r.status === 'issued' && r.invoice_no === 'SL/2026-27/0001', 'paid order → issued with number');
  const call = c.calls.rpc[0];
  ok(call?.name === 'issue_invoice' && call.args.p_order_id === 'order_1', 'calls issue_invoice for that order');
  ok(call.args.p_calc.total_paise === 149900 && call.args.p_calc.cgst_paise === 11433 && call.args.p_calc.place_of_supply === '06', 'p_calc carries the core split');
  ok(call.args.p_calc.buyer_address === 'Assandh, Karnal' && call.args.p_calc.buyer_name === 'Kisan PACS', 'buyer snapshot from society_settings');
  const u = c.calls.updates.find((x) => x.table === 'orders');
  ok(u && u.patch.invoice_error === null && typeof u.patch.invoice_tried_at === 'string', 'issued → pending reason CLEARED, tried_at stamped');
}
{
  const c = fakeClient({ tables: { orders: [ORDER], billing_seller: [SELLER], society_settings: [SOC] }, rpc: () => ({ data: { status: 'already', invoice_no: 'SL/2026-27/0001' }, error: null }) });
  const r = await issueInvoiceForOrder(c, 'order_1');
  ok(r.status === 'already' && c.calls.updates[0].patch.invoice_error === null, 'retry of an invoiced order → already, reason cleared');
}

// ── 1b. The buyer confirmed at checkout (migration 132) wins over society_settings ──
{
  const order = { ...ORDER, buyer_name: 'Delhi Coop Ltd', buyer_gstin: '07ABCDE1234F1Z5', buyer_state_code: '07', buyer_address: null };
  const c = fakeClient({ tables: { orders: [order], billing_seller: [SELLER], society_settings: [SOC] }, rpc: issued });
  await issueInvoiceForOrder(c, 'order_1');
  const p = c.calls.rpc[0].args.p_calc;
  ok(p.buyer_name === 'Delhi Coop Ltd' && p.buyer_gstin === '07ABCDE1234F1Z5' && p.place_of_supply === '07' && p.igst_paise === 22866, 'checkout GSTIN (Delhi) → IGST, even though the society is in Haryana');
  ok(p.buyer_address === 'Assandh, Karnal', 'blank checkout address falls back to the society address');
}
{
  const order = { ...ORDER, buyer_name: '', buyer_gstin: null, buyer_state_code: '06', buyer_address: 'Ward 3' };
  const c = fakeClient({ tables: { orders: [order], billing_seller: [SELLER], society_settings: [] }, rpc: issued });
  const r = await issueInvoiceForOrder(c, 'order_1');
  const p = c.calls.rpc[0].args.p_calc;
  ok(r.status === 'issued' && p.place_of_supply === '06' && p.buyer_address === 'Ward 3' && p.buyer_gstin === '', 'checkout state alone is enough, even with no society_settings row');
}

// ── 2. Pending reasons are recorded, never thrown ────────────────────────────
{
  const c = fakeClient({ tables: { orders: [ORDER], billing_seller: [{ id: true }], society_settings: [SOC] }, rpc: issued });
  const r = await issueInvoiceForOrder(c, 'order_1');
  ok(r.status === 'seller_incomplete' && c.calls.rpc.length === 0, 'empty seller row → seller_incomplete, issue_invoice NOT called');
  ok(c.calls.updates[0].patch.invoice_error === 'seller_incomplete', 'reason written to the order');
}
{
  const c = fakeClient({ tables: { orders: [ORDER], billing_seller: [SELLER], society_settings: [{ ...SOC, state: '' }] }, rpc: issued });
  const r = await issueInvoiceForOrder(c, 'order_1');
  ok(r.status === 'buyer_state_unknown' && c.calls.rpc.length === 0, 'society without state → buyer_state_unknown');
}
{
  const c = fakeClient({ tables: { orders: [ORDER], billing_seller: [SELLER], society_settings: [SOC] }, rpc: () => ({ data: null, error: { message: 'total mismatch' } }) });
  const r = await issueInvoiceForOrder(c, 'order_1');
  ok(r.status === 'error' && r.error === 'total mismatch' && c.calls.updates[0].patch.invoice_error === 'error: total mismatch', 'RPC error → status error + message recorded');
}
{
  const c = fakeClient({ tables: { orders: [ORDER], billing_seller: [SELLER], society_settings: [SOC] }, rpc: issued, throwOn: 'billing_seller' });
  const r = await issueInvoiceForOrder(c, 'order_1');
  ok(r.status === 'error' && /boom/.test(r.error), 'an exception becomes status error — never thrown to the caller');
}
{
  const c = fakeClient({ tables: { orders: [{ ...ORDER, status: 'created' }], billing_seller: [SELLER], society_settings: [SOC] }, rpc: issued });
  const r = await issueInvoiceForOrder(c, 'order_1');
  ok(r.status === 'order_not_paid' && c.calls.rpc.length === 0, 'unpaid order → no invoice');
}
{
  const c = fakeClient({ tables: { orders: [] }, rpc: issued });
  ok((await issueInvoiceForOrder(c, 'nope')).status === 'unknown_order', 'unknown order');
}
{
  const c = fakeClient({ tables: { orders: [ORDER], billing_seller: [SELLER], society_settings: [SOC] }, rpc: issued, failUpdate: true });
  const r = await issueInvoiceForOrder(c, 'order_1');
  ok(r.status === 'issued', 'before migration 131 (no reason columns) a good invoice is still reported issued');
}

// ── 3. Migration 131 ─────────────────────────────────────────────────────────
{
  const up = code(read('supabase/migrations/131_billing_invoices_admin.sql'));
  const down = read('supabase/migrations/131_billing_invoices_admin_down.sql');
  for (const fn of ['admin_list_invoices', 'admin_list_pending_invoices']) {
    const body = up.slice(up.indexOf(`function public.${fn}(`));
    ok(/security definer/.test(body.slice(0, 400)) && /if not public\.is_platform_admin\(\) then\s+raise exception/.test(body), `${fn}: definer, refuses non-admins`);
    ok(new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon;`).test(up), `${fn}: anon cannot execute`);
    ok(new RegExp(`drop function if exists public\\.${fn}\\(`).test(down), `131 down drops ${fn}`);
  }
  ok(/o\.status = 'paid'\s+and not exists \(select 1 from public\.invoices i where i\.order_id = o\.id\)/.test(up), 'pending = paid orders with no invoice row');
  ok(/add column if not exists invoice_error text/.test(up) && /drop column if exists invoice_error/.test(down), 'reason column added / dropped');
  ok(/values \('131', 'billing_invoices_admin'\)/.test(up) && /delete from public\.app_migrations where version = '131'/.test(down), '131 ledger insert / down delete');
}

// ── 4. admin-retry-invoice ───────────────────────────────────────────────────
{
  const fn = read('supabase/functions/admin-retry-invoice/index.ts');
  ok(/import \{ issueInvoiceForOrder \} from '\.\.\/_shared\/issue-invoice\.mjs'/.test(fn), 'retry uses the same shared issuer as the webhook');
  const gate = fn.indexOf("asCaller.rpc('is_platform_admin')");
  const service = fn.indexOf("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
  ok(gate > 0 && service > gate, 'is_platform_admin is checked AS THE CALLER before the service-role client exists');
  ok(/isAdmin !== true\) return json\(\{ error: 'Platform admin only' \}, 403\)/.test(fn), 'non-admin → 403');
  ok(/mfaPending\(bearer\)\) return json/.test(fn) && /bearer === anonKey\) return json/.test(fn), 'anon key and 2FA-pending tokens refused');
  ok(!/rpc\('issue_invoice'/.test(fn), 'retry never calls issue_invoice directly');
}

console.log(`issue-invoice: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
