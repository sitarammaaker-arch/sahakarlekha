import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Languages, Bell, User, Settings, HelpCircle, Menu, LogOut, Search, Landmark, ShieldAlert, XCircle, Lock, CalendarClock, ShieldCheck } from 'lucide-react';
import { buildComplianceCalendar, complianceNotifications } from '@/lib/complianceCalendar';
import { cn } from '@/lib/utils';
import { GlobalSearch } from '@/components/GlobalSearch';
import { MfaSetupDialog } from '@/components/security/MfaSetupDialog';
import { helpForRoute } from '@/content/help';

interface HeaderProps {
  sidebarCollapsed: boolean;
  onMobileMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ sidebarCollapsed, onMobileMenuToggle }) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const { society, loans, auditObjections, vouchers, employees, getComplianceFiledIds } = useData();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const ctxHelp = helpForRoute(pathname); // matching how-to for the current screen, if any
  const [searchOpen, setSearchOpen] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);

  // Live notification data
  const overdueLoans = loans.filter(l => l.status === 'overdue');
  const pendingObjections = auditObjections.filter(o => o.status === 'pending');
  const cancelledVouchers = vouchers.filter(v => v.isDeleted);
  // ECR-13: statutory deadlines needing attention (overdue + due-soon, unfiled).
  const complianceAlerts = useMemo(() => {
    const asOf = new Date().toISOString().split('T')[0];
    const items = buildComplianceCalendar(asOf, {
      hasEmployees: (employees || []).some(e => e.status === 'active'),
      tan: !!society.tan?.trim(),
      gstin: !!society.gstin?.trim(),
    }, { filedIds: getComplianceFiledIds() });
    return complianceNotifications(items);
  }, [society.tan, society.gstin, employees, getComplianceFiledIds]);
  const totalNotifications = overdueLoans.length + pendingObjections.length + (cancelledVouchers.length > 0 ? 1 : 0) + (complianceAlerts.length > 0 ? 1 : 0);

  // Ctrl+K / Cmd+K shortcut disabled — search box still opens on click.

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'admin') return 'default';
    if (role === 'accountant') return 'secondary';
    return 'outline';
  };

  return (
    <>
      <header
        className={cn(
          'fixed top-0 right-0 z-30 h-16 bg-card border-b border-border transition-all duration-300',
          'left-0',
          sidebarCollapsed ? 'md:left-16' : 'md:left-64'
        )}
      >
        <div className="flex h-full items-center justify-between px-4 md:px-6">
          {/* Left side */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={onMobileMenuToggle}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              {/* Mobile: show shortName (truncated), Desktop: show full name */}
              <h1 className="text-base md:text-xl font-bold text-foreground leading-tight">
                <span className="block md:hidden truncate max-w-[180px]">
                  {language === 'hi'
                    ? (society.shortNameHi || society.shortName || society.nameHi)
                    : (society.shortName || society.shortNameHi || society.name)}
                </span>
                <span className="hidden md:block truncate max-w-xs lg:max-w-sm">
                  {language === 'hi' ? society.nameHi : society.name}
                </span>
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block truncate max-w-xs">
                {language === 'hi' ? 'पंजीकरण संख्या' : 'Reg. No'}: {society.registrationNo} | {language === 'hi' ? 'वित्तीय वर्ष' : 'FY'}: {society.financialYear}
                {society.fyLocked && (
                  <span className="ml-2 inline-flex items-center gap-1 text-destructive font-semibold">
                    <Lock className="h-3 w-3" />{language === 'hi' ? 'लॉक' : 'LOCKED'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1 md:gap-2 pr-1 md:pr-0">
            {/* Search Button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hidden sm:flex text-muted-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
              <span className="text-xs">{language === 'hi' ? 'खोजें…' : 'Search…'}</span>
              <kbd className="pointer-events-none hidden xl:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px]">
                Ctrl K
              </kbd>
            </Button>
            {/* Search icon hidden on mobile — use sidebar nav or Ctrl+K on desktop */}

            {/* Language Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Languages className="h-4 w-4" />
                  <span className="hidden sm:inline">{language === 'hi' ? 'हिंदी' : 'English'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLanguage('hi')}>
                  <span className={cn(language === 'hi' && 'font-semibold')}>हिंदी</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('en')}>
                  <span className={cn(language === 'en' && 'font-semibold')}>English</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {totalNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                      {totalNotifications > 9 ? '9+' : totalNotifications}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-72">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>{language === 'hi' ? 'सूचनाएं' : 'Notifications'}</span>
                  {totalNotifications > 0 && (
                    <Badge variant="destructive" className="text-xs">{totalNotifications}</Badge>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {totalNotifications === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {language === 'hi' ? 'कोई सूचना नहीं' : 'No notifications'}
                  </div>
                )}

                {overdueLoans.length > 0 && (
                  <DropdownMenuItem onClick={() => navigate('/loan-register')} className="flex-col items-start gap-1 py-3">
                    <div className="flex items-center gap-2 text-destructive font-medium">
                      <Landmark className="h-4 w-4 shrink-0" />
                      {language === 'hi' ? `${overdueLoans.length} अतिदेय ऋण` : `${overdueLoans.length} Overdue Loan${overdueLoans.length > 1 ? 's' : ''}`}
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {language === 'hi' ? 'ऋण रजिस्टर में देखें' : 'Review in Loan Register'}
                    </p>
                  </DropdownMenuItem>
                )}

                {pendingObjections.length > 0 && (
                  <DropdownMenuItem onClick={() => navigate('/audit-register')} className="flex-col items-start gap-1 py-3">
                    <div className="flex items-center gap-2 text-amber-600 font-medium">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      {language === 'hi' ? `${pendingObjections.length} लंबित ऑडिट आपत्तियां` : `${pendingObjections.length} Pending Audit Objection${pendingObjections.length > 1 ? 's' : ''}`}
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {language === 'hi' ? 'ऑडिट रजिस्टर में देखें' : 'Review in Audit Register'}
                    </p>
                  </DropdownMenuItem>
                )}

                {cancelledVouchers.length > 0 && (
                  <DropdownMenuItem onClick={() => navigate('/vouchers')} className="flex-col items-start gap-1 py-3">
                    <div className="flex items-center gap-2 text-muted-foreground font-medium">
                      <XCircle className="h-4 w-4 shrink-0" />
                      {language === 'hi' ? `${cancelledVouchers.length} रद्द वाउचर` : `${cancelledVouchers.length} Cancelled Voucher${cancelledVouchers.length > 1 ? 's' : ''}`}
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {language === 'hi' ? 'वाउचर सूची में देखें' : 'View in Vouchers list'}
                    </p>
                  </DropdownMenuItem>
                )}

                {complianceAlerts.length > 0 && (
                  <DropdownMenuItem onClick={() => navigate('/compliance-calendar')} className="flex-col items-start gap-1 py-3">
                    <div className="flex items-center gap-2 text-orange-600 font-medium">
                      <CalendarClock className="h-4 w-4 shrink-0" />
                      {language === 'hi'
                        ? `${complianceAlerts.length} सांविधिक देय तिथियाँ`
                        : `${complianceAlerts.length} statutory deadline${complianceAlerts.length > 1 ? 's' : ''} due`}
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {complianceAlerts.slice(0, 3).map(a => a.title).join(', ')}{complianceAlerts.length > 3 ? '…' : ''} — {language === 'hi' ? 'अनुपालन कैलेंडर' : 'Compliance Calendar'}
                    </p>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Contextual help — opens this screen's how-to (or the hub) in a new tab,
                so the user keeps their place in the app. Highlighted when a match exists. */}
            <Button
              variant="ghost" size="icon"
              className={cn('hidden sm:flex relative', ctxHelp && 'text-primary')}
              title={ctxHelp ? `कैसे करें: ${ctxHelp.title}` : (language === 'hi' ? 'मदद केंद्र' : 'Help Center')}
              onClick={() => window.open(ctxHelp ? `/help/${ctxHelp.slug}` : '/help', '_blank', 'noopener')}
            >
              <HelpCircle className="h-5 w-5" />
              {ctxHelp && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />}
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-2 pr-1 md:pr-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {user ? getInitials(user.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium">{user?.name}</span>
                    <Badge variant={getRoleBadgeVariant(user?.role || '')} className="text-[10px] px-1.5 py-0">
                      {user?.role ? t(user.role) : ''}
                    </Badge>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>
                  <User className="h-4 w-4 mr-2" />
                  {language === 'hi' ? 'प्रोफ़ाइल' : 'Profile'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/society-setup')}>
                  <Settings className="h-4 w-4 mr-2" />
                  {t('settings')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMfaOpen(true)}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {language === 'hi' ? 'सुरक्षा (2FA)' : 'Security (2FA)'}
                  {user?.mfaEnabled && <Badge variant="outline" className="ml-auto text-[10px] px-1">ON</Badge>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => window.open('/help', '_blank', 'noopener')}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  {language === 'hi' ? 'सहायता' : 'Help'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  {language === 'hi' ? 'लॉगआउट' : 'Logout'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <MfaSetupDialog open={mfaOpen} onOpenChange={setMfaOpen} />
    </>
  );
};
