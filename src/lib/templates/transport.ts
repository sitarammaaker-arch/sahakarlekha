/**
 * Transport Cooperative Society — the heads a transport society needs ON TOP of the CMS chart
 * (storage.ts composes: CMS_SOCIETY_ACCOUNTS + these). Focus: freight / hire income from its own
 * vehicles, and vehicle running costs. Vehicle asset (3104), its depreciation (3110 / 5503) and
 * wages / PF / ESI (5202-5204) already come from the CMS chart.
 *
 * Income heads are commission_income ("Commission & Service Income" in the state audit format) and
 * running costs are operational_expense, so neither inflates Total Sales / Total Purchases.
 */
import type { LedgerAccount } from '@/types';

export const TRANSPORT_EXTRA_ACCOUNTS: LedgerAccount[] = [
  { id: '4500', name: 'Transport Operating Income', nameHi: 'परिवहन संचालन आय', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: true, parentId: '4000' },
  { id: '4501', name: 'Freight Income', nameHi: 'माल भाड़ा आय', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4500', subtype: 'commission_income' },
  { id: '4502', name: 'Vehicle Hire / Passenger Fare', nameHi: 'वाहन किराया / सवारी किराया आय', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4500', subtype: 'commission_income' },
  { id: '4503', name: 'Loading / Unloading Charges Received', nameHi: 'लदाई / उतराई शुल्क आय', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4500', subtype: 'commission_income' },
  { id: '4504', name: 'Detention / Waiting Charges', nameHi: 'रुकाई / प्रतीक्षा शुल्क आय', type: 'income', openingBalance: 0, openingBalanceType: 'credit', isSystem: false, isGroup: false, parentId: '4500', subtype: 'commission_income' },
  { id: '5700', name: 'Vehicle Operating Expenses', nameHi: 'वाहन संचालन व्यय', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: true, parentId: '5000' },
  { id: '5701', name: 'Diesel / Fuel', nameHi: 'डीज़ल / ईंधन', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5700', subtype: 'operational_expense' },
  { id: '5702', name: 'Tyres & Tubes', nameHi: 'टायर एवं ट्यूब', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5700', subtype: 'operational_expense' },
  { id: '5703', name: 'Vehicle Repairs & Maintenance', nameHi: 'वाहन मरम्मत एवं रखरखाव', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5700', subtype: 'operational_expense' },
  { id: '5704', name: 'Vehicle Insurance', nameHi: 'वाहन बीमा', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5700', subtype: 'operational_expense' },
  { id: '5705', name: 'Road Tax / Permit / Fitness Fees', nameHi: 'रोड टैक्स / परमिट / फ़िटनेस शुल्क', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5700', subtype: 'operational_expense' },
  { id: '5706', name: 'Toll & Parking', nameHi: 'टोल एवं पार्किंग', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5700', subtype: 'operational_expense' },
  { id: '5707', name: 'Driver / Conductor Trip Allowance', nameHi: 'चालक / परिचालक यात्रा भत्ता', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5700', subtype: 'operational_expense' },
  { id: '5708', name: 'Hired Vehicle Charges', nameHi: 'किराये के वाहन का भाड़ा', type: 'expense', openingBalance: 0, openingBalanceType: 'debit', isSystem: false, isGroup: false, parentId: '5700', subtype: 'operational_expense' },
];
