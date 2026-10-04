/**
 * PURE — the year-end pre-print checklist.
 *
 * Source: NABARD Common Accounting System for PACS, Annexure VI Part 1 para 2 ("steps ... to close the books of
 * accounts and prepare financial statements"). It is the PACS manual; for other society types it is a benchmark of
 * good practice, not that State's prescribed procedure. The list only INFORMS: nothing here blocks printing or
 * posting. Items the app can compute are checked ('ok' / 'warn'); the rest need a person ('manual').
 */
export type ChecklistStatus = 'ok' | 'warn' | 'manual';

export interface ChecklistItem {
  key: string;
  en: string;
  hi: string;
  status: ChecklistStatus;
  detail?: string;
  /** Where the step comes from. */
  cite: string;
}

const CAS = (step: string) => `NABARD CAS, Annexure VI, step ${step}`;
const money = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));

export interface ChecklistInput {
  tbBalanced: boolean;
  bsBalanced: boolean;
  /** bank: Trial Balance vs all Bank Books vs Receipts & Payments */
  bankTiesToBooks: boolean;
  bankTiesToRP: boolean;
  share: { reconciled: boolean; difference: number };
  asset: { reconciled: boolean; difference: number };
}

export function buildYearEndChecklist(o: ChecklistInput): ChecklistItem[] {
  const chk = (key: string, en: string, hi: string, ok: boolean, cite: string, detail?: string): ChecklistItem =>
    ({ key, en, hi, status: ok ? 'ok' : 'warn', cite, ...(ok || !detail ? {} : { detail }) });
  const man = (key: string, en: string, hi: string, cite: string): ChecklistItem => ({ key, en, hi, status: 'manual', cite });

  return [
    chk('tb', 'Trial Balance agrees (Dr = Cr)', 'ट्रायल बैलेंस मिलता है (डेबिट = क्रेडिट)', o.tbBalanced, CAS('3'), 'Trial Balance does not agree'),
    chk('bs', 'Balance Sheet agrees (assets = liabilities)', 'बैलेंस शीट मिलती है (संपत्ति = देयता)', o.bsBalanced, CAS('4(vi)'), 'Balance Sheet does not agree'),
    chk('bank-books', 'Bank balances: Trial Balance = all Bank Books', 'बैंक शेष: ट्रायल बैलेंस = सभी बैंक बुक', o.bankTiesToBooks, CAS('(ii)'), 'Bank Books differ from the Trial Balance - reconcile'),
    chk('bank-rp', 'Bank balance: Trial Balance = Receipts & Payments', 'बैंक शेष: ट्रायल बैलेंस = प्राप्ति-भुगतान', o.bankTiesToRP, CAS('(ii)'), 'Receipts & Payments differs from the Trial Balance'),
    chk('share', 'Member-wise share capital = share capital ledger', 'सदस्य-वार अंश-पूँजी = अंश-पूँजी खाता', o.share.reconciled, CAS('(xv)'), `Difference Rs. ${money(o.share.difference)}`),
    chk('assets', 'Asset register cost = fixed-asset ledger', 'संपत्ति रजिस्टर की लागत = स्थायी संपत्ति खाता', o.asset.reconciled, CAS('(xii)-(xiii)'), `Difference Rs. ${money(o.asset.difference)}`),
    man('cash-count', 'Cash book closed and cash physically counted and tallied', 'रोकड़ बही बंद और नकद की भौतिक गिनती का मिलान', CAS('(i)')),
    man('bank-confirm', 'Bank / borrowing balances confirmed by the bank or lender (confirmation certificate)', 'बैंक / ऋणदाता से शेष-पुष्टि प्रमाणपत्र', CAS('(ii), (xvi)')),
    man('accruals', 'Interest and expense accruals passed up to 31 March (accrued, payable, outstanding)', '31 मार्च तक ब्याज और खर्च के accrual की प्रविष्टियाँ', CAS('(iii)-(v)')),
    man('stock', 'Closing stock physically verified and booked from the ACTUAL stock (not the register); lower of cost and market', 'अंतिम स्टॉक की भौतिक जाँच; प्रविष्टि वास्तविक स्टॉक से; लागत या बाज़ार में जो कम', CAS('(viii)-(ix)')),
    man('provisions', 'Provisions made (NPA, overdue interest, bad debts, investment depreciation)', 'प्रावधान (NPA, ओवरड्यू ब्याज, डूबत ऋण, निवेश का अवमूल्यन)', CAS('(vii), (x)-(xi)')),
    man('depreciation', 'Depreciation chart matches the depreciation charged in the P&L', 'मूल्यह्रास-तालिका P&L में लगे मूल्यह्रास से मिलती है', CAS('(xiii)')),
    man('deposits', 'Deposit and borrowing accounts balanced and tallied with the ledger', 'जमा और उधार खाते संतुलित और खाता-बही से मिलान', CAS('(xvi)-(xvii)')),
  ];
}
