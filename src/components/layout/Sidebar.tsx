import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigation } from '@/hooks/useNavigation';
import type { ModuleDefinition } from '@/lib/navigation';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const location = useLocation();
  // Capability-Based Navigation: groups + items come from the registry/engine, NOT
  // hardcoded arrays. Role filtering is applied inside the engine (isModuleVisible).
  const groups = useNavigation();

  const renderNavItem = (item: ModuleDefinition) => {
    const isActive = location.pathname === item.route;
    const Icon = item.icon;

    const linkContent = (
      <NavLink
        to={item.route}
        onClick={onMobileClose} // Close mobile sidebar on navigation
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-sidebar-primary',
          collapsed && 'justify-center px-2'
        )}
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-sidebar-primary')} />
        {!collapsed && <span className="text-sm font-medium truncate">{t(item.titleKey)}</span>}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.id} delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">{t(item.titleKey)}</TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.id}>{linkContent}</div>;
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

      {/* Navigation — rendered from the capability engine (groups in domain order,
          a separator before every group except the first, heading when present). */}
      <nav className="flex flex-col h-[calc(100vh-4rem)] p-3 overflow-y-auto">
        {groups.map((group, gi) => (
          <React.Fragment key={group.domain}>
            {gi > 0 && <Separator className="my-4 bg-sidebar-border" />}
            {group.headingKey && !collapsed && (
              <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
                {t(group.headingKey)}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map(renderNavItem)}
            </div>
          </React.Fragment>
        ))}

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
