# सहकार लेखा — Brand Book v1.0 (B-01)

**Status:** DRAFT — awaiting founder approval.
**Applies to:** every asset, page, video, print piece and message that carries
the brand — for the next 10 years. When in doubt, this book wins.
**Companions:** design tokens ([brand-assets/tokens/tokens.json](../../../brand-assets/tokens/tokens.json)) ·
logo masters ([brand-assets/logo/](../../../brand-assets/logo/)) ·
strategy ([MARKETING-MASTER-PLAN.md](../MARKETING-MASTER-PLAN.md)).

---

## 1. The brand in one breath

> **सहकार लेखा** — सहकारी समितियों का अपना सॉफ्टवेयर।
> All 8 society types. Hindi-first. Free. Audit-ready.

We are the cooperative sector's **own** software — not a generic accounting
tool wearing a co-op sticker, not a government scheme with a rollout queue.
Built only for societies, in their language, at no cost, with books that are
always ready for the auditor.

### Positioning pillars (every asset ladders to ≥ 1)

1. **सिर्फ़ सहकारी समितियों के लिए** — share capital, dividend, MSP, RCS formats built-in.
2. **Audit-ready, हमेशा** — one-click statutory reports, FY-lock, clean trails.
3. **आपकी भाषा में** — Hindi-first UI, course, support.
4. **मुफ़्त और पारदर्शी** — free, explained openly, export-anytime.
5. **सीखना भी मुफ़्त** — the certificate course; we train the whole sector.

### Personality

The **village-bank-officer-turned-teacher**: trustworthy, precise, warm,
patient. Never a startup bro, never a sarkari circular, never flashy.

---

## 2. Naming rules

| Rule | Correct | Wrong |
|---|---|---|
| Devanagari name is **two words** | सहकार लेखा | सहकारलेखा |
| Latin name is **two words, title case** | Sahakar Lekha | SahakarLekha, sahakar lekha |
| Domain is **always lowercase, one word** | sahakarlekha.com | SAHAKARLEKHA.COM, Sahakarlekha.com |
| Social handle | @sahakarlekha | @SahakarLekha |
| First mention in Hindi copy | सहकार लेखा | "SL", "the app" |

- In running Hindi text, use सहकार लेखा; in running English text, Sahakar Lekha.
- Never translate the name ("Cooperative Accounts" etc.).
- Never abbreviate to SL in anything user-facing.

---

## 3. Voice & tone (आवाज़)

**Everyday Hinglish first, plain English second.** बोलचाल की भाषा — शुद्ध
साहित्यिक हिन्दी नहीं। Statutory words stay exact and untranslated where the
sector uses them: बैलेंस शीट, तलपट, TDS, 26Q, GST, ऑडिट.

| Do | Don't |
|---|---|
| "5 मिनट में balance sheet तैयार" | "पाँच मिनटों में तुलन-पत्र सृजित करें" |
| "Audit की टेंशन खत्म" | "अंकेक्षण संबंधी चिंताओं का निवारण" |
| "आपका data आपका है — कभी भी export करें" | "डेटा स्वामित्व उपयोगकर्ता के पास सुरक्षित" |
| Reassure, then instruct: "घबराइए मत — बस 3 step हैं" | Fear-selling: "ग़लत हिसाब = जेल!" |

Tone dials by audience:
- **Secretary/clerk:** warm teacher. Step-by-step. इज़्ज़त-first — never imply they're behind.
- **Chairman/board:** formal Hindi, risk-reduction framing, peer proof.
- **Auditor/registrar:** precise, format-literal, zero hype, English acceptable.
- **Social/video:** friendly, seasonal hooks, light wordplay allowed; never memes at the sector's expense.

Numbers: always ₹ with Indian grouping — **₹1,12,500** (never 112,500).
Dates in Hindi copy: 31 मार्च 2026.

**Truth rule (absolute):** no invented testimonials, user counts, endorsements
or "India's #1" claims. "India's only cooperative-specific platform" is the
approved superlative. Never attack the government PACS scheme.

---

## 4. Logo system

Masters live in `brand-assets/logo/` — vector paths baked in, identical on
every machine. Full usage table in [logo/README.md](../../../brand-assets/logo/README.md).

