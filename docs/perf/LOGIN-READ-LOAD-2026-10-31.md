# लॉगिन पर Supabase का पढ़ने का बोझ: जाँच और योजना (31 अक्टूबर 2026)

> **स्थिति:** सिर्फ़ जाँच हुई है। कोड या डेटाबेस में कुछ नहीं बदला गया। हर slice आपकी मंज़ूरी के बाद ही बनेगा।
> हर तथ्य के आगे उसका स्रोत लिखा है: **[मापा: staging]** = staging डेटाबेस पर चलाकर मापा,
> **[कोड]** = कोड पढ़कर पक्का किया, **[अनुमान]** = अभी साबित नहीं, prod के आँकड़ों से पक्का होगा.

---

## 1. सीधी बात पहले

1. **31 अक्टूबर की बंदी की मुख्य वजह Nano का छोटा RAM था, ऐप के पढ़ने का तरीका नहीं.** पूरा डेटाबेस
   ~70 MB का है, और Small (2 GB) पर यह पूरा RAM में आ जाता है. Swap ~0 होने के बाद ऐप की पढ़ाई ज़्यादातर
   disk तक नहीं पहुँचती. **[अनुमान]** इसे Block 2/3 वाली SQL (नीचे §6) से पक्का करना है.
2. लेकिन ऐप का तरीका **हर समिति के साथ बढ़ता है**, और तीन जगह बिना वजह भारी है:
   - **(क) RLS की एक policy हर row पर एक function चलाती है**, इसलिए vouchers पढ़ना **25 से 50 गुना धीमा** है
     **[मापा: staging]**.
   - **(ख) हर लॉगिन पर समिति का पूरा `ledger_events` journal उतरता है** (सबसे बड़ी table, 7.8 MB), सभी
     समितियों के लिए **[कोड]**.
   - **(ग) Marketing और Consumer के ~22 tables और procurement/deposit के ~14 tables हर समिति के लिए उतरते हैं**,
     चाहे वह module चालू हो या नहीं **[कोड + मापा: staging]**.
3. हल का क्रम: **पहले prod के असली आँकड़े (आपको 4 SQL चलानी हैं, सब read-only)**, फिर (क), फिर (ग), और
   (ख) तभी करें जब आँकड़े कहें कि ज़रूरत है.

---

## 2. लॉगिन पर क्या-क्या चलता है [कोड]

हर लॉगिन **और हर F5 (refresh)** पर नीचे का सब कुछ दोबारा चलता है. हर खुला tab भी यही अलग से करता है.

| कौन | क्या पढ़ता है | requests |
|---|---|---|
| AuthContext | `getSession`, `society_users`, `is_platform_admin` RPC | 3 |
| DataContext: मुख्य | 18 tables, 1000-1000 rows के पन्नों में (vouchers, members, accounts, loans, sales, purchases, stock…) + `society_settings` | 19+ (बड़ी समिति में vouchers के कई पन्ने) |
| DataContext: उसके बाद, एक-एक करके | `member_identity`, फिर **पूरा `ledger_events`** | 2+ (journal के जितने पन्ने) |
| DataContext: साइड-लोड | capabilities, activities, deposits (2), compliance, **10 procurement tables**, work_orders, muster | 17 |
| DataContext: झंडे | `society_flags`, `voucher_edit_capabilities` RPC | 2 |
| MarketingDataContext | 17 tables, **हर समिति के लिए** | 17 |
| ConsumerDataContext | 5 tables, **हर समिति के लिए** | 5 |
| Dairy / Housing / Labour / Transport | 6 / 11 / 5 / 3 tables: **सिर्फ़ जब module चालू हो** (यह gate पहले से लगा है, J6b) | 0–25 |
| EmailVerifyBanner | `my_email_verification` RPC | 1 |

