# SahakarLekha — Marketing Design System Master Plan v1.0

**Status:** PLANNING PHASE — awaiting founder approval. No asset in this document
has been designed yet; nothing here is final copy.
**Date:** 2026-07-05
**Owner:** Founder (Sitaram) · Prepared by Claude (CBO/CD/PMM role)
**Scope:** 10-year marketing foundation for SahakarLekha (sahakarlekha.com)

---

## 1. Executive Summary

SahakarLekha is **India's only cooperative-specific accounting platform** — 8
society types, 36 states/UTs, Hindi-first bilingual, TDS 26Q / GST / audit
compliance, free to use. The product is deep (Constitution-governed ERP with
PACS, Dairy, Marketing, Housing, Consumer domains in flight) and the content
moat is already exceptional (10-part course + certificate, ~30 blog articles
seasonally scheduled, 8 society-type + state SEO pages, 356-item knowledge
base).

**The core finding of this audit:** SahakarLekha does not have a branding
problem — it has a **brand codification and distribution problem**. A coherent
visual identity already exists in the wild (navy + orange "स" tile, tricolor
strip, Hind/Inter type, Hindi-first voice) but it lives implicitly in a
handful of PNGs and CSS variables. There is no written brand book, no reusable
template system, no sales enablement kit, no offline/print presence, and no
video presence — while the audience (society secretaries, auditors, federation
officers) is the most offline-and-WhatsApp-native B2B audience in India.

**The strategic window:** the Government's ₹2,516 Cr PACS computerization
scheme (2022–27) has onboarded ~50,000 PACS onto a common ERP (NLPS). This is
simultaneously the biggest threat (a free government incumbent for PACS) and
the biggest gift: it has *educated the entire sector* that cooperative
accounting must be digital. SahakarLekha's winning position is **everything
the government software is not** — all 8 society types (not just PACS),
instant self-service signup (no sanction/rollout queue), Hindi-first UX,
modern cloud + mobile, and a teaching brand that trains the sector's
accountants for free.

**Recommended one-line positioning (for approval, not final copy):**
*"सहकारी समितियों का अपना सॉफ्टवेयर"* — the cooperative sector's own software:
built only for cooperatives, free, in the sector's own language.

**Plan shape:** 5 phases. Phase 1 (Critical, ~4–6 weeks of asset work) =
Brand Book + master template system + core sales kit (one-pager, demo deck,
WhatsApp kit) + YouTube launch kit — because these unblock every downstream
asset. Phases 2–5 scale outward: field/print → education & partners →
federation/government/enterprise.

---

## 2. Marketing Audit

### 2.1 Current state by area

