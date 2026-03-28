import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Wallet, Building2, FileText, BookOpen, Users,
  Scale, TrendingUp, FileSpreadsheet, BarChart3, Settings, LogOut,
  ChevronLeft, ChevronRight, ArrowLeftRight, BookMarked, Landmark, Package, ShieldCheck, CalendarDays,
  ListTree, Boxes, ShoppingCart, PackagePlus, BadgeDollarSign, Truck, UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavItem {
  key: string;
  icon: React.ElementType;
  path: string;
  roles?: ('admin' | 'accountant' | 'viewer')[];
}

const mainNavItems: NavItem[] = [
  { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'cashBook', icon: Wallet, path: '/cash-book' },
  { key: 'bankBook', icon: Building2, path: '/bank-book' },
  { key: 'vouchers', icon: FileText, path: '/vouchers' },
  { key: 'dayBook', icon: CalendarDays, path: '/day-book' },
  { key: 'ledger', icon: BookOpen, path: '/ledger' },
  { key: 'members', icon: Users, path: '/members' },
];

const operationsNavItems: NavItem[] = [
  { key: 'ledgerHeads', icon: ListTree, path: '/ledger-heads' },
  { key: 'inventory', icon: Boxes, path: '/inventory' },
  { key: 'suppliers', icon: Truck, path: '/suppliers' },
  { key: 'customers', icon: UserCheck, path: '/customers' },
  { key: 'sales', icon: ShoppingCart, path: '/sales' },
  { key: 'purchases', icon: PackagePlus, path: '/purchases' },
  { key: 'salary', icon: BadgeDollarSign, path: '/salary' },
];

const reportNavItems: NavItem[] = [
  { key: 'trialBalance', icon: Scale, path: '/trial-balance' },
  { key: 'receiptsPayments', icon: ArrowLeftRight, path: '/receipts-payments' },
  { key: 'tradingAccount', icon: ShoppingCart, path: '/trading-account' },
  { key: 'profitLoss', icon: TrendingUp, path: '/profit-loss' },
  { key: 'balanceSheet', icon: FileSpreadsheet, path: '/balance-sheet' },
  { key: 'reports', icon: BarChart3, path: '/reports' },
];

const registerNavItems: NavItem[] = [
  { key: 'shareRegister', icon: BookMarked, path: '/share-register' },
  { key: 'loanRegister', icon: Landmark, path: '/loan-register' },
  { key: 'assetRegister', icon: Package, path: '/asset-register' },
  { key: 'auditRegister', icon: ShieldCheck, path: '/audit-register' },
];

const settingsNavItems: NavItem[] = [
  { key: 'societySetup', icon: Settings, path: '/society-setup', roles: ['admin'] },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const { t } = useLanguage();
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  const renderNavItem = (item: NavItem) => {
    if (item.roles && !hasPermission(item.roles)) return null;

    const isActive = location.pathname === item.path;
    const Icon = item.icon;

    const linkContent = (
      <NavLink
        to={item.path}
        onClick={onMobileClose} // Close mobile sidebar on navigation
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-sidebar-primary',
          collapsed && 'justify-center px-2'
        )}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-sidebar-primary')} />
        {!collapsed && <span className="text-sm font-medium truncate">{t(item.key)}</span>}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.key} delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">{t(item.key)}</TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.key}>{linkContent}</div>;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300',
        // Desktop: always visible, width based on collapsed state
        collapsed ? 'w-16' : 'w-64',
        // Mobile: hidden off-screen by default, slides in when open
        'max-md:-translate-x-full max-md:w-64',
        mobileOpen && 'max-md:translate-x-0'
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm">स</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">समिति लेखा</span>
              <span className="text-xs text-sidebar-foreground/70">Cooperative Accounts</span>
            </div>
          </div>
        )}
        {/* Toggle button — hidden on mobile (use hamburger in header instead) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hidden md:flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        {/* Mobile close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileClose}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent md:hidden"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col h-[calc(100vh-4rem)] p-3 overflow-y-auto">
        <div className="space-y-1">
          {mainNavItems.map(renderNavItem)}
        </div>

        <Separator className="my-4 bg-sidebar-border" />

        {!collapsed && (
          <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            {t('operations') || 'Operations'}
          </p>
        )}
        <div className="space-y-1">
          {operationsNavItems.map(renderNavItem)}
        </div>

        <Separator className="my-4 bg-sidebar-border" />

        {!collapsed && (
          <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            {t('reports')}
          </p>
        )}
        <div className="space-y-1">
          {reportNavItems.map(renderNavItem)}
        </div>

        <Separator className="my-4 bg-sidebar-border" />

        {!collapsed && (
          <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            {t('registers') || 'Registers'}
          </p>
        )}
        <div className="space-y-1">
          {registerNavItems.map(renderNavItem)}
        </div>

        <Separator className="my-4 bg-sidebar-border" />

        <div className="space-y-1">
          {settingsNavItems.map(renderNavItem)}
        </div>

        <div className="flex-1" />

        <div className="border-t border-sidebar-border pt-4 mt-4">
          {!collapsed && user && (
            <div className="px-3 mb-3">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/70 capitalize">{t(user.role)}</p>
            </div>
          )}
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="w-full h-10 text-sidebar-foreground hover:bg-destructive hover:text-destructive-foreground"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('logout')}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              onClick={logout}
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="h-5 w-5" />
              <span>{t('logout')}</span>
            </Button>
          )}
        </div>
      </nav>
    </aside>
  );
};
