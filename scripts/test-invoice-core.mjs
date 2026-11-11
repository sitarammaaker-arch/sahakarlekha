// Unit tests for the PURE subscription-invoice calculator (supabase/functions/_shared/invoice-core.mjs)
// plus static guards on migration 130 and the razorpay-webhook wiring. Every paisa of the GST split
// is proven here before an invoice is issued.
// Run: node scripts/test-invoice-core.mjs
import { readFileSync } from 'node:fs';
import { GST_STATE_CODES, SETUP_STATE_CODES, cleanGstin, buyerStateCode, stateCodeFromState, validStateCode, splitInclusive, buildInvoiceCalc, totalWithGstPaise } from '../supabase/functions/_shared/invoice-core.mjs';
import { INDIAN_STATES } from '../src/lib/constants.ts';
import { PLAN_CATALOG } from '../src/lib/plans.ts';
import { GST_STATE_CODES as APP_CODES } from '../src/lib/gstStates.ts';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (sql) => sql.replace(/--[^\n]*/g, '');

const sum = (s) => s.taxable + s.cgst + s.sgst + s.igst;

// ── 1. State codes mirror the app's table ────────────────────────────────────
ok(JSON.stringify(GST_STATE_CODES) === JSON.stringify(APP_CODES), 'GST_STATE_CODES mirrors src/lib/gstStates.ts exactly');
ok(cleanGstin(' 06abcde1234f1z5 ') === '06ABCDE1234F1Z5', 'GSTIN trimmed + upper-cased');
ok(cleanGstin('99ABCDE1234F1Z5') === '' && cleanGstin('06ABC') === '' && cleanGstin(null) === '', 'implausible GSTIN → empty');
ok(buyerStateCode('07ABCDE1234F1Z5', 'Haryana') === '07', 'GSTIN prefix beats the state name');
ok(buyerStateCode('', ' haryana ') === '06', 'state name used when no GSTIN');
ok(buyerStateCode('', 'hr') === '06' && buyerStateCode('', 'DL') === '07' && buyerStateCode('', 'Jammu & Kashmir') === '01' && buyerStateCode('', '09') === '09', 'Setup value, "&" names and bare codes resolve');
ok(buyerStateCode('', '99') === '' && validStateCode('25') === '' && validStateCode('06') === '06', 'non-existent codes refused');
{
  // Every Society Setup state (INDIAN_STATES) maps — derived from its label through the app's GST table.
  let bad = [];
  for (const st of INDIAN_STATES) {
    const want = APP_CODES[st.label.toLowerCase().replace(/\s*&\s*/g, ' and ')];
    if (!want || SETUP_STATE_CODES[st.value] !== want || stateCodeFromState(st.value) !== want) bad.push(st.value);
  }
  ok(bad.length === 0 && Object.keys(SETUP_STATE_CODES).length === INDIAN_STATES.length, `SETUP_STATE_CODES matches INDIAN_STATES exactly (bad: ${bad.join(',') || 'none'})`);
}
ok(buyerStateCode('', 'Atlantis') === '' && buyerStateCode(undefined, undefined) === '', 'unknown state → empty, never guessed');

// ── 2. The three plan prices at 18% ──────────────────────────────────────────
{
  const s = splitInclusive(149900, 18, true);
  ok(s.taxable === 127034 && s.cgst === 11433 && s.sgst === 11433 && s.igst === 0, `₹1,499 intra = 1270.34 + 114.33 + 114.33 (got ${JSON.stringify(s)})`);
  const i = splitInclusive(149900, 18, false);
  ok(i.taxable === 127034 && i.igst === 22866 && i.cgst === 0 && i.sgst === 0, `₹1,499 inter = 1270.34 + IGST 228.66 (got ${JSON.stringify(i)})`);
  const p = splitInclusive(399900, 18, true);
  ok(sum(p) === 399900 && p.cgst === p.sgst, '₹3,999 splits to the paisa, CGST = SGST');
  const q = splitInclusive(999900, 18, false);
  ok(sum(q) === 999900, '₹9,999 inter splits to the paisa');
}

