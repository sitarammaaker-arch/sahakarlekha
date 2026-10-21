// The invoice email (supabase/functions/_shared/invoice-email.mjs, billing slice 4) driven with a FAKE service-role
// client and a FAKE Resend, plus static guards on migration 134, create-order, the webhook and the retry function.
// Run: node scripts/test-invoice-email.mjs   (npm run test:invoice-email)
import { readFileSync } from 'node:fs';
import { sendInvoiceEmail, buildInvoiceEmail, stateLabel } from '../supabase/functions/_shared/invoice-email.mjs';
import { issueInvoiceForOrder } from '../supabase/functions/_shared/issue-invoice.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/**
 * A PostgREST stand-in that really applies update() to its rows, honours eq()/is() filters and returns the
 * updated rows for update().select() — enough to prove the claim is exactly-once.
 */
function fakeClient(tables, { rpc } = {}) {
  const writes = [];
  const from = (table) => {
    const q = { filters: [], patch: null, select: false };
    const match = () => (tables[table] ?? []).filter((r) => q.filters.every(([k, v]) => (v === null ? r[k] == null : r[k] === v)));
    const run = () => {
      if (q.patch) {
        const hit = match();
        for (const r of hit) Object.assign(r, q.patch);
        writes.push({ table, patch: { ...q.patch }, filters: [...q.filters], rows: hit.length });
        return { data: q.select ? hit.map((r) => ({ id: r.id })) : null, error: null };
      }
      return { data: match(), error: null };
    };
    const api = {
      select: () => { q.select = true; return api; },
      eq: (k, v) => { q.filters.push([k, v]); return api; },
      is: (k, v) => { q.filters.push([k, v]); return api; },
      limit: () => api,
      update: (patch) => { q.patch = patch; return api; },
      maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
      then: (res, rej) => Promise.resolve(run()).then(res, rej),
    };
    return api;
  };
  return { writes, from, rpc: async (n, a) => rpc(n, a) };
}

/** Fake Resend: records each call; `reply` decides the response. */
function fakeFetch(reply = () => ({ ok: true, status: 200, text: async () => '{"id":"e1"}' })) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return reply(calls.length); };
  return { calls, f };
}

const INV = () => ({
  id: 'inv1', invoice_no: 'SL/2026-27/0001', invoice_date: '2026-10-21', society_id: 'SOC1', order_id: 'order_1',
  payment_id: 'pay_1', plan: 'starter', kind: 'new',
  seller_name: 'Seller <Pvt> Ltd', seller_gstin: '06ABCDE1234F1Z5', seller_address: 'Karnal', seller_state_code: '06',
  buyer_name: 'Kisan PACS & Co', buyer_address: 'Assandh', buyer_state_code: '06', buyer_gstin: null, place_of_supply: '06',
  sac: '998431', gst_rate_pct: 18, taxable_paise: 127034, cgst_paise: 11433, sgst_paise: 11433, igst_paise: 0, total_paise: 149900,
  emailed_at: null, emailed_to: null, email_error: null,
});
const ORDER = () => ({ id: 'order_1', society_id: 'SOC1', amount: 1499, status: 'paid', payer_email: 'Payer@Example.com ' });
const USERS = () => [
  { society_id: 'SOC1', email: 'admin1@example.com', role: 'admin', is_active: true },
  { society_id: 'SOC1', email: 'acct@example.com', role: 'accountant', is_active: true },
  { society_id: 'SOC1', email: 'old@example.com', role: 'admin', is_active: false },
];
const CFG = (f, extra = {}) => ({ apiKey: 're_test', from: 'सहकार लेखा <billing@sahakarlekha.com>', appUrl: 'https://app.example/', fetch: f, ...extra });

