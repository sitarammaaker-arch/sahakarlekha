/**
 * State-wise SEO landing data for /cooperative-software/:state. Cooperatives are
 * registered and audited at the STATE level (each state has its own Cooperative
 * Societies Act, Registrar and apex bodies), so a per-state page targets that
 * state's real search intent with genuinely state-specific facts — not thin
 * templated copy. Start with Haryana (pilot); add more states here to scale.
 */
import { MapPin } from 'lucide-react';
import type React from 'react';

export interface StateInfo {
  slug: string;
  nameHi: string;
  nameEn: string;
  Icon: React.ComponentType<{ className?: string }>;
  metaTitle: string;
  metaDescription: string;
  h1Hi: string;
  introHi: string;
  /** Governing law line (verified per state). */
  act: string;
  /** State cooperative ecosystem rows — what's unique to this state. */
  ecosystem: { area: string; body: string; fits: string }[];
  compliance: string[];
  seoEn: string;
}

export const STATES: StateInfo[] = [
  {
    slug: 'haryana',
    nameHi: 'हरियाणा',
    nameEn: 'Haryana',
    Icon: MapPin,
    metaTitle: 'हरियाणा सहकारी समिति लेखा सॉफ्टवेयर — मुफ़्त | Haryana Cooperative Society Accounting Software',
    metaDescription: 'हरियाणा की सहकारी समितियों के लिए मुफ़्त लेखा सॉफ्टवेयर — HAFED MSP खरीद, Vita दुग्ध भुगतान, PACS/KCC साख, RCS हरियाणा ऑडिट प्रारूप, हरियाणा सहकारी समिति अधिनियम 1984 अनुपालन, TDS 26Q/GST। हिंदी+English, 100% मुफ़्त।',
    h1Hi: 'हरियाणा सहकारी समिति लेखा सॉफ्टवेयर — मुफ़्त',
    introHi: 'हरियाणा की सहकारी समितियाँ हरियाणा सहकारी समिति अधिनियम, 1984 व नियम, 1989 के अंतर्गत पंजीकृत होती हैं और सहकारिता विभाग / Registrar of Cooperative Societies (RCS), हरियाणा के अधीन ऑडिट होती हैं। SahakarLekha इन्हीं ज़रूरतों के लिए बना मुफ़्त, द्विभाषी (हिंदी+English) लेखा सॉफ्टवेयर है।',
    act: 'हरियाणा सहकारी समिति अधिनियम, 1984 (Haryana Act No. 22 of 1984) व हरियाणा सहकारी समिति नियम, 1989',
    ecosystem: [
      { area: 'विपणन / खरीद', body: 'HAFED — गेहूँ, धान, सरसों, कपास की MSP खरीद', fits: 'MSP खरीद, किसान भुगतान, बारदाना-हिसाब, मंडी शुल्क/HRDF, उपार्जन प्रभार' },
      { area: 'दुग्ध', body: 'Vita / हरियाणा डेयरी विकास सहकारी संघ (HDDCF)', fits: 'सदस्य-वार दूध भुगतान, फैट/SNF, पशु आहार बिक्री, कमीशन' },
      { area: 'साख', body: 'HARCO Bank → जिला केंद्रीय सहकारी बैंक (DCCB) → PACS, KCC', fits: 'सदस्य ऋण, KCC, ब्याज, NPA, आरक्षित निधि' },
      { area: 'अन्य', body: 'सहकारी चीनी मिलें, आवास समितियाँ, उपभोक्ता भंडार', fits: 'स्टॉक, बिल-वार निपटान, रख-रखाव बकाया, GST बिक्री' },
    ],
    compliance: [
      'हरियाणा अधिनियम 1984 अनुसार वैधानिक संचय निधि (शुद्ध लाभ का निर्धारित भाग) का स्वतः परिकलन',
      'RCS हरियाणा के लिए ऑडिट-तैयार तुलन-पत्र, आय-व्यय, प्राप्ति-भुगतान व तलपट',
      'TDS 26Q व GST रिटर्न-तैयार सारांश',
      'सब कुछ हिंदी + English में — सदस्य, सचिव, क्लर्क व ऑडिटर सभी के लिए',
    ],
    seoEn: 'Free cooperative society accounting software for Haryana — built for societies registered under the Haryana Cooperative Societies Act, 1984 and Rules, 1989. It handles HAFED MSP procurement (wheat, paddy, mustard, cotton), Vita dairy member payments, PACS / KCC credit under HARCO Bank and the District Central Cooperative Banks, cooperative sugar mills, housing and consumer stores — with audit-ready reports for the Registrar of Cooperative Societies (RCS), Haryana, plus TDS 26Q and GST. Bilingual Hindi-English, completely free.',
  },
];

export function findState(slug: string): StateInfo | null {
  return STATES.find((s) => s.slug === slug) ?? null;
}
