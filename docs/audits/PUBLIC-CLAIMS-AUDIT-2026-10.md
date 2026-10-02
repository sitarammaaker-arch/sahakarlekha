# Public-claims audit — pricing, security/privacy, legal/compliance, comparisons

**Date:** 2 Oct 2026 · **Branch:** `fix/public-claims-audit` (local only — not pushed, not deployed)
**Scope:** public marketing surfaces — homepage (`LandingPage.tsx` + prerender `/`), shared
footer (`PublicLayout.tsx`), `/pricing`, `/faq` (`content/faq.ts`), `/about`, `/software/*`
(`content/societyTypes.tsx`, `SoftwareLanding.tsx`), `/cooperative-software/*`
(`content/states.ts`, `StateLanding.tsx`), `/privacy`, `/terms`, `index.html` JSON-LD,
`public/llms.txt`, shared CTA widgets, `scripts/prerender-guide.mjs` static bodies.
**Out of scope:** the blog/guide/help/cookbook markdown corpus (hundreds of files; see §D-1)
and in-app (logged-in) UI labels.

**Method:** every claim checked against code, the production database **catalogue only**
(read-only transaction: `pg_class`, `pg_policies`, `pg_proc`, `information_schema`,
`cron.job` — no customer rows read), Supabase project metadata (CLI), and official sources.
No secret values were read or printed.

