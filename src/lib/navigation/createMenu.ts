/**
 * "＋ नई entry" — one menu for every "make a new …" action (compact menu phase 3, 2026-10-10; QuickBooks "+ New",
 * Zoho "Quick Create", Tally voucher keys).
 *
 * Each action OPENS the page's own existing form — there is no new save path: vouchers via the ?type= / ?mode=expert / ?billwise=
 * deep links the Vouchers page already reads (journal + contra live in the expert form; easy mode scrolls to the
 * receipt / payment templates), sales / purchases / returns switch to their entry tab and the master pages
 * open their own "add" dialog on ?new=1 (useOpenOnNew → the same handler their "नया …" button calls).
 * An action is offered only when its page is visible to this user (moduleId through the same engine), so the menu can
 * never reach a page the person may not open; the page's own permission checks still apply when it saves.
 * PURE.
 */
import type { ElementType } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, BookOpen, ArrowLeftRight, HandCoins, Banknote, ShoppingCart, PackagePlus, Undo2,
  Redo2, Users, UserCheck, Truck, Boxes, ListTree, Landmark, PiggyBank,
} from 'lucide-react';

export interface CreateAction { id: string; hi: string; en: string; to: string; moduleId: string; icon: ElementType }
export interface CreateGroup { hi: string; en: string; actions: CreateAction[] }

export const CREATE_GROUPS: CreateGroup[] = [
  { hi: 'पैसा', en: 'Money', actions: [
    { id: 'receipt', hi: 'रसीद (पैसा आया)', en: 'Receipt', to: '/vouchers?type=receipt', moduleId: 'vouchers', icon: ArrowDownCircle },
    { id: 'payment', hi: 'भुगतान (पैसा गया)', en: 'Payment', to: '/vouchers?type=payment', moduleId: 'vouchers', icon: ArrowUpCircle },
    { id: 'journal', hi: 'जर्नल (कई पंक्तियाँ)', en: 'Journal (multi-line)', to: '/vouchers?mode=expert&type=journal', moduleId: 'vouchers', icon: BookOpen },
    { id: 'contra', hi: 'कॉन्ट्रा (नकद ⇄ बैंक)', en: 'Contra (cash ⇄ bank)', to: '/vouchers?mode=expert&type=contra', moduleId: 'vouchers', icon: ArrowLeftRight },
    { id: 'receiveBill', hi: 'ग्राहक से वसूली (बिल-वार)', en: 'Receive against bills', to: '/vouchers?billwise=receive', moduleId: 'vouchers', icon: HandCoins },
    { id: 'payBill', hi: 'सप्लायर को भुगतान (बिल-वार)', en: 'Pay against bills', to: '/vouchers?billwise=pay', moduleId: 'vouchers', icon: Banknote },
  ] },
  { hi: 'बिक्री व खरीद', en: 'Sales & purchases', actions: [
    { id: 'sale', hi: 'बिक्री बिल', en: 'Sale bill', to: '/sales?new=1', moduleId: 'sales', icon: ShoppingCart },
    { id: 'purchase', hi: 'खरीद बिल', en: 'Purchase bill', to: '/purchases?new=1', moduleId: 'purchases', icon: PackagePlus },
    { id: 'salesReturn', hi: 'बिक्री वापसी', en: 'Sales return', to: '/sales-return?new=1', moduleId: 'salesReturn', icon: Undo2 },
    { id: 'purchaseReturn', hi: 'खरीद वापसी', en: 'Purchase return', to: '/purchase-return?new=1', moduleId: 'purchaseReturn', icon: Redo2 },
  ] },
  { hi: 'नया खाता / मास्टर', en: 'New master', actions: [
    { id: 'member', hi: 'सदस्य', en: 'Member', to: '/members?new=1', moduleId: 'members', icon: Users },
    { id: 'customer', hi: 'ग्राहक', en: 'Customer', to: '/customers?new=1', moduleId: 'customers', icon: UserCheck },
    { id: 'supplier', hi: 'सप्लायर', en: 'Supplier', to: '/suppliers?new=1', moduleId: 'suppliers', icon: Truck },
    { id: 'item', hi: 'माल (स्टॉक आइटम)', en: 'Stock item', to: '/inventory?new=1', moduleId: 'inventory', icon: Boxes },
    { id: 'ledgerHead', hi: 'लेजर खाता', en: 'Ledger account', to: '/ledger-heads?new=1', moduleId: 'ledgerHeads', icon: ListTree },
  ] },
  { hi: 'ऋण व जमा', en: 'Loans & deposits', actions: [
    { id: 'loan', hi: 'नया ऋण', en: 'New loan', to: '/loan-register?new=1', moduleId: 'loanRegister', icon: Landmark },
    { id: 'deposit', hi: 'नया जमा खाता', en: 'New deposit account', to: '/deposits?new=1', moduleId: 'deposits', icon: PiggyBank },
  ] },
];

/** The groups with only the actions whose page this user may open; empty groups dropped. */
export function visibleCreateGroups(visibleModuleIds: ReadonlySet<string>): CreateGroup[] {
  return CREATE_GROUPS
    .map((g) => ({ ...g, actions: g.actions.filter((a) => visibleModuleIds.has(a.moduleId)) }))
    .filter((g) => g.actions.length > 0);
}
