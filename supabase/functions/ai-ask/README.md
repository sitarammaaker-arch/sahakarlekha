# ai-ask — the CAIOS seam

हर channel का सवाल यहीं आता है (`/ask`, आगे चलकर copilot और WhatsApp)।
Blueprint: [COOPERATIVE-AI-OS-BLUEPRINT.md](../../../docs/architecture/COOPERATIVE-AI-OS-BLUEPRINT.md) §4–§5.

**अभी इसमें कोई AI मॉडल नहीं है।** Slice 1 पूरा मैकेनिज़्म चलाता है — गेट, lane, पहरा,
audit — शून्य token खर्च पर। मॉडल पड़ाव 6 में बाद में आएगा, और उसे `npm run eval:ask`
के मौजूदा score (70.5%) से जीतना होगा, वरना ship नहीं।

---

## यह चालू न हो तो क्या होगा?

**कुछ नहीं टूटेगा।** `/ask` बिल्कुल आज जैसा चलता रहेगा — client-side search से, तुरंत,
मुफ़्त। यह fallback design है, safety net नहीं (CAIOS-K1 / AI-G4: AI additive है,
correctness के लिए कभी load-bearing नहीं)।

इसलिए **deploy करना ज़रूरी नहीं है।** यह तब करें जब आप guard, lane routing, jurisdiction
और audit trail चालू करना चाहें।

---

## चालू कैसे करें (क्रम से)

### 1. Project link है या नहीं, जाँचें

```bash
npx supabase projects list
```

अगर `●` वाला linked project नहीं दिखता, तो पहले link करें:

```bash
npx supabase link --project-ref <आपका-project-ref>
```

> `project-ref` कहाँ मिलेगा: Supabase Dashboard → आपका project → Settings → General →
> **Reference ID** (20 अक्षर का, जैसे `abcdefghijklmnopqrst`)।

### 2. Bundle ताज़ा करें

यह तभी ज़रूरी है जब `src/lib/ask/`, `src/lib/search/`, `src/lib/ai/` या corpus बदला हो:

```bash
npm run build:search-index    # KI corpus → src/generated/search-index.json
npm run build:ask-core        # ऊपर वाला + code → _shared/ask-core.mjs
```

दिखना चाहिए: `276 docs, 158 KB · glossary 100 · help 10 · …`

### 3. Function deploy करें

```bash
npx supabase functions deploy ai-ask
```

> `--no-verify-jwt` **नहीं** चाहिए (scheduled-backup से उलट)। यह function अनजान
> visitor को भी जवाब देता है, और Supabase का anon key ही उसका दरवाज़ा है।

### 4. चालू करें — यही असली switch है

```bash
npx supabase secrets set AI_ENABLED=true
```

**Default बंद है।** `AI_ENABLED` को साफ़ `"true"` होना ही पड़ेगा। कोई typo, कोई भूल →
**बंद** रहेगा, चालू नहीं। एक statutory-record सिस्टम में यही सही default है।

### 5. जाँचें कि सचमुच चला

Browser में खोलें: `/ask?q=GST की दर क्या है`

**दिखना चाहिए** — पीले रंग का box:

> **मैं इसका उत्तर नहीं दूँगा**
> यह एक नियामक आँकड़ा है (दर / सीमा / धारा) और मेरे पास इसका प्रमाणित, तिथि-सहित
> स्रोत नहीं है — इसलिए मैं अंदाज़ा नहीं लगाऊँगा…

**यह सफलता है, विफलता नहीं।** पहरा काम कर रहा है (§4.5)। अगर इसकी जगह कोई ब्लॉग/
calculator "जवाब" की तरह दिख रहा है → function चालू नहीं हुआ (fallback चल रहा है)।

फिर `/ask?q=वाउचर क्या है` — यह सामान्य जवाब देना चाहिए।

### 6. Audit trail देखें

Supabase Dashboard → SQL Editor:

```sql
select created_at, entity_id, after->>'lane' as lane,
       after->>'query' as query, after->>'answered' as answered,
       after->'trace'->>'guard' as guard
from audit_log where entity_type = 'ai_answer'
order by created_at desc limit 10;
```

हर सवाल की एक पंक्ति दिखेगी — कौन-सा lane, पहरा लगा या नहीं, क्या स्रोत मिले।
**यही वह चीज़ है जो बाद में नहीं बनाई जा सकती** (IRR-3)।

---

## बंद कैसे करें (rollback)

```bash
npx supabase secrets set AI_ENABLED=false
```

तुरंत, पूरा, और `/ask` वापस आज जैसा। कोई redeploy नहीं चाहिए। यही kill switch है
(AI-G4), और इसे DB के बजाय env में रखा गया है — जिस kill switch को database पढ़ना
पड़े, वह ठीक उसी घटना में बेकार है जहाँ database ही समस्या हो।

**सिर्फ़ एक society बंद करनी हो:**

```bash
npx supabase secrets set AI_KILL_SOCIETIES=SOC001,SOC002
```

---

## खुला मुद्दा — पहले D-lane tool से पहले ज़रूरी

आज `societyId` request body से आता है और सिर्फ़ lane चुनने + kill switch के लिए
इस्तेमाल होता है — **किसी society का डेटा नहीं पढ़ा जाता** (D-lane tools Slice 4 में
आएँगे)। पर पहला tool आने से पहले पहचान **verified JWT से** लेनी होगी:
client का बताया `societyId` एक दावा है, पहचान नहीं (AI-P2)।
