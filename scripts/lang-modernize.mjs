// Language modernization — replace Sanskritised shuddh-Hindi accounting terms with the
// common everyday accounting words our users actually speak (GLOBAL LANGUAGE RULE).
// Encoding-safe (UTF-8 via fs, no BOM). Uses Unicode word boundaries so we never damage
// a longer word (पूँजी inside पूँजीगत, अंश inside अंशदान/लाभांश stay intact).
//
// SAFETY: never run on storage.ts / templates/* / stateAuditFormats.ts / siteSearch.ts —
// those hold stored Supabase account names, statutory formats, or search synonyms that must
// keep the old spelling. Pass an explicit file list only.
import fs from 'node:fs';

// from → to. Order does not matter: we sort by needle length DESC so longer phrases win.
const MAP = [
  ['मूल्यह्रास', 'डेप्रिसिएशन'],
  ['तलपट', 'ट्रायल बैलेंस'],
  ['चिट्ठा', 'बैलेंस शीट'],
  ['रोज़नामचा', 'डे बुक'],
  ['अंकेक्षण', 'ऑडिट'],
  ['अंकेक्षक', 'ऑडिटर'],
  ['पंजीयक', 'रजिस्ट्रार'],
  ['प्रलेख', 'वाउचर'],
  ['विवेकशीलता', 'प्रूडेंस'],
  ['लाभांश', 'डिविडेंड'],
  ['चक्रवृद्धि ब्याज', 'कंपाउंड इंटरेस्ट'],
  ['चक्रवृद्धि', 'कंपाउंड'],
  ['साधारण ब्याज', 'सिंपल इंटरेस्ट'],
  ['परिसंपत्तियाँ', 'एसेट्स'],
  ['परिसंपत्तियों', 'एसेट्स'],
  ['परिसंपत्ति', 'एसेट'],
  ['देयताएँ', 'लायबिलिटीज़'],
  ['देयताएं', 'लायबिलिटीज़'],     // anusvara spelling variant
  ['देयताओं', 'लायबिलिटीज़'],
  ['देयता', 'लायबिलिटी'],
  ['पूंजी', 'कैपिटल'],            // anusvara spelling variant of पूँजी
  ['कार्यशील पूँजी', 'वर्किंग कैपिटल'],
  ['चालू परिसंपत्ति', 'करंट एसेट'],
  ['चालू देयता', 'करंट लायबिलिटी'],
  ['चालू अनुपात', 'करंट रेशियो'],
  ['चालू व्यवसाय', 'गोइंग कंसर्न'],
  ['अंश पूँजी', 'शेयर कैपिटल'],
  ['अंश प्रमाण-पत्र', 'शेयर सर्टिफिकेट'],
  ['अंकित मूल्य', 'फेस वैल्यू'],
  ['चुकता पूँजी', 'पेड-अप कैपिटल'],
  ['अधिकृत पूँजी', 'ऑथराइज़्ड कैपिटल'],
  ['निर्गमित पूँजी', 'इश्यूड कैपिटल'],
  ['अभिदत्त पूँजी', 'सब्सक्राइब्ड कैपिटल'],
  ['अभिदत्त', 'सब्सक्राइब्ड'],
  ['पूँजी', 'कैपिटल'],
  ['अंशधारक', 'शेयरधारक'],
  ['अंशों', 'शेयरों'],
  ['अंश', 'शेयर'],
  ['रोकड़ बही', 'कैश बुक'],
  ['रोकड़ खाता', 'कैश अकाउंट'],
  ['नकद बही', 'कैश बुक'],
  ['हस्तगत रोकड़', 'कैश-इन-हैंड'],
  ['रोकड़', 'कैश'],
  ['बैंक बही', 'बैंक बुक'],
  ['खाता बही', 'लेजर'],
  ['लेजर खाता', 'लेजर अकाउंट'],
  ['खाता शीर्ष', 'लेजर हेड'],
  ['खाता समूह', 'अकाउंट ग्रुप'],
  ['तुलन पत्र', 'बैलेंस शीट'],
  ['लाभ-हानि विवरण', 'प्रॉफ़िट एंड लॉस'],
  ['लाभ-हानि खाता', 'प्रॉफ़िट एंड लॉस खाता'],
  ['दोहरा लेखा प्रणाली', 'डबल एंट्री सिस्टम'],
  ['दोहरा लेखा', 'डबल एंट्री'],
  ['समापन शेष', 'क्लोज़िंग बैलेंस'],
  ['प्रारंभिक शेष', 'ओपनिंग बैलेंस'],
  ['नामांकित व्यक्ति', 'नॉमिनी'],
  ['लेखांकन समीकरण', 'अकाउंटिंग इक्वेशन'],
  ['सुनहरे नियम', 'गोल्डन रूल्स'],
  ['प्राप्ति', 'रसीद'],
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// longest-first so multi-word phrases replace before their single-word parts
const RULES = MAP.slice().sort((a, b) => b[0].length - a[0].length).map(([from, to]) => ({
  re: new RegExp(`(?<![\\p{L}\\p{M}])${esc(from)}(?![\\p{L}\\p{M}])`, 'gu'),
  to,
}));

const files = process.argv.slice(2);
let totalFiles = 0, totalHits = 0;
for (const f of files) {
  let txt = fs.readFileSync(f, 'utf8');
  const before = txt;
  let hits = 0;
  for (const { re, to } of RULES) {
    txt = txt.replace(re, () => { hits++; return to; });
  }
  if (txt !== before) {
    fs.writeFileSync(f, txt, 'utf8');
    totalFiles++; totalHits += hits;
    console.log(`  ${hits.toString().padStart(4)}  ${f}`);
  }
}
console.log(`\n[lang-modernize] ${totalHits} replacements across ${totalFiles} files.`);