// ── 3. Invariants over every rupee amount a prorated upgrade can produce ─────
{
  let bad = 0, worst = 0;
  for (let r = 1; r <= 10000; r++) {
    for (const rate of [18, 12, 5, 0]) {
      for (const intra of [true, false]) {
        const t = r * 100;
        const s = splitInclusive(t, rate, intra);
        const tax = s.cgst + s.sgst + s.igst;
        const exact = (s.taxable * rate) / 100;
        worst = Math.max(worst, Math.abs(tax - exact));
        if (sum(s) !== t || s.cgst !== s.sgst || s.taxable < 0 || (intra ? s.igst !== 0 : s.cgst !== 0)
            || ![s.taxable, s.cgst, s.sgst, s.igst].every(Number.isSafeInteger)) bad++;
      }
    }
  }
  ok(bad === 0, `₹1…₹10,000 × {18,12,5,0}% × intra/inter: taxable + taxes = total, CGST = SGST, integer paise (${bad} bad)`);
  // Intra-state rounds each half to the paisa, so the pair can sit just over 1 paisa off the exact tax.
  ok(worst < 1.5, `tax within 1.5 paise of taxable × rate (worst ${worst.toFixed(2)})`);
  const z = splitInclusive(100, 0, true);
  ok(z.taxable === 100 && z.cgst === 0, '0% rate → all taxable');
}
{
  let threw = 0;
  for (const bad of [0, -100, 1.5, NaN]) { try { splitInclusive(bad, 18, true); } catch { threw++; } }
  try { splitInclusive(100, -1, true); } catch { threw++; }
  ok(threw === 5, 'non-positive / fractional total and negative rate are refused');
}

// ── 4. buildInvoiceCalc ──────────────────────────────────────────────────────
const SELLER = { state_code: '06', gst_rate_pct: 18 };
{
  ok(buildInvoiceCalc({ amountRupees: 1499, seller: null, buyer: { state: 'Haryana' } }).status === 'seller_incomplete', 'no seller row → seller_incomplete');
  ok(buildInvoiceCalc({ amountRupees: 1499, seller: { state_code: null, gst_rate_pct: 18 }, buyer: { state: 'Haryana' } }).status === 'seller_incomplete', 'seller without state → seller_incomplete');
  ok(buildInvoiceCalc({ amountRupees: 1499, seller: { state_code: '06', gst_rate_pct: null }, buyer: { state: 'Haryana' } }).status === 'seller_incomplete', 'seller without rate → seller_incomplete');
  ok(buildInvoiceCalc({ amountRupees: 1499, seller: SELLER, buyer: { name: 'X' } }).status === 'buyer_state_unknown', 'buyer without state/GSTIN → buyer_state_unknown');

  const h = buildInvoiceCalc({ amountRupees: 1499, seller: SELLER, buyer: { name: ' Kisan PACS ', address: 'Assandh', state: 'Haryana', gstin: 'bad' } });
  ok(h.status === 'ok' && h.calc.place_of_supply === '06' && h.calc.cgst_paise === 11433 && h.calc.igst_paise === 0, 'Haryana buyer, Haryana seller → CGST + SGST');
  ok(h.calc.buyer_gstin === '' && h.calc.buyer_name === 'Kisan PACS' && h.calc.buyer_address === 'Assandh', 'invalid GSTIN dropped, name trimmed, address without the raw state');
  ok(h.calc.total_paise === 149900 && h.calc.gst_rate_pct === 18, 'total = order amount in paise; rate echoed for the server check');

  const d = buildInvoiceCalc({ amountRupees: 3999, seller: SELLER, buyer: { state: 'Haryana', gstin: '07ABCDE1234F1Z5' } });
  ok(d.status === 'ok' && d.calc.place_of_supply === '07' && d.calc.igst_paise > 0 && d.calc.cgst_paise === 0, 'Delhi GSTIN → IGST even if the state field says Haryana');
  const hr = buildInvoiceCalc({ amountRupees: 1499, seller: SELLER, buyer: { name: 'X', state: 'hr' } });
  ok(hr.status === 'ok' && hr.calc.place_of_supply === '06' && hr.calc.cgst_paise === 11433, "Society Setup's stored 'hr' → Haryana, CGST + SGST (not buyer_state_unknown)");
  const s = buildInvoiceCalc({ amountRupees: 1499, seller: { state_code: '06', gst_rate_pct: '18' }, buyer: { state: 'Haryana' } });
  ok(s.status === 'ok' && s.calc.gst_rate_pct === 18, 'numeric rate from PostgREST as a string is accepted');
}

