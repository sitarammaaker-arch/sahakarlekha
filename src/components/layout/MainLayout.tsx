import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import FeedbackFab from '@/components/FeedbackFab';
import ModuleGlossaryBar from '@/components/glossary/ModuleGlossaryBar';
import Breadcrumbs from './Breadcrumbs';
import NextSteps from './NextSteps';
import SubscriptionBanner from '@/components/SubscriptionBanner';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { fmtDate } from '@/lib/dateUtils';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  useKeyboardShortcuts(() => setShowShortcuts(p => !p));
  const { society } = useData();
  const { language } = useLanguage();
  const hi = language === 'hi';

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Printing any page prints the PAGE, not the app chrome (header / sidebar / breadcrumbs / next-steps
          used to print on every sheet — the header, being position:fixed, repeated on each page). */}
      <div className="print:hidden">
        <KeyboardShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />
        {/* Mobile overlay backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        <Header
          sidebarCollapsed={sidebarCollapsed}
          onMobileMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />
      </div>

      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300 print:pt-0 print:ml-0 print:min-h-0',
          // On mobile: no margin (sidebar is overlay)
          // On desktop: margin based on sidebar state
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        )}
      >
        {/* pb-24 keeps bottom content (Save buttons etc.) clear of the fixed FeedbackFab (bottom-5, ~3rem tall). */}
        <div className="p-4 md:p-6 pb-24 md:pb-24 print:p-0">
          {/* Print-only identity line — replaces the hidden header so a printout still says whose books it is. */}
          <div className="hidden print:block mb-3 pb-2 border-b text-xs">
            <span className="font-semibold text-sm">{(hi ? society.nameHi : society.name) || society.name}</span>
            {society.registrationNo && <> · {hi ? 'पंजी. सं.' : 'Reg. No'}: {society.registrationNo}</>}
            {society.financialYear && <> · FY: {society.financialYear}</>}
            {' · '}{hi ? 'छापा गया' : 'Printed'}: {fmtDate(new Date().toISOString().slice(0, 10))}
          </div>
          <div className="print:hidden">
            <SubscriptionBanner />
            <Breadcrumbs />
            <ModuleGlossaryBar />
          </div>
          {children}
          <div className="print:hidden"><NextSteps /></div>
        </div>
      </main>

      <FeedbackFab />
    </div>
  );
};
