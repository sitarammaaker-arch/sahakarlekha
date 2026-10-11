/**
 * Report-only Hindi terms for the PDFs (see lib/pdfLang.ts). Keys are the English label LOWER-CASED with spaces
 * collapsed; a key here wins over the app's own screen vocabulary (`translations` in LanguageContext).
 *
 * EXTERNAL VALIDATION NEEDED: these are presentation choices, not statutory text. Hindi accounting terms follow
 * the common usage in cooperative accounting (नामे/जमा, प्रति/द्वारा, आय-व्यय खाता, प्राप्ति एवं भुगतान खाता,
 * तुलन-पत्र). Have the CA / the cooperative department confirm them before a statutory submission relies on the
 * Hindi version; the bilingual mode ("हिंदी / English") exists so the English is always beside the Hindi.
 * This is the ONE place to correct a term.
 */
export const PDF_HI_EXTRA: Record<string, string> = {
  // ── statement titles ──
  'receipts & payments account': 'प्राप्ति एवं भुगतान खाता',
  'income & expenditure account': 'आय एवं व्यय खाता',
  'trading account': 'व्यापार खाता',
  'balance sheet': 'तुलन-पत्र',
  'unaudited - interim statement': 'अलेखापरीक्षित - अंतरिम विवरण',
  'trial balance': 'तलपट (ट्रायल बैलेंस)',
  'ledger account statement': 'खाता-बही विवरण',
  'cash / bank bills (settled at once - not posted to this account; balance unaffected)': 'नकद / बैंक बिल (उसी समय चुकता - इस खाते में दर्ज नहीं; शेष पर असर नहीं)',
  'bill no.': 'बिल सं.',
  'share register': 'अंश रजिस्टर',
  'loan register': 'ऋण रजिस्टर',

  // ── invoice adjustments (115) ──
  'trade discount': 'व्यापार छूट',
  'cash discount (after gst)': 'नकद छूट (GST के बाद)',
  'round off': 'राउंड ऑफ',

  // ── balance sheet (CA format, 2026-10-11) ──
  'detail': 'ब्योरा',
  'profit & loss a/c (balance)': 'लाभ-हानि खाता (शेष)',
  'less: profit & loss a/c (deficit)': 'घटाएँ: लाभ-हानि खाता (घाटा)',
  'balance brought forward': 'पिछला शेष',
  'add: net profit for the year': 'जोड़ें: इस वर्ष का शुद्ध लाभ',
  'less: net loss for the year': 'घटाएँ: इस वर्ष का शुद्ध घाटा',
  'closing stock (inventory + goods put into stock this year)': 'समापन माल (इन्वेंट्री + इस वर्ष स्टॉक खाते में आया माल)',

  // ── trial balance ──
  'liabilities & income (rs.)': 'देयताएँ एवं आय (रु.)',
  'assets & expenditure (rs.)': 'परिसंपत्तियाँ एवं व्यय (रु.)',
  'opening': 'प्रारंभिक शेष',
  'closing': 'अंतिम शेष',
  'debit': 'नामे (डेबिट)',
  'credit': 'जमा (क्रेडिट)',
  'total': 'कुल',
  'total purchases': 'कुल खरीद',
  'gross sales': 'सकल बिक्री',
  'net sales': 'शुद्ध बिक्री',
  'less: sales returns / debit balances in sales accounts': 'घटाएँ: बिक्री वापसी / बिक्री खातों के नामे शेष',
  'total direct expenses': 'कुल प्रत्यक्ष व्यय',
  'total recoveries': 'कुल वसूली / उलटाव',
  'recoveries / credit balances in expense accounts': 'वसूली / व्यय खातों के जमा शेष',
  'trial balance is balanced - debit total equals credit total.': 'तलपट संतुलित है — नामे का योग जमा के योग के बराबर है।',
  'certified that the above trial balance has been prepared from the books of account of the society.':
    'प्रमाणित किया जाता है कि उपरोक्त तलपट समिति की लेखा-पुस्तकों से तैयार किया गया है।',

  // ── balance sheet ──
  'capital & liabilities': 'पूँजी एवं देयताएँ',
  'assets': 'परिसंपत्तियाँ',
  'amount': 'राशि',
  'grand': 'कुल योग',
  'grand total': 'कुल योग',
  'current liabilities': 'चालू देयताएँ',
  'current assets & cash/bank': 'चालू परिसंपत्तियाँ एवं नकद/बैंक',
  'loans': 'ऋण',
  'other': 'अन्य',
  'profit & loss a/c': 'लाभ-हानि खाता',
  'profit & loss a/c (deficit)': 'लाभ-हानि खाता (घाटा)',
  'closing stock': 'अंतिम स्टॉक',
  'opening stock': 'प्रारंभिक स्टॉक',

  // ── auditor's certificate / signatures ──
  "auditor's certificate": 'लेखा-परीक्षक का प्रमाण-पत्र',
  'statutory auditor': 'वैधानिक लेखा-परीक्षक',
  '(name & membership no.)': '(नाम एवं सदस्यता सं.)',
  '(seal)': '(मुहर)',
  '(with seal)': '(मुहर सहित)',
  'secretary': 'सचिव',
  'president': 'अध्यक्ष',
  'chairman': 'सभापति',
  'secretary / manager': 'सचिव / प्रबंधक',
  'accountant': 'लेखाकार',
  'president / chairman': 'अध्यक्ष / सभापति',
  'registrar / auditor': 'रजिस्ट्रार / लेखा-परीक्षक',

  // ── receipts & payments ("To …" / "By …" are handled as prefixes: प्रति / द्वारा) ──
  'dr — receipts': 'नामे — प्राप्तियाँ',
  'cr — payments': 'जमा — भुगतान',
  'balance b/d (opening)': 'प्रारंभिक शेष (आगे लाया गया)',
  'balance c/d (closing)': 'अंतिम शेष (आगे ले जाया गया)',
  'capital': 'पूँजीगत',
  'revenue': 'राजस्व',
  'cash in hand': 'हाथ में नकद',
  'cash at bank': 'बैंक में नकद',
  'certified that the above receipts & payments account is correct as per the books of account of the society.':
    'प्रमाणित किया जाता है कि उपरोक्त प्राप्ति एवं भुगतान खाता समिति की लेखा-पुस्तकों के अनुसार सही है।',

  // ── trading / income & expenditure ──
  'sales (trading income)': 'बिक्री (व्यापारिक आय)',
  'total sales': 'कुल बिक्री',
  'total opening stock': 'कुल प्रारंभिक स्टॉक',
  'total closing stock': 'कुल अंतिम स्टॉक',
  'direct expenses': 'प्रत्यक्ष व्यय',
  'gross profit (to i&e account)': 'सकल लाभ (आय-व्यय खाते में अंतरित)',
  'debit (dr)': 'नामे (Dr)',
  'credit (cr)': 'जमा (Cr)',
  'expenditure (dr)': 'व्यय (नामे)',
  'income (cr)': 'आय (जमा)',
  'surplus carried to balance sheet': 'अधिशेष तुलन-पत्र में अंतरित',
  'certified that the above trading account has been prepared from the books of account of the society.':
    'प्रमाणित किया जाता है कि उपरोक्त व्यापार खाता समिति की लेखा-पुस्तकों से तैयार किया गया है।',

  // ── cash book / bank book / ledger / day book ──
  'receipt (dr)': 'प्राप्ति (नामे)',
  'payment (cr)': 'भुगतान (जमा)',
  'deposit': 'जमा',
  'withdrawal': 'निकासी',
  'date / voucher': 'तिथि / वाउचर',
  'debit (rs.)': 'नामे (रु.)',
  'credit (rs.)': 'जमा (रु.)',
  'day total': 'दिन का योग',

  // ── share register ──
  'name': 'नाम',
  'father/husband': 'पिता/पति',
  'join date': 'सदस्यता तिथि',
  'cert. no.': 'प्रमाणपत्र सं.',
  'shares': 'अंश',
  'face val.': 'अंकित मूल्य',
  'nominee': 'नामांकित व्यक्ति',
  'relation': 'संबंध',
  'status': 'स्थिति',
  'active': 'सक्रिय',
  'total capital': 'कुल पूँजी',
  'certified that the above is a true and correct register of members and share capital of the society as maintained in the books.':
    'प्रमाणित किया जाता है कि उपरोक्त समिति की बहियों में रखा गया सदस्यों एवं अंश-पूँजी का सही एवं शुद्ध रजिस्टर है।',

  // ── loan register ──
  'loan no.': 'ऋण सं.',
  'member': 'सदस्य',
  'type': 'प्रकार',
  'purpose': 'उद्देश्य',
  'rate': 'दर',
  'disbursed': 'वितरित',
  'due date': 'देय तिथि',
  'repaid': 'चुकाया गया',
  'outstanding': 'बकाया',

  // ── asset register / depreciation schedule ──
  'asset register': 'परिसंपत्ति रजिस्टर',
  'acc. dep.': 'संचित मूल्यह्रास',
  'asset name': 'परिसंपत्ति का नाम',
  'asset no.': 'परिसंपत्ति सं.',
  'book value': 'बही मूल्य',
  'cost': 'लागत',
  'dep%': 'मूल्यह्रास %',
  'location': 'स्थान',
  'purchase date': 'क्रय तिथि',
  'category': 'श्रेणी',
  'depreciation schedule': 'मूल्यह्रास अनुसूची',
  'additions': 'वृद्धि',
  'closing wdv': 'अंतिम अवलिखित मूल्य (WDV)',
  'opening wdv': 'प्रारंभिक अवलिखित मूल्य (WDV)',
  'dep rate': 'मूल्यह्रास दर',
  'method': 'विधि',

  // ── audit rectification register ──
  'audit rectification register': 'अंकेक्षण आपत्ति निवारण रजिस्टर',
  'action taken': 'की गई कार्रवाई',
  'audit year': 'अंकेक्षण वर्ष',
  'auditor': 'अंकेक्षक',
  'objection': 'आपत्ति',
  'objn. no.': 'आपत्ति सं.',
  'para': 'पैरा',
  'rect. date': 'सुधार तिथि',

  // ── budget ──
  'budget vs actual': 'बजट बनाम वास्तविक',
  'account': 'खाता',
  'actual (rs.)': 'वास्तविक (रु.)',
  'budget (rs.)': 'बजट (रु.)',
  'expenses': 'व्यय',
  'income': 'आय',
  'var %': 'अंतर %',

  // ── closing stock report ──
  'closing stock report': 'अंतिम स्टॉक रिपोर्ट',
  'close qty': 'अंतिम मात्रा',
  'close val': 'अंतिम मूल्य',
  'open qty': 'प्रारंभिक मात्रा',
  'open val': 'प्रारंभिक मूल्य',
  'purch qty': 'क्रय मात्रा',
  'purch val': 'क्रय मूल्य',
  'purch ret qty': 'क्रय वापसी मात्रा',
  'purch ret val': 'क्रय वापसी मूल्य',
  'sale qty': 'बिक्री मात्रा',
  'sale val': 'बिक्री मूल्य',
  'sale ret qty': 'बिक्री वापसी मात्रा',
  'sale ret val': 'बिक्री वापसी मूल्य',
  'unit': 'इकाई',

  // ── sale / purchase registers ──
  'sale register': 'बिक्री रजिस्टर',
  'purchase register': 'क्रय रजिस्टर',
  'customer': 'ग्राहक',
  'supplier': 'आपूर्तिकर्ता',
  'invoice no': 'चालान सं.',
  'bill no': 'बिल सं.',
  's.no': 'क्र.सं.',
  's.no.': 'क्र.सं.',
  'tax total': 'कुल कर',
  'taxable (rs.)': 'करयोग्य (रु.)',
  'tds': 'टीडीएस',
  'cgst': 'सीजीएसटी',
  'sgst': 'एसजीएसटी',
  'igst': 'आईजीएसटी',

  // ── GST summary (internal report) ──
  'gst summary report': 'जीएसटी सारांश रिपोर्ट',
  'part a — output tax (sales)': 'भाग क — आउटपुट कर (बिक्री)',
  'part b — input tax credit (purchases)': 'भाग ख — इनपुट टैक्स क्रेडिट (खरीद)',
  'part c — net gst liability statement': 'भाग ग — शुद्ध जीएसटी देयता विवरण',
  'bills': 'बिल',
  'gst rate': 'जीएसटी दर',
  'taxable value': 'करयोग्य मूल्य',
  'cgst (rs.)': 'सीजीएसटी (रु.)',
  'sgst (rs.)': 'एसजीएसटी (रु.)',
  'igst (rs.)': 'आईजीएसटी (रु.)',
  'cgst (itc)': 'सीजीएसटी (आईटीसी)',
  'sgst (itc)': 'एसजीएसटी (आईटीसी)',
  'igst (itc)': 'आईजीएसटी (आईटीसी)',
  'total gst': 'कुल जीएसटी',
  'total gst (rs.)': 'कुल जीएसटी (रु.)',
  'total itc': 'कुल आईटीसी',
  'authorized signatory': 'अधिकृत हस्ताक्षरकर्ता',
  'note: this report is for internal accounting purposes only. verify with gstn portal before filing returns.':
    'नोट: यह रिपोर्ट केवल आंतरिक लेखा उद्देश्य के लिए है। रिटर्न दाखिल करने से पहले GSTN पोर्टल से मिलान करें।',

  // ── housing share & nomination register / member share ledger ──
  'share & nomination register': 'अंश एवं नामांकन रजिस्टर',
  'cert no.': 'प्रमाणपत्र सं.',
  'flat / unit': 'फ़्लैट / इकाई',
  'owner': 'स्वामी',
  'chairman / president': 'सभापति / अध्यक्ष',
  'certified that the above is a true record of share certificates and nominations per flat as maintained by the society.':
    'प्रमाणित किया जाता है कि उपरोक्त समिति द्वारा रखा गया प्रति फ़्लैट अंश-प्रमाणपत्रों एवं नामांकनों का सही अभिलेख है।',
  'member share ledger': 'सदस्य अंश खाता-बही',

  // ── misc ──
  'nil': 'शून्य',
  'this report has no transactions for the selected period.': 'चुनी गई अवधि में इस रिपोर्ट में कोई लेन-देन नहीं है।',
};