**जो नहीं मिला (अच्छी ख़बर):** कोई realtime subscription नहीं, React StrictMode नहीं (दोहरा load नहीं),
token refresh पर दोबारा load नहीं, लॉगिन पर कोई लिखाई नहीं (RM-01 के बाद). सिर्फ़ एक timer है: हर 5 मिनट
**और हर बार tab पर लौटने पर** 2 छोटी requests (`society_flags` + RPC).

---

## 3. मापे गए आँकड़े [मापा: staging]

Staging पर ऐप जैसी ही queries चलाकर मापा (script ने `.env.staging.local` ख़ुद पढ़ा; कोई password स्क्रीन पर नहीं आया).

**3.1 खाली समिति का एक लॉगिन (कम-से-कम का बोझ):**
- **62 HTTP requests** (लॉगिन के 2 अलग से), लगभग 1.4 सेकंड. 59 tables पूछे गए, सब में 0 rows.
- यानी डेटा न हो तब भी हर लॉगिन ~65 requests भेजता है. Marketing+Consumer+procurement के ~36 इनमें से हैं.

**3.2 RLS की असली कीमत:** staging समिति (1,174 vouchers, 1,579 journal events). वही query दो तरह चलाई:

| table (1000 rows) | बिना RLS | RLS के साथ (ऐप जैसे) |
|---|---|---|
| vouchers | 1–2 ms | **49–51 ms** |
| sales (365 rows) | 1 ms | **17–18 ms** |
| ledger_events | 2 ms | 2–5 ms |

**वजह (पक्की):** `vouchers, sales, purchases, members, godowns` पर branch वाली policy
`jwt_branch_ok("branchId")` है. यह `SECURITY DEFINER` function है, इसलिए Postgres इसे query में मिला नहीं
पाता और **हर row पर अलग से चलाता है** (plan में `Filter: … AND jwt_branch_ok(vouchers."branchId")` दिखता है).
जिस user की कोई branch नहीं, उसके लिए जवाब हमेशा "हाँ" ही है, फिर भी कीमत हर row पर लगती है.
Prod में Rania जैसी समिति (~3,100 vouchers) पर यह **एक लॉगिन में ~130 ms सिर्फ़ vouchers पर (staging पर ~43 µs प्रति row)** होगा **[अनुमान]**,
और समितियों/vouchers के साथ सीधा बढ़ेगा.

**3.3 Index:** staging में society_id वाले 118 tables में से **33 पर `society_id` से शुरू होने वाला कोई index नहीं** है,
जिनमें `stock_items, stock_movements, deposit_accounts` और 8 `procurement_*` tables भी हैं, जो सब लॉगिन पर पढ़े जाते हैं.
आज tables छोटे हैं, इसलिए असर कम है. पर बिना index के हर लॉगिन **सभी समितियों की पूरी table** पढ़ता है, सिर्फ़ अपनी
समिति की rows नहीं, तो यह बोझ समितियाँ बढ़ने के साथ बढ़ेगा. **[मापा: staging]** prod में index अलग हो सकते हैं, क्योंकि
migrations हाथ से चलाई गई थीं. Block 3 से पता चलेगा.

---

## 4. एक बगल का संदिग्ध (बंदी से ठीक पहले जुड़ा)

30 अक्टूबर को email का `outbox-send-worker` cron जुड़ा, जो **हर मिनट** चलता है (`* * * * *`), और साथ में
email-health (हर 30 मिनट). हर run `cron.job_run_details` और `net._http_response` में एक row जोड़ता है. Supabase
पर ये tables अपने-आप साफ़ नहीं होतीं, और Nano पर ऐसी हर मिनट की लिखाई भी RAM/IO खाती है. **[अनुमान]** यह
बंदी की वजह साबित नहीं है, सिर्फ़ जाँचने लायक है. Block 4 बताएगा ये tables कितनी बड़ी हैं.

---

## 5. सुधार: बचत बनाम जोखिम के क्रम में

