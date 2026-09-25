/**
 * hsnSeed.ts — cooperative-focused HSN/SAC starter set (Slice 6).
 *
 * Purpose: give a fresh society a usable HSN/SAC master so the item-form
 * search-picker works from day one, instead of an empty list.
 *
 * ⚠️ RATES ARE INDICATIVE, NOT AUTHORITATIVE. GST rates change and often depend
 * on branded/pre-packaged vs loose status, end-use (seed vs consumption), and
 * notification updates. Every rate here MUST be verified against the current
 * CBIC rate notification before it is relied on for filing. The import UI shows
 * this warning, and the app treats an item's GST rate as an editable suggestion
 * (never a locked/"verified" value). Codes + descriptions are the stable part.
 *
 * Scope: the highest-frequency lines for PACS / multipurpose / marketing /
 * consumer / dairy cooperatives. Societies add the rest via "Add Code".
 */

export interface HsnSeedRow {
  code: string;
  description: string;      // English / Hindi — searchable in both
  type: 'HSN' | 'SAC';
  gstRate: number;          // INDICATIVE — verify before filing
  cess: number;
}

export const HSN_SAC_SEED: HsnSeedRow[] = [
  // ── Fertilizers (उर्वरक) — indicative 5% ──
  { code: '3102', description: 'Nitrogenous fertilizers incl. Urea / नत्रजन उर्वरक (यूरिया)', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '3103', description: 'Phosphatic fertilizers / फॉस्फेटिक उर्वरक', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '3104', description: 'Potassic fertilizers / पोटैशिक उर्वरक', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '3105', description: 'NPK / DAP & other mineral fertilizers / एनपीके/डीएपी व अन्य उर्वरक', type: 'HSN', gstRate: 5, cess: 0 },

  // ── Seeds for sowing (बुवाई हेतु बीज) — indicative 0% (exempt) ──
  { code: '1209', description: 'Seeds of a kind used for sowing / बुवाई हेतु बीज', type: 'HSN', gstRate: 0, cess: 0 },
  { code: '1001', description: 'Wheat (seed) / गेहूँ (बीज)', type: 'HSN', gstRate: 0, cess: 0 },
  { code: '1006', description: 'Rice / Paddy / धान–चावल', type: 'HSN', gstRate: 0, cess: 0 },
  { code: '1005', description: 'Maize / मक्का', type: 'HSN', gstRate: 0, cess: 0 },
  { code: '0713', description: 'Dried leguminous pulses / दालें (सूखी)', type: 'HSN', gstRate: 0, cess: 0 },

  // ── Crop protection ──
  { code: '3808', description: 'Insecticides / pesticides / fungicides / कीटनाशक-फफूँदनाशक', type: 'HSN', gstRate: 18, cess: 0 },

  // ── Agricultural implements & machinery (कृषि औज़ार/मशीनरी) — indicative 12% ──
  { code: '8201', description: 'Agricultural hand tools / कृषि हस्त औज़ार', type: 'HSN', gstRate: 12, cess: 0 },
  { code: '8432', description: 'Soil preparation / tillage machinery / जुताई मशीनरी', type: 'HSN', gstRate: 12, cess: 0 },
  { code: '8433', description: 'Harvesting / threshing machinery / कटाई-थ्रेशर मशीनरी', type: 'HSN', gstRate: 12, cess: 0 },
  { code: '8436', description: 'Other agricultural machinery / अन्य कृषि मशीनरी', type: 'HSN', gstRate: 12, cess: 0 },

  // ── Animal feed (पशु-आहार) — indicative 0% (exempt) ──
  { code: '2309', description: 'Animal feed preparations / पशु-आहार', type: 'HSN', gstRate: 0, cess: 0 },
  { code: '2302', description: 'Bran, sharps & residues (feed) / चोकर व अवशेष', type: 'HSN', gstRate: 0, cess: 0 },

  // ── Consumer / PACS store staples (उपभोक्ता वस्तुएँ) ──
  { code: '1101', description: 'Wheat flour / atta / गेहूँ आटा', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '1701', description: 'Sugar / चीनी', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '1507', description: 'Soyabean oil / सोयाबीन तेल', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '1508', description: 'Groundnut oil / मूँगफली तेल', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '1512', description: 'Sunflower / safflower oil / सूरजमुखी तेल', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '2501', description: 'Salt / नमक', type: 'HSN', gstRate: 0, cess: 0 },
  { code: '0902', description: 'Tea / चाय', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '0901', description: 'Coffee / कॉफ़ी', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '3401', description: 'Soap / साबुन', type: 'HSN', gstRate: 18, cess: 0 },
  { code: '3402', description: 'Washing / detergent preparations / डिटर्जेंट', type: 'HSN', gstRate: 18, cess: 0 },
  { code: '6305', description: 'Sacks & bags (gunny/packing) / बोरे व थैले', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '2523', description: 'Cement / सीमेंट', type: 'HSN', gstRate: 28, cess: 0 },

  // ── Dairy (डेयरी) ──
  { code: '0401', description: 'Fresh milk / ताज़ा दूध', type: 'HSN', gstRate: 0, cess: 0 },
  { code: '0402', description: 'Milk powder / concentrated milk / दूध पाउडर', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '0403', description: 'Curd / yogurt / lassi / दही-लस्सी', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '0405', description: 'Butter & ghee / मक्खन व घी', type: 'HSN', gstRate: 12, cess: 0 },
  { code: '0406', description: 'Cheese / paneer / पनीर-चीज़', type: 'HSN', gstRate: 5, cess: 0 },
  { code: '0407', description: 'Eggs / अंडे', type: 'HSN', gstRate: 0, cess: 0 },

  // ── Services (SAC) — सेवाएँ ──
  { code: '9986', description: 'Support services to agriculture / कृषि सहायक सेवाएँ', type: 'SAC', gstRate: 0, cess: 0 },
  { code: '9967', description: 'Storage & warehousing / भंडारण (गोदाम)', type: 'SAC', gstRate: 0, cess: 0 },
  { code: '9965', description: 'Goods transport services / माल परिवहन सेवाएँ', type: 'SAC', gstRate: 5, cess: 0 },
  { code: '9961', description: 'Commission / agency (trade) services / कमीशन-अभिकरण सेवाएँ', type: 'SAC', gstRate: 18, cess: 0 },
  { code: '9973', description: 'Leasing / rental services / पट्टा-किराया सेवाएँ', type: 'SAC', gstRate: 18, cess: 0 },
];
