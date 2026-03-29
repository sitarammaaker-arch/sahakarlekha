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
  { key: 'F3',  path: '/ledger',           description: 'Ledger',             descriptionHi: 'खाता बही' },
  { key: 'F4',  path: '/compound-voucher', description: 'Compound Voucher',   descriptionHi: 'संयुक्त वाउचर' },
  { key: 'F5',  path: '/vouchers?type=receipt', description: 'Receipt Voucher', descriptionHi: 'रसीद वाउचर' },
  { key: 'F6',  path: '/vouchers?type=payment', description: 'Payment Voucher', descriptionHi: 'भुगतान वाउचर' },
  { key: 'F7',  path: '/vouchers?type=journal', description: 'Journal Voucher', descriptionHi: 'जर्नल वाउचर' },
  { key: 'F8',  path: '/sales',            description: 'Sales',              descriptionHi: 'बिक्री' },
  { key: 'F9',  path: '/purchases',        description: 'Purchases',          descriptionHi: 'खरीद' },
  { key: 'F10', path: '/cash-book',        description: 'Cash Book',          descriptionHi: 'नकद बही' },
  { key: 'F11', path: '/bank-book',        description: 'Bank Book',          descriptionHi: 'बैंक बही' },
  { key: 'F12', path: '/trial-balance',    description: 'Trial Balance',      descriptionHi: 'तलपट' },
  { key: 'Alt+D', path: '/dashboard',      description: 'Dashboard',          descriptionHi: 'डैशबोर्ड' },
  { key: 'Alt+M', path: '/members',        description: 'Members',            descriptionHi: 'सदस्य' },
  { key: 'Alt+R', path: '/reports',        description: 'Reports',            descriptionHi: 'रिपोर्ट' },
];

export function useKeyboardShortcuts(onToggleHelp?: () => void) {
  const navigate = useNavigate();

  const handler = useCallback((e: KeyboardEvent) => {
    // Don't fire shortcuts when typing in inputs/textareas/selects
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Build key combo string
    const combo = [
      e.altKey ? 'Alt' : '',
      e.ctrlKey ? 'Ctrl' : '',
      e.shiftKey ? 'Shift' : '',
      e.key,
    ].filter(Boolean).join('+');

    // Toggle shortcut help with Ctrl+?
    if (combo === 'Ctrl+?' || combo === 'Ctrl+/') {
      e.preventDefault();
      onToggleHelp?.();
      return;
    }

    const match = GLOBAL_SHORTCUTS.find(s => s.key === combo || s.key === e.key);
    if (match?.path) {
      e.preventDefault();
      navigate(match.path);
    }
  }, [navigate, onToggleHelp]);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