| # | सुधार | बचत | जोखिम | RULE 1 / RULE 2 |
|---|---|---|---|---|
| **S0** | **Prod के आँकड़े लेना** (§6 की 4 read-only SQL, आप चलाएँगे) | — (फ़ैसले का आधार) | शून्य | — |
| **S1** | **RLS branch policy को "एक बार चलने वाली" बनाना:** policy में `(select jwt_branch_id())` लिखना, ताकि function पूरी query में **एक ही बार** चले, हर row पर नहीं. 5 tables, सिर्फ़ एक migration. | उन 5 tables की पढ़ाई का CPU **~95% कम** (50 ms → ~2 ms) | **मध्यम**: यह security policy है. नियम बिल्कुल वही रहना चाहिए. पहले staging पर, cross-tenant और branch tests के साथ, पुराने और नए नतीजे row-दर-row मिलाकर | ऐप का कोड नहीं बदलता. जो rows दिखती हैं वही रहती हैं, इसलिए कोई report नहीं बदलती |
| **S2** | **Marketing (17) + Consumer (5) + procurement/work-order/deposit साइड-लोड (~14) को module चालू होने पर ही लोड करना**, जैसे Dairy/Housing में पहले से है (J6b) | जिन समितियों में ये module बंद हैं, उनमें **हर लॉगिन ~36 requests कम** (~65 → ~29) | **कम-मध्यम**: एक बात पक्की करनी है. अगर module बंद है पर पुराने दस्तावेज़ पड़े हैं, तो उनके voucher वाले delete-guard (`registerVoucherOwner`) तब भी काम करें. अगर पक्का न हो सके, तो ऐसी समिति के लिए लोड चालू रहे | जो लोड होता है उसमें कोई बदलाव नहीं. सिर्फ़ बंद module के tables नहीं आते. Reports के formula वही रहते हैं |
| **S3** | **लॉगिन पर पढ़े जाने वाले tables पर `(society_id, …)` index** (सिर्फ़ जहाँ Block 3 में full-scan दिखें) | आज कम. समितियाँ बढ़ने पर बड़ी (पढ़ाई "पूरी table" से घटकर "सिर्फ़ अपनी समिति") | **कम**: index से नतीजे नहीं बदलते. `create index concurrently` से कोई lock नहीं | कोई असर नहीं |
| **S4** | **`ledger_events` journal को लॉगिन पर नहीं, ज़रूरत पड़ने पर लोड करना** (report खोलने पर, या opening बदलने से पहले) | लॉगिन की सबसे बड़ी table हटती है. बाक़ी load ख़त्म होने के बाद यह अलग पन्नों में भी आती है | **मध्यम-ऊँचा**: journal पूरा लोड होने से पहले opening बदलने पर opening-delta छूट सकता है (`journalLoadedRef`). यानी हर ऐसे बदलाव से पहले journal ज़रूर लोड करना होगा, वरना journal और खाते अलग हो जाएँगे | RULE 2: report पहले से "journal पूरा नहीं तो voucher से गणना" पर लौटती है, इसलिए formula वही रहेगा. पर इसकी जाँच ज़रूरी है |
| S5 | Tab पर लौटने वाली flag-check को 1 मिनट में एक बार तक सीमित करना | छोटी | बहुत कम | — |
| ✗ | **Browser में cache रखकर F5 पर दोबारा न पढ़ना / सिर्फ़ बदला हुआ पढ़ना** | सबसे बड़ी | **ऊँचा**: यही "लोकल और Supabase अलग" (RULE 1) वाली ग़लती का रास्ता है | **अभी सुझाव नहीं.** S0–S3 के बाद भी ज़रूरत हो तभी, अलग design के साथ |

**मेरी सिफ़ारिश (S0 के prod नतीजों के बाद बदली हुई, §8 देखें):** S3 (index) सबसे पहले → S1 (RLS) → S2 (gating) → S4 (journal).
Cache (✗) अभी नहीं. Vercel की सीमा देखते हुए S3+S1 (दोनों migration) एक PR में, और S2 (ऐप कोड) दूसरे PR में.

---

## 6. आपको क्या करना है (S0): prod के आँकड़े, सब read-only

