# Marketing Society (marketing_processing) — फ़्लो व फ़ंक्शन ऑडिट

तारीख: 2026-10-25 · आधार: `origin/main` @ 74bc336 · केवल पढ़ा (कोई कोड/डेटा नहीं बदला)
तरीका: 3 स्वतंत्र कोड-जाँच (MSP चेन · ट्रेडिंग/इन्वेंटरी · परिवहन/सेटअप/स्कीमा) + prod read-only query + मुख्य निष्कर्ष कोड में स्वयं जाँचे।

## 0. सबसे बड़ी बात — असली समितियाँ MSP मॉड्यूल इस्तेमाल ही नहीं कर रहीं

Prod में 8 marketing_processing समितियाँ (7 हरियाणा, 1 UP)। सभी पर posting_service चालू।

| समिति | vouchers | procurement lots | कैसे काम कर रहे हैं |
|---|---|---|---|
| Assandh | 453 | 0 | खाद की थोक बिक्री PACS को (135 sale), HAFED/ठेके के journal, wooden crates |
| Bacher Kisan | 123 | 0 | MSP का पूरा काम **हाथ के journal** से: HSWC Sirsa, 5116 Govt Procurement Purchase, 2105, लेबर, Shortage, TDS-194H Dami |
| Ding | 37 | 0 | खाद बिक्री (4101) |
| Rania (पुरानी) | 2062 | 2 | practice |

निष्कर्ष: जो MSP procurement मॉड्यूल बना है (lot → J-Form → settlement → payment), वह असली
समितियों की ज़रूरत से मेल नहीं खाता — इसलिए उन्होंने journal का रास्ता अपनाया। Bacher
5116 "Govt Procurement Purchase" (principal / ख़रीदार मॉडल) में बुक कर रहा है, जबकि ऐप केवल
agent मॉडल (Dr 3308 / Cr 2105) देता है।

## 1. स्थिति — हर कदम

| कदम | स्थिति |
|---|---|
| चार्ट/ऑनबोर्डिंग (CMS chart, 2105/3308/3314/4206) | ✅ ठीक |
| Procurement masters (फ़सल, सीज़न, एजेंसी, केंद्र, MSP दर, नियम) | ✅ ठीक (RULE 1/6 पालन) |
| Lot entry, J-Form | ✅ चलता है |
| "बहीखाता में पोस्ट" एक-क्लिक | ❌ टूटा — पहले कदम के बाद रुकता है |
| Settlement / payment | ⚠️ चलता है, पर दोहरा भुगतान संभव |
| Lot / settlement सुधार या रद्द | ❌ कोई रास्ता नहीं |
| Agency receipt, commission | ✅ चलता है (हटाने पर confirm नहीं) |
| Registers | ⚠️ आंकड़े बढ़े हुए (rejected/unposted/draft भी जुड़ते हैं) |
| खाद/माल ख़रीद-बिक्री | ✅ मुख्य रूप से ठीक; 2 खाता-रूटिंग बग |
| गोदाम | ⚠️ गोदाम स्टॉक ≠ Inventory स्टॉक |
| परिवहन (अपने वाहन) | ✅ ठीक |
| परिवहन (किराये का ट्रक) | ❌ भाड़ा/भुगतान फ़्लो नहीं |
| Kachi Aarat / Recoverables / Annual review | ⚠️ register हैं, बहीखाते से जुड़ाव नहीं; proforma गणना कहीं नहीं दिखती |
| खाद सब्सिडी | ❌ मॉड्यूल इस समिति-प्रकार को दिखते नहीं |
| Tests | test:procurement 103/0, test:marketing 21/0 — पर पेज-स्तर की चेन/रद्द पथ पर कोई test नहीं |

## 2. निष्कर्ष (गंभीरता अनुसार)

### P0 — डेटा/खाते गलत
- **P0-1 किसान को दो बार भुगतान संभव** — `DataContext.tsx:5617-5623`: भुगतान voucher सेव होने के बाद settlement का `amountPaid` अलग से सेव होता है; फ़ेल होने पर हल्का toast "refresh पर ठीक हो जाएगी" — पर कुछ भी ठीक नहीं करता। F5 के बाद बकाया पुराना दिखता है, दोबारा भुगतान होता है, 2105 Dr में चला जाता है। (स्वयं जाँचा)
- **P0-2 voucher फ़ेल होने पर settlement वापस नहीं होता** — `approveFarmerSettlement`, `recordFarmerPayment`, `recordAgencyReceipt` `addVoucher` का `onFailed` नहीं देते → settlement "approved" रह जाता है, voucher नहीं।

