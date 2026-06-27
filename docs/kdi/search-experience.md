# Phase 5 — Search Experience

> How the 50 **active** KIs power `/search` ([SiteSearch](../scos/02-knowledge-architecture.md)): suggestions,
> autocomplete, related searches, filters, popular searches, did-you-mean, and **Hindi / English / mixed**
> matching via KI synonyms. Built on each KI's `keywords`, `hindi_name`, `english_name`, and `glossary`
> fields — **no new search architecture**, just a KI-fed index.

---

## 1. Synonym & multilingual map (the core of Hindi/English/mixed search)

Each KI contributes a synonym cluster so a user can search in Hindi, English, Hinglish, or Devanagari and
land on the same result. (Source: KI `hindi_name` + `english_name` + `keywords`.)

| Canonical KI | Synonyms / variants (hi · en · hinglish) |
|---|---|
| KI-000101 Cash book | रोकड़ बही · cash book · rokad bahi · रोकड़ · cashbook |
| KI-000114 Bank book | बैंक बही · bank book · bank bahi |
| KI-000079 Ledger | खाता बही · ledger · khata bahi · लेजर |
| KI-000055 Voucher | वाउचर · voucher · entry · पर्ची |
| KI-000027 Debit | नाम · debit · dr · डेबिट |
| KI-000028 Credit | जमा · credit · cr · क्रेडिट |
| KI-000026 Double-entry | दोहरा लेखा · double entry · double-entry |
| KI-000049 Accounting cycle | लेखांकन चक्र · accounting cycle |
| KI-000185-type Trial balance* | तलपट · trial balance · TB *(planned KI; synonym reserved)* |
| KI-000034 Asset | परिसंपत्ति · asset · संपत्ति |
| KI-000035 Liability | देयता · liability · देनदारी |
| KI-000036 Capital | पूँजी · capital · पूंजी |
| KI-000037 Income | आय · income · आमदनी |
| KI-000038 Expense | व्यय · expense · खर्च · kharcha |
| KI-000050 Financial year | वित्तीय वर्ष · financial year · FY · वित्त वर्ष |
| KI-000004 Member | सदस्य · member · sadasya |
| KI-000153 Share | अंश · share · शेयर |
| KI-000121 Bank statement | बैंक स्टेटमेंट · bank statement · statement |
| KI-000010 PACS | PACS · प्राथमिक कृषि साख समिति · पैक्स |
| KI-000306 Data backup | बैकअप · backup · data backup · डेटा सुरक्षा |
| KI-000305 Society setup | समिति सेटअप · society setup · setup |

> The glossary KIs (KI-000263–000302 in the registry; several active here) are the **synonym backbone** —
> each maps a Hindi term ⇄ English term ⇄ its concept KI.

## 2. Autocomplete seeds (as the user types)

| User types | Suggest (KI) |
|---|---|
| "रोकड़…" | रोकड़ बही (KI-000101), रोकड़ खाता (KI-000100) |
| "cash…" | cash book (101), cash account (100) |
| "bank…" | bank book (114), bank account (113), bank reconciliation* |
| "वाउचर / voucher" | voucher (055), voucher types* |
| "debit / नाम" | debit (027), credit (028), double-entry (026) |
| "सदस्य / member" | member (004), membership (131), add member (help) |
| "balance…" | balance sheet*, opening balance* |
| "PACS / पैक्स" | PACS (010), society types (009) |
| "free / मुफ्त" | is it free (341), pricing |
| "backup / बैकअप" | data backup (306), restore* |

\* = planned KI / existing surface; suggestion reserved.

## 3. Related searches (per result, from KI relationships)
- Open **Cash book (101)** → related: रोकड़ खाता (100), बैंक बही (114), receipts & payments, "Cash Book कैसे देखें" (help).
- Open **Voucher (055)** → related: debit (027), credit (028), double-entry (026), "पहला Voucher कैसे करें" (help).
- Open **Ledger (079)** → related: ledger account (080), posting (048), day book (086), trial balance*.
- Open **Member (004)** → related: membership (131), share (153), "Member कैसे जोड़ें" (help).
> Generated from each KI's `related_concepts` + `related_modules`.

## 4. Filters (facets on results)
| Filter | Values (from KI fields) |
|---|---|
| **Type** | concept · term · how-to · product · FAQ |
| **Category** | Cooperative Basics · Accounting Foundations · Vouchers · Ledger · Cash · Bank · Members · Shares · Reports · Software · Help |
| **For (persona)** | Secretary · Accountant · Auditor · Chairman · Member · New user |
| **Surface** | Guide · Help · Glossary · FAQ · Module |
| **Difficulty** | beginner · intermediate |

## 5. Popular searches (seed list — refine later with real GA/Search-Console data)
> *Seeded from P0/high-impact KIs; mark "Research Required" until real query data exists (no fabricated volumes).*
रोकड़ बही · वाउचर कैसे करें · सदस्य कैसे जोड़ें · trial balance · बैंक रिकॉन्सिलिएशन · वित्तीय वर्ष · डेबिट क्रेडिट · समिति सेटअप · क्या मुफ्त है · रिपोर्ट कैसे पढ़ें.

## 6. Did-you-mean / typo & script tolerance
| User enters | Did you mean |
|---|---|
| "rokar bahi" / "rokad bhai" | रोकड़ बही (KI-000101) |
| "ledjer" / "kahata bahi" | खाता बही (KI-000079) |
| "vouchar" / "bauchar" | वाउचर (KI-000055) |
| "debt" (meaning debit) | डेबिट / debit (KI-000027) |
| "PAKS" / "pax" | PACS (KI-000010) |
| Latin "khata" | खाता (KI-000033) |

## 7. Mixed-language handling
- Index **both scripts** per KI (Devanagari + Latin transliteration) so "rokad bahi", "रोकड़ बही", and
  "cash book" all resolve to KI-000101.
- Match on `hindi_name` OR `english_name` OR any `keyword`.
- Display result in the user's apparent language; offer the other as a subtitle.

## 8. Implementation note (reuse `siteSearch.ts`)
Extend the existing `siteSearch` index with an **active-KI source**: each KI emits `{title, hindi_name,
english_name, keywords, category, persona, surface, related_module}`. This powers suggestions, synonyms,
filters, and did-you-mean **without a new search system**. Mixed-script matching = index transliterations
alongside Devanagari.

### Cross-references
[Ask-AI Map](ask-ai-map.md) · [Delivery Map](knowledge-delivery-map.md) · [Coverage Audit](knowledge-coverage-audit.md) · [SCOS Search Intent](../scos/04-search-intent.md) · [KPP active KIs](../kpp/wave-1-active/00-index.md)