फ़ाइल: `docs/perf/login-read-load-prod-check.sql`. इसमें 4 blocks हैं. हर block `begin transaction read only` से
शुरू होकर `rollback` पर ख़त्म होता है, यानी **कुछ भी लिखा नहीं जाता**.

1. Supabase dashboard खोलें → **production** project (Tokyo) → बाएँ **SQL Editor** → **New query**.
2. फ़ाइल का **Block 1** (`-- ── Block 1` से अगले `rollback;` तक) copy करें, paste करें, **Run** दबाएँ
   (सिर्फ़ "Run", "Run and enable RLS" नहीं).
3. नतीजे की table का screenshot लें या copy करें.
4. यही काम Block 2, 3 और 4 के लिए अलग-अलग करें. हर बार नई query या पुराना text मिटाकर.
5. अगर Block 2 में `pg_stat_statements does not exist` आए, तो वह block छोड़ दें और बताएँ. बाक़ी blocks फिर भी चलेंगे.
6. चारों नतीजे मुझे भेज दें. उन्हीं से तय होगा कि S1–S4 में से कौन-से सच में ज़रूरी हैं.

**हर नतीजे से क्या पता चलेगा:**
- Block 1: सबसे भारी समिति एक लॉगिन में कितनी rows खींचती है.
- Block 2: डेटाबेस का समय कहाँ जा रहा है, और क्या ऊपर वही login queries हैं.
- Block 3: बड़े tables पर full-scan कितने हो रहे हैं (S3 की ज़रूरत).
- Block 4: cron/pg_net की tables कितनी फूल गई हैं (§4).

---

## 7. जाँच कैसे हुई (दोहराने के लिए)

- Staging (`ivmrlhjrqtwftdlxajxk`) पर तीन node scripts चलीं, सब read-only transaction में और सिर्फ़ गिनती छापने वाली:
  (1) ऐप की लॉगिन queries का replay (supabase-js, test user A), (2) हर table की rows और index coverage,
  (3) `EXPLAIN ANALYZE`: owner role बनाम `authenticated` role (असली RLS के साथ).
- Prod को छुआ नहीं गया. Browser में login नहीं किया गया (credential पढ़ने की अनुमति नहीं थी), इसलिए request की गिनती
  एक replay से है, असली browser की नहीं. Page खोलने पर जो अतिरिक्त fetch होते हैं (जैसे loan accruals) वे इसमें नहीं गिने गए.
- कोड के हवाले: `src/contexts/DataContext.tsx:1202-1561` (लॉगिन load), `:1510` (journal load), `:2957-2971` (5-मिनट timer),
  `src/contexts/MarketingDataContext.tsx:237`, `src/contexts/ConsumerDataContext.tsx:342` (बिना gate),
  `src/contexts/useCapabilityEnabled.ts` (J6b gate), `supabase/migrations/039_branch_scoped_rls_select.sql:46` (`jwt_branch_ok`).

---

## 8. Prod के नतीजे (S0, 31 अक्टूबर को आपने चलाए) [मापा: prod]

**Block 1: एक लॉगिन में कितनी rows आती हैं (7 बड़े tables)**

| समिति | rows/लॉगिन | vouchers | ledger_events | accounts |
|---|---|---|---|---|
| d5e007f0 (Rania, पुरानी) | **6,918** | 2,064 | **3,772** | 594 |
| 9ef456de (Rania, reset) | 2,669 | 1 | 1,882 | 786 |
| 7f2919f0 | 1,666 | 462 | 496 | 242 |
| ddcb71c2 (Assandh) | 1,431 | 453 | 397 | 260 |
| बाक़ी | 450 से कम | | | |

- सबसे भारी लॉगिन भी ~7,000 rows का है. यह **छोटा** है. पढ़ाई की मात्रा अकेले कोई ख़तरा नहीं है.
- सबसे भारी समिति में **आधे से ज़्यादा (55%) rows `ledger_events` journal की हैं.** Reset वाली Rania में voucher सिर्फ़ 1 है,
  फिर भी हर लॉगिन 1,882 journal events उतारता है.

