/**
 * Module Catalog (C1) — the single source of navigation FACTS (id, title, icon,
 * route, domain, required capabilities/roles, order). Migrated 1:1 from the five
 * hardcoded arrays in Sidebar.tsx. In C1 EVERY module is universal
 * (requiredCapabilities: []) so the rendered sidebar is byte-identical to today;
 * capabilities are introduced from C4 onward.
 *
 * Facts that are code (icon, route, component) live here; policy that varies per
 * society/plan (capability grants) is data — keeping this catalog stable.
 */
import type { ElementType } from 'react';
import {
  LayoutDashboard, Wallet, Building2, CheckCircle2, FileText, Layers, CalendarDays, BookOpen, Users, ClipboardList,
  ListTree, Boxes, Truck, UserCheck, ShoppingCart, HandCoins, PackagePlus, Banknote, BadgeDollarSign, Milk,
  Scale, ArrowLeftRight, TrendingUp, FileSpreadsheet, BarChart3, Clock, Percent, TrendingDown, Receipt, Warehouse,
  Package, PiggyBank, FileJson, Hash, Landmark, ScrollText, BookMarked, ShieldCheck, Users2, FileCheck, Shield,
  Coins, Trash2, Wheat, Vote, Settings, BookOpenCheck, UserCog, DatabaseBackup, Blocks, HardHat,
} from 'lucide-react';
import type { Capability, NavDomain, Role } from './capabilities';

export interface ModuleDefinition {
  id: string;
  titleKey: string;                  // reuse existing LanguageContext keys via t(titleKey)
  icon: ElementType;
  route: string;
  domain: NavDomain;
  requiredCapabilities: Capability[]; // [] = universal (always visible)
  requiredRoles?: Role[];
  order: number;
}

const U: Capability[] = []; // universal shorthand

