# Phase 4 — Ask-AI Map

> How the `/ask` assistant ([AskAssistant](../scos/02-knowledge-architecture.md)) consumes the **active**
> KIs to answer grounded, cited, jurisdiction-aware questions. The retrieval contract is **already
> specified** in [KAE 11 — AI Knowledge API](../kae/11-ai-knowledge-api.md); this map supplies the per-KI
> triggers and the answer/refuse/recommend rules for the 50 active KIs.

**Each KI provides:** answer source (its definition/purpose), evidence (`EV-…`), related KIs, related
guide/blog article, related module (for "recommend software"). **All 50 active KIs are Level-A** → the
AI may answer them directly with citation.

---

## 1. Global answer rules (apply to every query)

| Situation | AI behaviour |
| --- | --- |
| Query matches an **active Level-A KI** (these 50) | **Answer** from the KI, cite `EV-`, add module CTA, link guide |
| Query needs a **B/C/D / NEV** fact (rate, section, treatment, deadline) | **Refuse to state the specific** → give the general concept + "अपने CA/RCS या आधिकारिक पोर्टल से पुष्टि करें"; never fabricate |
| Query is **state-specific** and no state KI exists | **No silent generalization** ([KAE 05](../kae/05-jurisdiction-engine.md)): give central/general + "राज्य के नियम अलग हो सकते हैं" |
| Query is **"how do I do X in the app"** | Answer + **recommend the module** (deep-link) + link help task |
| Query is **out of scope / not in KI base** | Say so plainly; offer search/guide; do not invent |
| Pricing/policy (KI-000341) | Answer from the KI but **source current pricing from /pricing** |

**When AI should recommend software:** whenever a KI has a `related_module` and the user shows intent to
*act* ("kaise kare", "where do I…") → surface the module CTA. **When AI should refuse:** any regulated
specific below E3 (all B/C/D NEV items) — concept yes, specific no.

## 2. Per-KI trigger questions (representative; Hindi-first)

| KI | Trigger questions | Related KIs | Evidence | Related article | Recommend module |
|---|---|---|---|---|---|
| KI-000001 Cooperative society | "सहकारी समिति क्या है?" / "what is a cooperative society" | 004,002,009 | EV-000001 | /guide/introduction | /register |
| KI-000009 Society types | "समिति कितने प्रकार की होती है?" | 010,014,001 | EV-000009 | /guide/society-type-entries | /society-setup |
| KI-000010 PACS | "PACS क्या है?" / "PACS software" | 009,014 | EV-000010 | /software/:type | /software/:type |
| KI-000025 Accounting | "लेखांकन क्या है?" | 026,039,046 | EV-000025 | /guide/accounting-foundations | /dashboard |
| KI-000026 Double-entry | "दोहरा लेखा क्या है?" | 027,028,040 | EV-000026 | /guide/golden-rules | /vouchers |
| KI-000027 Debit / KI-000028 Credit | "डेबिट/क्रेडिट का मतलब?" / "Dr Cr kya hai" | 026,029 | EV-000027/28 | /guide/golden-rules | /vouchers |
| KI-000033 Account | "खाता क्या होता है?" | 079,081,034 | EV-000033 | /guide/chart-of-accounts | /ledger-heads |
| KI-000034/35/36 Asset/Liability/Capital | "परिसंपत्ति/देयता/पूँजी क्या है?" | 040,207 | EV-000034.. | /guide/balance-sheet | /balance-sheet |
| KI-000040 Accounting equation | "लेखांकन समीकरण क्या है?" | 034,035,036 | EV-000040 | /guide/balance-sheet | /balance-sheet |
| KI-000050 Financial year | "वित्तीय वर्ष कब से कब?" | 049,051 | EV-000050 | /guide/year-end-and-fy-lock | /society-setup |
| KI-000055 Voucher | "वाउचर क्या है? / पहला वाउचर कैसे?" | 026,047,039 | EV-000055 | /guide/voucher-types | /vouchers |
| KI-000079 Ledger | "खाता बही क्या है?" | 080,048,086 | EV-000079 | /guide/daybook-and-ledger | /ledger |
| KI-000101 Cash book | "रोकड़ बही क्या है? कैसे देखें?" | 099,100,114 | EV-000101 | /guide/receipts-and-payments | /cash-book |
| KI-000113/114 Bank account/book | "बैंक बही क्या है? बैंक कैसे जोड़ें?" | 121,116,101 | EV-000113/14 | /guide/receipts-and-payments | /bank-book |
| KI-000121 Bank statement | "बैंक स्टेटमेंट से मिलान कैसे?" | 114,122 | EV-000121 | /bank-reconciliation | /bank-reconciliation |
| KI-000131 Membership / KI-000004 Member | "सदस्य कौन? सदस्य कैसे जोड़ें?" | 153,134 | EV-000131/04 | /guide/member-management | /members |
| KI-000153 Share / KI-000157 Paid-up | "शेयर/चुकता पूँजी क्या है?" | 158,036 | EV-000153/57 | /guide/member-management | /share-register |
| KI-000212 Read reports | "रिपोर्ट कैसे पढ़ें?" | 207,201,206 | EV-000212 | /guide/financial-ratios-and-lifecycle | /reports |
| KI-000303 Cloud accounting | "क्लाउड लेखांकन सुरक्षित है?" | 306,322 | EV-000303 | /software | /register |
| KI-000305 Society setup | "समिति सेटअप कैसे करें?" | 325,009,050 | EV-000305 | /guide/society-setup-and-roles | /society-setup |
| KI-000306 Data backup | "मेरा डेटा सुरक्षित है?" | 303,307 | EV-000306 | /guide/data-security-and-backup | /backup-restore |
| KI-000322 Why go digital | "समिति डिजिटल क्यों बने?" | 303,305 | EV-000322 | /software | /register |
| KI-000325 Getting started | "शुरुआत कैसे करें?" | 305,329,330 | EV-000325 | /guide/quick-start | /register |
| KI-000341 Is free? | "क्या यह मुफ्त है?" | 303,322 | EV-000341 | /pricing | /pricing |