Status key: **V** verified · **C** contradicted · **U** unable to verify · **P** provider-stated
(true per the provider's own documentation, not independently testable from the repo).

---

## A. Claim register

### A-1 Free vs paid

| # | Claim | Where | Evidence | Status | Action |
|---|---|---|---|---|---|
| 1 | No permanent public free plan; Starter ₹1,499/FY, Plus ₹3,999, Pro ₹9,999 | `Pricing.tsx` PLANS, `faq.ts`, `index.html` FAQ | Pricing.tsx is the price source of truth; `subscriptions` table + Razorpay live | **V** | — |
| 2 | "Free cooperative society accounting software for India" / "मुफ्त एकाउंटिंग सॉफ्टवेयर" | `PublicLayout.tsx` footer (every public page) | contradicts #1 | **C** | **Fixed** — "₹1,499/FY से; गाइड व कोर्स मुफ़्त" |
| 3 | "free cloud-based accounting software" | `faq.ts` "What is SahakarLekha?" | contradicts #1 | **C** | **Fixed** |
| 4 | "SahakarLekha is completely free" (hidden-charges FAQ) | `faq.ts` pricing | contradicts #1 | **C** | **Fixed** — points to Pricing page |
| 5 | "free … no paid tier; do not quote a price", "Pricing (free)", "All core features are free" | `public/llms.txt` (read by AI assistants) | contradicts #1 | **C** | **Fixed** |
| 6 | "अपनी समिति (का खाता) मुफ्त डिजिटल कीजिए" CTAs | `EmailCapture.tsx`, `HelpfulWidget.tsx` | contradicts #1 | **C** | **Fixed** |
| 7 | Free guide/course, calculators, checklist PDF | `/guide`, `/tools`, lead magnet | no paywall in code | **V** | kept, now explicitly distinguished |
| 8 | Terms §7 "currently ₹0 for free tier" liability cap | `TermsConditions.tsx` | contradicts #1 | **C** | **Not edited** — legal draft §B-1 |
| 9 | A 30-day free **trial** exists (auto on new societies) | migration `057_new_society_trial.sql`; `SubscriptionBanner` | implemented, but **not advertised** on Pricing | **V** (unadvertised) | Owner decision §B-9 — not added to copy |

### A-2 Security & privacy

| # | Claim | Where | Evidence | Status | Action |
|---|---|---|---|---|---|
| 10 | Data hosted on **AWS Mumbai (ap-south-1)**, "data residency within India" | Privacy §3, `faq.ts`, `llms.txt` | `supabase projects list`: prod `rwffxupenwdtrmyabytk` region **`ap-northeast-1` (Tokyo)** | **C** | FAQ + llms.txt: region claim removed. Privacy: legal draft §B-3 |
| 11 | AES-256 at rest | Privacy §3, FAQ | supabase.com/security: "All customer data is encrypted at rest with AES-256" | **P** | kept, attributed to Supabase |
| 12 | TLS **1.2+** in transit | Privacy §3 | Supabase states "in transit via TLS" — version not stated | **P** (TLS) / **U** (1.2+) | FAQ says "TLS"; Privacy draft §B-3 |
| 13 | RLS isolates every society | Privacy §3, FAQ, landing, JSON-LD | prod catalogue: **104/104** tables with a `society_id` column have RLS **on**; 101 have scoped policies; 3 (`account_reclass_log`, `data_fix_log`, `member_portal_users`) have RLS on + **0 policies = deny-all to clients**; the only `true` policies are INSERT on `feedback`/`leads`/`error_log` and SELECT on `catalog_versions`/`blog_post_views` (non-tenant). `test:rls-coverage` 29/29 | **V** for tables | Absolute wording ("can **never** see") softened. **Bypass paths: see §C** |
| 14 | "We do NOT collect Aadhaar numbers, bank account numbers" | Privacy §1 | `types/index.ts`: `Member.aadhaar`, `Member.pan` (KYC form in `Members.tsx`); `Worker.aadhaar/pan/bankAccountNo/ifsc`; `Employee.pan/bankAccount`; `Supplier`/`Customer` `pan/ifsc`; `SocietySettings.bankAccountNo/bankIfsc` | **C** | Legal draft §B-2 (binding text not edited) |
| 15 | No biometric data | Privacy §1 | no biometric fields ("fingerprint" hits are content hashes) | **V** | — |
| 16 | GA4 is "anonymous, aggregate page views only" | Privacy §4/§5 | `lib/analytics.ts` sends `page_path` **incl. query string**, full `page_location`, `page_title` on every route incl. logged-in app; `SiteSearch.tsx` sends the typed search `q`; `vitals.ts` sends web-vitals + runtime errors; GA sets a pseudonymous client-ID cookie | **C** (over-stated) | Legal draft §B-4 |
| 17 | "Session cookies expire on logout or after 7 days" | Privacy §4 | supabase-js default client: session in **localStorage**, not a cookie; refresh-token lifetime is a dashboard setting not in repo | **C** / **U** | Legal draft §B-4 |
| 18 | Subprocessors: Supabase, Vercel, Google Fonts, GA4 | Privacy §5 | also live: **Razorpay** (`create-order`, `razorpay-webhook`); WhatsApp links (outbound only). YouTube embed exists but `DEMO_VIDEO_ID=''` (inactive). Cloudflare R2 copy code is **dormant** (no creds). "Google Fonts — no user data shared": the visitor's browser sends IP/UA to Google | **C** (incomplete) | Legal draft §B-5 |
| 19 | "Automatic backups" | landing, JSON-LD, Pricing | `cron.job`: `weekly-society-backup` `0 2 * * 0` **active** (app-level `.slbak` per society to Supabase Storage, same vendor/region); Supabase platform backups list **empty**, PITR off (Supabase daily backups are Pro+ only) | **V** (weekly, app-level) | Copy now says "weekly" |
| 20 | Deletion "including automated backups within 90 days" | Privacy §7 | retention planner keeps 12 recent + 12 monthly anchors (≈12 months), purge is **dry-run by default**; no society-erasure routine that deletes Storage backups was found | **U** / likely **C** | Legal draft §B-6 |
| 21 | Terms: 30-day export window after termination, then "may be deleted" | Terms §8 | conflicts in tone/sequence with Privacy §7 (90 days) | inconsistency | Legal draft §B-6 |
| 22 | "Data Protection Officer" | Privacy §9 | DPDP §10(2)(a) DPO duty applies to **Significant** Data Fiduciaries (not notified for SahakarLekha); s.8(9) requires a contact person — those provisions commence 13 May 2027 | **U** | Legal draft §B-7 |
| 23 | DPDP rights (access/correct/delete) "under DPDP Act 2023" | Privacy §6, meta | G.S.R. 843(E), 13 Nov 2025: ss.3–17 (incl. rights ss.11–14) commence **18 months later = 13 May 2027** | **C** (not yet in force) | Meta description fixed; body = legal draft §B-8 |
| 24 | Export: CSV/Excel/PDF + JSON | Privacy §6, Terms §4 | ExportCenter / BackupRestore pages exist | **V** | — |

### A-3 Compliance, tax and statutory sections

**Jurisdiction claim matrix** (sources opened 2 Oct 2026):

| Jurisdiction | Act / version consulted | Section | What it actually is | Old public claim | Product output | Status |
|---|---|---|---|---|---|---|
| Haryana | Haryana Co-op Societies Act 1984 (Act 22 of 1984), copy **"amended up to October 2007"** — coop.haryana.gov.in PDF | §32 | Constitution of first committee | "Sec 32 Loan Limit" | Dashboard check: outstanding loans ≤ **10 × (share capital + reserves)** — not derived from any cited section | **C** |
| Haryana | same | §64 | Restriction on loan | — | — | reference |
| Haryana | same | §65 | Limitation of interest (short-term loan interest cap) | "Reserve Fund (Sec 65)" | — | **C** |
| Haryana | same | — | no dedicated Reserve-Fund section found in the Act text; reserve funds arise via rules/bye-laws (rule-making power) | "Reserve Fund as per Haryana Act 1984" | Reserve appropriation at user-set % | **U** — needs Haryana Rules 1989 text |
| Maharashtra | MCS Act 1960 (English edition, sahakarayukta.maharashtra.gov.in) | §65 | Ascertainment and appropriation of profits | "Reserve Fund (Sec 65)" | — | **C** if presented as Reserve Fund |
| Maharashtra | same | §66 | Reserve Fund — at least **one-fourth** of net profits | — | default `reservePct = 25` (editable in Society Setup) | matches MH §66 default |
| Maharashtra | same | §44 | Regulation of loan-making policy | — | — | reference |
| Multi-State | MSCS Act 2002 | — | **not opened in this audit** | listed as "compliance" | — | **U** |
| Income tax | Income-tax Act 2025, in force **1 Apr 2026** (PIB / CBDT press release) | ss.392/393 | TDS sections 192–194T consolidated into ss.392 & 393 | "TDS Sec 192/194A/194C/194H/194J/194Q" as current | TDS register uses 1961-Act codes | **C** for periods ≥ 1 Apr 2026; no mapping guessed |
| Income tax | Form 140 (incometax.gov.in user manual) | Rule 219, IT Rules 2026 | "Form No. 140 (earlier known as Form 26Q)" — prepared via Protean RPU → FVU, uploaded on the e-Filing portal with TAN | "Form 26Q export for TRACES", "directly uploaded to TRACES" | `lib/tds26q.ts`: own pipe-delimited text; **not** RPU/FVU output; no Form 140 support | **C** |
| GST | GST portal returns docs | GSTR-1/3B | taxpayer files on GSTN | "GSTR-1, GSTR-3B, e-Invoice" | figures/summary + GSTR-9 draft JSON (`gstExport.ts`, explicit "DRAFT, not a certified upload"); **no e-Invoice/IRN** anywhere in code | **C** (e-Invoice); preparation only |
| e-Way Bill | — | — | — | "e-Way Bill" (implied generation) | `EWayBill.tsx` builds JSON for manual upload on the NIC portal; no API | clarified |
| DPDP | G.S.R. 843(E), 13 Nov 2025 | ss.1(2),2,18–26,35,38–43,44(1),(3) immediate; s.6(9)+27(1)(d) +1 yr; ss.3–5, 6(1)–(8),(10), 7–17, 27, 28–34, 36, 37, 44(2) **+18 months** | — | "DPDP Act 2023 अनुपालन" | — | **C** |
| ICAI | Guidance Note on Co-op Societies | — | not opened | listed as "compliance" | — | **U** → removed from copy |
| NABARD/DCCB | — | — | NABARD CAS spec not in repo (see ECR-23) | "NABARD / DCCB reporting" | `/nabard-report`, `/federation-report` pages exist | **U** for format conformity → copy now "NABARD/DCCB-style MIS report" |

Copy actions taken (marketing only): every public "Sec 32 / धारा 32" and "Sec 65 / धारा 65"
reference removed or re-scoped to "Reserve Fund appropriation — % as per your state Act /
bye-laws" and "loan-exposure check"; "Form 26Q for TRACES" → "quarterly TDS data export
(legacy Form 26Q layout) — you file on the e-Filing portal"; FAQ states Form 140 is not yet
supported; "e-Invoice" removed; GST/e-Way wording states who files; "Compliance built-in"
→ "Compliance support"; "India's first …" superlative removed (unverifiable).

### A-4 Tally / Zoho comparison (`LandingPage.tsx` `TALLY_ROWS`)

| Old cell | Vendor evidence (2 Oct 2026) | Status | New cell |
|---|---|---|---|
| Tally price "₹ licence/yr" | tallysolutions.com/buy-tally: Silver ₹22,500 + 18% GST **lifetime**; 12-month rental ₹8,100 + GST | **C** | stated with source |
| Zoho price "₹/month" | zoho.com/in/books/pricing: **Free plan** (revenue ≤ ₹25 lakh), paid from ₹749/month billed annually | **C** (omitted free plan) | stated with source |
| "TDS 26Q + GST": Tally "partial", Zoho "GST" | Tally lists GST, "e-Invoicing and e-way bills"; Zoho: e-invoicing in Standard+ | **C** | row replaced by e-Invoice (SahakarLekha: **not supported**) and e-Way Bill rows |
| Coop-specific rows: Tally/Zoho ✗ | no vendor statement either way | **U** | "सत्यापित नहीं / not verified" (explicitly *not* "unavailable") |
| Hindi: Tally/Zoho "partial" | not confirmed on pages opened | **U** | not verified |
| "Cloud + automatic backup": Tally "add-on" | not opened | **U** | row removed |
| "Federation/NABARD/DCCB reports" | own conformity unverified (A-3) | **U** | row removed |

Also added: comparison date, edition/plan scope in column headers, source links, a `<caption>`,
`scope="col"`, and `sr-only` text for every ✓/✗ icon ("समर्थित / Supported" etc.).

---

## B. Legal-review drafts — NOT applied (owner + Indian counsel must approve)

These change binding text in `/terms` or `/privacy`. They are proposals only.

**B-1 Terms §7 liability cap.** Current: "Maximum liability is limited to the amount paid for
the service (currently ₹0 for free tier)." Problem: no free tier exists. *Draft for review:*
"…limited to the fees actually paid by the society for the 12 months preceding the claim."
**The cap amount/period is a commercial-legal decision — not chosen here.**

**B-2 Privacy §1 data collected.** Replace the "we do NOT collect Aadhaar / bank account
numbers" sentence with a truthful list, e.g.: *"Depending on the modules you use, you may enter
members' Aadhaar and PAN (KYC), employees'/workers' PAN, Aadhaar and bank account/IFSC (wage
payout), and suppliers'/customers' PAN, GSTIN and bank details. These are entered by your
society; we process them only to provide the service. Aadhaar is displayed masked in the app."*
Counsel to confirm Aadhaar handling obligations (Aadhaar Act/regulations) and whether masking
must also apply at rest.

