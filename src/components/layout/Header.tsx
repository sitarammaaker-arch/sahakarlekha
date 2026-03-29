import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Languages, Bell, User, Settings, HelpCircle, Menu, LogOut, Search, Landmark, ShieldAlert, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlobalSearch } from '@/components/GlobalSearch';

interface HeaderProps {
  sidebarCollapsed: boolean;
  onMobileMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ sidebarCollapsed, onMobileMenuToggle }) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const { society, loans, auditObjections, vouchers } = useData();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  // Live notification data
  const overdueLoans = loans.filter(l => l.status === 'overdue');
  const pendingObjections = auditObjections.filter(o => o.status === 'pending');
  const cancelledVouchers = vouchers.filter(v => v.isDeleted);
  const totalNotifications = overdueLoans.length + pendingObjections.length + (cancelledVouchers.length > 0 ? 1 : 0);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(open => !open);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {language === 'hi' ? society.nameHi : society.name}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {language === 'hi' ? 'पंजीकरण संख्या' : 'Reg. No'}: {society.registrationNo} | {language === 'hi' ? 'वित्तीय वर्ष' : 'FY'}: {society.financialYear}
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
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
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setSearchOpen(true)}>
              <Search className="h-5 w-5" />
            </Button>

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
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Help */}
            <Button variant="ghost" size="icon">
              <HelpCircle className="h-5 w-5" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-2 pr-3">
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
                <DropdownMenuSeparator />
                <DropdownMenuItem>
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
    </>
  );
};
