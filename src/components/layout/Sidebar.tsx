import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, ChevronDown, LogOut, List, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigation, useAllNavigation } from '@/hooks/useNavigation';
import { compactSidebar, entryIsActive, type ModuleDefinition, type SidebarEntry } from '@/lib/navigation';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const { t, language } = useLanguage();
  const hi = language === 'hi';
  const { user, logout } = useAuth();
  const location = useLocation();
  // Capability-Based Navigation: groups + items come from the registry/engine, NOT
  // hardcoded arrays. Role filtering is applied inside the engine (isModuleVisible).
  const groups = useNavigation();
  const allGroups = useAllNavigation();

  // Compact menu (default, 2026-10-10): Dashboard, Vouchers + one entry per group page (/hub/:id). The old full list
  // stays one click away ("पूरा menu") and the choice persists per browser.
  const MODE_KEY = 'sl.nav.mode';
  const [mode, setMode] = React.useState<'compact' | 'full'>(() => {
    try { return localStorage.getItem(MODE_KEY) === 'full' ? 'full' : 'compact'; } catch { return 'compact'; }
  });
  const switchMode = () => setMode(prev => {
    const next = prev === 'full' ? 'compact' : 'full';
    try { localStorage.setItem(MODE_KEY, next); } catch { /* ignore */ }
    return next;
  });
  const entries = React.useMemo(() => compactSidebar(allGroups.flatMap(g => g.items)), [allGroups]);

  // Collapsible groups: reduce the ~100-item wall of the full sidebar. Default is
  // EXPANDED (first-load behaviour is unchanged); a user can collapse the groups they
  // don't use and the choice persists per browser. Only headed groups (not core/admin,
  // which have no heading) are collapsible, and only in the full (non-icon) sidebar.
  const GROUPS_KEY = 'sl.sidebar.collapsedGroups';
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}'); } catch { return {}; }
  });
  const toggleGroup = (domain: string) => setCollapsedGroups(prev => {
    const next = { ...prev, [domain]: !prev[domain] };
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  const renderNavItem = (item: ModuleDefinition) =>
    renderLink(item.id, item.route, t(item.titleKey), item.icon, location.pathname === item.route);

  const renderEntry = (e: SidebarEntry) => e.kind === 'module'
    ? renderLink(e.id, e.module.route, t(e.module.titleKey), e.icon, entryIsActive(e, location.pathname))
    : renderLink(e.id, e.route, hi ? e.hub.hi : e.hub.en, e.hub.icon, entryIsActive(e, location.pathname));

  const renderLink = (key: string, route: string, label: string, Icon: React.ElementType, isActive: boolean) => {

    const linkContent = (
      <NavLink
        to={route}
        onClick={onMobileClose} // Close mobile sidebar on navigation
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-sidebar-primary',
          collapsed && 'justify-center px-2'
        )}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-sidebar-primary')} />
        {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip key={key} delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">{label}</TooltipContent>
        </Tooltip>
      );
    }

    return <div key={key}>{linkContent}</div>;
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
              <span className="text-sm font-semibold leading-tight">सहकार लेखा</span>
              <span className="text-xs text-sidebar-foreground/70">SahakarLekha</span>
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

      {/* Navigation — rendered from the capability engine (groups in domain order,
          a separator before every group except the first, heading when present). */}
      <nav className="flex flex-col h-[calc(100vh-4rem)] p-3 overflow-y-auto">
        {mode === 'compact' && (
          <div className="space-y-1">{entries.map(renderEntry)}</div>
        )}
        {mode === 'full' && groups.map((group, gi) => {
          // A headed group (not core/admin) can be collapsed, but only in the full
          // sidebar. Headless groups and icon-mode always show their items.
          const isCollapsible = !!group.headingKey && !collapsed;
          const isGroupCollapsed = isCollapsible && !!collapsedGroups[group.domain];
          return (
            <React.Fragment key={group.domain}>
              {gi > 0 && <Separator className="my-4 bg-sidebar-border" />}
              {isCollapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.domain)}
                  aria-expanded={!isGroupCollapsed}
                  className="w-full flex items-center justify-between px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 hover:text-sidebar-foreground/80 uppercase tracking-wider transition-colors"
                >
                  <span>{t(group.headingKey!)}</span>
                  {isGroupCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                    : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />}
                </button>
              ) : (
                group.headingKey && !collapsed && (
                  <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
                    {t(group.headingKey)}
                  </p>
                )
              )}
              {!isGroupCollapsed && (
                <div className="space-y-1">
                  {group.items.map(renderNavItem)}
                </div>
              )}
            </React.Fragment>
          );
        })}

        <div className="flex-1" />

        {/* Compact ⇄ full menu */}
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={switchMode} aria-label={mode === 'compact' ? (hi ? 'पूरा menu दिखाएँ' : 'Show full menu') : (hi ? 'छोटा menu' : 'Compact menu')} className="w-full h-10 mt-4 text-sidebar-foreground/70 hover:bg-sidebar-accent">
                {mode === 'compact' ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{mode === 'compact' ? (hi ? 'पूरा menu दिखाएँ' : 'Show full menu') : (hi ? 'छोटा menu' : 'Compact menu')}</TooltipContent>
          </Tooltip>
        ) : (
          <Button variant="ghost" onClick={switchMode} className="w-full justify-start gap-3 mt-4 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent">
            {mode === 'compact' ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
            <span>{mode === 'compact' ? (hi ? 'पूरा menu दिखाएँ' : 'Show full menu') : (hi ? 'छोटा menu दिखाएँ' : 'Show compact menu')}</span>
          </Button>
        )}

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