// ── 4b. "+ GST" prices (2026-11-11): charge = price + GST, and the invoice gives the price back ──
{
  ok(totalWithGstPaise(2999, 18) === 353882 && totalWithGstPaise(6999, 18) === 825882 && totalWithGstPaise(14999, '18') === 1769882, '₹2,999 / ₹6,999 / ₹14,999 + 18% = ₹3,538.82 / ₹8,258.82 / ₹17,698.82');
  for (const id of ['starter', 'plus', 'pro']) {
    const price = PLAN_CATALOG[id].price;
    const total = totalWithGstPaise(price, 18);
    for (const intra of [true, false]) {
      const s = splitInclusive(total, 18, intra);
      ok(s.taxable === price * 100 && sum(s) === total && s.cgst === s.sgst, `${id}: the invoice taxable value is the plan price to the paisa (${intra ? 'intra' : 'inter'})`);
    }
  }
  // A prorated upgrade is any whole-rupee amount — never off by a paisa at 18%.
  let bad = 0;
  for (let r = 1; r <= 12000; r += 7) {
    const t = totalWithGstPaise(r, 18);
    const a = splitInclusive(t, 18, true), b = splitInclusive(t, 18, false);
    if (a.taxable !== r * 100 || b.taxable !== r * 100 || sum(a) !== t || sum(b) !== t) bad++;
  }
  ok(bad === 0, 'every whole-rupee price + 18% splits back to that price, intra and inter');
  let threw = 0;
  for (const [r, p] of [[0, 18], [-5, 18], [10.5, 18], [100, null], [100, ''], [100, 'x'], [100, -1]]) { try { totalWithGstPaise(r, p); } catch { threw++; } }
  ok(threw === 7, 'no charge is computed from a bad price or a missing / bad rate');
  const c = buildInvoiceCalc({ amountPaise: 353882, amountRupees: 3539, seller: SELLER, buyer: { state: 'Haryana' } });
  ok(c.status === 'ok' && c.calc.total_paise === 353882 && c.calc.taxable_paise === 299900 && c.calc.cgst_paise === 26991 && c.calc.sgst_paise === 26991, 'amountPaise wins over the rounded rupees: ₹2,999 + ₹269.91 + ₹269.91 = ₹3,538.82');
  ok(buildInvoiceCalc({ amountPaise: null, amountRupees: 1499, seller: SELLER, buyer: { state: 'Haryana' } }).calc.total_paise === 149900, 'an order from before 158 (no paise) still uses its whole rupees');

  const co = read('supabase/functions/create-order/index.ts');
  const m = co.match(/const PRICE_INR: Record<string, number> = \{ starter: (\d+), plus: (\d+), pro: (\d+) \};/);
  ok(m && Number(m[1]) === PLAN_CATALOG.starter.price && Number(m[2]) === PLAN_CATALOG.plus.price && Number(m[3]) === PLAN_CATALOG.pro.price, 'create-order PRICE_INR mirrors PLAN_CATALOG');
  ok(/totalPaise = totalWithGstPaise\(rupees, seller\?\.gst_rate_pct\)/.test(co) && /from\('billing_seller'\)\.select\('gst_rate_pct'\)/.test(co) && !/\b18\b/.test(co.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'the GST rate comes from billing_seller — never hard-coded in create-order');
  ok(co.indexOf('totalWithGstPaise(rupees') < co.indexOf("fetch('https://api.razorpay.com/v1/orders'"), 'no rate → refused BEFORE a Razorpay order exists');
  ok(/amount: totalPaise, \/\/ paise/.test(co), 'Razorpay is charged price + GST');
  const ins = co.indexOf("const { error: insErr } = await supa.from('orders').insert({");
  ok(/amount_paise: totalPaise,/.test(co.slice(ins, co.indexOf('});', ins))), 'amount_paise is in the base insert — no order id leaves unless the exact charge is saved');
}

// ── 4c. Migration 158 — an order is charged to the paisa ────────────────────
{
  const fn = (sql) => { const a = sql.indexOf('create or replace function public.issue_invoice('); return a < 0 ? '' : sql.slice(a, sql.indexOf('$$;', a) + 3); };
  const up = read('supabase/migrations/158_orders_amount_paise.sql');
  const down = read('supabase/migrations/158_orders_amount_paise_down.sql');
  const f133 = fn(read('supabase/migrations/133_orders_test_mode.sql'));
  const f158 = fn(up);
  const a = f158.indexOf('  -- 158:'), b = f158.indexOf('  if (p_calc ->> \'gst_rate_pct\')');
  const a3 = f133.indexOf("  v_total := (p_calc ->> 'total_paise')::bigint;"), b3 = f133.indexOf('  if (p_calc ->> \'gst_rate_pct\')');
  ok(a > 0 && f158.slice(0, a) + f158.slice(b) === f133.slice(0, a3) + f133.slice(b3), '158 issue_invoice = 133 body with only the total check changed');
  ok(/if v_total <> coalesce\(v_order\.amount_paise, v_order\.amount::bigint \* 100\) then\s+raise exception/.test(f158), 'total must equal the exact charge; older orders fall back to rupees × 100');
  ok(/is_test is distinct from false/.test(f158) && f158.indexOf('is_test is distinct from false') < f158.indexOf('insert into public.invoice_counters'), '158 keeps the test-mode guard');
  ok(fn(down) === f133, '158 down restores the 133 issue_invoice byte-for-byte');
  ok(/add column if not exists amount_paise bigint check \(amount_paise is null or amount_paise > 0\)/.test(up) && /drop column if exists amount_paise/.test(down), 'amount_paise added / dropped');
  ok(/revoke execute on function public\.issue_invoice\(text, jsonb\) from public, anon, authenticated;/.test(code(up)), '158 keeps issue_invoice service-role only');
  ok(/values \('158', 'orders_amount_paise'\)/.test(up) && /delete from public\.app_migrations where version = '158'/.test(down), '158 ledger insert / down delete');
}

// ── 5. Migration 130 ─────────────────────────────────────────────────────────
{
  const up = read('supabase/migrations/130_billing_invoices.sql');
  const down = read('supabase/migrations/130_billing_invoices_down.sql');
  const c = code(up);
  for (const t of ['billing_seller', 'invoice_counters', 'invoices']) {
    ok(new RegExp(`create table if not exists public\\.${t} \\(`).test(c) && new RegExp(`alter table public\\.${t} enable row level security`).test(c), `130 creates ${t} with RLS on`);
    ok(new RegExp(`drop table if exists public\\.${t};`).test(down), `130 down drops ${t}`);
  }
  ok(!/policy[^;]*on public\.(billing_seller|invoice_counters)/.test(c), 'seller + counters have no policies (server only)');
  ok(/create policy "invoices_select_own" on public\.invoices\s+for select using \(society_id = get_current_society_id\(\)\);/.test(c), 'invoices: read-own-society only');
  ok(!/on public\.invoices\s+for (insert|update|delete|all)/.test(c), 'invoices: no client write / update / delete policy');
  ok(/order_id\s+text not null unique references public\.orders\(id\)/.test(c), 'one invoice per order (unique order_id)');
  ok(/check \(taxable_paise \+ cgst_paise \+ sgst_paise \+ igst_paise = total_paise\)/.test(c) && /check \(cgst_paise = sgst_paise\)/.test(c), 'DB enforces taxable + taxes = total and CGST = SGST');
  ok(/insert into public\.billing_seller \(id\) values \(true\)/.test(c) && !/insert into public\.billing_seller \([^)]*gstin/.test(c), 'seller row seeded EMPTY — no invented seller details');
  ok(/revoke execute on function public\.issue_invoice\(text, jsonb\) from public, anon, authenticated;/.test(c) && /grant execute on function public\.issue_invoice\(text, jsonb\) to service_role;/.test(c), 'issue_invoice: service_role only');
  ok(/for update;/.test(c) && /'already'/.test(c), 'issue_invoice locks the order and is idempotent');
  ok(/'seller_incomplete'/.test(c) && c.indexOf("'seller_incomplete'") < c.indexOf('insert into public.invoice_counters'), 'an incomplete seller returns BEFORE a number is taken');
  ok(/v_order\.amount::bigint \* 100/.test(c) && /<> v_seller\.gst_rate_pct/.test(c), 'server re-checks total vs order and rate vs seller');
  ok(/at time zone 'Asia\/Kolkata'/.test(c) && /extract\(month from v_date\) >= 4/.test(c), 'FY from the IST invoice date, April start');
  ok(/values \('130', 'billing_invoices'\)/.test(c) && /delete from public\.app_migrations where version = '130'/.test(down), '130 ledger insert / down delete');
  ok(/drop function if exists public\.issue_invoice\(text, jsonb\);/.test(down), '130 down drops issue_invoice');
}

// ── 6. Webhook wiring ────────────────────────────────────────────────────────
{
  const wh = read('supabase/functions/razorpay-webhook/index.ts');
  const issuer = read('supabase/functions/_shared/issue-invoice.mjs');
  ok(/from '\.\.\/_shared\/issue-invoice\.mjs'/.test(wh) && /from '\.\/invoice-core\.mjs'/.test(issuer), 'webhook → shared issuer → the tested core');
  ok(/rpc\('issue_invoice'/.test(issuer) && !/rpc\('issue_invoice'/.test(wh), 'only the shared issuer calls issue_invoice');
  ok(wh.indexOf(".from('subscriptions').upsert(") < wh.indexOf('issueInvoiceForOrder(supa, orderId'), 'subscription is activated BEFORE the invoice — an invoice problem never blocks the plan');
  ok(/try \{[\s\S]*issueInvoiceForOrder\(supa, orderId[,)][\s\S]*\} catch/.test(wh), 'invoice issuance is wrapped so its failure cannot fail the webhook');
}

console.log(`invoice-core: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