### P1 — फ़्लो टूटा
- **P1-1 एक-क्लिक पोस्ट टूटा** — `ProcurementLots.tsx:159-172` लौटे id पर चेन बनाता है, पर `generatePostingRequest` (`DataContext.tsx:5266`) पुराने React state में ढूंढता है → "Financial Intent नहीं मिला" का झूठा लाल toast; 4 क्लिक लगते हैं। (स्वयं जाँचा)
- **P1-2 पोस्ट हुए lot को सुधारने/रद्द करने का कोई रास्ता नहीं** — engine voucher immutable है, `buildReversalVoucher` का कोई caller नहीं। गलत मात्रा/दर हमेशा के लिए 3308/2105 में।
- **P1-3 पोस्ट के बाद quality "rejected" करने से lot फँस जाता है** — J-Form से पहले quality ज़रूरी नहीं; बाद में reject करने पर settlement/payment बंद, पर 3308/2105 entry बनी रहती है।
- **P1-4 जुड़े voucher Vouchers पेज से रद्द हो सकते हैं, cascade नहीं** — procurement `registerVoucherOwner` नहीं करता (Dairy/Housing करते हैं)। RULE 3 उल्लंघन।
- **P1-5 Purchase A/c dropdown में 5150 Closing Stock contra भी आता है** — `Inventory.tsx:520-544` (5100 के सभी leaf)। उस पर ख़रीद → Trading और P&L दोनों से ग़ायब, सकल लाभ/शुद्ध अधिशेष गलत। (स्वयं जाँचा)
- **P1-6 4100/5100 के नीचे नए sub-group वाले खाते Trading A/c से बाहर** — `tradingAndProfitLoss.ts:40,145,236-237` केवल सीधा parent देखता है; Inventory पेज sub-group बनाने देता है। सकल लाभ गलत। (स्वयं जाँचा)
- **P1-7 गोदाम स्टॉक का फ़ॉर्मूला अलग (RULE 2)** — `godownStock.ts` opening stock नहीं जोड़ता, raw movements पढ़ता है → गोदाम कुल ≠ Inventory/Trading closing stock; opening stock transfer नहीं हो सकता। (स्वयं जाँचा)
- **P1-8 Annual-review proforma (P2/P8) की गणना किसी पेज पर नहीं** — `calculateP2/P8` का कोई consumer नहीं; register "Annual Review पेज पर जुड़ेगा" का वादा करते हैं, पेज मौजूद नहीं।

### P2 — ज़रूरी फ़ीचर ग़ायब / UX
- **MSP मॉडल:** केवल agent मॉडल; principal/ख़रीदार मॉडल (5116, Bacher जैसा) नहीं। Lot की business date नहीं (हमेशा क्लिक की तारीख)। Gate entry / तौल पर्ची (gross-tare-net, बोरी गिनती) नहीं। Bardana issue/return नहीं। Arhtiya (`arhtiyaId` टेबल में, UI में नहीं) — आढ़त/दामी नहीं। J-Form / भुगतान पर्ची print नहीं। एजेंसी को lifting/dispatch, shortage, एजेंसी बिल (MSP + mandi fee/HRDF/लेबर/बारदाना/दामी) नहीं। किसान bank/IFSC, edit/delete नहीं। Bulk भुगतान नहीं। सीज़न-अंत मिलान नहीं।
- **Deduction नियम केवल % में** — लेबर/तौल/बारदाना प्रति क्विंटल/बोरी होते हैं।
- **Quality spec / bardana master कहीं उपयोग नहीं** — नमी spec से नहीं जाँची जाती।
- **Centre के बिना lot** → commission बटन नहीं, receipt "unallocated"।
- **Registers** rejected/unposted lots, draft settlements जोड़ते हैं; status हमेशा `created`; UTC तारीख।
- **"एजेंसी ने सीधे भुगतान" में हर asset खाता चुना जा सकता है** (cash/stock भी)।
- **procurement_* टेबलों पर role-split RLS नहीं** — कोई भी role API से events/number counters लिख सकता है।
- **किराये का ट्रक:** transporter master है पर trip → भाड़ा (Dr 5708/5103, Cr transporter) → भुगतान नहीं; पेज "अगले चरण में" कहता है।
- **Kachi Aarat का बहीखाते (4201 दामी) से जुड़ाव नहीं; हरियाणा के बाहर बंद** (Punjab/UP आढ़त भी होती है)।
- **Federation report में marketing सामग्री नहीं** — केवल credit-society की बातें (सदस्य/जमा/ऋण)।
- **खाद:** `subsidy_reconciliation`/`fertilizer_distribution` इस प्रकार को नहीं; 3305 सब्सिडी receivable है पर claim register नहीं; FCO licence / Form-O, POS/iFMS मिलान नहीं। Purchase Order (IFFCO/KRIBHCO को) छिपा है (pos_billing पर gated)।
- **अज्ञात item वाली sale line 4101 "Fertilizer Sales" में चली जाती है।**
- **Renumber के बाद पुराने stock movements अनाथ** (गोदाम में दिखते हैं)।
- **गोदाम क्षमता** अलग-अलग इकाइयाँ (बोरी/kg/लीटर) MT से जोड़ता है।
- **bootstrap SQL में `allow_all`** (recoverables, kachi_aarat) — दोबारा चलाने पर RLS खुल जाएगा।
- **Tests:** MarketingDataContext guards/rollback, पेज की post चेन, cancel पथ, e2e — कोई नहीं।

