# 08 — Lead Generation Engine

> Turns knowledge traffic into users. Builds on the **live** stack: `leadMagnets.ts` (3 PDF magnets),
> `EmailCapture.tsx` (topic-matched offer + localStorage guard + leads insert), `api/subscribe.ts`
> (Resend welcome email), GA4 `trackEvent`, and the `leads` Supabase table.

---

## 1. Funnel model

```
SEO traffic → Content (value first) → Soft CTA (magnet) → Email capture → Welcome (Resend)
   → Nurture drip → Demo / Register → Activated user → Advocate (review/referral)
```
Every cluster declares its funnel stage offer in [04](04-search-intent.md)'s magnet column.

## 2. Lead magnets

**Live (3):** `audit-checklist`, `gst-checklist`, `inventory-checklist` (jsPDF, English content,
value-first, mapped by category in `magnetForCategory()`).

**Planned expansion** (each = a magnet + a landing cluster in D29):
| Magnet | Trigger cluster(s) | Format |
| --- | --- | --- |
| Year-end closing checklist | C-YE, C144 | PDF |
| AGM kit (notice + agenda + minutes + resolutions) | C163–C168 | PDF/Word |
| Standard Chart of Accounts (by society type) | C031, D27 | Excel |
| Opening balance template | C033 | Excel |
| Compliance calendar (FY) | C158 | PDF |
| TDS rate chart | C134 | PDF |
| Depreciation schedule template | C112 | Excel |
| Loan register + EMI sheet | C069, C077 | Excel |
| NPA / aging tracker | C073, C074 | Excel |
| Society-type COA packs (×12) | D27 | Excel |

> **Rule:** magnet content is **English** (Helvetica/jsPDF can't render Devanagari) and **value-first**
> — established constraint. New magnets register as `MagnetKey` and map via `magnetForCategory()`.

## 3. Email funnels (Resend)

- **Welcome** (live): fires on capture via `/api/subscribe`, from `hello@sahakarlekha.com`. Keep fail-soft.
- **Nurture drips (planned)** — sequence by persona ([05](05-personas.md)):
  - *SEC track:* setup → first voucher → first report → audit prep → register.
  - *ACC track:* COA → reconciliation → year-end → tax → migration.
  - *CHR/BUY track:* why digital → ROI → comparison → demo.
- **Behaviour triggers:** magnet downloaded → matching track; multiple visits → demo nudge.
- **Compliance:** double-opt-in where required, one-click unsubscribe, consent stored (leads table already captures consent). `⚠️ NEV` for any legal email-marketing claim per jurisdiction.

## 4. Free tools as top-of-funnel

Calculators ([10](10-calculators.md)) are **link magnets + lead capture**: use free → optional "email me
the result / save to account" → register. Highest-intent, most-linkable assets.

## 5. Free templates

[09-template-library.md](09-template-library.md) entries are gated downloads → email capture → track via
`leads.source = template:<slug>`. Each template links to the module that *generates it automatically*
in-app (conversion bridge: "stop filling this by hand → do it in SahakarLekha").

## 6. PDFs / checklists

Current generator is client-side jsPDF (network-independent). Roadmap: optionally add server-side
rich PDFs (with Devanagari font) for higher-value magnets via a serverless function.

## 7. Demo requests

- `BUY`/`CHR` personas → "request demo" / "talk to us" from `/software/:type`, `/pricing`, comparison clusters.
- Route to the existing contact/feedback system (Contact form + Admin Inbox already live).

## 8. Newsletter

- "सहकारी अपडेट" — monthly: new statutory changes, due-date reminders, new guides/templates.
- Powered by the same `leads`/Resend stack; segment by persona/society type.
- Doubles as a **freshness signal** and re-engagement loop.

## 9. On-site capture surfaces (live + planned)

| Surface | Mechanism | Status |
| --- | --- | --- |
| In-article opt-in (topic-matched) | `EmailCapture` mid + end | live |
| Success-moment CTA | post-action prompts | live |
| FAB / feedback | floating button | live |
| Tool result capture | calculator → email result | planned |
| Exit-intent (desktop) | modal | planned (use sparingly) |
| Download hub | `/downloads` gated | planned |

## 10. Measurement

- GA4 events (`trackEvent`): `magnet_view`, `magnet_download`, `lead_submit`, `demo_request`, `calc_used`, `register_click`.
- Attribute `leads.source` to cluster/magnet for cluster-level ROI.
- North-star: **registrations**; guardrail: capture rate without harming UX/trust.

---

### Cross-references
[Search Intent](04-search-intent.md) · [Personas](05-personas.md) · [Template Library](09-template-library.md) · [Calculators](10-calculators.md)
