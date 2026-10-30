/**
 * The notification outbox worker core (email slice 1, migration 142). Plain JS with an injectable fetch and
 * client, so scripts/test-email-outbox.mjs drives it with a fake service-role client and a fake Resend.
 *
 * One run = claim a batch (claim_outbox leases the rows and already marked suppressed / unverified ones), render
 * each row's template, send it through Resend with Idempotency-Key = the row's idempotency_key, and report the
 * result with complete_outbox (which owns retry/backoff/give-up). Never throws.
 *
 * Not configured (no RESEND_API_KEY / RESEND_FROM) → claims NOTHING, so the queue simply waits for the key.
 * Retryable = network error, 429 and 5xx. Any other 4xx (bad address, bad from) is permanent → failed.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const base = (appUrl) => String(appUrl || 'https://sahakarlekha.com').replace(/\/+$/, '');
const shell = (body) => `<div style="font-family:Arial,'Noto Sans Devanagari',sans-serif;line-height:1.6;color:#0f172a;max-width:600px">${body}
    <p style="color:#475569">— टीम सहकार लेखा · <a href="https://sahakarlekha.com" style="color:#0F7B5A">sahakarlekha.com</a></p>
  </div>`;

/** Role keys (society_users.role) → Hindi label; unknown roles show as stored. */
const ROLE_HI = {
  admin: 'एडमिन', accountant: 'लेखाकार', viewer: 'व्यूअर', auditor: 'ऑडिटर', manager: 'प्रबंधक',
  secretary: 'सचिव', cashier: 'कैशियर', storeKeeper: 'भंडारपाल', procurementOfficer: 'खरीद अधिकारी',
  salesOperator: 'बिक्री संचालक', internalAuditor: 'आंतरिक ऑडिटर', externalCA: 'बाहरी CA',
  boardMember: 'बोर्ड सदस्य', chairman: 'अध्यक्ष', employee: 'कर्मचारी', dataEntry: 'डेटा एंट्री',
};
const roleLabel = (r, en) => (en || !ROLE_HI[r] ? String(r ?? '') : `${ROLE_HI[r]} (${r})`);

/**
 * One notice email: a greeting, Hindi + English lines (or English only), optional button, optional footnote.
 * `lines` = [[hi, en], …]; values are escaped here.
 */
function notice(row, { subjectHi, subjectEn, lines, button, foot, unsubscribe }) {
  const en = row.locale === 'en';
  const name = row.payload?.name ? String(row.payload.name) : '';
  const hello = en ? `Hello${name ? ` ${esc(name)}` : ''},` : `नमस्ते${name ? ` ${esc(name)}` : ''},`;
  const paras = lines.map(([hi, eng]) => (en
    ? `<p>${esc(eng)}</p>`
    : `<p>${esc(hi)}<br><span style="color:#475569">${esc(eng)}</span></p>`)).join('\n    ');
  const btn = button ? `<p style="margin:20px 0"><a href="${esc(button.href)}" style="background:#0F7B5A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">${esc(en ? button.en : button.hi)}</a></p>` : '';
  const footHtml = foot ? `<p style="color:#475569;font-size:12px">${esc(en ? foot[1] : `${foot[0]} / ${foot[1]}`)}</p>` : '';
  const unsubLabel = unsubscribe ? (en ? unsubscribe.en : `${unsubscribe.hi} / ${unsubscribe.en}`) : '';
  const unsubHtml = unsubscribe ? `<p style="color:#475569;font-size:12px"><a href="${esc(unsubscribe.href)}" style="color:#475569">${esc(unsubLabel)}</a></p>` : '';
  const html = shell(`<p>${hello}</p>
    ${paras}
    ${btn}
    ${footHtml}
    ${unsubHtml}`);
  const text = [
    en ? `Hello${name ? ` ${name}` : ''},` : `नमस्ते${name ? ` ${name}` : ''},`, '',
    ...lines.flatMap(([hi, eng]) => (en ? [eng] : [hi, eng])),
    ...(button ? ['', button.href] : []),
    ...(foot ? ['', en ? foot[1] : `${foot[0]} / ${foot[1]}`] : []),
    ...(unsubscribe ? ['', `${unsubLabel}: ${unsubscribe.href}`] : []),
  ].join('\n');
  const out = { subject: en ? subjectEn : `${subjectHi} / ${subjectEn}`, html, text };
  // RFC 2369: lets Gmail/Outlook show their own "Unsubscribe" next to the sender.
  if (unsubscribe) out.headers = { 'List-Unsubscribe': `<${unsubscribe.href}>` };
  return out;
}