export const MODULE_CATALOG: ModuleDefinition[] = [
  // ── core (was mainNavItems) ──
  { id: 'dashboard',          titleKey: 'dashboard',          icon: LayoutDashboard, route: '/dashboard',          domain: 'core', requiredCapabilities: U, order: 0 },
  { id: 'cashBook',           titleKey: 'cashBook',           icon: Wallet,          route: '/cash-book',          domain: 'core', requiredCapabilities: U, order: 1 },
  { id: 'bankBook',           titleKey: 'bankBook',           icon: Building2,       route: '/bank-book',          domain: 'core', requiredCapabilities: U, order: 2 },
  { id: 'bankReconciliation', titleKey: 'bankReconciliation', icon: CheckCircle2,    route: '/bank-reconciliation', domain: 'core', requiredCapabilities: U, order: 3 },
  { id: 'vouchers',           titleKey: 'vouchers',           icon: FileText,        route: '/vouchers',           domain: 'core', requiredCapabilities: U, order: 4 },
  { id: 'compoundVoucher',    titleKey: 'compoundVoucher',    icon: Layers,          route: '/compound-voucher',   domain: 'core', requiredCapabilities: U, requiredRoles: ['admin', 'accountant'], order: 5 },
  { id: 'voucherApproval',    titleKey: 'voucherApproval',    icon: CheckCircle2,    route: '/voucher-approval',   domain: 'core', requiredCapabilities: U, requiredRoles: ['admin'], order: 6 },
  { id: 'dayBook',            titleKey: 'dayBook',            icon: CalendarDays,    route: '/day-book',           domain: 'core', requiredCapabilities: U, order: 7 },
  { id: 'ledger',             titleKey: 'ledger',             icon: BookOpen,        route: '/ledger',             domain: 'core', requiredCapabilities: U, order: 8 },
  { id: 'members',            titleKey: 'members',            icon: Users,           route: '/members',            domain: 'core', requiredCapabilities: U, order: 9 },
  { id: 'memberApplication',  titleKey: 'memberApplication',  icon: ClipboardList,   route: '/member-application', domain: 'core', requiredCapabilities: U, requiredRoles: ['admin', 'accountant'], order: 10 },

  // ── operations (was operationsNavItems) ──
  { id: 'ledgerHeads',    titleKey: 'ledgerHeads',    icon: ListTree,        route: '/ledger-heads',    domain: 'operations', requiredCapabilities: U, order: 0 },
  { id: 'inventory',      titleKey: 'inventory',      icon: Boxes,           route: '/inventory',       domain: 'operations', requiredCapabilities: ['inventory_sales'], order: 1 },
  { id: 'suppliers',      titleKey: 'suppliers',      icon: Truck,           route: '/suppliers',       domain: 'operations', requiredCapabilities: U, order: 2 },
  { id: 'customers',      titleKey: 'customers',      icon: UserCheck,       route: '/customers',       domain: 'operations', requiredCapabilities: ['inventory_sales'], order: 3 },
  { id: 'sales',          titleKey: 'sales',          icon: ShoppingCart,    route: '/sales',           domain: 'operations', requiredCapabilities: ['inventory_sales'], order: 4 },
  { id: 'receivePayment', titleKey: 'receivePayment', icon: HandCoins,       route: '/receive-payment', domain: 'operations', requiredCapabilities: U, requiredRoles: ['admin', 'accountant'], order: 5 },
  { id: 'purchases',      titleKey: 'purchases',      icon: PackagePlus,     route: '/purchases',       domain: 'operations', requiredCapabilities: U, order: 6 },
  { id: 'makePayment',    titleKey: 'makePayment',    icon: Banknote,        route: '/make-payment',    domain: 'operations', requiredCapabilities: U, requiredRoles: ['admin', 'accountant'], order: 7 },
  { id: 'salary',         titleKey: 'salary',         icon: BadgeDollarSign, route: '/salary',          domain: 'operations', requiredCapabilities: U, order: 8 },
  { id: 'milkCollection', titleKey: 'milkCollection', icon: Milk,            route: '/milk-collection', domain: 'operations', requiredCapabilities: ['dairy_collection'], order: 9 },  // C4: dairy-only
  { id: 'procurementLots', titleKey: 'procurementLots', icon: Wheat,         route: '/procurement-lots', domain: 'operations', requiredCapabilities: ['procurement_msp'], order: 10 },
  { id: 'maintenanceBilling', titleKey: 'maintenanceBilling', icon: Receipt, route: '/maintenance-billing', domain: 'operations', requiredCapabilities: ['housing'], requiredRoles: ['admin', 'accountant'], order: 11 },
  // ── Labour cooperative module group (domain: 'labour') ──
  { id: 'workerMaster',    titleKey: 'workerMaster',    icon: HardHat,         route: '/worker-master',   domain: 'labour',     requiredCapabilities: ['labour'], requiredRoles: ['admin', 'accountant'], order: 10 },
  { id: 'departmentMaster',titleKey: 'departmentMaster',icon: Landmark,        route: '/department-master', domain: 'labour',   requiredCapabilities: ['labour'], requiredRoles: ['admin', 'accountant'], order: 11 },
  { id: 'workOrders',      titleKey: 'workOrders',      icon: ClipboardList,   route: '/work-orders',     domain: 'labour',     requiredCapabilities: ['labour'], order: 12 },
  { id: 'musterRoll',      titleKey: 'musterRoll',      icon: UserCheck,       route: '/muster-roll',     domain: 'labour',     requiredCapabilities: ['labour'], requiredRoles: ['admin', 'accountant'], order: 13 },

  // ── reports (was reportNavItems) ──
  { id: 'trialBalance',       titleKey: 'trialBalance',       icon: Scale,           route: '/trial-balance',        domain: 'reports', requiredCapabilities: U, order: 0 },
  { id: 'receiptsPayments',   titleKey: 'receiptsPayments',   icon: ArrowLeftRight,  route: '/receipts-payments',    domain: 'reports', requiredCapabilities: U, order: 1 },
  { id: 'tradingAccount',     titleKey: 'tradingAccount',     icon: ShoppingCart,    route: '/trading-account',      domain: 'reports', requiredCapabilities: ['inventory_sales'], order: 2 },
  { id: 'profitLoss',         titleKey: 'profitLoss',         icon: TrendingUp,      route: '/profit-loss',          domain: 'reports', requiredCapabilities: U, order: 3 },
  { id: 'balanceSheet',       titleKey: 'balanceSheet',       icon: FileSpreadsheet, route: '/balance-sheet',        domain: 'reports', requiredCapabilities: U, order: 4 },
  { id: 'reports',            titleKey: 'reports',            icon: BarChart3,       route: '/reports',              domain: 'reports', requiredCapabilities: U, order: 5 },
  { id: 'saleRegister',       titleKey: 'saleRegister',       icon: ShoppingCart,    route: '/sale-register',        domain: 'reports', requiredCapabilities: ['inventory_sales'], order: 6 },
  { id: 'purchaseRegister',   titleKey: 'purchaseRegister',   icon: PackagePlus,     route: '/purchase-register',    domain: 'reports', requiredCapabilities: U, order: 7 },
  { id: 'billsOutstanding',   titleKey: 'billsOutstanding',   icon: Clock,           route: '/bills-outstanding',    domain: 'reports', requiredCapabilities: U, order: 8 },
  { id: 'gstSummary',         titleKey: 'gstSummary',         icon: Percent,         route: '/gst-summary',          domain: 'reports', requiredCapabilities: ['gst'], order: 9 },
  { id: 'agingAnalysis',      titleKey: 'agingAnalysis',      icon: TrendingDown,    route: '/aging-analysis',       domain: 'reports', requiredCapabilities: U, order: 10 },
  { id: 'tdsForm16A',         titleKey: 'tdsForm16A',         icon: Receipt,         route: '/tds-form16a',          domain: 'reports', requiredCapabilities: ['tds'], order: 11 },
  { id: 'tdsRegister',        titleKey: 'tdsRegister',        icon: Receipt,         route: '/tds-register',         domain: 'reports', requiredCapabilities: ['tds'], order: 12 },
  { id: 'stockValuation',     titleKey: 'stockValuation',     icon: Warehouse,       route: '/stock-valuation',      domain: 'reports', requiredCapabilities: ['inventory_sales'], order: 13 },
  { id: 'closingStockReport', titleKey: 'closingStockReport', icon: Package,         route: '/closing-stock-report', domain: 'reports', requiredCapabilities: ['inventory_sales'], order: 14 },
  { id: 'budgetModule',       titleKey: 'budgetModule',       icon: PiggyBank,       route: '/budget-module',        domain: 'reports', requiredCapabilities: U, order: 15 },
  { id: 'eWayBill',           titleKey: 'eWayBill',           icon: FileJson,        route: '/eway-bill',            domain: 'reports', requiredCapabilities: ['gst'], order: 16 },
  { id: 'hsnMaster',          titleKey: 'hsnMaster',          icon: Hash,            route: '/hsn-master',           domain: 'reports', requiredCapabilities: ['gst'], order: 17 },
  { id: 'nabardReport',       titleKey: 'nabardReport',       icon: Landmark,        route: '/nabard-report',        domain: 'reports', requiredCapabilities: ['lending'], order: 18 },
  { id: 'federationReport',   titleKey: 'federationReport',   icon: ScrollText,      route: '/federation-report',    domain: 'reports', requiredCapabilities: ['procurement_msp'], order: 19 },
  { id: 'recoverables',       titleKey: 'recoverables',       icon: ScrollText,      route: '/recoverables',         domain: 'reports', requiredCapabilities: ['procurement_msp'], order: 20 },
  { id: 'kachiAarat',         titleKey: 'kachiAarat',         icon: ScrollText,      route: '/kachi-aarat',          domain: 'reports', requiredCapabilities: ['procurement_msp'], order: 21 },

  // ── registers (was registerNavItems) ──
  { id: 'shareRegister',        titleKey: 'shareRegister',        icon: BookMarked,   route: '/share-register',        domain: 'registers', requiredCapabilities: U, order: 0 },
  { id: 'loanRegister',         titleKey: 'loanRegister',         icon: Landmark,     route: '/loan-register',         domain: 'registers', requiredCapabilities: ['lending'], order: 1 },
  { id: 'loanInterest',         titleKey: 'loanInterest',         icon: Percent,      route: '/loan-interest',         domain: 'registers', requiredCapabilities: ['lending'], requiredRoles: ['admin', 'accountant'], order: 2 },
  { id: 'assetRegister',        titleKey: 'assetRegister',        icon: Package,      route: '/asset-register',        domain: 'registers', requiredCapabilities: U, order: 3 },
  { id: 'depreciationSchedule', titleKey: 'depreciationSchedule', icon: TrendingDown, route: '/depreciation-schedule', domain: 'registers', requiredCapabilities: U, order: 4 },
  { id: 'auditRegister',        titleKey: 'auditRegister',        icon: ShieldCheck,  route: '/audit-register',        domain: 'registers', requiredCapabilities: U, order: 5 },
  { id: 'meetingRegister',      titleKey: 'meetingRegister',      icon: Users2,       route: '/meeting-register',      domain: 'registers', requiredCapabilities: U, order: 6 },
  { id: 'nominationRegister',   titleKey: 'nominationRegister',   icon: UserCheck,    route: '/nomination-register',   domain: 'registers', requiredCapabilities: U, order: 7 },
  { id: 'form1MemberList',      titleKey: 'form1MemberList',      icon: ClipboardList, route: '/form1-member-list',    domain: 'registers', requiredCapabilities: U, order: 8 },
  { id: 'auditCertificate',     titleKey: 'auditCertificate',     icon: FileCheck,    route: '/audit-certificate',     domain: 'registers', requiredCapabilities: U, requiredRoles: ['admin', 'accountant'], order: 9 },
  { id: 'auditSchedules',       titleKey: 'auditSchedules',       icon: ClipboardList, route: '/audit-schedules',      domain: 'registers', requiredCapabilities: U, requiredRoles: ['admin', 'accountant'], order: 10 },
  { id: 'reserveFund',          titleKey: 'reserveFund',          icon: Shield,       route: '/reserve-fund',          domain: 'registers', requiredCapabilities: U, requiredRoles: ['admin', 'accountant'], order: 11 },
  { id: 'profitDistribution',   titleKey: 'profitDistribution',   icon: Coins,        route: '/profit-distribution',   domain: 'registers', requiredCapabilities: U, requiredRoles: ['admin', 'accountant'], order: 12 },
  { id: 'deletedVouchers',      titleKey: 'deletedVouchers',      icon: Trash2,       route: '/deleted-vouchers',      domain: 'registers', requiredCapabilities: U, requiredRoles: ['admin'], order: 13 },
  { id: 'kccLoan',              titleKey: 'kccLoan',              icon: Wheat,        route: '/kcc-loan',              domain: 'registers', requiredCapabilities: ['lending'], order: 14 },
  { id: 'electionModule',       titleKey: 'electionModule',       icon: Vote,         route: '/election-module',       domain: 'registers', requiredCapabilities: U, order: 15 },
  { id: 'boardOfDirectors',     titleKey: 'boardOfDirectors',     icon: Users2,       route: '/board-of-directors',    domain: 'registers', requiredCapabilities: U, requiredRoles: ['admin'], order: 16 },
  { id: 'flatsRegister',        titleKey: 'flatsRegister',        icon: Building2,    route: '/flats-register',        domain: 'registers', requiredCapabilities: ['housing'], order: 17 },

  // ── administration (was settingsNavItems) ──
  { id: 'societySetup',               titleKey: 'societySetup',               icon: Settings,        route: '/society-setup',                domain: 'administration', requiredCapabilities: U, requiredRoles: ['admin'], order: 0 },
  { id: 'openingBalances',            titleKey: 'openingBalances',            icon: BookOpenCheck,   route: '/opening-balances',             domain: 'administration', requiredCapabilities: U, requiredRoles: ['admin'], order: 1 },
  { id: 'userManagement',             titleKey: 'userManagement',             icon: UserCog,         route: '/user-management',              domain: 'administration', requiredCapabilities: U, requiredRoles: ['admin'], order: 2 },
  { id: 'backupRestore',              titleKey: 'backupRestore',              icon: DatabaseBackup,  route: '/backup-restore',               domain: 'administration', requiredCapabilities: U, requiredRoles: ['admin'], order: 3 },
  { id: 'multiSocietyConsolidation',  titleKey: 'multiSocietyConsolidation',  icon: Building2,       route: '/multi-society-consolidation',  domain: 'administration', requiredCapabilities: U, requiredRoles: ['admin'], order: 4 },
  { id: 'universalImporter',          titleKey: 'universalImporter',          icon: FileSpreadsheet, route: '/universal-importer',           domain: 'administration', requiredCapabilities: U, requiredRoles: ['admin'], order: 5 },
  { id: 'features',                   titleKey: 'features',                   icon: Blocks,          route: '/features',                     domain: 'administration', requiredCapabilities: U, requiredRoles: ['admin'], order: 6 },
];
