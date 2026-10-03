import React from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useData } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Browser-print button for report pages (audit: statements had PDF/Excel/CSV but no print).
 * The app chrome is already hidden in print (MainLayout `print:hidden`); the `@media print`
 * rules in index.css make tables repeat their header row on every sheet and avoid splitting rows.
 */
export const PrintButton: React.FC = () => {
  const { language } = useLanguage();
  return (
    <Button variant="outline" size="sm" className="gap-2 print:hidden" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />{language === 'hi' ? 'प्रिंट' : 'Print'}
    </Button>
  );
};

/** Society identity block — invisible on screen, printed at the top of the page. */
export const PrintHeader: React.FC = () => {
  const { society } = useData();
  const printedOn = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <div className="hidden print:block mb-3 border-b border-black pb-2 text-center">
      <div className="text-lg font-bold">{society.name}</div>
      <div className="text-xs">
        {society.registrationNo ? `Reg. No: ${society.registrationNo} | ` : ''}FY: {society.financialYear} | Printed on: {printedOn}
      </div>
    </div>
  );
};