// ── 1. Happy path: sent once, to the payer, every figure from the row ───────
{
  const t = { invoices: [INV()], orders: [ORDER()], society_users: USERS() };
  const c = fakeClient(t);
  const r = fakeFetch();
  const out = await sendInvoiceEmail(c, 'order_1', CFG(r.f));
  ok(out.status === 'sent' && out.to.join() === 'payer@example.com', 'sent to the payer (trimmed, lower-cased)');
  ok(r.calls.length === 1 && r.calls[0].url === 'https://api.resend.com/emails', 'one Resend call');
  const h = r.calls[0].init.headers;
  ok(h.Authorization === 'Bearer re_test' && h['Idempotency-Key'] === 'invoice-SL/2026-27/0001', 'auth + idempotency key = invoice number');
  const b = r.calls[0].body;
  ok(b.from === 'सहकार लेखा <billing@sahakarlekha.com>' && b.subject.includes('SL/2026-27/0001'), 'from + subject with the number');
  ok(b.html.includes('₹1,499.00') && b.html.includes('₹1,270.34') && b.html.includes('CGST @ 9%') && b.html.includes('₹114.33') && !b.html.includes('IGST'), 'intra-state figures straight from the row');
  ok(b.html.includes('https://app.example/user-management') && b.text.includes('https://app.example/user-management'), 'link to the invoices card (trailing slash trimmed)');
  ok(b.html.includes('Kisan PACS &amp; Co') && b.html.includes('Seller &lt;Pvt&gt; Ltd') && !b.html.includes('<Pvt>'), 'user text is HTML-escaped');
  const inv = t.invoices[0];
  ok(inv.emailed_at && inv.emailed_to === 'payer@example.com' && inv.email_error === null, 'row: emailed_at + emailed_to, no error');

  const again = await sendInvoiceEmail(c, 'order_1', CFG(r.f));
  ok(again.status === 'already_sent' && r.calls.length === 1, 'second call (repeat webhook / retry) → already_sent, NO second email');
}

// ── 2. The claim, not the pre-check, is what stops a race ──────────────────
{
  const t = { invoices: [INV()], orders: [ORDER()], society_users: USERS() };
  const c = fakeClient(t);
  const r = fakeFetch();
  const [a, b] = await Promise.all([sendInvoiceEmail(c, 'order_1', CFG(r.f)), sendInvoiceEmail(c, 'order_1', CFG(r.f))]);
  ok(r.calls.length === 1 && [a.status, b.status].sort().join() === 'already_sent,sent', 'two concurrent senders → exactly one email');
  const claims = c.writes.filter((w) => w.patch.emailed_at && w.filters.some(([k, v]) => k === 'emailed_at' && v === null));
  ok(claims.length === 2 && claims.filter((w) => w.rows === 1).length === 1, 'both tried the `emailed_at is null` claim; only one won');
}

// ── 3. Recipient fallback: active admins only ──────────────────────────────
{
  const t = { invoices: [INV()], orders: [{ ...ORDER(), payer_email: null }], society_users: USERS() };
  const r = fakeFetch();
  const out = await sendInvoiceEmail(fakeClient(t), 'order_1', CFG(r.f));
  ok(out.status === 'sent' && out.to.join() === 'admin1@example.com', 'no payer → active admins (not accountants, not inactive)');
}
{
  const t = { invoices: [INV()], orders: [{ ...ORDER(), payer_email: 'not-an-email' }], society_users: [] };
  const r = fakeFetch();
  const out = await sendInvoiceEmail(fakeClient(t), 'order_1', CFG(r.f));
  ok(out.status === 'no_recipient' && r.calls.length === 0 && t.invoices[0].email_error === 'no_recipient' && !t.invoices[0].emailed_at, 'nobody to send to → no_recipient recorded, nothing claimed');
}