- **Primary lockup:** horizontal (tile + सहकार लेखा + sahakarlekha.com).
- **Tile alone:** small spaces (favicon, DP, watermark, < 120px widths).
- **Stacked:** squarish placements (certificates, social posts).
- **Tagline lockup:** covers and title slides only — not in body layouts.
- **Reversed versions** on navy/dark; **mono versions** for photocopy/stamp/fax.

Rules:
- **Clear space** = 25% of tile height on all sides. The tricolor strip, text,
  QR codes — nothing enters it.
- **Minimum sizes:** tile 24px / 8mm; horizontal 120px / 35mm wide.
- **Never:** recolor, stretch, rotate, add shadows/glows, outline, re-typeset
  the wordmark, write the name as one word, place the orange tile on
  orange/saffron, or set the logo on a busy photo without a solid panel.
- One logo per surface. Don't repeat the logo as a pattern.

---

## 5. Color

Single source: `brand-assets/tokens/tokens.json`. Never eyeball.

| Token | Hex | Role & rules |
|---|---|---|
| **Navy** | `#153f79` | The brand's voice: headings, wordmark, trust surfaces, chart series 1. Backgrounds for reversed layouts. |
| **Orange (saffron)** | `#f48525` | Energy: logo tile, ONE call-to-action per asset, highlight numbers. ❌ Never body text on white (fails AA). ❌ Never full-page backgrounds. |
| **Navy dark** | `#122d54` | Depth: background blobs/shapes, dark panels, tagline text. |
| **White** | `#ffffff` | Space. Layouts breathe — default page background is white. |
| Success green | `#1f9350` | मुफ़्त/free badges, checkmarks, positive numbers, tricolor strip green. |
| Info teal | `#2999a3` | Chart series 2, info callouts. |
| Warning amber | `#f59f0a` | Caution notes only — never decoration (clashes with brand orange). |
| Destructive red | `#db2424` | Errors/negative numbers only. |
| Neutrals | `#1d2330` body · `#676f7e` captions · `#e9edf2`/`#f3f5f7` section bg · `#d1d8e0` rules | Text and structure. |

**Proportions (rule of thumb):** ~60% white/neutral · ~30% navy family ·
~10% orange + accents. If an asset feels "orange", it's wrong.

**Accessibility pairs (AA-safe):** navy on white ✅ · white on navy ✅ ·
white on orange ✅ (large text/logo only) · orange on navy ✅ (headlines ≥ 18px) ·
orange on white ❌ (only for logo/large display, never body).

### Tricolor strip (the institutional signature)

A thin band — saffron `#f48525` / white / green `#1f9350` — on **one edge**
of an asset (top or bottom, 4–8px digital, 2–3mm print).
❌ Never behind text · ❌ never two edges · ❌ never rendered as the actual
flag · ❌ no Ashoka Chakra, no government emblem (Emblems Act safety).

---

## 6. Typography

| Script | Family | Weights | Use |
|---|---|---|---|
| Devanagari | **Hind** | 700 display/headlines · 600 subheads · 400/500 body | Everything Hindi |
| Latin/numbers | **Inter** | 700/600/400 | English text, numbers, URLs |
| Print fallback | Noto Sans Devanagari | — | when Hind unavailable |

Scale (digital 1x): display 44 · h1 32 · h2 24 · h3 18 · body 16 · caption 13.
Print body ≥ 9pt Devanagari.

Rules:
- Devanagari line-height **≥ 1.5** (matras clip below that).
- **No faux bold/italic** on Devanagari — use real weights, skip italics entirely in Hindi.
- Hindi is the FIRST (larger/upper) language on bilingual assets; English supports.
- Latin digits for all amounts (₹1,12,500) — Devanagari digits (१२३) only as
  decorative chapter numbers, never for money.
- Don't mix a third typeface. Ever.

---

## 7. Layout & graphic language

- **Grid:** 12-column digital / 8pt spacing everywhere (multiples of 8; 4 for fine detail).
- **Radius family:** tiles 22% of side · cards 12px · buttons 8px. No sharp-cornered cards, no pill-everything.
- **Shadows:** one direction, soft, sparing (`0 4px 16px rgba(18,45,84,.12)` equivalent). Never glows.
- **Signature shapes:** large `#122d54` circles/blobs bleeding off dark layouts
  (see og-image) — max 2 per composition, never behind body text.
