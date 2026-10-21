/**
 * Email a subscription tax invoice to the society (billing slice 4, migration 134). Plain JS with an
 * injectable fetch, so scripts/test-invoice-email.mjs drives it with a fake client and a fake Resend.
 *
 * Called by the shared issuer (_shared/issue-invoice.mjs) right after an invoice is issued, and again by the
 * SuperAdmin retry. Never throws: returns { status, to?, error? }. The email carries every figure of the
 * invoice and a link to the app, where the PDF is downloaded — no attachment (the PDF is drawn in the browser).
 *
 * Exactly-once: the invoice row is CLAIMED (`emailed_at` set where it is null) before Resend is called, and the
 * Resend call carries an Idempotency-Key, so a repeated webhook or a double click never sends twice. A failed
 * send releases the claim and records email_error for SuperAdmin. Before migration 134 the columns do not
 * exist — nothing is sent (there would be no claim to stop a repeat).
 *
 * Recipients: orders.payer_email (the verified user who paid), else the society's active admins.
 * Nothing here can fail the payment or the invoice — the caller keeps its own status.
 */
import { GST_STATE_CODES } from './invoice-core.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 5;

const PLAN_NAMES = { starter: 'Starter', plus: 'Plus', pro: 'Pro' };
const KIND_HI = { new: '1 वर्ष', renew: '1 वर्ष का नवीनीकरण', upgrade: 'बाकी अवधि के लिए अपग्रेड' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const inr = (paise) => '₹' + (Number(paise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** "06 - Haryana" — the same first-match rule as src/lib/billing/invoiceView.ts stateLabel. */
export function stateLabel(code) {
  const name = Object.keys(GST_STATE_CODES).find((k) => GST_STATE_CODES[k] === code);
  return name ? `${code} - ${titleCase(name)}` : String(code ?? '');
}

/** DD-MM-YYYY from the row's YYYY-MM-DD. */
const fmtDate = (d) => { const [y, m, day] = String(d ?? '').split('-'); return day ? `${day}-${m}-${y}` : String(d ?? ''); };

/**
 * Subject, HTML and plain text for one invoice row — every figure straight from the row.
 * @param {object} inv  an invoices row (migration 130)
 * @param {{ appUrl: string }} opts
 */
export function buildInvoiceEmail(inv, { appUrl }) {
  const link = `${String(appUrl || 'https://sahakarlekha.com').replace(/\/+$/, '')}/user-management`;
  const plan = PLAN_NAMES[inv.plan] ?? inv.plan;
  const rate = Number(inv.gst_rate_pct);
  const intra = inv.place_of_supply === inv.seller_state_code;
  const taxRows = intra
    ? [[`CGST @ ${rate / 2}%`, inv.cgst_paise], [`SGST @ ${rate / 2}%`, inv.sgst_paise]]
    : [[`IGST @ ${rate}%`, inv.igst_paise]];
  const rows = [
    ['इनवॉइस नं. / Invoice No.', inv.invoice_no],
    ['तारीख / Date', fmtDate(inv.invoice_date)],
    ['सेवा / Service', `सहकार लेखा सब्सक्रिप्शन — ${plan} plan, ${KIND_HI[inv.kind] ?? inv.kind} (SAC ${inv.sac})`],
    ['खरीदार / Bill To', inv.buyer_name + (inv.buyer_gstin ? ` · GSTIN ${inv.buyer_gstin}` : '')],
    ['Place of Supply', stateLabel(inv.place_of_supply)],
    ['कर योग्य मूल्य / Taxable Value', inr(inv.taxable_paise)],
    ...taxRows.map(([k, p]) => [k, inr(p)]),
    ['कुल / Total (GST सहित)', inr(inv.total_paise)],
  ];
  const subject = `टैक्स इनवॉइस ${inv.invoice_no} — सहकार लेखा सब्सक्रिप्शन / Tax Invoice`;
  const tr = rows.map(([k, v], i) => {
    const last = i === rows.length - 1;
    return `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#475569">${esc(k)}</td>`
      + `<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;${last ? 'font-weight:bold;color:#0f172a' : ''}">${esc(v)}</td></tr>`;
  }).join('');
  const html = `<div style="font-family:Arial,'Noto Sans Devanagari',sans-serif;line-height:1.6;color:#0f172a;max-width:600px">
    <p>नमस्ते ${esc(inv.buyer_name)},</p>
    <p>आपके सहकार लेखा सब्सक्रिप्शन के भुगतान का टैक्स इनवॉइस जारी हो गया है। विवरण नीचे है।<br>
      <span style="color:#475569">Your SahakarLekha subscription payment has been received and its tax invoice is issued.</span></p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">${tr}</table>
    <p style="margin-top:16px">
      📄 <a href="${esc(link)}" style="color:#0F7B5A;font-weight:bold">इनवॉइस की PDF डाउनलोड करें</a>
      — ऐप में लॉगिन करके <b>User Management → Invoices</b> में।<br>
      <span style="color:#475569">Download the PDF: sign in and open User Management → Invoices.</span>
    </p>
    <p style="color:#475569;font-size:12px">
      विक्रेता / Seller: ${esc(inv.seller_name)} · GSTIN ${esc(inv.seller_gstin)}<br>
      ${esc(inv.seller_address)} (${esc(stateLabel(inv.seller_state_code))})
    </p>
    <p style="color:#475569">— टीम सहकार लेखा · <a href="https://sahakarlekha.com" style="color:#0F7B5A">sahakarlekha.com</a></p>
  </div>`;
  const text = [
    `नमस्ते ${inv.buyer_name},`,
    '',
    'आपके सहकार लेखा सब्सक्रिप्शन के भुगतान का टैक्स इनवॉइस जारी हो गया है।',
    'Your SahakarLekha subscription payment has been received and its tax invoice is issued.',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `PDF: ${link} (User Management → Invoices)`,
    '',
    `Seller: ${inv.seller_name} · GSTIN ${inv.seller_gstin}`,
    `${inv.seller_address} (${stateLabel(inv.seller_state_code)})`,
  ].join('\n');
  return { subject, html, text };
}

/** Valid, de-duplicated, lower-cased addresses (at most MAX_RECIPIENTS). */
function cleanList(list) {
  const out = [];
  for (const e of list) {
    const v = String(e ?? '').trim().toLowerCase();
    if (EMAIL_RE.test(v) && !out.includes(v)) out.push(v);
  }
  return out.slice(0, MAX_RECIPIENTS);
}

/** Best-effort write of the send state — a failure here must not change what the caller is told. */
async function record(supa, id, patch) {
  try { await supa.from('invoices').update(patch).eq('id', id); } catch { /* best-effort */ }
}

/**
 * @param {*} supa  SERVICE-ROLE client
 * @param {string} orderId
 * @param {{ apiKey?: string, from?: string, appUrl?: string, force?: boolean, fetch?: typeof fetch }} cfg
 *   force = SuperAdmin "send again": skips the already-sent check (the claim still runs, unconditionally).
 * @returns {Promise<{ status: string, to?: string[], error?: string }>}
 *   status: sent | already_sent | not_migrated | no_invoice | not_configured | no_recipient | error
 */
export async function sendInvoiceEmail(supa, orderId, cfg = {}) {
  let inv = null;
  let holding = false; // we hold the claim — an unexpected throw must release it
  try {
    const { data, error } = await supa.from('invoices').select('*').eq('order_id', orderId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { status: 'no_invoice' };
    inv = data;
    if (!('emailed_at' in inv)) return { status: 'not_migrated' };
    if (inv.emailed_at && !cfg.force) return { status: 'already_sent' };

    if (!cfg.apiKey || !cfg.from) {
      await record(supa, inv.id, { email_error: 'not_configured' });
      return { status: 'not_configured' };
    }

    // Who gets it: the payer, else the society's active admins.
    const { data: order } = await supa.from('orders').select('*').eq('id', orderId).maybeSingle();
    let to = cleanList([order?.payer_email]);
    if (!to.length) {
      const { data: users } = await supa.from('society_users').select('email, role, is_active').eq('society_id', inv.society_id);
      to = cleanList((users ?? []).filter((u) => u.is_active !== false && u.role === 'admin').map((u) => u.email));
    }
    if (!to.length) {
      await record(supa, inv.id, { email_error: 'no_recipient' });
      return { status: 'no_recipient' };
    }

    // Claim. Unclaimed → somebody else already sent (or is sending) it.
    const claimedAt = new Date().toISOString();
    let claim = supa.from('invoices').update({ emailed_at: claimedAt, email_error: null }).eq('id', inv.id);
    if (!cfg.force) claim = claim.is('emailed_at', null);
    const { data: claimed, error: cErr } = await claim.select('id');
    if (cErr) return { status: 'error', error: `claim: ${cErr.message}` };
    if (!claimed?.length) return { status: 'already_sent' };
    holding = true;

    const { subject, html, text } = buildInvoiceEmail(inv, { appUrl: cfg.appUrl });
    const doFetch = cfg.fetch ?? fetch;
    let res;
    try {
      res = await doFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
          // Resend drops a repeat with the same key; a forced resend is a new send on purpose.
          'Idempotency-Key': `invoice-${inv.invoice_no}${cfg.force ? `-${claimedAt}` : ''}`,
        },
        body: JSON.stringify({ from: cfg.from, to, subject, html, text }),
      });
    } catch (e) {
      res = { ok: false, status: 0, text: async () => (e instanceof Error ? e.message : String(e)) };
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      const error = `resend ${res.status}${detail ? `: ${detail}` : ''}`;
      await record(supa, inv.id, { emailed_at: null, email_error: error });
      return { status: 'error', error };
    }
    await record(supa, inv.id, { emailed_to: to.join(', '), email_error: null });
    return { status: 'sent', to };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (inv?.id) await record(supa, inv.id, holding ? { emailed_at: null, email_error: `error: ${error}` } : { email_error: `error: ${error}` });
    return { status: 'error', error };
  }
}