/** Hindi name of the statement an auditor's certificate is about (the English name when unknown). */
function reportNameHi(name: string): string {
  const map: Record<string, string> = {
    'Balance Sheet': 'तुलन-पत्र',
    'Income & Expenditure Account': 'आय एवं व्यय खाता',
    'Trading Account': 'व्यापार खाता',
  };
  return map[name] ?? name;
}

/**
 * The auditor's certificate paragraph in Hindi. Built here (not in pdf.ts) so that ALL Hindi wording lives in this
 * file and a guard (test-pdf-english-only) can keep Hindi literals out of the generators. The act name stays in
 * English (stateAuditFormats has no Hindi name for it). EXTERNAL VALIDATION NEEDED: presentation wording, not
 * statutory text.
 */
/**
 * Notice printed INSTEAD of the auditor's certificate while the financial year is open / not audit-locked.
 * EXTERNAL VALIDATION NEEDED: presentation wording, not statutory text.
 */
export function interimNoticeHi(o: { reportName: string; financialYear: string; fyEndDdMmYyyy: string }): string {
  return `यह ${reportNameHi(o.reportName)} तैयार करने की तिथि तक की बहियों से वित्तीय वर्ष ${o.financialYear}` +
    (o.fyEndDdMmYyyy ? ` (समाप्ति ${o.fyEndDdMmYyyy})` : '') +
    ' के लिए बनाया गया है। इसका अंकेक्षण नहीं हुआ है। अंकेक्षक का प्रमाणपत्र वर्ष-समाप्ति के अंकेक्षण के बाद ही जारी होगा।';
}

export function auditorCertificateHi(o: {
  societyName: string; registrationNo: string; reportName: string; financialYear: string; actName: string;
  /** dd/mm/yyyy the accounts are made up to; empty falls back to the old wording. */
  asAtDdMmYyyy?: string;
}): string {
  return `हमने ${o.societyName} (पंजीकरण सं. ${o.registrationNo}) का ${reportNameHi(o.reportName)} वित्तीय वर्ष ${o.financialYear} के लिए जाँचा है ` +
    `और प्रमाणित करते हैं कि यह ${o.actName} तथा उसके अंतर्गत बने नियमों के अनुसार तैयार किया गया है ` +
    (o.asAtDdMmYyyy ? `और ${o.asAtDdMmYyyy} को समिति की वित्तीय स्थिति का सही एवं यथार्थ चित्र प्रस्तुत करता है।` : 'और 31 मार्च को समिति की वित्तीय स्थिति का सही एवं यथार्थ चित्र प्रस्तुत करता है।');
}