**Block 3: पूरी table पढ़ना (seq scan) बनाम index**

| table | full scans | full scan में पढ़ी rows | कुल rows (सभी समितियाँ) |
|---|---|---|---|
| **accounts** | 10,607 | **4.37 करोड़** | 7,768 |
| ledger_events | 2,052 | 80 लाख | 6,911 |
| vouchers | 3,291 | 53 लाख | 3,310 |
| stock_movements | 8,871 | 19 लाख | 517 |
| members | 2,880 | 19 लाख | 510 |

- **यह सबसे बड़ी खोज है.** `accounts` पढ़ने पर डेटाबेस हर बार **सभी 32 समितियों के सारे खाते** पढ़ता है, ताकि
  उनमें से एक समिति के खाते छाँट सके. हर full scan में औसतन ~4,100 rows पढ़ी गईं, जबकि सबसे बड़ी समिति के भी 786 ही खाते हैं.
  यही वह बोझ है जो **हर नई समिति के साथ बढ़ता है**: खाते बढ़ते हैं, और हर लॉगिन सबको पढ़ता है.
- Staging पर `accounts` के index ये थे: `(id, society_id)` और `(society_id, code) WHERE code IS NOT NULL`.
  लॉगिन की query `society_id = … order by id` इन दोनों में से किसी का पूरा फ़ायदा नहीं ले सकती. Prod में भी यही है या नहीं,
  यह Block 5 (नीचे) से पक्का करना है. `stock_movements` पर तो staging में `society_id` का कोई index था ही नहीं.

**Block 2: डेटाबेस का समय कहाँ गया**
- ये आँकड़े **बंदी वाले समय को भी शामिल करते हैं.** इसीलिए cron की एक row लिखने में औसत 1.7 सेकंड और update में 4.7 सेकंड
  लगे, जबकि आम तौर पर ये 1 ms से कम होते हैं. उस समय डेटाबेस भूखा था और हर चीज़ धीमी थी. इसलिए "कुल समय" से कारण और
  शिकार में फ़र्क़ नहीं किया जा सकता.
- ऊपर की कई queries **हमारे ऐप की नहीं, Supabase के अपने सिस्टम की** हैं: extensions की सूची (1,769 बार), functions और
  tables की जानकारी (1,523 और 1,876 बार), `pg_timezone_names` (504 बार, हर बार ~6 लाख rows). ये PostgREST के schema-cache
  reload और dashboard से आती हैं. **[अनुमान]** इतनी बार reload होना इस बात से मेल खाता है कि RAM की कमी से services बार-बार
  restart हो रही थीं. Small पर यह अपने-आप कम होना चाहिए.
- ऐप की queries में सबसे ऊपर: vouchers पढ़ना (2,960 बार, औसत 301 ms), accounts पढ़ना (तीन रूपों में ~3,900 बार, औसत 316–531 ms),
  ledger_events (2,121 बार, 120 ms). **Disk से सबसे ज़्यादा blocks भी इन्हीं ने पढ़े**: ledger_events 930, vouchers 496, accounts 398.

**Block 4: cron/pg_net — संदेह ख़त्म**
- `cron.job_run_details` 1,079 rows (576 kB), `net._http_response` 43 rows. दोनों बहुत छोटी हैं. **§4 वाला संदेह ग़लत निकला:**
  ये tables फूली नहीं हैं. Cron की धीमी लिखाई बंदी का शिकार थी, कारण नहीं.

### नतीजों के बाद नया क्रम

