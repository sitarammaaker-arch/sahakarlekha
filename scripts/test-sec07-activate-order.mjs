// SEC-07 (product audit 2026-11-17) — a paid order always activates its plan: migration 186 activate_order() + webhook.
// Before: razorpay-webhook marked the order paid, then upserted the subscription, reading neither result; a failed second
// write left "paid, no plan" and the retry was answered "already processed".
// Run on Postgres (PGlite) while building: a browser and anon were refused; a wrong amount activated nothing (order still
// 'created'); the right one activated plus / 6 seats / 12 months, a retry answered 'already'; an order stranded by the old
// failure (paid, never activated) was activated by a retry of its own payment and refused for a different payment;
// set_period_end was honoured; the backfill marked existing paid orders activated; re-run clean; down removed it all.
// Run: node scripts/test-sec07-activate-order.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(pathResolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };

const m = read('supabase/migrations/186_activate_order.sql');
const d = read('supabase/migrations/186_activate_order_down.sql');
const fn = m.slice(m.indexOf('create or replace function public.activate_order'), m.indexOf('$$;', m.indexOf('create or replace function public.activate_order')));

// ── the function ──
ok(fn.includes('select * into o from public.orders where id = p_order_id for update;'), 'the order row is locked — two concurrent webhooks cannot both activate');
ok(fn.includes(`if o.activated_at is not null then\n    return jsonb_build_object('status', 'already'`), 'an activated order answers "already" (safe to retry)');
ok(fn.includes("if p_amount_paise is not null and o.amount_paise is not null and p_amount_paise <> o.amount_paise then") && fn.includes("'amount_mismatch'"), 'the captured amount must equal the order\'s amount_paise');
ok(fn.includes("o.payment_id <> p_payment_id then") && fn.includes("'different_payment'"), 'a second, different payment never activates the order again');
ok(fn.indexOf('update public.orders') > fn.indexOf("'amount_mismatch'") && fn.indexOf('insert into public.subscriptions') > fn.indexOf('update public.orders'), 'order paid + subscription active are written AFTER the checks, in the same function (one transaction)');
ok(fn.includes("activated_at = v_now") && fn.includes("on conflict (society_id) do update"), 'the order is stamped activated and the subscription upserted');
ok(fn.includes("coalesce(o.set_period_end, v_now + interval '12 months')"), 'period_end from the order (create-order decided it) or 12 months');
ok(/security definer set search_path = ''/.test(fn), 'definer with an empty search_path');
ok(/revoke execute on function public\.activate_order\(text, text, bigint\) from public, anon, authenticated;\ngrant execute on function public\.activate_order\(text, text, bigint\) to service_role;/.test(m), 'only the service role (the webhook) can call it');
ok(/update public\.orders set activated_at = coalesce\(updated_at, created_at\) where status = 'paid' and activated_at is null;/.test(m), 'existing paid orders are marked activated (their plans are live)');
ok(/^begin;/m.test(m) && /^commit;/m.test(m) && /values \('186', 'activate_order'\)/.test(m) && /drop function if exists public\.activate_order\(text, text, bigint\);/.test(d), '186 is one transaction, registers itself, and has a down');

// ── seats = the plan catalogue ──
{
  const P = await import(pathToFileURL(pathResolve(ROOT, 'src/lib/plans.ts')).href);
  ok(fn.includes("case o.plan when 'starter' then 1 when 'plus' then 6 else null end"), 'seats: starter 1, plus 6, others unlimited');
  ok(P.PLAN_CATALOG.starter.seatsLimit === 1 && P.PLAN_CATALOG.plus.seatsLimit === 6 && P.PLAN_CATALOG.pro.seatsLimit === null, '…which is what PLAN_CATALOG says');
}

// ── the webhook ──
{
  const wh = read('supabase/functions/razorpay-webhook/index.ts');
  ok(wh.includes("supa.rpc('activate_order', {") && wh.includes('p_amount_paise: Number.isFinite(Number(payment.amount)) ? Number(payment.amount) : null'), 'the webhook activates through activate_order with the captured amount');
  ok(!wh.includes(".from('subscriptions')") && !/from\('orders'\)\.update/.test(wh), 'it no longer writes orders / subscriptions itself');
  ok(!wh.includes("'already processed'") && wh.includes("return new Response('activation failed — retry', { status: 500 });"), 'a failed activation returns 500 (Razorpay retries); no early "already processed" exit');
  ok(wh.indexOf("supa.rpc('activate_order'") < wh.indexOf('issueInvoiceForOrder(supa, orderId'), 'the invoice is issued after activation (and on a retry of an activated order)');
  ok(wh.includes("if (status === 'amount_mismatch' || status === 'different_payment') {") && wh.includes('console.error(`order ${orderId} NOT activated'), 'a mismatch is logged and never activates');
}

console.log(`SEC-07 activate_order (186): ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
