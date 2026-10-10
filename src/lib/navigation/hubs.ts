/**
 * Compact menu + group ("hub") pages (founder 2026-10-10: "keep only what is needed on the sidebar, the rest on one
 * page per group" — researched against Zoho Books / QuickBooks / Tally Gateway / Xero).
 *
 * The sidebar shows ~10 entries: Dashboard, Vouchers and one entry per hub. A hub page (/hub/:id) lists its pages as
 * cards in sections. NOTHING about access changes: a hub only shows modules the existing engine already made visible
 * (getVisibleGroups → isModuleVisible: role + capability gates); a hub with no visible page is not shown, and a hub
 * with exactly one visible page links straight to it. Every catalog module belongs to exactly one place (a direct
 * entry or one hub section) — scripts/test-nav-hubs.mjs pins that, so a new module cannot silently fall off the menu.
 * PURE.
 */
import type { ElementType } from 'react';
import {
  LayoutDashboard, FileText, BookOpen, ShoppingCart, PackagePlus, Boxes, Users, Building, Banknote, BarChart3,
  ShieldCheck, Settings,
} from 'lucide-react';
import type { ModuleDefinition } from './moduleCatalog';
import type { NavDomain } from './capabilities';

export interface HubSection { hi: string; en: string; moduleIds?: string[]; domain?: NavDomain }
export interface HubDef { id: string; hi: string; en: string; icon: ElementType; sections: HubSection[] }

/** Shown as their own sidebar entries (not inside a hub). myDashboard only when Dashboard itself is not visible. */
export const DIRECT_ENTRIES = ['dashboard', 'myDashboard', 'vouchers'] as const;
const DIRECT_ICON: Record<string, ElementType> = { dashboard: LayoutDashboard, myDashboard: LayoutDashboard, vouchers: FileText };

export const HUBS: HubDef[] = [
  { id: 'books', hi: 'बहियाँ', en: 'Books', icon: BookOpen, sections: [
    { hi: 'रोज़ की बहियाँ', en: 'Daily books', moduleIds: ['cashBook', 'bankBook', 'dayBook', 'ledger'] },
    { hi: 'मिलान व जाँच', en: 'Reconcile & check', moduleIds: ['bankReconciliation', 'voucherApproval', 'deletedVouchers'] },
  ] },
  { id: 'sales', hi: 'बिक्री', en: 'Sales', icon: ShoppingCart, sections: [
    { hi: 'बिक्री', en: 'Sales', moduleIds: ['sales', 'salesReturn', 'saleRegister'] },
    { hi: 'ग्राहक', en: 'Customers', moduleIds: ['customers'] },
  ] },
  { id: 'purchases', hi: 'खरीद', en: 'Purchases', icon: PackagePlus, sections: [
    { hi: 'खरीद', en: 'Purchases', moduleIds: ['purchases', 'purchaseReturn', 'purchaseRegister', 'procurementMatch'] },
    { hi: 'सप्लायर', en: 'Suppliers', moduleIds: ['suppliers'] },
  ] },
  { id: 'stock', hi: 'स्टॉक', en: 'Stock', icon: Boxes, sections: [
    { hi: 'माल', en: 'Items', moduleIds: ['inventory', 'hsnMaster', 'godowns'] },
    { hi: 'स्टॉक रिपोर्ट', en: 'Stock reports', moduleIds: ['closingStockReport', 'stockValuation'] },
  ] },
  { id: 'members', hi: 'सदस्य व ऋण', en: 'Members & loans', icon: Users, sections: [
    { hi: 'सदस्य', en: 'Members', moduleIds: ['members', 'memberApplication', 'form1MemberList', 'nominationRegister', 'shareRegister'] },
    { hi: 'ऋण व जमा', en: 'Loans & deposits', moduleIds: ['loanRegister', 'loanInterest', 'kccLoan', 'deposits'] },
  ] },
  // The society-type modules — one section per domain; only the domains this society has show up.
  { id: 'society', hi: 'समिति का काम', en: 'Society work', icon: Building, sections: [
    { hi: 'उपभोक्ता भंडार', en: 'Consumer store', domain: 'consumer' },
    { hi: 'विपणन / खरीद एजेंसी', en: 'Marketing / procurement', domain: 'marketing' },
    { hi: 'डेयरी', en: 'Dairy', domain: 'dairy' },
    { hi: 'श्रमिक', en: 'Labour', domain: 'labour' },
    { hi: 'आवास', en: 'Housing', domain: 'housing' },
  ] },
  { id: 'payroll', hi: 'वेतन', en: 'Payroll', icon: Banknote, sections: [
    { hi: 'वेतन', en: 'Payroll', moduleIds: ['salary', 'payroll'] },
  ] },
  { id: 'reports', hi: 'रिपोर्ट', en: 'Reports', icon: BarChart3, sections: [
    { hi: 'अंतिम खाते', en: 'Final accounts', moduleIds: ['trialBalance', 'tradingAccount', 'profitLoss', 'balanceSheet', 'receiptsPayments'] },
    { hi: 'GST व TDS', en: 'GST & TDS', moduleIds: ['gstSummary', 'gstr9', 'eWayBill', 'tdsRegister', 'tdsForm16A', 'statutoryReconciliation'] },
    { hi: 'पार्टी व बकाया', en: 'Parties & dues', moduleIds: ['billsOutstanding', 'agingAnalysis', 'recoverables'] },
    { hi: 'विश्लेषण', en: 'Analysis', moduleIds: ['analytics', 'myDashboard', 'budgetModule', 'reports'] },
    { hi: 'वैधानिक व एजेंसी', en: 'Statutory & agency', moduleIds: ['nabardReport', 'federationReport', 'kachiAarat', 'complianceCalendar'] },
  ] },
  { id: 'registers', hi: 'रजिस्टर व ऑडिट', en: 'Registers & audit', icon: ShieldCheck, sections: [
    { hi: 'ऑडिट', en: 'Audit', moduleIds: ['auditRegister', 'auditCertificate', 'auditSchedules', 'auditTrail', 'ledgerHygiene'] },
    { hi: 'बैठक व चुनाव', en: 'Meetings & elections', moduleIds: ['meetingRegister', 'electionModule', 'boardOfDirectors'] },
    { hi: 'संपत्ति व कोष', en: 'Assets & funds', moduleIds: ['assetRegister', 'depreciationSchedule', 'fundRegister', 'surplusAppropriation'] },
  ] },
  { id: 'settings', hi: 'सेटिंग्स', en: 'Settings', icon: Settings, sections: [
    { hi: 'समिति', en: 'Society', moduleIds: ['societySetup', 'ledgerHeads', 'openingBalances', 'branches', 'features'] },
    { hi: 'उपयोगकर्ता', en: 'Users', moduleIds: ['userManagement'] },
    { hi: 'डेटा', en: 'Data', moduleIds: ['universalImporter', 'exportCenter', 'backupRestore', 'restoreCenter', 'multiSocietyConsolidation'] },
  ] },
];