const SECURITY_FOOT = ['अगर यह बदलाव आपकी जानकारी में नहीं है, तो तुरंत अपनी समिति के एडमिन से संपर्क करें।',
  'If you did not expect this change, contact your society admin at once.'];

/**
 * Template registry: key → (row, { appUrl }) → { subject, html, text }. Hindi first with an English line
 * (house style, as the invoice email); locale 'en' drops the Hindi.
 */
export const TEMPLATES = {
  email_verify(row, { appUrl }) {
    const token = String(row.payload?.token ?? '');
    if (!/^[0-9a-f]{48}$/.test(token)) throw new Error('email_verify: payload has no token');
    const link = `${base(appUrl)}/verify-email?token=${token}`;
    const name = row.payload?.name ? String(row.payload.name) : '';
    const en = row.locale === 'en';
    const subject = en ? 'Verify your email — SahakarLekha' : 'अपना ईमेल सत्यापित करें — सहकार लेखा / Verify your email';
    const btn = `<p style="margin:20px 0"><a href="${esc(link)}" style="background:#0F7B5A;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">${en ? 'Verify email' : 'ईमेल सत्यापित करें / Verify'}</a></p>`;
    const html = shell(en
      ? `<p>Hello${name ? ` ${esc(name)}` : ''},</p>
    <p>Please confirm that this address is yours. Until it is confirmed, SahakarLekha sends no notifications here.</p>
    ${btn}
    <p style="color:#475569;font-size:12px">The link works for 48 hours. If you did not ask for this, ignore this email.</p>`
      : `<p>नमस्ते${name ? ` ${esc(name)}` : ''},</p>
    <p>कृपया पुष्टि करें कि यह ईमेल आपका है। पुष्टि होने तक सहकार लेखा इस पते पर कोई सूचना नहीं भेजेगा।<br>
      <span style="color:#475569">Please confirm this address is yours. Until then, no notifications are sent here.</span></p>
    ${btn}
    <p style="color:#475569;font-size:12px">लिंक 48 घंटे तक चलेगा। अगर आपने यह नहीं माँगा, तो इस ईमेल को अनदेखा करें।<br>
      The link works for 48 hours. If you did not ask for this, ignore this email.</p>`);
    const text = (en
      ? [`Hello${name ? ` ${name}` : ''},`, '', 'Please confirm this address is yours:', link, '', 'The link works for 48 hours.']
      : [`नमस्ते${name ? ` ${name}` : ''},`, '', 'कृपया पुष्टि करें कि यह ईमेल आपका है:', link, '',
         'लिंक 48 घंटे तक चलेगा। / The link works for 48 hours.']).join('\n');
    return { subject, html, text };
  },

  /** society_users INSERT (migration 143). Carries a verify token unless the address was already verified. */
  user_invite(row, { appUrl }) {
    const p = row.payload ?? {};
    const token = p.token ? String(p.token) : '';
    if (token && !/^[0-9a-f]{48}$/.test(token)) throw new Error('user_invite: bad token');
    const en = row.locale === 'en';
    const soc = String(p.society_name ?? '');
    const role = roleLabel(p.role, en);
    const lines = [
      [`आपको सहकार लेखा पर "${soc}" में ${role} के रूप में जोड़ा गया है (जोड़ने वाले: ${p.by}).`,
        `You have been added to "${soc}" on SahakarLekha as ${role} (added by ${p.by}).`],
      ['लॉगिन के लिए यही ईमेल और एडमिन से मिला पासवर्ड इस्तेमाल करें।',
        'Sign in with this email and the password your admin gives you.'],
    ];
    if (token) lines.push(['नीचे बटन दबाकर पुष्टि करें कि यह ईमेल आपका है — तभी आगे की सूचनाएँ यहाँ आएँगी।',
      'Click below to confirm this email is yours — only then will notifications reach it.']);
    return notice(row, {
      subjectHi: `${soc} — सहकार लेखा में आपका स्वागत है`,
      subjectEn: 'Welcome to SahakarLekha',
      lines,
      button: token
        ? { href: `${base(appUrl)}/verify-email?token=${token}`, hi: 'ईमेल सत्यापित करें', en: 'Verify email' }
        : { href: `${base(appUrl)}/login`, hi: 'लॉगिन करें', en: 'Sign in' },
      foot: token
        ? ['पुष्टि का लिंक 48 घंटे चलेगा। अगर आप इस समिति से जुड़े नहीं हैं, तो इस ईमेल को अनदेखा करें।',
            'The link works for 48 hours. If you are not part of this society, ignore this email.']
        : null,
    });
  },

  /** society_users role change (migration 143) — a security notice to the affected user. */
  role_changed(row, { appUrl }) {
    const p = row.payload ?? {};
    const en = row.locale === 'en';
    const soc = String(p.society_name ?? '');
    return notice(row, {
      subjectHi: 'आपकी भूमिका बदली गई — सहकार लेखा',
      subjectEn: 'Your role was changed — SahakarLekha',
      lines: [[
        `"${soc}" में आपकी भूमिका ${roleLabel(p.old_role, en)} से बदलकर ${roleLabel(p.new_role, en)} कर दी गई है (बदलने वाले: ${p.by}).`,
        `Your role in "${soc}" was changed from ${roleLabel(p.old_role, en)} to ${roleLabel(p.new_role, en)} (by ${p.by}).`,
      ]],
      button: { href: `${base(appUrl)}/login`, hi: 'ऐप खोलें', en: 'Open the app' },
      foot: SECURITY_FOOT,
    });
  },

  /** society_settings."fyUnlockRequestedBy" set (migration 143) — the other admins must approve. */
  fy_unlock_requested(row, { appUrl }) {
    const p = row.payload ?? {};
    const soc = String(p.society_name ?? '');
    const fy = p.financial_year ? ` (${p.financial_year})` : '';
    return notice(row, {
      subjectHi: 'वित्त वर्ष अनलॉक का अनुरोध — आपकी मंज़ूरी चाहिए',
      subjectEn: 'FY unlock requested — your approval is needed',
      lines: [
        [`"${soc}" के ऑडिट-लॉक वित्त वर्ष${fy} को खोलने का अनुरोध ${p.by} ने किया है।`,
          `${p.by} has asked to unlock the audit-locked financial year${fy} of "${soc}".`],
        ['नियम के अनुसार किसी दूसरे एडमिन की मंज़ूरी ज़रूरी है: Society Setup → FY Lock में देखें।',
          'A different admin must approve it: see Society Setup → FY Lock.'],
      ],
      button: { href: `${base(appUrl)}/society-setup`, hi: 'Society Setup खोलें', en: 'Open Society Setup' },
      foot: SECURITY_FOOT,
    });
  },

  /** society_settings."fyLocked" true → false (migration 143) — every admin is told. */
  fy_unlocked(row, { appUrl }) {
    const p = row.payload ?? {};
    const soc = String(p.society_name ?? '');
    const fy = p.financial_year ? ` (${p.financial_year})` : '';
    return notice(row, {
      subjectHi: 'वित्त वर्ष अनलॉक हुआ — सहकार लेखा',
      subjectEn: 'Financial year unlocked — SahakarLekha',
      lines: [
        [`"${soc}" का ऑडिट-लॉक वित्त वर्ष${fy} अनलॉक कर दिया गया है (अनलॉक करने वाले: ${p.by}).`,
          `The audit-locked financial year${fy} of "${soc}" was unlocked (by ${p.by}).`],
        ['अब इस वर्ष की entries बदली जा सकती हैं। काम पूरा होने पर इसे फिर से लॉक करें।',
          'Entries for this year can now be changed. Lock it again when the work is done.'],
      ],
      button: { href: `${base(appUrl)}/society-setup`, hi: 'Society Setup खोलें', en: 'Open Society Setup' },
      foot: SECURITY_FOOT,
    });
  },

  /**
   * Daily statutory reminder (migration 145, compliance-reminders fn) — 7 / 2 / 0 days before a sourced due
   * date. Titles, period, due date, days left and a count only: an amount must never reach this email.
   */
  compliance_due(row, { appUrl }) {
    const p = row.payload ?? {};
    const due = String(p.due_date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('compliance_due: bad due_date');
    const days = Number(p.days_left);
    if (!Number.isInteger(days) || days < 0) throw new Error('compliance_due: bad days_left');
    const [y, m, d] = due.split('-');
    const dueShown = `${d}/${m}/${y}`;
    const soc = String(p.society_name ?? '');
    const title = String(p.title ?? '');
    const titleHi = String(p.title_hi ?? title);
    const period = p.period ? ` (${p.period})` : '';
    const whenHi = days === 0 ? 'आज अंतिम तारीख़ है' : `${days} दिन बाकी`;
    const whenEn = days === 0 ? 'due today' : `${days} day${days === 1 ? '' : 's'} left`;
    const lines = [
      [`"${soc}" — ${titleHi}${period} की अंतिम तारीख़ ${dueShown} है (${whenHi})।`,
        `"${soc}" — ${title}${period} is due on ${dueShown} (${whenEn}).`],
    ];
    const pending = Number(p.pending_count);
    if (Number.isInteger(pending) && pending > 1) {
      lines.push([`अगले 7 दिनों में कुल ${pending} अनुपालन आइटम बाकी हैं।`, `${pending} compliance items are due in the next 7 days.`]);
    }
    lines.push(['फाइल कर दिया हो तो अनुपालन कैलेंडर में "फाइल हुआ" दबाएँ — फिर इसकी याद-दहानी नहीं आएगी।',
      'If it is already filed, press "Mark filed" on the Compliance Calendar and these reminders stop.']);
    return notice(row, {
      subjectHi: `याद-दहानी: ${titleHi} — ${days === 0 ? 'आज' : dueShown} तक`,
      subjectEn: `Reminder: ${title} due ${dueShown}`,
      lines,
      button: { href: `${base(appUrl)}/compliance-calendar`, hi: 'अनुपालन कैलेंडर खोलें', en: 'Open Compliance Calendar' },
      foot: ['तारीख़ें सरकारी नियम के पाठ से ली गई हैं; अंतिम पुष्टि अपने CA / पोर्टल से करें।',
        'Dates are taken from the rule text; confirm with your CA / the portal.'],
    });
  },

  /**
   * Monday summary for admins (migration 146, weekly-digest fn). COUNTS ONLY: the payload is checked against a
   * fixed key list, so an amount / balance field can never be rendered — the row fails instead.
   */
  weekly_digest(row, { appUrl }) {
    const p = row.payload ?? {};
    const extra = Object.keys(p).filter((k) => !DIGEST_KEYS.has(k));
    if (extra.length) throw new Error(`weekly_digest: unexpected payload field ${extra.join(',')}`);
    const n = (k) => {
      const v = Number(p[k]);
      if (p[k] === null || p[k] === '' || !Number.isInteger(v) || v < 0) throw new Error(`weekly_digest: bad ${k}`);
      return v;
    };
    const week = n('vouchers_week'), pending = n('pending_approval'), due = n('compliance_due'), unver = n('unverified_users');
    const since = p.days_since_last === null || p.days_since_last === undefined ? null : n('days_since_last');
    const dmy = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s ?? '')) ? String(s).split('-').reverse().join('/') : '');
    const from = dmy(p.period_from), to = dmy(p.period_to);
    const range = from && to ? ` (${from} – ${to})` : '';
    const soc = String(p.society_name ?? '');
    // 147: rows queued before migration 147 carry no token → no unsubscribe link (never a broken one).
    const tok = p.unsubscribe_token === undefined || p.unsubscribe_token === null ? '' : String(p.unsubscribe_token);
    if (tok && !/^[0-9a-f]{48}$/.test(tok)) throw new Error('weekly_digest: bad unsubscribe_token');
    const lines = [
      [`"${soc}" — पिछले 7 दिनों${range} का सारांश:`, `"${soc}" — summary of the last 7 days${range}:`],
      [`• इस हफ़्ते दर्ज वाउचर: ${week}`, `• Vouchers entered this week: ${week}`],
      [since === null ? '• अभी तक कोई वाउचर दर्ज नहीं हुआ' : since === 0 ? '• आख़िरी वाउचर: आज' : `• आख़िरी वाउचर: ${since} दिन पहले`,
        since === null ? '• No voucher entered yet' : since === 0 ? '• Last voucher: today' : `• Last voucher: ${since} day${since === 1 ? '' : 's'} ago`],
      [`• मंज़ूरी के लिए बाकी वाउचर: ${pending}`, `• Vouchers waiting for approval: ${pending}`],
      [`• अगले 14 दिनों में अनुपालन की अंतिम तारीख़ें: ${due}`, `• Compliance items due in the next 14 days: ${due}`],
    ];
    if (unver > 0) {
      lines.push([`• ${unver} यूज़र का ईमेल सत्यापित नहीं है — उन्हें कोई सूचना नहीं जाती। हर यूज़र अपने मेन्यू में "ईमेल सत्यापन" से पुष्टि कर सकता है।`,
        `• ${unver} user${unver === 1 ? ' has' : 's have'} not verified their email and get no notifications. Each user can verify from "Email verification" in their menu.`]);
    }
    return notice(row, {
      subjectHi: `साप्ताहिक सारांश — ${soc}`,
      subjectEn: 'Weekly summary',
      lines,
      button: { href: `${base(appUrl)}/dashboard`, hi: 'डैशबोर्ड खोलें', en: 'Open dashboard' },
      foot: ['यह सारांश हर सोमवार सुबह एडमिन को आता है। इसमें सिर्फ़ गिनती है, कोई रकम नहीं।',
        'This summary reaches admins every Monday morning. It carries counts only, never an amount.'],
      unsubscribe: tok
        ? { href: `${base(appUrl)}/email-unsubscribe?t=${tok}`, hi: 'साप्ताहिक सारांश बंद करें', en: 'Stop the weekly summary' }
        : null,
    });
  },
};