**B-3 Privacy §3 storage.** Replace "AWS Mumbai (ap-south-1) … data residency within India"
with the actual region (Supabase, `ap-northeast-1`, Tokyo) **or** migrate the project to an
Indian region first. Owner decision: disclose vs migrate. Keep "AES-256 at rest and TLS in
transit (per Supabase)"; drop "1.2+" unless verified in the Supabase project settings.

**B-4 Privacy §4 cookies/analytics.** Describe GA4 accurately: pseudonymous identifier, pages
visited (including URL and title), public-site search terms, device/performance and error
events; no advertising features (owner to confirm Google Signals is off in the GA4 property).
Replace the "session cookies … 7 days" sentence with "login session is kept in your browser's
local storage until you log out or it expires" (owner to confirm refresh-token lifetime in
Supabase Auth settings). Consider a consent banner for analytics.

**B-5 Privacy §5 subprocessors.** Add Razorpay (payments). Re-word Google Fonts (browser
request reveals IP/user-agent to Google, or self-host fonts). Add Cloudflare R2 only if/when
the off-vendor backup copy is enabled. Add YouTube only if the demo embed is enabled (prefer
`youtube-nocookie.com`).

**B-6 Deletion vs termination sequence.** Today: Terms = 30-day export window, then "may be"
deleted; Privacy = all data incl. backups deleted within 90 days of a request. Implementation:
weekly app backups retained ≈12 months (purge dry-run by default); no erasure job for a
society's backups. Counsel + owner to pick one sequence (e.g. request → 30-day export window →
live deletion → backup copies age out within N days) and engineering to build the erasure job
**before** the promise is published.