export const hubRoute = (id: string) => `/hub/${id}`;
export const hubById = (id: string | undefined) => HUBS.find((h) => h.id === id);

/** A hub's sections filled with the VISIBLE modules (catalog order inside a domain section); empty sections dropped. */
export function hubSections(hub: HubDef, visible: ModuleDefinition[]): { section: HubSection; items: ModuleDefinition[] }[] {
  const byId = new Map(visible.map((m) => [m.id, m]));
  return hub.sections
    .map((section) => ({
      section,
      items: section.domain
        ? visible.filter((m) => m.domain === section.domain).sort((a, b) => a.order - b.order)
        : (section.moduleIds ?? []).map((id) => byId.get(id)).filter((m): m is ModuleDefinition => !!m),
    }))
    .filter((s) => s.items.length > 0);
}

export type SidebarEntry =
  | { kind: 'module'; id: string; module: ModuleDefinition; icon: ElementType }
  | { kind: 'hub'; id: string; hub: HubDef; route: string; count: number; routes: string[] };

/**
 * The compact sidebar for the pages this user may open: direct entries, then one entry per hub that has a visible page
 * (a single-page hub becomes a direct link to that page — no pointless one-card page).
 */
export function compactSidebar(visible: ModuleDefinition[]): SidebarEntry[] {
  const byId = new Map(visible.map((m) => [m.id, m]));
  const out: SidebarEntry[] = [];
  for (const id of DIRECT_ENTRIES) {
    if (id === 'myDashboard' && byId.has('dashboard')) continue;
    const m = byId.get(id);
    if (m) out.push({ kind: 'module', id, module: m, icon: DIRECT_ICON[id] ?? m.icon });
  }
  const shown = new Set(out.map((e) => e.id));
  for (const hub of HUBS) {
    const items = hubSections(hub, visible).flatMap((s) => s.items).filter((m) => !shown.has(m.id));
    if (items.length === 0) continue;
    if (items.length === 1) out.push({ kind: 'module', id: items[0].id, module: items[0], icon: hub.icon });
    else out.push({ kind: 'hub', id: hub.id, hub, route: hubRoute(hub.id), count: items.length, routes: items.map((m) => m.route) });
  }
  return out;
}

/** Whether a sidebar entry is the "current" one for this path (a hub is current on its own page and on its pages). */
export function entryIsActive(e: SidebarEntry, pathname: string): boolean {
  if (e.kind === 'module') return pathname === e.module.route;
  return pathname === e.route || e.routes.includes(pathname);
}
