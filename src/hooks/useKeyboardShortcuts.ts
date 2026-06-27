import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface Shortcut {
  key: string;
  description: string;
  descriptionHi: string;
  action?: () => void;
  path?: string;
}

export const GLOBAL_SHORTCUTS: Omit<Shortcut, 'action'>[] = [
  { key: 'F2',  path: '/vouchers',         description: 'New Voucher',        descriptionHi: 'नया वाउचर' },
  { key: 'F3',  path: '/ledger',           description: 'Ledger',             descriptionHi: 'लेजर' },
  { key: 'F4',  path: '/compound-voucher', description: 'Compound Voucher',   descriptionHi: 'संयुक्त वाउचर' },
  { key: 'F5',  path: '/vouchers?type=receipt', description: 'Receipt Voucher', descriptionHi: 'रसीद वाउचर' },
  { key: 'F6',  path: '/vouchers?type=payment', description: 'Payment Voucher', descriptionHi: 'भुगतान वाउचर' },
  { key: 'F7',  path: '/vouchers?type=journal', description: 'Journal Voucher', descriptionHi: 'जर्नल वाउचर' },
  { key: 'F8',  path: '/sales',            description: 'Sales',              descriptionHi: 'बिक्री' },
  { key: 'F9',  path: '/purchases',        description: 'Purchases',          descriptionHi: 'खरीद' },
  { key: 'F10', path: '/cash-book',        description: 'Cash Book',          descriptionHi: 'कैश बुक' },
  { key: 'F11', path: '/bank-book',        description: 'Bank Book',          descriptionHi: 'बैंक बुक' },
  { key: 'F12', path: '/trial-balance',    description: 'Trial Balance',      descriptionHi: 'ट्रायल बैलेंस' },
  { key: 'Alt+D', path: '/dashboard',      description: 'Dashboard',          descriptionHi: 'डैशबोर्ड' },
  { key: 'Alt+M', path: '/members',        description: 'Members',            descriptionHi: 'सदस्य' },
  { key: 'Alt+R', path: '/reports',        description: 'Reports',            descriptionHi: 'रिपोर्ट' },
];

export function useKeyboardShortcuts(_onToggleHelp?: () => void) {
  // Global keyboard shortcuts disabled — F-keys / Alt combos were colliding
  // with browser defaults (F5 refresh, F11 fullscreen, F12 devtools, Alt+D
  // address bar, etc). Keep the hook as a no-op so existing call sites stay
  // valid; the GLOBAL_SHORTCUTS list above is retained for documentation.
  useNavigate(); // preserves the hook-rules contract
  useEffect(() => { /* no listener registered */ }, []);
  useCallback(() => {}, []);
}