### P3 — पॉलिश
- सामान्य UI में HAFED शब्द: `ProcurementLots.tsx:577`, `DataContext.tsx:5594` toast, `Suppliers.tsx:439`, UserGuide, generic audit schedule "Hafed Share" (`stateAuditFormats.ts:278,526`)।
- Agency receipt / MSP दर / transporter बिना confirm हटते हैं; commission accrual हटाने का UI नहीं।
- J-Form gross paise में round नहीं (`DataContext.tsx:5182`)।
- `deleteTrip` पहले row हटाता है फिर voucher रद्द करता है (उल्टा क्रम)।
- update* में Supabase write setState updater के अंदर; delete में 0-row जाँच नहीं।
- SocietySetup में default society type `marketing_processing`; dead field `p4Category`; receipt में cash '3301' hardcoded।
- Legacy (posting-service बंद) पथ में sale/purchase base-fail पर voucher/movement rollback नहीं — **prod में सभी 8 marketing समितियों पर posting_service चालू है, इसलिए अभी जोखिम नहीं।**

## 3. प्लान (मंज़ूरी के बाद ही काम)

Batch-PR नियम के अनुसार हर बैच = एक PR।

**बैच A — डेटा-सुरक्षा (P0 + MSP P1), बिना migration**
1. P0-1: load पर `amountPaid` = live `farmer.payment` vouchers का योग (voucher ही सत्य); भुगतान से पहले बकाया भी vouchers से।
2. P0-2: settlement approve / farmer payment / agency receipt में `onFailed` से rollback।
3. P1-1: एक-क्लिक पोस्ट — बने objects को सीधे अगले कदम में देना (या ref)।
4. P1-3: J-Form के बाद quality बटन छिपाना; पोस्ट-lot पर reject रोकना।
5. P1-4: procurement voucher owner register — farmer payment/deduction/commission/receipt voucher केवल अपने पेज से रद्द।
6. Registers: केवल posted + non-rejected lots, approved settlements, local तारीख; J-Form gross paise round।
7. "एजेंसी सीधे भुगतान" में केवल agency receivable; HAFED शब्द हटाना; हटाने पर confirm; commission accrual हटाने का बटन।
8. Tests: post-chain, amountPaid derive, owner guard, FY guard source-test, CMS chart role resolver।

**बैच B — Lot सुधार/रद्द (RULE 3 cascade)**
- "Lot रद्द करें": engine voucher का reversal voucher (`buildReversalVoucher`) + settlement → deduction voucher → payments → commission का cascade; केवल तभी जब भुगतान/receipt न हुए हों, वरना पहले उन्हें उलटने को कहें। Lot business date (back-dating, FY के अंदर) — **migration: `procurement_lots.lotDate`**।

**बैच C — ट्रेडिंग/गोदाम सही करना (RULE 2/4)**
- Purchase/Sales dropdown: 5150 और closing-stock subtype हटाना; Trading A/c में ancestor walk (4100/5100 के नीचे कहीं भी)।
- गोदाम: opening stock को "बिना गोदाम" में जोड़ना, reconciled movements से गणना; renumber पर movement `referenceNo` अपडेट।
- अज्ञात item वाली sale line को रोकना।
- bootstrap SQL से `allow_all` blocks हटाना।