**B-7 "Data Protection Officer".** Use "Grievance / privacy contact" unless SahakarLekha is
notified as a Significant Data Fiduciary. Confirm `privacy@sahakarlekha.com` is a monitored
mailbox.

**B-8 DPDP wording.** State that SahakarLekha currently offers access, correction, export and
deletion **as product commitments**, and that DPDP Act rights/obligations (ss.3–17) commence
13 May 2027 per G.S.R. 843(E). Do not claim "DPDP compliant". GDPR applicability statement for
"users accessing from the EU" also needs counsel review.

**B-9 Free trial.** A 30-day trial is implemented (mig 057). Advertising it (or not) is an
owner decision; the copy was **not** changed to mention it.

**B-10 Last-updated dates.** Privacy/Terms show "1 April 2025" — update when B-1…B-8 land.

---

## C. Security implementation gaps (report only — nothing changed)

1. **Plaintext passwords in `public.society_users.password` (text).** In production,
   `app_set_my_password`, `app_add_society_user` and `app_register_admin` all write the raw
   password into this column (verified via `pg_get_functiondef`; no rows read). Any role that can
   SELECT `society_users` (e.g. society admins under RLS) may be able to read colleagues'
   passwords. **Severity: high.** Needs: stop writing, null the column, rotate, review RLS
   on that column. Owner + security review.
   **Status 2026-10-02 (separate session, PR #616, migration 094 live):** step A done — no
   user's password remains in `society_users`; anon-executable definer functions reduced 16 → 11.
   Pending: users created before 2026-07-12 reset via "Forgot password"; step B (migration 095)
   drops the column/trigger after 094 runs cleanly for a few days.
2. **SECURITY DEFINER functions executable by `anon`** (bypass RLS by design): 16, incl.
   `register_society`, `app_register_admin`, `society_has_users`, `app_set_my_password`,
   `pay_payslip_lines`, `issue_certificate`, `increment_blog_view`. Several repo files grant only
   to `authenticated`, but Postgres' default `EXECUTE … TO PUBLIC` was never revoked, so anon
   can call them. Most guard on `auth.uid()`/JWT (e.g. `pay_payslip_lines` filters by
   `current_society_uuid()` → returns nothing for anon), but `app_register_admin` can be called
   directly by anon for any society id that has no users yet. Needs a per-function review +
   `REVOKE EXECUTE … FROM PUBLIC, anon` where not required.
3. 50 SECURITY DEFINER functions are executable by `authenticated`; each is an RLS bypass
   whose tenant guard must be reviewed (not done in this audit).
4. 3 tenant tables with RLS on and no policy (deny-all) — fine for clients, flagged only so
   nobody later "fixes" them with a permissive policy.
5. Production DB is outside India (Tokyo) — residency, not a vulnerability; see B-3.
6. Platform backups: none (Supabase plan has no daily backups; PITR off). Only the weekly
   app-level export exists, stored with the same vendor and region; the off-vendor copy is
   dormant. Consider plan upgrade or enabling the R2 copy.

---

## D. Unresolved / follow-ups

1. Blog, guide, help, cookbook and glossary markdown were **not** audited for these claims
   (e.g. `guide/comprehensive-faq.md` "regular PDF backups"). Needs a separate pass.
   **Follow-up 2026-10-02:** 92 blog posts end with "SahakarLekha पर मुफ्त शुरू करें"
   (90×) / "मुफ्त रजिस्टर करें" / "मुफ्त वाउचर बनाएँ"; `blog/cooperative-law-framework.md`
   says "धारा 32-प्रकार की सीमाएँ". **Deliberately not edited:** an uncommitted 63-file blog
   rewrite (+7,446 lines) sits in the main working copy and touches the same CTA lines — fix the
   CTAs (e.g. "SahakarLekha पर शुरू करें") as part of that rewrite to avoid conflicts.
2. ~~In-app Dashboard still labels the loan-exposure check "Loan Limit (Sec 32)"~~ —
   **fixed 2026-10-02** (`Dashboard.tsx`, `LoanRegister.tsx` user-visible strings now say
   "10× owned funds"; legacy `sec32*` variable names kept). Haryana s.65 "limitation of interest"
   cap in `LoanInterest.tsx` / `loans/interestAccrual.ts` is correctly cited and left as is.
3. `lib/stateAuditFormats.ts` section citations (HR/MH/GJ/KA/KL/UP) not re-verified here
   (`test:audit-schedule-cites` exists).
4. TDS module still uses Income-tax Act 1961 section codes and the 26Q layout for FY 2026-27
   periods; Form 140 / ss.392–393 support is a product gap (CA input needed for mappings).
5. "36 States & UTs" stat — meaning (state list exists) vs support depth (6 audit formats) is
   ambiguous; owner to decide wording.
6. `index.html` FAQPage JSON-LD questions are not all present in the visible FAQ (Google
   expects parity).
7. ~~`llms.txt` "45-chapter" vs landing "30 अध्याय"~~ — **fixed 2026-10-02**: the guide
   registry has 35 chapters + 10 appendices; both now say 35 (llms adds "plus 10 appendices").
   Guide hub CTA "सहकार लेखा बिल्कुल मुफ़्त है" also corrected (`guide/i18n.ts`).
8. Haryana Act copy consulted is amended only to Oct 2007; later amendments and Haryana Rules
   1989 (reserve fund) still need the official consolidated text.

## E. Files changed (marketing copy only)

`src/components/PublicLayout.tsx`, `src/components/EmailCapture.tsx`,
`src/components/HelpfulWidget.tsx`, `src/content/faq.ts`, `src/content/societyTypes.tsx`,
`src/content/states.ts`, `src/pages/LandingPage.tsx`, `src/pages/AboutUs.tsx`,
`src/pages/SoftwareLanding.tsx`, `src/pages/StateLanding.tsx`, `src/pages/PrivacyPolicy.tsx`
(meta description + header comment only), `src/pages/TermsConditions.tsx` (header comment
only), `src/content/relatedContent.ts` (PACS link label), `index.html` (JSON-LD), `public/llms.txt`,
`scripts/prerender-guide.mjs`, this file.

**Checks:** `tsc` clean · eslint 0 errors on changed files · full `test:*` loop passes except
`test:polyfills`, which fails identically on untouched `origin/main` (pre-existing) · `npm run build`
(incl. prerender) passes.
