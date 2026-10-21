// Unit tests for the PURE subscription-invoice calculator (supabase/functions/_shared/invoice-core.mjs)
// plus static guards on migration 130 and the razorpay-webhook wiring. Every paisa of the GST split
// is proven here before an invoice is issued.
// Run: node scripts/test-invoice-core.mjs
import { readFileSync } from 'node:fs';
import { GST_STATE_CODES, SETUP_STATE_CODES, cleanGstin, buyerStateCode, stateCodeFromState, validStateCode, splitInclusive, buildInvoiceCalc } from '../supabase/functions/_shared/invoice-core.mjs';
import { INDIAN_STATES } from '../src/lib/constants.ts';
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
