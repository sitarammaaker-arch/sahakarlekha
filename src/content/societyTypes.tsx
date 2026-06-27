/**
 * Society-type marketing/SEO landing data.
 * Powers /software and /software/:type — each type targets its own high-intent
 * search keyword (e.g. "PACS accounting software", "dairy cooperative software").
 * Hindi-first copy with an English SEO paragraph per type.
 */
import React from 'react';
import {
  Wheat, Landmark, ShoppingCart, Milk, Home, Factory, Hammer, Building2,
} from 'lucide-react';

export interface SocietyType {
  slug: string;
  Icon: React.ComponentType<{ className?: string }>;
  nameHi: string;
  nameEn: string;
  metaTitle: string;
  metaDescription: string;
  h1Hi: string;
  introHi: string;
  /** English paragraph for SEO crawlers + English readers. */
  seoEn: string;
  /** Day-to-day challenges this society type faces. */
  painsHi: string[];
  /** How SahakarLekha solves them (feature → benefit). */
  solvesHi: string[];
}

export const SOCIETY_TYPES: SocietyType[] = [
  {
    slug: 'pacs',
    Icon: Landmark,
    nameHi: 'प्राथमिक कृषि ऋण समिति (PACS)',
    nameEn: 'PACS',
    metaTitle: 'PACS लेखा सॉफ्टवेयर — मुफ़्त | PACS Accounting Software India',
    metaDescription: 'PACS (प्राथमिक कृषि ऋण समिति) के लिए मुफ़्त लेखा सॉफ्टवेयर — सदस्य ऋण, KCC, ब्याज, NPA, DCCB/NABARD रिपोर्ट, आरक्षित फंड (धारा 65), ऑडिट। हिंदी+English।',
    h1Hi: 'PACS के लिए मुफ़्त लेखा सॉफ्टवेयर',
    introHi: 'प्राथमिक कृषि ऋण समिति का पूरा हिसाब एक जगह — सदस्य ऋण, KCC, ब्याज गणना, NPA वर्गीकरण और DCCB/NABARD रिपोर्ट, सहकारिता अधिनियम के अनुरूप।',
    seoEn: 'SahakarLekha is free accounting software built for PACS (Primary Agricultural Credit Societies). Manage member loans, KCC, interest calculation, NPA classification, Reserve Fund (Sec 65), and DCCB/NABARD reporting in the RCS audit format — in Hindi and English.',
    painsHi: [
      'सदस्य-वार ऋण व ब्याज की गणना और बकाया का हिसाब',
      'KCC (किसान क्रेडिट कार्ड) खातों का प्रबंधन',
      'DCCB/NABARD के निर्धारित प्रारूप में रिपोर्ट',
      'NPA वर्गीकरण व आरक्षित फंड का अनुपालन',
    ],
    solvesHi: [
      'ऋण रजिस्टर (धारा 32) — सदस्य-वार ऋण, किस्त व ब्याज स्वतः',
      'समर्पित KCC मॉड्यूल व ब्याज गणना',
      'NABARD रिपोर्ट + आरक्षित फंड (धारा 65) स्वतः',
      'सदस्य शेयर रजिस्टर, ट्रायल बैलन्स, बैलेंस शीट व ऑडिट प्रमाणपत्र',
    ],
  },
  {
    slug: 'dairy',
    Icon: Milk,
    nameHi: 'दुग्ध सहकारी समिति',
    nameEn: 'Dairy Cooperative',
    metaTitle: 'दुग्ध सहकारी समिति सॉफ्टवेयर — मुफ़्त | Dairy Cooperative Software',
    metaDescription: 'दुग्ध सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर — सदस्य-वार दूध भुगतान, पशु आहार बिक्री, कमीशन, स्टॉक, TDS/GST व ऑडिट रिपोर्ट। हिंदी+English।',
    h1Hi: 'दुग्ध सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर',
    introHi: 'दूध संग्रह, सदस्य-वार भुगतान, पशु आहार की उधार बिक्री और कमीशन — दुग्ध समिति का पूरा हिसाब सरल हिंदी में, एक ही जगह।',
    seoEn: 'SahakarLekha is free accounting software for dairy cooperative societies. Track member-wise milk payments, cattle-feed credit sales, commission income, stock and TDS/GST, and generate audit-ready reports — in Hindi and English.',
    painsHi: [
      'सदस्य-वार दूध भुगतान व मासिक भुगतान चक्र',
      'पशु आहार की उधार बिक्री व सदस्य बकाया',
      'कमीशन/प्रसंस्करण आय का अलग हिसाब',
      'स्टॉक व वैल्यूएशन का सही लेखा',
    ],
    solvesHi: [
      'सदस्य खाता + bill-wise भुगतान/बकाया मिलान',
      'पशु आहार स्टॉक रजिस्टर व बिक्री',
      'गतिविधि-वार (activity-wise) आय/व्यय हेड',
      'TDS/GST सारांश व RCS ऑडिट रिपोर्ट',
    ],
  },
  {
    slug: 'marketing',
    Icon: Wheat,
    nameHi: 'विपणन एवं प्रसंस्करण समिति',
    nameEn: 'Marketing & Processing Cooperative',
    metaTitle: 'विपणन सहकारी समिति सॉफ्टवेयर — मुफ़्त | Marketing Cooperative Software',
    metaDescription: 'विपणन एवं प्रसंस्करण सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर — MSP खरीद, किसान भुगतान, Hafed/FCI कमीशन, स्टॉक, TDS/GST व ऑडिट। हिंदी+English।',
    h1Hi: 'विपणन एवं प्रसंस्करण समिति के लिए मुफ़्त लेखा सॉफ्टवेयर',
    introHi: 'MSP खरीद, किसान-वार भुगतान, Hafed/FCI एजेंट कमीशन और प्रसंस्करण आय — विपणन समिति का पूरा हिसाब, सहकारिता-अनुरूप ऑडिट प्रारूप में।',
    seoEn: 'SahakarLekha is free accounting software for marketing & processing cooperative societies (CMS). Handle MSP procurement, farmer-wise payments, Hafed/FCI agent commission, stock valuation, TDS/GST and RCS-format audit reports — in Hindi and English.',
    painsHi: [
      'MSP/खरीद और किसान-वार भुगतान का हिसाब',
      'Hafed/FCI एजेंट कमीशन व प्रसंस्करण आय',
      'गतिविधि-वार बिक्री/खरीद का अलग लेखा',
      'स्टॉक वैल्यूएशन व बड़े लेन-देन',
    ],
    solvesHi: [
      'किसान-वार खाता + bill-wise भुगतान',
      'गतिविधि-वार (activity-wise) बिक्री/खरीद हेड',
      'स्टॉक रजिस्टर व वैल्यूएशन (FIFO/WA)',
      'TDS/GST व RCS ऑडिट प्रमाणपत्र',
    ],
  },
  {
    slug: 'consumer',
    Icon: ShoppingCart,
    nameHi: 'उपभोक्ता सहकारी भंडार',
    nameEn: 'Consumer Cooperative Store',
    metaTitle: 'उपभोक्ता सहकारी भंडार सॉफ्टवेयर — मुफ़्त | Consumer Co-op Software',
    metaDescription: 'उपभोक्ता सहकारी भंडार के लिए मुफ़्त लेखा व इन्वेंट्री सॉफ्टवेयर — GST बिक्री बिल, स्टॉक वैल्यूएशन, HSN/GSTR सारांश, आपूर्तिकर्ता बकाया व ऑडिट। हिंदी+English।',
    h1Hi: 'उपभोक्ता सहकारी भंडार के लिए मुफ़्त लेखा व इन्वेंट्री सॉफ्टवेयर',
    introHi: 'खुदरा बिक्री, GST बिल, स्टॉक और HSN सारांश — उपभोक्ता भंडार की दुकान व खाता दोनों एक ही सॉफ्टवेयर में।',
    seoEn: 'SahakarLekha is free accounting and inventory software for consumer cooperative stores. Issue GST sales bills, manage stock valuation, HSN/GSTR summaries, supplier dues and audit reports — in Hindi and English.',
    painsHi: [
      'खुदरा बिक्री व GST बिल बनाना',
      'स्टॉक व वैल्यूएशन का सटीक हिसाब',
      'HSN/दर-वार GST सारांश',
      'आपूर्तिकर्ता बकाया व भुगतान',
    ],
    solvesHi: [
      'GST बिक्री बिल व रसीद',
      'इन्वेंट्री + स्टॉक वैल्यूएशन रिपोर्ट',
      'HSN सारांश व GSTR-1/3B सहायक',
      'bill-wise आपूर्तिकर्ता बकाया व ऑडिट',
    ],
  },
  {
    slug: 'housing',
    Icon: Home,
    nameHi: 'आवास सहकारी समिति',
    nameEn: 'Housing Cooperative Society',
    metaTitle: 'आवास सहकारी समिति सॉफ्टवेयर — मुफ़्त | Housing Society Software',
    metaDescription: 'आवास सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर — सदस्य-वार रख-रखाव बकाया, सिंकिंग फंड, बैठक रजिस्टर, रसीद-भुगतान व ऑडिट रिपोर्ट। हिंदी+English।',
    h1Hi: 'आवास सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर',
    introHi: 'रख-रखाव शुल्क, सिंकिंग फंड, सदस्य बकाया और बैठक रिकॉर्ड — आवास समिति का सरल व पारदर्शी प्रबंधन।',
    seoEn: 'SahakarLekha is free accounting software for housing cooperative societies. Manage member-wise maintenance dues, sinking/repair funds, meeting registers, receipts & payments and audit reports — in Hindi and English.',
    painsHi: [
      'सदस्य-वार रख-रखाव शुल्क व बकाया',
      'सिंकिंग/मरम्मत फंड का अलग हिसाब',
      'बैठक व प्रस्ताव का रिकॉर्ड',
      'पारदर्शी रसीद-भुगतान व ऑडिट',
    ],
    solvesHi: [
      'सदस्य खाता + बकाया मिलान',
      'फंड-वार हेड (सिंकिंग, मरम्मत आदि)',
      'बैठक रजिस्टर व कार्यवृत्त',
      'रसीद-भुगतान खाता, बैलेंस शीट व ऑडिट',
    ],
  },
  {
    slug: 'sugar',
    Icon: Factory,
    nameHi: 'चीनी सहकारी कारखाना',
    nameEn: 'Sugar Cooperative Factory',
    metaTitle: 'चीनी सहकारी कारखाना सॉफ्टवेयर — मुफ़्त | Sugar Cooperative Software',
    metaDescription: 'चीनी सहकारी कारखाने के लिए मुफ़्त लेखा सॉफ्टवेयर — गन्ना खरीद, किसान भुगतान, चीनी/शीरा स्टॉक, बड़े लेन-देन, TDS/GST व ऑडिट रिपोर्ट। हिंदी+English।',
    h1Hi: 'चीनी सहकारी कारखाने के लिए मुफ़्त लेखा सॉफ्टवेयर',
    introHi: 'गन्ना खरीद, किसान-वार भुगतान, चीनी व शीरा का स्टॉक और बड़े पैमाने के लेन-देन — चीनी कारखाने का पूरा लेखा एक जगह।',
    seoEn: 'SahakarLekha is free accounting software for sugar cooperative factories. Manage cane procurement, farmer-wise payments, sugar/molasses stock, large-volume transactions, TDS/GST and audit reports — in Hindi and English.',
    painsHi: [
      'गन्ना खरीद व किसान-वार भुगतान',
      'चीनी/शीरा का स्टॉक व वैल्यूएशन',
      'बड़े पैमाने के खाते व TDS',
      'सहकारिता ऑडिट प्रारूप',
    ],
    solvesHi: [
      'किसान-वार खाता + bill-wise भुगतान',
      'गतिविधि-वार खरीद/बिक्री हेड',
      'स्टॉक वैल्यूएशन व डेप्रिसिएशन',
      'TDS/GST व RCS ऑडिट प्रमाणपत्र',
    ],
  },
  {
    slug: 'labour',
    Icon: Hammer,
    nameHi: 'श्रमिक/निर्माण सहकारी समिति',
    nameEn: 'Labour Cooperative Society',
    metaTitle: 'श्रमिक सहकारी समिति सॉफ्टवेयर — मुफ़्त | Labour Cooperative Software',
    metaDescription: 'श्रमिक/निर्माण सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर — ठेका कार्य आय, मजदूरी/वेतन, TDS 194C, सदस्य भुगतान व ऑडिट रिपोर्ट। हिंदी+English।',
    h1Hi: 'श्रमिक/निर्माण सहकारी समिति के लिए मुफ़्त लेखा सॉफ्टवेयर',
    introHi: 'ठेका कार्य आय, मजदूरी/वेतन, TDS 194C और सदस्य भुगतान — श्रमिक समिति का पूरा हिसाब सरल हिंदी में।',
    seoEn: 'SahakarLekha is free accounting software for labour and construction cooperative societies. Track contract income, wages/salary, TDS 194C, member payments and audit reports — in Hindi and English.',
    painsHi: [
      'ठेका कार्य की आय व बिल',
      'मजदूरी/वेतन भुगतान',
      'ठेकेदार TDS (194C) का अनुपालन',
      'सदस्य-वार भुगतान व रिकॉर्ड',
    ],
    solvesHi: [
      'वेतन/मजदूरी मॉड्यूल',
      'TDS रजिस्टर + 26Q निर्यात (TRACES)',
      'गतिविधि-वार आय हेड',
      'सदस्य खाता, बैलेंस शीट व ऑडिट',
    ],
  },
  {
    slug: 'multipurpose',
    Icon: Building2,
    nameHi: 'बहुउद्देशीय व अन्य सहकारी समिति',
    nameEn: 'Multipurpose & Other Cooperatives',
    metaTitle: 'बहुउद्देशीय सहकारी समिति सॉफ्टवेयर — मुफ़्त | Multipurpose Co-op Software',
    metaDescription: 'बहुउद्देशीय, मत्स्य, बुनकर व अन्य सहकारी समितियों के लिए मुफ़्त लेखा सॉफ्टवेयर — मिश्रित गतिविधियाँ, सदस्य+व्यापार, TDS/GST व RCS ऑडिट। हिंदी+English।',
    h1Hi: 'बहुउद्देशीय व अन्य सहकारी समितियों के लिए मुफ़्त लेखा सॉफ्टवेयर',
    introHi: 'मत्स्य, बुनकर, श्रम, ऋण+भंडार जैसी मिश्रित गतिविधियाँ — हर बहुउद्देशीय समिति का लेखा एक ही लचीले सॉफ्टवेयर में।',
    seoEn: 'SahakarLekha is free accounting software for multipurpose and other cooperative societies — fisheries, weavers, labour, credit-cum-store. Handle mixed activities, member and trading accounts, TDS/GST and RCS-format audits — in Hindi and English.',
    painsHi: [
      'एक साथ कई गतिविधियों का हिसाब',
      'सदस्य + व्यापार दोनों का लेखा',
      'विविध अनुपालन (TDS/GST)',
      'RCS ऑडिट प्रारूप',
    ],
    solvesHi: [
      '8 समिति-प्रकार के तैयार COA टेम्पलेट',
      'गतिविधि-वार आय/व्यय हेड',
      'सदस्य + ऋण + स्टॉक एक जगह',
      'TDS/GST व RCS ऑडिट प्रमाणपत्र',
    ],
  },
];

export function findSocietyType(slug?: string): SocietyType | undefined {
  return SOCIETY_TYPES.find((s) => s.slug === slug);
}