| Area | State | Evidence | Grade |
|---|---|---|---|
| Brand positioning | Strong claim, never formalized | "India's ONLY cooperative-specific platform" in meta tags only | B− |
| Product positioning | Implicit; feature-led, not outcome-led | Society-type landing pages exist; no "vs Tally / vs govt ERP / vs Excel" narrative | C+ |
| Market positioning | Undefined vs the govt NLPS rollout | No public stance on PACS computerization scheme | D |
| Visual identity | Coherent but **uncodified** | Navy `hsl(215 70% 28%)` + orange `hsl(28 90% 55%)` (~#153F79 / #F48525), "स" tile logo, tricolor strip, Hind + Inter fonts — all consistent across og-image, YT kit, X header | B |
| Website branding | Good; conversion-optimized homepage, unique metas, prerendered SEO pages | 69 static pages, GA4, Search Console verified | A− |
| Trust signals | **Weakest area.** No testimonials, no logos, no numbers, no founder story, no "about the maker" | Memory: "real testimonials — don't fabricate" still pending | D |
| Sales material | Ad-hoc | 2 PPTX decks + Business Model deck exist at repo root, not templated, not versioned | C− |
| Content marketing | Exceptional | 10-part course + certificate, ~30 seasonal blog posts, guide PDF, sample-report lead magnet, viral PDF footer | A |
| Social media branding | Assets exist, presence dormant | X handle @sahakarlekha + header; YT avatar/banner/watermark/3 thumbnail samples ready; **no channel live, no posting cadence** | C |
| Video branding | Kit ready, zero videos | yt_* assets + thumbnail template PPTX | D |
| Print branding | **Nonexistent** | No brochure, visiting card, poster, standee — for an audience that attends AGMs, melas, federation meetings | F |
| Exhibition branding | Nonexistent | — | F |
| Referral branding | Mechanism exists (viral PDF footer, certificate WhatsApp share), no formal program | Memory: referral program pending | C− |
| Customer onboarding | In-product only | Demo society docs exist; no welcome kit, no printed quick-start | C |
| Customer retention | Seasonal blog drip is the only touch | No email/WhatsApp lifecycle, no newsletter | D+ |
| Customer education | Best-in-class | Course + certificate + quizzes + knowledge stack (SCOS/KPP: 356 knowledge items) | A |

### 2.2 Asset classification

**Existing & strong (protect, codify):** og-image, YT kit, X header, guide
PDF, sample-report generator, certificate + share, blog/guide system, PDF
viral footer, WhatsApp floating button.

**Existing & weak (rework in Phase 1):** the two PPTX decks (not on a master
template, likely inconsistent), demo-society docs (content good, packaging
unbranded), guide-shots (good but only 6, desktop-only).

**Missing & high priority:** Brand book · logo master files (SVG/AI, clear
space, misuse) · one-page sales sheet (hi/en) · master deck template · demo
video + channel trailer · WhatsApp sales kit (intro message + PDF + status
creatives) · testimonial capture system · print starter kit (brochure,
visiting card, poster) · email/WhatsApp lifecycle templates.

**Missing & low priority (later phases):** merchandise, investor kit,
recruitment kit, press kit, exhibition booth system.

**Duplicates to resolve:** brand marks currently re-drawn per asset (og-image
vs yt_avatar vs favicon) — must converge on ONE master logo source. Marketing
files scattered at repo root (`SahakarLekha_*.pptx/pdf`, `yt_*.png`,
`x_header.png`) — must move into the governed folder structure (§11).

---

## 3. SWOT Analysis

**Strengths**
- Only true multi-society-type cooperative platform (8 types; govt NLPS = PACS only).
- Free — removes the #1 objection in a price-hypersensitive sector.
- Hindi-first everything: UI, course, blog, support. Competitors are English-first.
- Education moat: certificate course + 30-article seasonal calendar + 356-item knowledge base — no competitor teaches the sector.
- Product depth governed by a Constitution (auditability, FY-lock, cascade integrity) — a genuine "audit-ready" claim.
- Built-in viral loops already shipped (PDF footer, certificate share).

**Weaknesses**
- Zero social proof: no named users, no testimonials, no usage numbers.
- Single-founder brand with no face/voice yet — trust in this sector is personal.
- No offline presence in an offline-first sector.
- No video in a YouTube-first learning culture.
- "Free" without a visible business model can *reduce* trust ("data बेचेंगे क्या?") — must be answered publicly.
- Brand exists only as artifacts, not as rules — every new asset risks drift.

**Opportunities**
- Govt PACS scheme has pre-educated 63,000 societies that digital accounting is mandatory-adjacent; the 7 non-PACS society types have **no government option at all**.
- 26,882 PACS staff trained on ERP concepts = a ready audience for a better-UX alternative and for the certificate course.
- Auditors & federation officers are unpaid distribution channels: one auditor touches 20–100 societies per year.
- Cooperative Week (Nov 14–20), AGM season (Sep), year-end (Feb–Mar) = built-in campaign calendar (already exploited in blog; not yet in social/video/field).
- Sahakar-se-Samriddhi policy tailwind: "cooperative digitization" is a funded national narrative to ride.

**Threats**
- NLPS/state ERPs becoming mandated for PACS (mitigation: lead with the 7 other types + position as complement/practice-ground, not replacement).
- Tally's default-brand gravity among accountants (mitigation: "Tally जानते हो? फिर 1 दिन में सीख जाओगे" bridge positioning, comparison content).
- A funded competitor copying the free+Hindi playbook (mitigation: speed + education moat + community).
- Trust attack: "free software will disappear with our data" (mitigation: public business-model page, export-anytime guarantee, uptime/history transparency).

---

## 4. Audience Mapping

Two axes: **society type** (what the marketing shows) × **role** (who reads
it). Personas below are the role axis; every asset must be tagged with both.

### Tier A — Daily users / initiators
| Persona | Pain points | Goals | Decision factors | Objections | Assets they need | Style |
|---|---|---|---|---|---|---|
| **Secretary / सचिव** (PACS & small societies; often the whole office) | Manual registers, audit fear, RCS deadlines, no accountant on staff | Pass audit clean, save time, look competent to the board | Hindi UX, free, "audit-ready", someone to call | "मुझसे नहीं होगा" (tech fear), data safety | WhatsApp demo video (2 min), quick-start card (print), course certificate | Respectful Hinglish, step-by-step, reassurance |
| **Clerk / Accountant (staff)** | Repetitive entry, Tally doesn't know cooperative heads, year-end chaos | Faster entry, fewer mistakes, skill growth | Familiar voucher concepts, keyboard speed, guide availability | "Tally छोड़ना पड़ेगा?" | Voucher cheat-sheets, comparison table vs Tally, course | Practical, keyboard-shortcuts, examples |
| **Manager (larger societies, dairy/consumer/marketing)** | Multi-branch, inventory + MSP procurement complexity, board reporting | Monthly MIS to board, control | Reports quality, multi-user, reliability | Migration effort from existing system | Demo deck, sample MIS pack, onboarding plan | Businesslike Hinglish, numbers-forward |

### Tier B — Approvers
| Persona | Pain points | Goals | Decision factors | Objections | Assets | Style |
|---|---|---|---|---|---|---|
| **Chairperson / अध्यक्ष, Board** | Audit objections land on them; opaque books | Clean audit, member trust, legacy | Auditor's opinion, peer societies using it, cost | "Committee को कैसे समझाऊँ?" | 1-page board note (print, Hindi), AGM presentation slide, testimonial video of a peer chairman | Formal Hindi, izzat-first, risk-reduction framing |
| **Society CEO (sugar/large marketing/urban)** | Compliance stack (GST/TDS/26Q), staff turnover | Institutionalize processes | Security, support SLA, export/exit rights | "Free = unreliable?" | Business-model transparency page, security one-pager, enterprise FAQ | Professional English/Hinglish |

### Tier C — Influencers & multipliers (highest leverage per contact)
| Persona | Pain points | Goals | Decision factors | Objections | Assets | Style |
|---|---|---|---|---|---|---|
| **Auditor (co-op dept. / CA panel)** | Illegible manual books, missing schedules, deadline pile-up | Finish audits faster | Statutory report formats, trial balance integrity, ledger drill-down | "मेरे format में report मिलेगी?" | Auditor's kit: sample audit pack (TB/BS/I&E/schedules), format mapping note, "recommend to your societies" referral one-pager | Precise, format-literal, English+Hindi |
| **District/State Federation officers** | Member societies' non-compliance reflects on them | Sector-wide digitization wins | Scale story, training support, zero cost to societies | Procurement/politics | Federation partnership deck, bulk-training offer, co-branded workshop kit | Formal, institutional |
| **Registrar / ARC / Govt officers** | Late annual returns, weak PACS beyond scheme scope | Compliance rates up | Legality, neutrality, no procurement needed (free) | "Private software को कैसे endorse करें?" | Neutral information brochure (not salesy), compliance-statistics one-pager | Sarkari-formal Hindi, zero hype |
| **Trainers / co-op training institutes (ICM/JCTCs)** | Outdated curriculum | Employable trainees | Free lab software + course + certificate | — | Classroom kit, bulk certificate program | Academic |

### Tier D — Society-type overlays (content skins, same assets)
PACS · Dairy · Marketing · Consumer · Housing · Labour · Sugar · Multipurpose ·
(later: credit/urban banks, federations as users). Each gets: its landing page
(8 already live), its one-pager variant, its demo-video chapter, its blog
cluster. **Rule: build the asset once on the master template, skin per type.**

---

## 5. Competitor Benchmark

| Competitor | Who they are | Brand/marketing strengths | Weaknesses vs us | What we learn (not copy) |
|---|---|---|---|---|
| **NLPS / Govt PACS ERP** (Ministry of Cooperation + NABARD; ~50,455 PACS onboarded as of Jan 2025) | The state-sponsored default for PACS | Ultimate trust signal (sarkari), free, mandated training (26,882 staff trained) | PACS-only; rollout queue via DCCB/StCB; no self-service; UX built for compliance not users | Trust in this sector = institutional endorsement + training. We must manufacture both privately (federation partners + certificate course) |
| **Tally (TallyPrime)** | The default accounting brand in every bazaar | 3-decade brand equity, partner/dealer network, "Tally जानता है" is a job skill | Zero cooperative awareness (no share capital registers, no patronage/dividend, no RCS formats), English-first, paid | Their moat is the *partner network* — our equivalent is auditors + trainers. Also: become a noun ("SahakarLekha में entry करो") |
| **Marg / Busy / Vyapar** | SME accounting/billing apps | Aggressive YouTube tutorial marketing, vernacular content, WhatsApp-first sales | Generic SME, no cooperative constructs | Vyapar's playbook (free tier + Hindi YouTube + WhatsApp share loops) is the closest model to ours — study cadence, not visuals |
| **MyGate / ApnaComplex / iSocietyManager / SocietyRun** | Housing society management apps | Polished consumer branding, app-store presence, city sales teams | Housing-only, urban, English, subscription-priced | Their "society" SEO overlaps ours for housing — our housing landing page must differentiate "cooperative housing society (registered) vs apartment management" |
| **Vedavaag & regional PACS ERP vendors** | B2G system integrators | Government relationships | No self-service brand at all | The B2G lane is procurement-driven; we win the B2C-of-B2B lane instead |
| **Sage Intacct / NetSuite / Dynamics** (listed in "best cooperative accounting 2026" roundups) | Global ERP | Enterprise credibility content (analyst reports, case studies) | Irrelevant price/complexity for Indian societies | The *format* of their trust content — case study + numbers + named customer — is what our testimonial program should produce, at village scale |

**Benchmark verdict:** nobody owns the position "the cooperative sector's own
software, in its own language, free, for ALL society types." The brand that
teaches the sector wins it — and we're the only one teaching.

Sources: [Ministry of Cooperation — Computerization of PACS](https://www.cooperation.gov.in/en/computerization-pacs-1) · [PIB — Onboarding of PACS on ERP](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2080074&reg=3&lang=2) · [PIB — Uniform Software for PACS](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2101726&reg=3&lang=2) · [NABARD — Digitalizing Cooperatives FAQ](https://www.nabard.org/digitalizing-cooperatives-faq.aspx) · [Indian Cooperative — ERP go-live counts](https://www.indiancooperative.com/from-states/computerization-of-pacs-25674-onboarded-on-erp-15207-go-live/) · [MyGate](https://mygate.com/society-accounting-software/) · [iSocietyManager](https://isocietymanager.com/society-accounting-software.html) · [WifiTalents — Best Cooperative Accounting Software 2026](https://wifitalents.com/best/cooperative-accounting-software/) · [Vedavaag PACS ERP](https://www.vedavaag.com/Primary-Agricultural-Cooperative-Society)

---

## 6. Brand Strategy

> Everything in this section is a **strategic draft for approval** — final
> wording ships only after founder sign-off (and taglines only after a Hindi
> native-speaker pass).

- **Mission:** हर सहकारी समिति का हिसाब साफ़, समय पर और audit-ready हो — मुफ़्त में, उसकी अपनी भाषा में।
- **Vision:** भारत की हर समिति — PACS से लेकर housing तक — का भरोसेमंद डिजिटल लेखा-साथी बनना; अगले दशक का "sahakari accounting = SahakarLekha"।
- **Brand promise:** "आपकी समिति का हिसाब, हमेशा audit-ready." (Your society's books, always audit-ready.)
- **Brand story (skeleton):** Born from watching societies lose real work to
  paper registers and generic software that doesn't know what a share register
  or MSP procurement is. Built cooperative-first, Hindi-first, free — because
  the cooperative movement was always about the small member, not the big
  license fee. (Needs founder's real origin details — see §15.)
- **Core values:** Sahakar (cooperation over extraction) · Bharosa (trust:
  never lose a user's entry — literally encoded as product law RULE 1) ·
  Saralta (simplicity in the user's language) · Pardarshita (transparency:
  open business model, export-anytime) · Seva-bhav (education free for the
  whole sector, users or not).
- **Personality:** the knowledgeable, patient **village-bank-officer-turned-teacher** —
  trustworthy, precise, warm, never flashy, never condescending. NOT a startup
  bro; NOT a sarkari circular.
- **Voice:** everyday Hinglish first (per standing rule — bolchaal, not shuddh
  Hindi), plain English second. Numbers and statutory terms stay exact
  (26Q, तलपट, बैलेंस शीट). Reassure, then instruct. Never fear-monger about
  audits — respect the reader's izzat.
- **Messaging pillars (all assets must ladder to one of these):**
  1. **सिर्फ़ सहकारी समितियों के लिए** — built only for cooperatives (8 types, share capital, dividend, MSP, RCS formats).
  2. **Audit-ready, हमेशा** — one-click statutory reports, FY-lock, clean trails.
  3. **आपकी भाषा में** — Hindi-first UI, course, support.
  4. **मुफ़्त और पारदर्शी** — free, with a publicly explained business model and export-anytime.
  5. **सीखना भी मुफ़्त** — the certificate course; we train the sector.
- **Tagline options (for approval):**
  1. सहकारी समितियों का अपना सॉफ्टवेयर *(the sector's own software — ownership framing, most on-strategy)*
  2. हिसाब साफ़, समिति मज़बूत *(clean books, strong society — outcome framing)*
  3. हर समिति, audit-ready *(category-benefit framing)*
  4. सहकार का डिजिटल बही-खाता *(heritage framing — bahi-khata nostalgia + digital)*
- **Elevator pitch (30 sec, draft):** "SahakarLekha भारत का इकलौता accounting
  software है जो सिर्फ़ सहकारी समितियों के लिए बना है — PACS से housing तक 8
  प्रकार की समितियाँ, हिंदी में, बिल्कुल मुफ़्त। Voucher entry से लेकर balance
  sheet, TDS 26Q और audit तक — सब one click। साथ में मुफ़्त certificate course,
  ताकि आपका staff खुद expert बन जाए।"
- **Value proposition:** For society secretaries and accountants who fear
  audit season, SahakarLekha turns daily entries into always-ready statutory
  reports — unlike Tally (doesn't know cooperatives) or the govt ERP
  (PACS-only, no self-service), it's cooperative-native, Hindi-first and free.
- **USP (one line):** *All 8 cooperative society types. Hindi-first. Free. Audit-ready. No one else has all four.*

---

## 7. Design System Blueprint (Visual Identity)

> Blueprint = the rulebook's table of contents + locked decisions. The actual
> Brand Book (Asset B-01) is a Phase 1 deliverable.

**Locked foundations (already in production — codify, don't reinvent):**
- **Logo:** orange rounded-square tile + white Devanagari **स**; wordmark
  "सहकार लेखा" (Devanagari, always two words) with "Sahakar Lekha" latin
  secondary. Rules to
  write: clear space = height of the स counter; min size 24px/8mm tile;
  misuse matrix (no recolor, no off-brand backgrounds, no stretching, no
  drop-shadow variants); mono + reversed versions. **One master SVG source**
  replaces today's per-asset redraws.
- **Primary palette:** Navy `hsl(215 70% 28%)` (≈ #153F79) — trust/authority;
  Orange `hsl(28 90% 55%)` (≈ #F48525) — energy/action (CTA-only rule);
  White. *(Exact hex to be locked from a single tokens file in Phase 1.)*
- **Secondary:** dark-navy `#0D2137`-range for depth shapes (already used in
  og/YT assets); success green (course/free badges — already in use);
  neutral grays from the app's existing scale.
- **Accent motif:** the **tricolor strip** (saffron/white/green edge band) —
  our "Indian institutional" signature; usage rule: one edge only, never
  behind text, never as the flag itself (flag-code safe).
- **Typography:** Devanagari-first pairing already shipped — **Hind**
  (Devanagari) + **Inter** (Latin/numbers). Scale, weights (700 display /
  600 head / 400 body), and Hindi line-height rules (Devanagari needs ~1.5×)
  to be tabled in the Brand Book. Print fallback: Noto Sans Devanagari.
- **Layout:** 12-col grid (digital), 8pt spacing system, generous margins;
  radius family from the app (`--radius`-based: tiles ~24%, cards 12px,
  buttons 8px); soft single-direction shadows only.
- **Graphic language:** big circles/blobs in darker navy (established in
  og/YT assets), real product screenshots in browser/phone frames (never
  fake UIs), flat iconography (Lucide set = app-consistent), NO stock photos
  of handshakes/suits — photography style = real Indian cooperative life
  (mandi, dairy, society office) when real photos exist, illustration
  otherwise.
- **Charts:** navy series first, orange highlight series, gray context;
  always ₹-formatted Indian digit grouping (1,12,500).
- **Motion:** calm and functional — 200–300ms ease-out, no bounce; video
  intro sting ≤ 2s; subtitle-always (sound-off viewing).
- **QR codes:** navy on white, tile logo center, always with a Hindi action
  label ("स्कैन करें — मुफ़्त शुरू करें"); one QR per asset max.
- **Badges/certificates/documents:** certificate style exists in-product —
  Brand Book will canonize its border/seal system for all official-feeling
  docs (welcome letter, partner certificate, training completion).
- **Co-branding rule (future federations/partners):** partner logo max same
  visual weight, always separated by a divider, never inside our clear space.

---

## 8. Marketing Asset Inventory

Legend — Priority: P1 critical / P2 important / P3 growth / P4 scale / P5
enterprise · Effort: S (<½ day) M (1–2 days) L (3–5 days) XL (1–2 wks).
Every asset ships hi + en unless noted. IDs are permanent.

### A. Brand assets
| ID | Asset | Purpose | Audience | Pri | Depends on | Effort |
|---|---|---|---|---|---|---|
| B-01 | Brand Book v1 (PDF + web page) | Single source of truth | Internal + partners | P1 | §7 approval | L |
| B-02 | Logo master pack (SVG/PNG/ICO; full/tile/mono/reversed) | Kill per-asset redraws | All | P1 | — | M |
| B-03 | Design tokens file (colors/type/spacing, JSON+CSS) | App↔marketing parity | Internal | P1 | B-01 | S |
| B-04 | Template masters: A4 doc, deck, social sizes, YT thumb, letterhead | Everything downstream | Internal | P1 | B-01,02 | L |
| B-05 | Icon + illustration starter library | Consistent visuals | Internal | P2 | B-01 | M |
| B-06 | Email signature + boilerplate block | Everyday touchpoints | Internal | P2 | B-02 | S |

### B. Sales assets
| ID | Asset | Purpose | Audience | Pri | Depends | Effort |
|---|---|---|---|---|---|---|
| S-01 | One-page product sheet (hi/en, print+PDF) | The universal leave-behind | Secretaries, boards | P1 | B-04 | M |
| S-02 | Master demo deck (15 slides) — rebuild of existing PPTX on template | Meetings, federations | Managers, boards | P1 | B-04 | L |
| S-03 | WhatsApp sales kit: intro msg pack + 1-pager PDF + 3 status creatives | Primary sales channel | All Tier A/B | P1 | S-01 | M |
| S-04 | Comparison sheets: vs Tally · vs Excel/registers · vs govt ERP (respectful) | Objection handling | Clerks, auditors | P2 | S-01 | M |
| S-05 | Society-type one-pager variants ×8 (skin of S-01) | Type-specific pitches | Per type | P2 | S-01 | L |
| S-06 | Board-meeting note template ("committee को समझाने के लिए") | Approval unlock | Chairpersons | P2 | S-01 | S |
| S-07 | Security & data one-pager + business-model transparency page | Trust objections | CEOs, registrars | P2 | §15 Q3 | M |
| S-08 | Auditor's kit (sample audit pack + format map + referral note) | Multiplier channel | Auditors | P2 | S-01 | L |
| S-09 | AGM presentation pack (3 slides societies can show members) | User-led virality | Societies | P3 | S-02 | S |

### C. Website & digital
| ID | Asset | Purpose | Pri | Depends | Effort |
|---|---|---|---|---|---|
| W-01 | Trust layer: testimonials module + numbers bar + founder note | Fix weakest area | P1 | real testimonials (§15) | M |
| W-02 | /brand press+media page (logo pack, boilerplate, screenshots) | Journalists, partners | P3 | B-01/02 | S |
| W-03 | Downloadables hub (all PDFs: one-pagers, checklists, posters) | Lead capture | P2 | S-xx | M |
| W-04 | Email lifecycle set: welcome ×3, audit-season, dormant-user (design templates) | Retention | P3 | B-04 | M |
| W-05 | WhatsApp broadcast template set (seasonal, feature, tip) | Retention | P2 | B-04 | S |

### D. Video (YouTube-first)
| ID | Asset | Purpose | Pri | Depends | Effort |
|---|---|---|---|---|---|
| V-01 | Channel launch kit: finalize banner/avatar/watermark + trailer script + end-card + thumbnail system (from existing samples) | The single biggest channel gap | P1 | B-04 | M |
| V-02 | Hero demo video (3–4 min, Hindi, screen+voice) + 60s cut for site/WhatsApp | Homepage embed pending since June | P1 | V-01 | L |
| V-03 | "Shuruaat" onboarding series ×5 (signup→first voucher→first report) | Activation | P2 | V-02 | XL |
| V-04 | Course companion videos (per part, 10) | Education moat ×video | P3 | V-03 | XL |
| V-05 | Testimonial video template (frame, lower-thirds, questions script) | Social proof engine | P2 | V-01, W-01 | S |
| V-06 | Shorts/Reels system (voucher tips, 30–45s, template) | Reach | P3 | V-01 | M |

### E. Print & field
| ID | Asset | Purpose | Pri | Depends | Effort |
|---|---|---|---|---|---|
| P-01 | Tri-fold brochure (hi) | AGMs, offices | P2 | S-01 | M |
| P-02 | Visiting card + letterhead + envelope | Founder credibility | P2 | B-04 | S |
| P-03 | A3 office poster ("इस समिति का हिसाब SahakarLekha पर है" + QR) | Society-office virality | P2 | B-04 | S |
| P-04 | Roll-up standee + backdrop (exhibition system v1) | Federation events, Co-op Week | P3 | B-04 | M |
| P-05 | Quick-start desk card (laminated, voucher cheat-sheet) | Onboarding + retention | P3 | S-01 | M |
| P-06 | Sticker/badge sheet ("Audit-Ready Society", certificate seals) | Delight, identity | P4 | B-01 | S |

### F. Education & customer success
| ID | Asset | Purpose | Pri | Depends | Effort |
|---|---|---|---|---|---|
| E-01 | Certificate + course collateral refresh on brand system | Flagship asset polish | P2 | B-04 | M |
| E-02 | Classroom/trainer kit (slides + exercises + bulk-certificate flow) | ICM/JCTC channel | P3 | S-02, E-01 | L |
| E-03 | Customer welcome kit (digital: letter + checklist + poster P-03 + links) | Onboarding | P3 | P-03 | S |
| E-04 | Season campaign kits ×4 (audit season, FY start, Co-op Week, AGM) — social+WhatsApp+blog banner bundles | Recurring campaigns | P3 | B-04 | L |

### G. Partner / institutional / scale
| ID | Asset | Purpose | Pri | Depends | Effort |
|---|---|---|---|---|---|
| G-01 | Federation partnership deck + MoU-style program one-pager | District/state federations | P4 | S-02 | L |
| G-02 | Registrar-safe information brochure (neutral, zero hype) | Govt officers | P4 | S-01 | M |
| G-03 | Referral program kit (mechanic + creatives + tracking plan) | Growth loop | P3 | W-01 | L |
| G-04 | Press kit (release template, founder bio+photo, fact sheet) | Media | P4 | W-02 | M |
| G-05 | Investor/strategy deck (business model, from existing BusinessModel.pptx) | Future funding | P5 | S-02 | L |
| G-06 | Recruitment one-pager + careers presence | Future hiring | P5 | B-01 | S |
| G-07 | Merchandise spec sheet (tee/cap/diary/pen for events) | Events | P5 | B-01 | S |

---

## 9. Asset Priority Matrix — Phases

**Phase 1 — CRITICAL (foundation; nothing else ships without it):**
B-01, B-02, B-03, B-04 · S-01, S-02, S-03 · V-01, V-02 · W-01.
*Why:* Brand Book + masters de-risk every future asset (10-year consistency
is decided here); one-pager + deck + WhatsApp kit = the minimum sales loop;
the demo video is the longest-standing conversion gap on the homepage; the
trust layer is the weakest audit finding. Everything here is reused by every
later phase.

**Phase 2 — IMPORTANT (objections, multipliers, retention):**
S-04–S-08 · B-05, B-06 · W-03, W-05 · V-03, V-05 · P-01, P-02, P-03 · E-01.
*Why:* converts the Phase 1 loop into a repeatable motion: objection sheets
for clerks/auditors, the auditor multiplier kit, first print presence, first
retention touches. Depends on Phase 1 templates — cannot come first.

**Phase 3 — GROWTH (reach, campaigns, programs):**
V-04, V-06 · E-02, E-03, E-04 · S-09 · P-04, P-05 · W-02, W-04 · G-03.
*Why:* scales what Phase 2 proved: seasonal campaign kits ride the existing
blog calendar; referral formalizes loops already shipped in product; trainer
kit opens the institutional education channel.

**Phase 4 — SCALE (institutional trust):** G-01, G-02, G-04 · P-06.
*Why:* federation/registrar assets only work once there are numbers and
testimonials to show (produced by Phases 1–3).

**Phase 5 — ENTERPRISE (company-building):** G-05, G-06, G-07.
*Why:* investor/recruitment assets are premature before traction proof; they
inherit everything above.

---

## 10. Production Roadmap

Cadence per standing operating rule: one asset at a time → review → approve →
next. Suggested order within Phase 1:

1. **Wk 1:** B-02 logo master pack → B-03 tokens → B-01 Brand Book draft.
2. **Wk 2:** B-01 approval → B-04 template masters (doc/deck/social/YT).
3. **Wk 3:** S-01 one-pager → S-03 WhatsApp kit (immediately usable in field).
4. **Wk 4:** S-02 demo deck rebuild → V-01 channel kit finalization.
5. **Wk 5–6:** V-02 demo video (script → record → edit → embed on homepage) →
   W-01 trust layer (blocked until first real testimonials arrive — start
   collecting NOW in parallel, see §14 Rec 1).

Gate to Phase 2: Brand Book approved + all four Phase-1 sales/video assets
live + at least 3 real testimonials captured.

---

## 11. Folder Structure, Naming, Formats, Versioning

```
docs/marketing/                      ← strategy & this plan (in git)
  MARKETING-MASTER-PLAN.md
  brand-book/                        ← B-01 source (md + exported PDF)
brand-assets/                        ← NEW top-level, in git (small/vector only)
  logo/          (svg masters, png exports @1x/2x, ico)
  tokens/        (tokens.json, tokens.css)
  templates/     (pptx/docx masters, social-size specs)
  fonts/         (Hind, Inter, Noto Sans Devanagari — license-checked)
marketing-vault/                     ← NOT in git (Drive/OneDrive): heavy files
  01-brand/  02-sales/  03-web/  04-video/  05-print/  06-education/
  07-partner/  08-campaigns/<YYYY-season>/  09-archive/
```

- **Naming:** `SL_<ID>_<asset-slug>_<lang>_<vMAJOR.MINOR>.<ext>` →
  `SL_S-01_one-pager_hi_v1.0.pdf`. Language codes: hi, en, hien (bilingual).
- **Formats:** every asset = 1 editable master (SVG/PPTX/DOCX/Figma-or-Canva —
  see §15 Q4) + exports (PDF/X-1a CMYK 300dpi+3mm bleed for print; PNG/WebP
  sRGB for digital; MP4 H.264 + SRT for video).
- **Versioning:** masters that are text/vector live in git; binaries >2MB live
  in the vault with the version in the filename; `docs/marketing/CHANGELOG.md`
  logs every released asset version. Existing root-level marketing files
  (`SahakarLekha_*.pptx/pdf`, `yt_*.png`, `x_header.png`) migrate into this
  structure in Phase 1 (repo hygiene win too).
- **Print specs:** A4 210×297, tri-fold 210×297 z-fold, standee 850×2000mm,
  visiting card 89×51mm; always CMYK + embedded fonts + outlined logo.
- **Digital specs:** OG 1200×630 · YT thumb 1280×720 · YT banner 2560×1440
  (safe 1546×423) · X header 1500×500 · WhatsApp status 1080×1920 ·
  Insta 1080×1080/1350 · LinkedIn 1200×627.
- **Accessibility:** WCAG AA contrast (navy/white passes; orange NEVER for
  body text on white), min 16px digital body, min 9pt print Devanagari,
  alt-text on all published images, SRT subtitles on all video.

---

## 12. Quality Standards (every asset, no exceptions)

1. **Consistency:** built from a B-04 master; tokens only — no eyeballed colors.
2. **Typography:** Hind/Inter only; Devanagari line-height ≥1.5; no fake bold/italic on Devanagari; Indian digit grouping (₹1,12,500).
3. **Spacing/alignment:** 8pt grid; logo clear space enforced; one visual hierarchy per page.
4. **Color:** navy = trust surfaces, orange = ONE call-to-action per asset, tricolor strip = one edge max.
5. **Accessibility:** AA contrast, readable at arm's length (print) / thumb-scroll (mobile).
6. **Localization:** Hindi is the FIRST language on the asset, not the translation; everyday Hinglish per standing style rule; English variant only where the audience is English-first (auditors/enterprise).
7. **Truthfulness:** no invented testimonials, user counts, or endorsements — ever (hard rule; also legal safety with govt-adjacent audiences).
8. **Screenshots:** real product, demo-society data, personal names masked.
9. **QR/logo placement:** QR bottom-right with Hindi action label; logo top-left (digital) / defined slot per template (print).
10. **Responsive/printable:** social assets checked at thumbnail size; print assets checked at 100% zoom + grayscale-photocopy test (society offices photocopy everything).
11. **Flag code:** tricolor motif is a strip, never the flag; no Ashoka Chakra; no govt emblem — legally required.

## Review checklist (run before any asset is marked done)

- [ ] Ladders to one of the 5 messaging pillars (§6)?
- [ ] Correct persona + society-type tag from §4?
- [ ] Built on the current template master version?
- [ ] Tokens-only colors/type? Logo from B-02 master?
- [ ] Hindi copy reviewed by native speaker (founder)?
- [ ] All claims true and sourced? No fabricated proof?
- [ ] Contact block correct (sahakarlekha.com · WhatsApp 91946-79-18545 · @sahakarlekha)?
- [ ] Correct export formats + named per convention + version logged?
- [ ] Photocopy/thumbnail legibility test passed?
- [ ] Founder approval recorded?

---

## 13. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Govt mandates NLPS for all PACS | Lose PACS segment | Lead marketing with the 7 uncovered types; position for PACS as training-ground/complement; never attack the scheme publicly |
| "Free" erodes trust | Conversion drag | S-07 transparency page in Phase 2; export-anytime guarantee everywhere |
| Zero testimonials blocks trust assets | W-01, V-05, G-01 all stall | Start capture immediately (Rec 1) — this is the critical path |
| Single-founder bandwidth | Roadmap slippage | Strict one-asset-at-a-time cadence; templates before assets |
| Brand drift over 10 years | Erodes the whole investment | B-01 as law + §12 checklist + tokens in git |
| Hindi copy quality (AI-generated shuddh-ness) | Sounds fake to the audience | Founder is final Hindi editor on every asset (standing rule) |
| Font/stock licensing in print | Legal | Google-font stack only (Hind/Inter/Noto — OFL licensed); no unlicensed stock imagery |

## 14. Recommendations (top 5, in order)

1. **Start testimonial capture TODAY, before any design work** — a WhatsApp
   message to every real user asking for 2 lines + name + society name +
   photo permission. Every trust asset in this plan is blocked on this.
2. **Approve the positioning + tagline direction first** (§6) — it changes
   copy on every asset; deciding it late means redoing Phase 1.
3. **Treat the YouTube channel as Phase 1, not "someday"** — the audience
   learns on YouTube; assets have been sitting ready in the repo since June.
4. **Answer the "free kaise?" question publicly** (S-07) — pre-empt the #1
   whispered objection before scaling reach.
5. **Move marketing files out of the repo root into §11 structure** during
   Phase 1 — cheap now, painful after 200 assets exist.

## 15. Missing Information & Questions

1. **Origin story:** the real founding moment/details for the brand story (§6) — who, when, which society, what went wrong?
2. **Traction numbers:** current registered societies/users — usable publicly? Even "100+ societies" changes every asset.
3. **Business model public stance:** what CAN we say about how free is sustained (the BusinessModel deck exists — which parts are public)?
4. **Design tool of record:** Canva Pro, Figma, or code-generated (HTML→PDF)? Affects B-04 template format and who can edit in 5 years.
5. **Founder visibility:** willing to be the face (name/photo/voice) on videos and press kit? The sector trusts people, not logos.
6. **Budget envelope:** any paid components in scope (print runs, Canva Pro, voice-over artist, event presence) or strictly ₹0 for now?
7. **Geographic focus:** Haryana-first (matching the state-page pilot and HAFED content) or pan-India from day one?
8. **Testimonial availability:** are there 3–5 real users reachable this month?

---

*Approval needed on: (a) this plan overall, (b) positioning + tagline
direction (§6), (c) Phase 1 asset list (§9), (d) answers to §15. Nothing will
be designed until then.*