/** The only fields a weekly_digest payload may carry (migration 146 builds exactly these). */
const DIGEST_KEYS = new Set(['name', 'society_name', 'week', 'period_from', 'period_to', 'pending_approval',
  'vouchers_week', 'days_since_last', 'compliance_due', 'unverified_users', 'unsubscribe_token']);

/** Render one outbox row. Throws on an unknown template or a bad payload (the caller marks it failed). */
export function renderRow(row, opts = {}) {
  const t = TEMPLATES[row.template_key];
  if (!t) throw new Error(`unknown template: ${row.template_key}`);
  return t(row, opts);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {*} supa  SERVICE-ROLE client
 * @param {{ apiKey?: string, from?: string, appUrl?: string, batch?: number, dailyCap?: number,
 *           gapMs?: number, fetch?: typeof fetch }} cfg
 * @returns {Promise<{ status: string, claimed?: number, sent?: number, retry?: number, failed?: number, error?: string }>}
 *   status: ok | not_configured | error
 */
export async function runOutbox(supa, cfg = {}) {
  if (!cfg.apiKey || !cfg.from) return { status: 'not_configured' };
  const out = { status: 'ok', claimed: 0, sent: 0, retry: 0, failed: 0 };
  let rows;
  try {
    const { data, error } = await supa.rpc('claim_outbox', { p_limit: cfg.batch ?? 20, p_daily_cap: cfg.dailyCap ?? 90 });
    if (error) return { status: 'error', error: `claim: ${error.message}` };
    rows = data ?? [];
  } catch (e) {
    return { status: 'error', error: `claim: ${e instanceof Error ? e.message : String(e)}` };
  }
  out.claimed = rows.length;
  const doFetch = cfg.fetch ?? fetch;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i > 0 && cfg.gapMs !== 0) await wait(cfg.gapMs ?? 600); // stay under Resend's per-second rate limit
    let result; // { ok, providerId?, error?, retryable? }
    let msg = null;
    try { msg = renderRow(row, { appUrl: cfg.appUrl }); }
    catch (e) { result = { ok: false, error: `render: ${e instanceof Error ? e.message : String(e)}`, retryable: false }; }

    if (msg) {
      try {
        const res = await doFetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': row.idempotency_key,
          },
          body: JSON.stringify({ from: cfg.from, to: [row.recipient], subject: msg.subject, html: msg.html, text: msg.text,
            ...(msg.headers ? { headers: msg.headers } : {}) }),
        });
        if (res.ok) {
          const body = await res.json().catch(() => ({}));
          result = { ok: true, providerId: body?.id ?? null };
        } else {
          const detail = (await res.text().catch(() => '')).slice(0, 300);
          result = { ok: false, error: `resend ${res.status}${detail ? `: ${detail}` : ''}`, retryable: res.status === 429 || res.status >= 500 };
        }
      } catch (e) {
        result = { ok: false, error: `network: ${e instanceof Error ? e.message : String(e)}`, retryable: true };
      }
    }

    try {
      const { data: verdict } = await supa.rpc('complete_outbox', {
        p_id: row.id, p_ok: result.ok, p_provider_id: result.providerId ?? null,
        p_error: result.error ?? null, p_retryable: result.retryable ?? true,
      });
      if (verdict === 'sent') out.sent++;
      else if (verdict === 'retry') out.retry++;
      else if (verdict === 'failed') out.failed++;
    } catch { /* the lease expires and the row is claimed again; Idempotency-Key stops a double send */ }
  }
  return out;
}