*(Remaining active KIs follow the same pattern; the full trigger set is generated from each KI's
`keywords` + `suggested FAQ` fields.)*

## 3. Escalation rules

```
1. Match query → active KI? 
     yes → answer (cite EV-, link article, module CTA)
     no  → 2
2. Is it a known B/C/D / NEV topic (tax, legal, treatment, deadline)?
     yes → concept-only answer + "verify with CA/RCS" + offer /guide; DO NOT state the specific
     no  → 3
3. Is it product support ("how to / where is")?
     yes → recommend module + link /help; if unclear, offer /search
     no  → 4
4. Unknown / out of scope → say so, offer /search + /guide; never fabricate.
Always: attach jurisdiction note if the topic is state-variable.
```

## 4. Refuse / safe-completion catalogue (examples)
- "मेरी समिति का reserve fund % कितना है?" → **refuse specific** (state-statutory, NEV) → explain reserve-fund concept (KI-000170 planned) generally + "अपने राज्य अधिनियम/CA से पुष्टि करें".
- "GST रेट क्या है?" → **refuse specific** (tax, NEV) → general + official portal.
- "मेरी समिति को क्या कानूनी सलाह है?" → refuse legal advice → direct to RCS/CA.
- "डेबिट क्या है?" → **answer** (Level-A KI-000027, cite EV-000027).

## 5. Implementation note (reuse existing)
`/ask` + `siteSearch` become the first consumers of the [KAE AI API](../kae/11-ai-knowledge-api.md):
retrieve over the 50 active KIs (definitions + `EV-` + `related_module` + `internal_links`), answer
Level-A directly, hedge everything else. **No new AI architecture** — only wire the active-KI corpus in.

### Cross-references
[Delivery Map](knowledge-delivery-map.md) · [Search Experience](search-experience.md) · [KAE AI Knowledge API](../kae/11-ai-knowledge-api.md) · [KAE Jurisdiction Engine](../kae/05-jurisdiction-engine.md) · [KPP active KIs](../kpp/wave-1-active/00-index.md)