// ── 4. Not configured / not migrated / no invoice: nothing sent ────────────
{
  const t = { invoices: [INV()], orders: [ORDER()], society_users: USERS() };
  const r = fakeFetch();
  const out = await sendInvoiceEmail(fakeClient(t), 'order_1', CFG(r.f, { apiKey: '' }));
  ok(out.status === 'not_configured' && r.calls.length === 0 && t.invoices[0].email_error === 'not_configured' && !t.invoices[0].emailed_at, 'no RESEND_API_KEY → not_configured recorded, no claim');
}
{
  const legacy = INV(); delete legacy.emailed_at; delete legacy.emailed_to; delete legacy.email_error;
  const t = { invoices: [legacy], orders: [ORDER()], society_users: USERS() };
  const c = fakeClient(t);
  const r = fakeFetch();
  const out = await sendInvoiceEmail(c, 'order_1', CFG(r.f));
  ok(out.status === 'not_migrated' && r.calls.length === 0 && c.writes.length === 0, 'before migration 134 → not_migrated, no email, no write');
}
{
  const r = fakeFetch();
  const out = await sendInvoiceEmail(fakeClient({ invoices: [], orders: [ORDER()] }), 'order_1', CFG(r.f));
  ok(out.status === 'no_invoice' && r.calls.length === 0, 'no invoice row → no_invoice');
}

// ── 5. Resend failure releases the claim, records why; retry then sends ────
{
  const t = { invoices: [INV()], orders: [ORDER()], society_users: USERS() };
  const c = fakeClient(t);
  const r = fakeFetch((n) => (n === 1 ? { ok: false, status: 422, text: async () => '{"message":"domain not verified"}' } : { ok: true, status: 200, text: async () => '' }));
  const out = await sendInvoiceEmail(c, 'order_1', CFG(r.f));
  ok(out.status === 'error' && /resend 422: .*domain not verified/.test(out.error), 'Resend 4xx → error with detail');
  ok(t.invoices[0].emailed_at === null && /domain not verified/.test(t.invoices[0].email_error), 'claim released, reason recorded');
  const out2 = await sendInvoiceEmail(c, 'order_1', CFG(r.f));
  ok(out2.status === 'sent' && r.calls.length === 2 && t.invoices[0].email_error === null, 'next attempt sends and clears the reason');
}
{
  const t = { invoices: [INV()], orders: [ORDER()], society_users: USERS() };
  const out = await sendInvoiceEmail(fakeClient(t), 'order_1', CFG(async () => { throw new Error('network down'); }));
  ok(out.status === 'error' && /network down/.test(out.error) && t.invoices[0].emailed_at === null, 'network throw → error, claim released, never thrown');
}

// ── 6. Force (SuperAdmin "फिर भेजें") sends again, with a fresh idempotency key ──
{
  const t = { invoices: [INV()], orders: [ORDER()], society_users: USERS() };
  const c = fakeClient(t);
  const r = fakeFetch();
  await sendInvoiceEmail(c, 'order_1', CFG(r.f));
  const out = await sendInvoiceEmail(c, 'order_1', CFG(r.f, { force: true }));
  ok(out.status === 'sent' && r.calls.length === 2, 'force → a second email');
  ok(r.calls[1].init.headers['Idempotency-Key'] !== r.calls[0].init.headers['Idempotency-Key'], 'forced send uses a new idempotency key');
}

// ── 7. Inter-state + labels ────────────────────────────────────────────────
{
  const inv = { ...INV(), place_of_supply: '07', buyer_state_code: '07', buyer_gstin: '07ABCDE1234F1Z5', cgst_paise: 0, sgst_paise: 0, igst_paise: 22866, taxable_paise: 127034 };
  const { html, text } = buildInvoiceEmail(inv, { appUrl: '' });
  ok(html.includes('IGST @ 18%') && html.includes('₹228.66') && !html.includes('CGST'), 'inter-state → IGST only');
  ok(text.includes('07 - Delhi') && text.includes('GSTIN 07ABCDE1234F1Z5'), 'place of supply + buyer GSTIN in the text part');
  ok(text.includes('https://sahakarlekha.com/user-management'), 'default app URL');
  ok(stateLabel('06') === '06 - Haryana' && stateLabel('99') === '99', 'stateLabel matches the app rule');
}

