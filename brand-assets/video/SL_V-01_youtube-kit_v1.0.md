# V-01 — YouTube Channel Kit v1.0

Assets (regenerate: `cd brand-assets/templates && npm run gen:youtube` → export/):
- `SL_V-01_yt-avatar_800.png` — DP (YouTube इसे गोल crop करता है — स safe है)
- `SL_V-01_yt-banner_2560x1440.png` — channel art (TV/desktop/mobile सब पर content safe-area में)
- `SL_V-01_yt-watermark_300.png` — video watermark (हर video पर bottom-right)
- Thumbnails: हर video के लिए `templates/content/` में JSON → `npm run gen` (yt format)

पुराने root वाले `yt_*.png` अब पुराने हैं (एक-शब्द नाम, पुराना स) — इन्हें delete
कर दें या vault में archive करें। PPTX thumbnail template की जगह अब JSON system है।

## Channel setup checklist (एक बार)

- [ ] Channel name: **सहकार लेखा** (दो शब्द) · Handle: **@sahakarlekha**
- [ ] Avatar + banner + watermark upload (ऊपर वाली files)
- [ ] Watermark setting: "Entire video" पर दिखे
- [ ] Description (नीचे copy करें) + links: sahakarlekha.com, /guide, X, WhatsApp
- [ ] Channel trailer: पहली video बनने के बाद set करें (script नीचे)
- [ ] Upload defaults: language हिंदी, category Education, visibility Public

### Channel description (copy-paste)

> सहकारी समितियों का अपना सॉफ्टवेयर — बिल्कुल मुफ़्त।
> PACS से housing तक, 8 प्रकार की समितियों के लिए accounting: voucher entry,
> बैलेंस शीट, ट्रायल बैलेंस, TDS 26Q, GST — सब हिंदी में, एक click पर।
> इस channel पर मिलेंगे आसान हिंदी tutorials — voucher entry से audit तैयारी तक।
> 🎓 मुफ़्त certificate course: sahakarlekha.com/guide
> 🌐 शुरू करें: sahakarlekha.com

## Trailer script (~45 sec, founder on camera + screen recording)

| समय | Visual | बोलना है |
|---|---|---|
| 0–6s | Founder camera पर | "समिति का हिसाब आज भी register में लिखते हैं? और audit के दिन वही भागदौड़?" |
| 6–14s | Camera | "नमस्ते! मैं सीताराम — मैंने बनाया है **सहकार लेखा**, सिर्फ़ सहकारी समितियों के लिए, बिल्कुल मुफ़्त।" |
| 14–30s | Screen recording: voucher entry → report | "Entry कीजिए आसान हिंदी में... और बैलेंस शीट, ट्रायल बैलेंस, TDS 26Q — एक click पर तैयार। Audit-ready, हमेशा।" |
| 30–38s | Course page + certificate | "साथ में मुफ़्त course भी — certificate के साथ। आपका staff खुद expert बन जाएगा।" |
| 38–45s | End-card (नीचे spec) | "sahakarlekha.com पर आज ही शुरू करें — मुफ़्त है, और आपका data आपका ही रहता है। Channel subscribe करना मत भूलिए!" |

Recording नियम (Brand Book §8): screen recording में demo society का data,
असली नाम कभी नहीं · **subtitles हमेशा** (Hind SemiBold, white on `#122d54` band) ·
intro sting ≤ 2 सेकंड (tile scale-in) · end-card पर QR + domain pill + subscribe।

## हर video की upload checklist

- [ ] Title: हिंदी, benefit-first, ≤ 60 chars ("बैलेंस शीट बनाएँ — सिर्फ़ 1 क्लिक में")
- [ ] Thumbnail: JSON → `npm run gen` (असली screenshot, नाम masked)
- [ ] Description के पहले 2 lines में sahakarlekha.com + video का फ़ायदा
- [ ] Subtitles (हिंदी) upload या review किए
- [ ] End-screen: subscribe + अगली video + website card
- [ ] Pinned comment: course link (sahakarlekha.com/guide)