| क्रम | slice | क्यों |
|---|---|---|
| 1 | **S3: index**, ख़ासकर `accounts (society_id, id)`, फिर `stock_movements`, `vouchers`, `ledger_events`, `members` पर लॉगिन वाले क्रम के index | prod में सबसे साफ़ सबूत (4.37 करोड़ rows). जोखिम सबसे कम, क्योंकि index से नतीजे नहीं बदलते. `create index concurrently` से कोई lock नहीं |
| 2 | **S1: RLS branch policy** | हर row पर function चलने वाला CPU ख़र्च (staging पर 25–50×) |
| 3 | **S2: बंद module के tables न पढ़ना** | हर लॉगिन ~36 requests कम |
| 4 | **S4: journal बाद में लोड करना** | सबसे भारी समिति की आधी rows इसी की हैं, पर जोखिम ज़्यादा. S3 के बाद दोबारा नापकर तय करें |

### S3 से पहले एक और read-only query (Block 5)

S3 का migration लिखने से पहले मुझे prod के **असली index** चाहिए, क्योंकि prod में migrations हाथ से चलाई गई थीं.
इसी query से यह भी पता चलेगा कि Block 2 के आँकड़े किस तारीख़ से गिने जा रहे हैं. Query `docs/perf/login-read-load-prod-check.sql`
में **Block 5** है. चलाने का तरीका वही है: SQL Editor → New query → paste → Run → नतीजा भेजें.

## 9. Block 5 का नतीजा और S3 [मापा: prod + staging]

- Block 2 के आँकड़े **26 मार्च 2026 से** गिने जा रहे हैं, यानी 7 महीने के. इस पूरे समय में vouchers की query 2,960 बार चली,
  यानी दिन में ~14 बार. **ऐप का कुल बोझ आज बहुत हल्का है**. बंदी की वजह Nano ही थी. Index भविष्य की बढ़त के लिए सस्ता बचाव है,
  कोई आपात इलाज नहीं.
- Prod के index ने पक्का किया: `accounts` पर कोई ऐसा index नहीं जो `society_id = … order by id` को सीधे परोस सके.
  `stock_movements` पर सिर्फ़ PK है. `vouchers`, `ledger_events`, `members`, `sales` और `purchases` पर `society_id` से शुरू होने वाले
  index पहले से हैं.
- `ledger_events` पर एक ही columns वाले **दो index** हैं (`ledger_events_aggregate_seq` unique और `ledger_events_scope`).
  दूसरा फ़ालतू है और हर लिखाई पर दोगुना काम करवाता है. इसे हटाना वैकल्पिक है और अलग से करना है, अभी नहीं.
- **S3 = migration 149** (`supabase/migrations/149_login_read_indexes.sql`): `accounts (society_id, id)` और
  `stock_movements (society_id, "createdAt", id)`. Staging पर एक transaction में बनाकर जाँचा, फिर rollback किया
  (कुछ नहीं बचा). पहले `accounts` पूरा PK index चलकर (सभी समितियाँ) ढूँढता था, और `stock_movements` पूरी table पढ़कर sort करता था.
  Index के बाद दोनों सीधे सिर्फ़ उसी समिति की rows क्रम में पढ़ते हैं, बिना sort के.
- **31 अक्टूबर 12:10 IST: migration 149 prod में चल गया.** दोनों index बने और दोनों `indisvalid = true` हैं
  (`accounts_society_id_idx`, `stock_movements_society_created_idx`). अगली जाँच 2–3 दिन बाद Block 3 दोबारा चलाकर होगी.

## 10. S1 = migration 150 (RLS branch policy) [मापा: staging]

- फ़ाइल: `supabase/migrations/150_branch_rls_select_initplan.sql` (वापसी के लिए `_down.sql`). यह सिर्फ़ 5 tables की **SELECT** policy बदलती है:
  vouchers, sales, purchases, members, godowns. लिखने वाली policies और `jwt_branch_ok()` जस-के-तस हैं.
- नियम वही है. फ़र्क़ सिर्फ़ इतना है कि "user की branch क्या है" और "क्या वह Head Office है" अब **हर query में एक बार** पूछा जाता है,
  हर row पर नहीं.