**बैच D — MSP फ़ील्ड-ज़रूरतें (आपके फ़ैसले पर; migrations लगेंगी)**
- Principal मॉडल विकल्प (5116 ख़रीद, जैसे Bacher) बनाम agent मॉडल — society-level setting।
- Arhtiya + दामी/आढ़त; प्रति-क्विंटल/प्रति-बोरी deduction नियम; तौल पर्ची + बोरी गिनती; bardana issue/return।
- J-Form + भुगतान पर्ची print; किसान bank/IFSC + edit; bulk भुगतान।
- एजेंसी dispatch/lifting + shortage; एजेंसी बिल; सीज़न-अंत मिलान रिपोर्ट।

**बैच E — बाकी marketing मॉड्यूल (आपके फ़ैसले पर)**
- किराये के ट्रक का trip → भाड़ा → भुगतान।
- Kachi Aarat → 4201 दामी से मिलान; generic `commission_agency` capability (हरियाणा के बाहर भी)।
- खाद: subsidy claim register (Dr 3305), FCO licence/Form-O master + expiry alert; Purchase Order marketing को खोलना।
- Federation report में ट्रेडिंग/procurement भाग; Annual-review P2/P8 पेज (या वादा हटाना)।

## 4. आपसे फ़ैसले चाहिए
1. किस बैच से शुरू करें? (सुझाव: A → C → B, फिर D/E)
2. MSP मॉडल: Bacher जैसी समितियाँ principal (5116) में बुक करती हैं — क्या दोनों मॉडल देने हैं?
3. पुराने खुले फ़ैसले (2026-10-04): पोस्टिंग पर commission अपने-आप? J-Form से पहले quality ज़रूरी?
4. बैच D/E में से कौन-से फ़ीचर असली समितियों (Assandh/Bacher/Ding) के लिए पहले चाहिए?

## 5. बैच D/E — आपके फ़ैसले (2026-10-25) और प्लान

**फ़ैसले:** (1) MSP मॉडल — दोनों, समिति चुने (एजेंट 3308/2105 या ख़रीदार/principal 5116→4108); (2) पोस्टिंग पर commission अपने-आप; (3) J-Form से पहले quality ज़रूरी; (4) चारों फ़ीचर-समूह चाहिए।

**नियम जो हर बैच पर लागू:** कोई राज्य-विशेष दर (मंडी शुल्क, HRDF, सब्सिडी दर, FCO नियम) code में नहीं — समिति master में भरे; जो कानूनी मान दिखाना हो, स्रोत के साथ। हर नई table के साथ RLS। हर बैच = एक PR।

| क्रम | बैच | क्या | Migration |
|---|---|---|---|
| 1 | **D1 नियम** | J-Form से पहले quality ज़रूरी + quality spec से नमी जाँच; पोस्टिंग के साथ commission अपने-आप; Society Setup में "MSP मॉडल: एजेंट / ख़रीदार" — ख़रीदार में पोस्टिंग Dr 5116 / Cr 2105 और एजेंसी को बिक्री Dr 3308 / Cr 4108 | 136: society_settings."procurementModel" |
| 2 | **D2a लॉट विवरण** | आढ़ती चुनना + दामी/आढ़त; कटौती नियम % / प्रति क्विंटल / प्रति बोरी; तौल पर्ची (gross-tare-net, बोरी); बारदाना issue/return | 137: lot पर weighment/bags/arhtiya, deduction rule "basisUnit", bardana_movements (+RLS) |
| 3 | **D2b काग़ज़ और भुगतान** | J-Form व भुगतान पर्ची print; किसान bank/IFSC + edit; bulk भुगतान (एक बैंक voucher, कई किसान) | 138: farmer bank fields |
| 4 | **D3 एजेंसी** | dispatch/lifting (truck challan, lots → dispatch), shortage; एजेंसी बिल (MSP + incidentals); रसीद ↔ बिल मिलान; सीज़न-अंत मिलान रिपोर्ट | 139: procurement_dispatches, agency_bills (+RLS) |
| 5 | **E1 खाद** | marketing को Purchase Order; सब्सिडी claim register (Dr 3305); FCO licence / Form-O master + expiry alert | 140: subsidy_claims, dealer_licences (+RLS) |
| 6 | **E2 परिवहन + कच्ची आढ़त** | किराये के ट्रक की trip → भाड़ा (Dr भाड़ा / Cr transporter) → भुगतान; Kachi Aarat ↔ 4201 दामी मिलान; हरियाणा के बाहर भी (generic capability, HAFED proforma हरियाणा-only) | 141: hired trips (+RLS) |
