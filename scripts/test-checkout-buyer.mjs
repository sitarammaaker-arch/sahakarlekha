// Checkout buyer details (billing slice 2b): the client check (src/lib/billing/checkoutBuyer.ts) and the
// server check (supabase/functions/_shared/invoice-core.mjs validateBuyer) must agree on every case, and
// create-order / the checkout must be wired the safe way round. Plus migration 132.
// Run: node scripts/test-checkout-buyer.mjs   (npm run test:checkout-buyer)
import { readFileSync } from 'node:fs';
import { validateBuyer } from '../supabase/functions/_shared/invoice-core.mjs';
import { buyerProblem } from '../src/lib/billing/checkoutBuyer.ts';
import { stateCodeFromSetupValue, stateCodeFromName } from '../src/lib/gstStates.ts';
import { INDIAN_STATES } from '../src/lib/constants.ts';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗', msg); } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (sql) => sql.replace(/--[^\n]*/g, '');

// ── 1. Client and server agree ───────────────────────────────────────────────
const CASES = [
  [{ name: 'Kisan PACS', gstin: '', stateCode: '06', address: 'Assandh' }, true, 'unregistered, state chosen'],
  [{ name: 'Kisan PACS', gstin: '06ABCDE1234F1Z5', stateCode: '06', address: '' }, true, 'GSTIN matching the state'],
  [{ name: 'Kisan PACS', gstin: ' 06abcde1234f1z5 ', stateCode: '06', address: '' }, true, 'GSTIN lower-case with spaces'],
  [{ name: '', gstin: '', stateCode: '06', address: '' }, false, 'no name'],
  [{ name: '   ', gstin: '', stateCode: '06', address: '' }, false, 'blank name'],
  [{ name: 'X', gstin: '', stateCode: '', address: '' }, false, 'no state'],
  [{ name: 'X', gstin: '07ABCDE1234F1Z5', stateCode: '06', address: '' }, false, 'GSTIN of Delhi, Haryana chosen'],
  [{ name: 'X', gstin: '06ABC', stateCode: '06', address: '' }, false, 'short GSTIN'],
  [{ name: 'X', gstin: '06ABCDE1234F1Z!', stateCode: '06', address: '' }, false, 'GSTIN with a symbol'],
];
for (const [b, valid, label] of CASES) {
  const server = validateBuyer(b);
  ok(server.ok === valid, `server: ${label} → ${valid ? 'ok' : 'refused'}`);
  ok((buyerProblem(b, true) === '') === valid && (buyerProblem(b, false) === '') === valid, `client agrees: ${label}`);
}
{
  const r = validateBuyer({ name: ' Kisan ', gstin: '06abcde1234f1z5', stateCode: '06', address: '  ' });
  ok(r.ok && r.buyer.buyer_gstin === '06ABCDE1234F1Z5' && r.buyer.buyer_name === 'Kisan' && r.buyer.buyer_address === null, 'server normalises: upper-case GSTIN, trimmed name, blank address → null');
  ok(validateBuyer({ name: 'X', stateCode: '25' }).ok === false && validateBuyer({ name: 'X', stateCode: 'hr' }).ok === false, 'server takes only real 2-digit GST codes (25 does not exist; a Setup value is not a code)');
  ok(validateBuyer({ name: 'x'.repeat(300), stateCode: '06' }).buyer.buyer_name.length === 200, 'name capped at 200');
  ok(/[ऀ-ॿ]/.test(validateBuyer({ name: '', stateCode: '06' }).error), 'server message is Hindi-first');
}

// ── 2. The dialog's state list covers every Setup state with a real code ─────
ok(INDIAN_STATES.every((s) => /^[0-3][0-9]$/.test(stateCodeFromSetupValue(s.value))), 'every Society Setup state has a GST code');
ok(stateCodeFromSetupValue('hr') === '06' && stateCodeFromSetupValue('jk') === '01' && stateCodeFromSetupValue('nope') === '', 'Setup value → code');
ok(stateCodeFromName('Andaman & Nicobar Islands') === '35' && stateCodeFromName('haryana') === '06', 'names with "&" resolve (GST Summary passes labels too)');

// ── 3. Wiring ────────────────────────────────────────────────────────────────
{
  const co = read('supabase/functions/create-order/index.ts');
  ok(/import \{ validateBuyer \} from '\.\.\/_shared\/invoice-core\.mjs'/.test(co), 'create-order validates with the shared core');
  ok(co.indexOf('validateBuyer(buyer)') < co.indexOf("fetch('https://api.razorpay.com/v1/orders'"), 'invalid buyer refused BEFORE a Razorpay order exists');
  ok(/if \(checkedBuyer && !checkedBuyer\.ok\) return json\(\{ error: checkedBuyer\.error \}, 400\)/.test(co), 'invalid buyer → 400 with the message');
  const ins = co.indexOf("await supa.from('orders').insert({");
  const insBody = co.slice(ins, co.indexOf('});', ins));
  ok(ins > 0 && !/buyer/.test(insBody), 'base insert carries NO buyer column (works before 132)');
  ok(co.indexOf(".update(checkedBuyer.buyer)") > ins && /buyerSaved = !bErr/.test(co), 'buyer columns in a second update; failure reported as buyerSaved');

  const rc = read('src/lib/razorpayCheckout.ts');
  ok(/\.\.\.\(opts\?\.buyer \? \{ buyer: opts\.buyer \} : \{\}\)/.test(rc) && /buyerSaved: data\.buyerSaved !== false/.test(rc), 'checkout sends the buyer and passes buyerSaved back');
  const um = read('src/pages/UserManagement.tsx');
  ok(!/window\.confirm\(/.test(um.slice(um.indexOf('const handlePay'), um.indexOf('const confirmPay'))), 'plan click opens the dialog, not window.confirm');
  ok(/buyer,\n\s+onDone:/.test(um) && /<CheckoutBuyerDialog/.test(um), 'dialog confirm starts checkout with the buyer');
  ok(/if \(!r\.ok\) \{[\s\S]*?return; \/\/ keep the dialog open/.test(um), 'a refused checkout keeps the dialog (and what was typed) open');
  ok(/r\.buyerSaved === false/.test(um), 'user is told when the details could not be saved');

  const issuer = read('supabase/functions/_shared/issue-invoice.mjs');
  ok(/from\('orders'\)\.select\('\*'\)/.test(issuer) && /order\.buyer_state_code\s*\?/.test(issuer), 'issuer reads order with * and prefers the checkout buyer');
}

// ── 4. Migration 132 ─────────────────────────────────────────────────────────
{
  const up = code(read('supabase/migrations/132_orders_buyer_details.sql'));
  const down = read('supabase/migrations/132_orders_buyer_details_down.sql');
  for (const c of ['buyer_name', 'buyer_gstin', 'buyer_state_code', 'buyer_address']) {
    ok(new RegExp(`add column if not exists ${c} text`).test(up) && new RegExp(`drop column if exists ${c};`).test(down), `132 adds / drops ${c}`);
  }
  ok(/check \(buyer_gstin is null or buyer_gstin ~ '\^\[0-3\]\[0-9\]\[A-Z0-9\]\{13\}\$'\)/.test(up), 'DB checks the GSTIN shape');
  ok(/values \('132', 'orders_buyer_details'\)/.test(up) && /delete from public\.app_migrations where version = '132'/.test(down), '132 ledger insert / down delete');
}

console.log(`checkout-buyer: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
