/**
 * Screenshots for the /software/<type> pages.
 *
 * Every picture is the real app with a DEMO society's data ("प्रगति बहुउद्देशीय सहकारी समिति लि." and
 * "उज्ज्वल किसान सहकारी विपणन समिति लि.", both seeded demo societies — no real society, no real person).
 * Files: public/software-shots/<file>.webp, 1200 px wide, cropped from the top of the screen.
 * A type is shown screens of modules it really has (see content/softwareModules); where a type has no
 * screen of its own yet (housing, labour, sugar) the pictures are the general books every society gets,
 * and the caption says what the screen is — never that it is that type's own module.
 * PURE — also loaded by scripts/prerender-guide.mjs.
 */
export interface SoftwareShot { file: string; hi: string; en: string; width: number; height: number }

const shot = (file: string, hi: string, en: string, height = 750): SoftwareShot => ({ file, hi, en, width: 1200, height });

const S = {
  dashboard: shot('dashboard', 'डैशबोर्ड — नकद, बैंक, सदस्य और शुद्ध लाभ एक नज़र में', 'Dashboard — cash, bank, members and net surplus at a glance'),
  loan: shot('loan-register', 'ऋण रजिस्टर — सदस्य-वार ऋण और बकाया', 'Loan register — member-wise loans and dues'),
  deposits: shot('deposits', 'जमा खाते — बचत, FD, RD और पिग्मी', 'Deposits — savings, FD, RD and pigmy'),
  milk: shot('milk-collection', 'दूध संकलन — पाली-वार fat, SNF और राशि', 'Milk collection — shift-wise fat, SNF and amount'),
  milkPay: shot('milk-settlement', 'दुग्ध सेटलमेंट — सदस्य-वार भुगतान', 'Milk settlement — member-wise payment'),
  milkOut: shot('milk-dispatch', 'दुग्ध डिस्पैच — यूनियन को बिक्री', 'Milk dispatch — sale to the union'),
  trips: shot('transport-trips', 'ट्रिप / भाड़ा बिल', 'Trip / freight bill'),
  tb: shot('trial-balance', 'ट्रायल बैलेंस', 'Trial Balance'),
  bs: shot('balance-sheet', 'बैलेंस शीट', 'Balance Sheet'),
  stock: shot('stock', 'माल भंडार — स्टॉक और मूल्य', 'Inventory — stock and value'),
  sales: shot('sales', 'बिक्री — बिल और बकाया', 'Sales — bills and dues', 675),
  lots: shot('procurement-lots', 'खरीद लॉट — किसान, फसल, तौल और MSP दर', 'Procurement lots — farmer, crop, weight and MSP rate'),
  agency: shot('agency-receipts', 'एजेंसी रसीद — खरीद एजेंसी से मिली राशि', 'Agency receipts — money received from the procurement agency'),
  trading: shot('trading-account', 'व्यापार खाता — सकल लाभ', 'Trading Account — gross profit'),
  cash: shot('cash-book', 'कैश बुक', 'Cash Book'),
  day: shot('day-book', 'रोजनामचा (डे बुक)', 'Day Book'),
};

export const SOFTWARE_SHOTS: Record<string, SoftwareShot[]> = {
  pacs: [S.loan, S.deposits, S.tb],
  credit: [S.loan, S.deposits, S.bs],
  'thrift-credit': [S.deposits, S.loan, S.tb],
  dairy: [S.milk, S.milkPay, S.milkOut],
  marketing: [S.lots, S.agency, S.trading],
  consumer: [S.stock, S.sales, S.bs],
  housing: [S.cash, S.day, S.bs],
  sugar: [S.stock, S.trading, S.tb],
  labour: [S.cash, S.tb, S.bs],
  multipurpose: [S.dashboard, S.trips, S.bs],
};

export const softwareShots = (slug: string): SoftwareShot[] => SOFTWARE_SHOTS[slug] ?? [];
export const softwareShotSrc = (s: SoftwareShot): string => `/software-shots/${s.file}.webp`;