- **Product screenshots:** REAL app, demo-society data, personal names masked;
  browser or phone frame; light tilt/overlap allowed. ❌ Never mock fake UI.
- **Icons:** Lucide set (app-consistent), 1.5–2px stroke, navy or white — not multicolored.
- **Illustration (when no real photo):** flat, 2–3 brand colors, Indian
  cooperative life (mandi, dairy can, society office, khet) — not Western
  corporate clip-art, no "handshake suits".
- **Photography (when real):** actual societies/users, daylight, candid work
  shots; get written consent; no watermarked stock.

### Charts

Series order: navy → teal → orange (highlight only) → gray (context).
White background, `#d1d8e0` gridlines, ₹-formatted axes, label the takeaway
("+32% वसूली") not just the data.

---

## 8. Motion & video

- Timing 200–300ms ease-out; calm, functional. No bounce, no spin.
- Intro sting ≤ 2s: tile scales in, wordmark reveals — same every video.
- **Subtitles always** (sound-off viewing is the norm) — Hind SemiBold, white
  on `#122d54` @ 85% band.
- Thumbnails (from the shipped YT system): navy bg, blob motif, ≤ 5 शब्द big
  Hindi hook, product screenshot right, tricolor strip bottom.
- Watermark: white mono tile, bottom-right, ~60% opacity.

---

## 9. Official-feel documents (QR, badges, certificates)

- **QR codes:** navy modules on white, tile logo center, one per asset,
  bottom-right, always with a Hindi action label: "स्कैन करें — मुफ़्त शुरू करें".
- **Certificates** (course/partner/training): white base, navy double-rule
  border, stacked logo top-center, orange seal motif, tricolor strip bottom
  edge, serial number + verification URL bottom-left.
- **Letterhead:** horizontal logo top-left, tricolor strip bottom edge,
  contact line (sahakarlekha.com · WhatsApp +91 94679 18545 · @sahakarlekha).
- **Badges** ("Audit-Ready Society"): tile + text lockup, navy/white, round or
  rounded-square — collectible, not gaudy.

---

## 10. Co-branding (federations, trainers, partners)

- Partner logo ≤ equal visual weight, separated by a 1px `#d1d8e0` divider,
  outside our clear space.
- Our position: top-left or first. On partner-led material, "Powered by
  सहकार लेखा" lockup (horizontal logo, min sizes apply).
- Never merge logos, never let a partner recolor ours, never imply government
  endorsement.

---

## 11. File practice

- Naming: `SL_<assetID>_<slug>_<lang>_<vMAJOR.MINOR>.<ext>` (lang: hi/en/hien).
- Colors/type only from tokens. Text in masters: baked paths (logos) or live
  text with Hind/Inter (documents).
- Small vector/masters → git (`brand-assets/`). Heavy binaries → marketing
  vault, path mirrored. Every release → line in `docs/marketing/CHANGELOG.md`.
- Print: PDF/X-1a, CMYK, 300dpi, 3mm bleed, fonts embedded/outlined.
  Digital: sRGB PNG/WebP. Video: MP4 H.264 + SRT.

---

## 12. Pre-flight checklist (run before ANY asset ships)

- [ ] Ladders to a positioning pillar (§1)?
- [ ] Persona + society-type tagged (master plan §4)?
- [ ] Name written correctly everywhere — सहकार लेखा / Sahakar Lekha / sahakarlekha.com (§2)?
- [ ] Colors/type from tokens only; logo from masters (§4–6)?
- [ ] One CTA, one orange focus, ≤ 2 blobs, tricolor on one edge max (§5, §7)?
- [ ] Hindi reviewed by founder; everyday Hinglish, not shuddh (§3)?
- [ ] Every claim true; no fabricated proof (§3)?
- [ ] Contact block correct (§9)?
- [ ] AA contrast; Devanagari ≥ 1.5 line-height; ₹ Indian grouping (§5–6)?
- [ ] Photocopy/thumbnail legibility test passed?
- [ ] Named per convention, version logged in CHANGELOG?
- [ ] Founder approval recorded?

---

*v1.0 draft · 2026-07-05 · Changes to this book require founder sign-off and
a version bump. The tokens file and logo masters are the machine-readable
half of this book — keep all three in sync.*