- **Staging पर सबूत** (सब एक transaction में, अंत में rollback):
  - 4 तरह के user × 5 tables की rows नए नियम से पहले और बाद में बिल्कुल एक जैसी निकलीं (row-ids का hash मिलाया):
    branch के बिना, Head Office वाला, दूसरी branch वाला, और ऐसी branch वाला जो मौजूद ही नहीं.
  - Anon (बिना login) को 0 rows मिलती हैं और कोई error नहीं आता.
  - **Vouchers की पढ़ाई ~51 ms से 1.7 ms**, sales 16 ms से 1 ms.
  - सीमा: staging समिति में purchases, members और godowns की rows 0 हैं. पर इन पाँचों tables की policy का text अक्षरशः एक जैसा है,
    इसलिए vouchers और sales का सबूत इन पर भी लागू होता है.
- Repo tests पास हैं: definer-exec-grants 152/152, rls-coverage 29/29, branch-scope 23/23, inter-branch 8/8.
- **31 अक्टूबर 12:18 IST: migration 150 prod में चल गया.** जाँच में 5 policies दिखीं, सब नए रूप
  `((SELECT jwt_branch_id() …) IS NULL) OR …` में. Founder ने अपनी समिति से login करके देखा कि Vouchers, Sales और
  Members में पहले जितनी entries दिख रही हैं.

## 11. S2 = migration 151 + ऐप का बदलाव: ख़ाली tables को न पढ़ना [मापा: staging]

**तरीका क्यों बदला:** पहली योजना थी "module बंद हो तो उसके tables न पढ़ें". पर जाँच में निकला कि Consumer का डेटा
(sales returns वग़ैरह) SaleRegister, GSTR9, GstSummary और Member360 जैसी आम reports भी पढ़ती हैं. Module बंद होने पर भी
अगर पुरानी entries पड़ी हों, तो उन reports के आँकड़े बदल जाते, जो RULE 2 का उल्लंघन होता. इसलिए नया तरीका यह है:
**जिस table में इस समिति की एक भी row नहीं है, सिर्फ़ उसे न पढ़ें.** ख़ाली table पढ़ो या न पढ़ो, नतीजा `[]` ही रहता है.
इसलिए कोई screen या report बदल ही नहीं सकती.

- **Migration 151:** `society_empty_tables(society, tables[])` एक call में बताता है कि सूची के कौन-से tables इस समिति के लिए ख़ाली हैं.
  यह user के अपने RLS से पढ़ता है (SECURITY INVOKER), कुछ लिखता नहीं, और बिना login वाले (anon) के लिए बंद है.
  जो table न मिले या पढ़ा न जा सके, उसे "ख़ाली" नहीं बताता, यानी ऐप उसे पहले की तरह पढ़ता है.
- **ऐप:** 39 tables पर यह लागू है: 17 DataContext के साइड-लोड, 17 Marketing और 5 Consumer. मुख्य 18 tables, `member_identity` और
  `ledger_events` इसमें **शामिल नहीं** हैं, क्योंकि उनका "ख़ाली" होने का मतलब अलग है.
- **अगर function न मिले** (151 अभी चला नहीं) या network fail हो, तो ऐप सब कुछ पहले की तरह पढ़ता है. इसलिए deploy किसी भी क्रम में हो सकता है.
- **Staging पर सबूत:**
  - 39 में से हर table के लिए function का जवाब असली row-count से मेल खाया (0 mismatch). जो table मौजूद नहीं, वह कभी "ख़ाली" नहीं बताया गया.
  - Anon को 42501 (permission denied) मिला.
  - **ख़ाली समिति का लॉगिन 62 से घटकर 24 requests.** Marketing समिति (5eed) में 39 में से 16 tables ख़ाली थे.
- **एक छोटी क़ीमत:** Marketing और Consumer के जिन tables में डेटा है, वे अब function का जवाब आने के बाद पढ़े जाते हैं.
  यानी उनमें ~एक round-trip की देरी. मुख्य load पर कोई असर नहीं, क्योंकि जवाब उसके साथ-साथ आता है.
- Test: `scripts/test-empty-table-skip.mjs` (20 जाँचें).
