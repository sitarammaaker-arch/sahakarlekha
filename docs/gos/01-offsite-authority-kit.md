# GOS-14 — Off-site Authority Kit v1.0

**Date:** 2026-07-06 · **Owner-led** (Sitaram executes; Claude drafts/refreshes copy on demand)
**Why:** RC-3 of the GOS diagnosis — a new domain with ~zero backlinks gets indexation-throttled
no matter how good the on-site work is. This is the ONLY P0/P1 lever that lives off-site.
**Rule:** कोई paid-link या link-farm नहीं — सिर्फ genuine listings, genuine content, genuine communities.

---

## 1 · UTM स्कीम (हर बाहरी link में यही pattern)

`https://sahakarlekha.com/?utm_source=<स्रोत>&utm_medium=<माध्यम>&utm_campaign=authority`

| जगह | utm_source | utm_medium |
|---|---|---|
| Software directories | `g2` / `capterra` / `softwaresuggest` / `alternativeto` | `directory` |
| YouTube video description | `youtube` | `video` |
| X posts | `x` | `social` |
| WhatsApp channel | `whatsapp` | `social` |
| Guest posts / PR | साइट का नाम | `guest` |

GA4 में Traffic acquisition → Session source/medium से ROI दिखेगा। ध्यान रहे: directory
की profile-link में UTM ठीक है, पर अगर कोई साइट "website" field में सिर्फ नंगा URL लेती
है तो नंगा URL ही दें — link मिलना UTM से ज़्यादा कीमती है।

## 2 · Software directories (पहले 2 हफ़्ते — सबसे आसान, सबसे पक्की listings)

Priority order (सब free listing देते हैं):

1. **SoftwareSuggest** (भारतीय B2B — सबसे relevant) — category: Accounting Software
2. **G2** — category: Accounting
3. **Capterra / GetApp** (Gartner) — Accounting + Nonprofit
4. **AlternativeTo** — "alternative to Tally" positioning (high-intent!)
5. **Product Hunt** — एक बार का launch (तैयारी से करें, screenshots + demo PDF के साथ)
6. **SaaSHub, Slant** — quick wins
7. **IndiaMART / Justdial** business listing — local citations (brand searches में मदद)

Listing copy (हर जगह same base, en):
> SahakarLekha is free cloud accounting software built specifically for Indian cooperative
> societies (PACS, dairy, marketing, consumer, housing, sugar, labour). Double-entry vouchers,
> member & share registers, loan/KCC interest, TDS 26Q, GST summaries, and RCS audit-format
> reports — bilingual Hindi + English. 100% free, no trial, no card.

## 3 · Cooperative-sector surfaces (असली moat — कोई competitor यहाँ नहीं है)

**सावधानी:** सरकारी/federation साइटों पर सिर्फ genuine संपर्क — कोई spam नहीं। पहला लक्ष्य
सूचीबद्ध होना नहीं, **परिचय** है; link अपने-आप आता है।

- राज्य RCS/सहकारिता विभाग के प्रशिक्षण केंद्र (HICM/हरियाणा से शुरू — Haryana pilot पेज पहले से है)
- NCUI / NCCT / VAMNICOM / राज्य सहकारी संघ — प्रशिक्षण-सामग्री के रूप में मुफ्त /guide + प्रमाणपत्र offer करें
- जिला सहकारी बैंक (DCCB) व HARCO — PACS clerks का प्रशिक्षण इनके नीचे होता है
- सहकारिता पत्रिकाएँ (हिन्दी): "सहकारी समिति का हिसाब डिजिटल कैसे करें" guest लेख — byline में साइट
- Hindi finance/agri YouTube-सहयोग: KCC, MSP भुगतान, समिति ऑडिट विषयों पर

Outreach draft (WhatsApp/email, Hinglish — छोटा रखें):
> नमस्ते जी। हमने सहकारी समितियों के लिए एक बिल्कुल **मुफ्त** लेखा सॉफ्टवेयर बनाया है —
> SahakarLekha (sahakarlekha.com)। वाउचर से बैलेंस शीट, TDS/GST, ऑडिट रिपोर्ट — सब हिन्दी में।
> साथ में मुफ्त कोर्स भी है जिसे पूरा करने पर प्रमाणपत्र मिलता है (sahakarlekha.com/guide)।
> अगर आपके प्रशिक्षण/समितियों के लिए उपयोगी लगे तो हम demo या सामग्री भेज सकते हैं। 🙏

## 4 · Content-led links (चल रहा है, cadence बनाए रखें)

- **YouTube** (assets ready): हर video description में 2-3 deep links (guide chapter + tool)
- **X drip**: हर नए blog post का thread; quote-tweet सहकारिता news
- **WhatsApp channel**: हर post + हर नया calculator/tool announce
- **Quora/Reddit (r/india, r/IndiaInvestments नहीं — सहकारिता सवाल)**: genuine जवाब, जहाँ सच में
  relevant हो वहीं link — जवाब पहले, link बाद में

## 5 · क्या नहीं करना

- ❌ Paid links, PBN, link exchange schemes
- ❌ Directory spam (100 junk directories) — ऊपर की ~7 quality listings काफी हैं
- ❌ सरकारी साइटों पर mass email
- ❌ AI-generated guest posts बिना समीक्षा के

## 6 · Tracking (monthly review में)

| Metric | कहाँ देखें | Baseline (2026-07-06) |
|---|---|---|
| Referring domains | GSC → Links report | ~0 (record at kickoff) |
| Brand searches ("sahakarlekha") | GSC Queries | record |
| Directory referral sessions | GA4 source/medium | 0 |
| Listing count live | manual checklist नीचे | 0/7 |

Checklist: [ ] SoftwareSuggest [ ] G2 [ ] Capterra [ ] AlternativeTo [ ] Product Hunt
[ ] SaaSHub [ ] IndiaMART · [ ] HICM संपर्क [ ] NCUI संपर्क [ ] पहला guest लेख