// ── 8. Through the shared issuer ───────────────────────────────────────────
{
  const t = { invoices: [], orders: [ORDER()], society_users: USERS(), billing_seller: [{ id: true, state_code: '06', gst_rate_pct: 18 }], society_settings: [] };
  t.orders[0].buyer_state_code = '06'; t.orders[0].buyer_name = 'Kisan PACS';
  const c = fakeClient(t, { rpc: () => { t.invoices.push(INV()); return { data: { status: 'issued', invoice_no: 'SL/2026-27/0001' }, error: null }; } });
  const r = fakeFetch();
  const res = await issueInvoiceForOrder(c, 'order_1', { email: CFG(r.f) });
  ok(res.status === 'issued' && res.email?.status === 'sent' && r.calls.length === 1, 'issued → emailed, result.email reported, status unchanged');
}
{
  const t = { invoices: [], orders: [ORDER()], billing_seller: [{ id: true }], society_settings: [] };
  const r = fakeFetch();
  const res = await issueInvoiceForOrder(fakeClient(t, { rpc: () => ({ data: null, error: null }) }), 'order_1', { email: CFG(r.f) });
  ok(res.status === 'seller_incomplete' && !res.email && r.calls.length === 0, 'no invoice → no email attempted');
}
{
  const t = { invoices: [INV()], orders: [ORDER()], society_users: USERS(), billing_seller: [{ id: true, state_code: '06', gst_rate_pct: 18 }], society_settings: [] };
  t.orders[0].buyer_state_code = '06';
  const r = fakeFetch();
  const res = await issueInvoiceForOrder(fakeClient(t, { rpc: () => ({ data: { status: 'issued' }, error: null }) }), 'order_1');
  ok(res.status === 'issued' && !res.email && r.calls.length === 0, 'without opts.email the issuer sends nothing (old callers unchanged)');
}

// ── 9. Static guards ───────────────────────────────────────────────────────
{
  const up = read('supabase/migrations/134_invoice_email.sql');
  const down = read('supabase/migrations/134_invoice_email_down.sql');
  for (const [tbl, col] of [['orders', 'payer_email'], ['invoices', 'emailed_at'], ['invoices', 'emailed_to'], ['invoices', 'email_error']]) {
    ok(new RegExp(`alter table public\\.${tbl} add column if not exists ${col} `).test(up), `134 adds ${tbl}.${col}`);
    ok(new RegExp(`alter table public\\.${tbl} drop column if exists ${col};`).test(down), `134 down drops ${tbl}.${col}`);
  }
  ok(/values \('134', 'invoice_email'\)/.test(up) && /delete from public\.app_migrations where version = '134'/.test(down), '134 ledger insert / down delete');

  const co = read('supabase/functions/create-order/index.ts');
  const ins = co.indexOf("const { error: insErr } = await supa.from('orders').insert({");
  ok(!/payer_email/.test(co.slice(ins, co.indexOf('});', ins))), 'payer_email NOT in the base insert (checkout works before 134)');
  ok(co.indexOf(".update({ payer_email: callerEmail })") > ins, 'payer_email = the verified caller, in its own update after the insert');

  const wh = read('supabase/functions/razorpay-webhook/index.ts');
  ok(/issueInvoiceForOrder\(supa, orderId, \{ email: invoiceEmailConfig\(\) \}\)/.test(wh), 'webhook passes the email config to the shared issuer');
  ok(/Deno\.env\.get\('RESEND_API_KEY'\)/.test(wh) && /Deno\.env\.get\('RESEND_FROM'\)/.test(wh), 'webhook reads the Resend secrets from env');
  ok(!/api\.resend\.com/.test(wh), 'webhook never calls Resend directly');

  const fn = read('supabase/functions/admin-retry-invoice/index.ts');
  ok(/force:\s+resend_email === true/.test(fn), 'retry: resend only on an explicit true');
  ok(fn.indexOf("asCaller.rpc('is_platform_admin')") < fn.indexOf("Deno.env.get('RESEND_API_KEY')"), 'retry: admin gate before any email config');
}

console.log(`invoice-email: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
